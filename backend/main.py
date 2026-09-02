import os
import hmac
import hashlib
import time
import razorpay
from dotenv import load_dotenv
from fastapi import Body, HTTPException
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from database import get_connection
from strategy_simulator import compare_strategies

app = FastAPI(title="AI Revenue Recovery API")

# Allow the React frontend (running on a different port) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # fine for a hackathon demo; would be locked down in production
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/summary")
def get_summary():
    conn = get_connection()

    total_at_risk = conn.execute("SELECT SUM(amount) as total FROM events").fetchone()["total"] or 0
    total_recoverable = conn.execute(
        "SELECT SUM(amount) as total FROM events WHERE action_status = 'executed'"
    ).fetchone()["total"] or 0
    total_recovered = conn.execute(
        "SELECT SUM(recovered_amount) as total FROM events"
    ).fetchone()["total"] or 0

    status_counts = conn.execute(
        "SELECT action_status, COUNT(*) as count FROM events GROUP BY action_status"
    ).fetchall()

    priority_counts = conn.execute(
        "SELECT priority, COUNT(*) as count FROM events GROUP BY priority"
    ).fetchall()

    reason_breakdown = conn.execute(
        "SELECT failure_reason, SUM(amount) as total_amount, COUNT(*) as count FROM events GROUP BY failure_reason ORDER BY total_amount DESC"
    ).fetchall()

    conn.close()

    recovery_rate = (total_recovered / total_recoverable * 100) if total_recoverable > 0 else 0

    return {
        "total_at_risk": round(total_at_risk, 2),
        "total_recoverable": round(total_recoverable, 2),
        "total_recovered": round(total_recovered, 2),
        "recovery_rate": round(recovery_rate, 1),
        "status_breakdown": [dict(r) for r in status_counts],
        "priority_breakdown": [dict(r) for r in priority_counts],
        "failure_reason_breakdown": [dict(r) for r in reason_breakdown],
    }


@app.get("/api/events")
def get_events(status: str = None, priority: str = None):
    conn = get_connection()

    query = "SELECT * FROM events"
    conditions = []
    params = []

    if status:
        conditions.append("action_status = ?")
        params.append(status)
    if priority:
        conditions.append("priority = ?")
        params.append(priority)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY risk_score DESC"

    rows = conn.execute(query, params).fetchall()
    conn.close()

    return [dict(r) for r in rows]


@app.get("/api/events/{event_id}")
def get_event_detail(event_id: str):
    conn = get_connection()

    event = conn.execute("SELECT * FROM events WHERE event_id = ?", (event_id,)).fetchone()
    if not event:
        conn.close()
        raise HTTPException(status_code=404, detail="Event not found")

    audit_trail = conn.execute(
        "SELECT * FROM audit_log WHERE event_id = ? ORDER BY timestamp", (event_id,)
    ).fetchall()

    conn.close()

    return {
        "event": dict(event),
        "audit_trail": [dict(a) for a in audit_trail],
    }


@app.get("/")
def root():
    return {"message": "AI Revenue Recovery API is running"}
@app.get("/api/strategy-comparison")
def get_strategy_comparison():
    return compare_strategies()
# ============================================================
# RAZORPAY TEST MODE INTEGRATION
# ============================================================

load_dotenv()


def get_razorpay_client():
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")

    if not key_id or not key_secret:
        raise HTTPException(
            status_code=500,
            detail="Razorpay credentials are missing"
        )

    if not key_id.startswith("rzp_test_"):
        raise HTTPException(
            status_code=500,
            detail="Safety check failed: Test Mode key required"
        )

    return razorpay.Client(auth=(key_id, key_secret))


@app.post("/api/razorpay/create-order")
def create_razorpay_order(payload: dict = Body(...)):
    event_id = payload.get("event_id")
    customer_id = payload.get("customer_id")

    if not event_id:
        raise HTTPException(
            status_code=400,
            detail="event_id is required"
        )

    try:
        client = get_razorpay_client()

        # Fixed ₹100 amount for safe Razorpay TEST MODE integration.
        # The browser cannot choose the payment amount.
        amount_paise = 10000

        order = client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"reviveai_{event_id}_{int(time.time())}"[:40],
            "notes": {
                "project": "ReviveAI",
                "event_id": event_id,
                "customer_id": customer_id or ""
            }
        })

        return {
            "id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "status": order["status"]
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Razorpay order creation failed: {str(error)}"
        )


@app.post("/api/razorpay/verify-payment")
def verify_razorpay_payment(payload: dict = Body(...)):
    payment_id = payload.get("razorpay_payment_id")
    order_id = payload.get("razorpay_order_id")
    signature = payload.get("razorpay_signature")

    if not payment_id or not order_id or not signature:
        raise HTTPException(
            status_code=400,
            detail="Payment verification data is incomplete"
        )

    key_secret = os.getenv("RAZORPAY_KEY_SECRET")

    if not key_secret:
        raise HTTPException(
            status_code=500,
            detail="Razorpay secret is missing"
        )

    # Verify Razorpay signature
    message = f"{order_id}|{payment_id}"

    expected_signature = hmac.new(
        key_secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(
        expected_signature,
        signature
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid Razorpay payment signature"
        )

    try:
        client = get_razorpay_client()

        payment = client.payment.fetch(payment_id)

        if payment.get("order_id") != order_id:
            raise HTTPException(
                status_code=400,
                detail="Payment does not belong to this order"
            )

        if payment.get("amount") != 10000:
            raise HTTPException(
                status_code=400,
                detail="Payment amount mismatch"
            )

        if payment.get("currency") != "INR":
            raise HTTPException(
                status_code=400,
                detail="Payment currency mismatch"
            )

        if payment.get("status") != "captured":
            raise HTTPException(
                status_code=400,
                detail=f"Payment status is {payment.get('status')}"
            )

        return {
            "success": True,
            "message": "Razorpay payment verified successfully",
            "payment_id": payment_id,
            "order_id": order_id,
            "status": payment.get("status")
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Payment verification failed: {str(error)}"
        )