import os
import hmac
import hashlib
import time
import requests

import razorpay
from dotenv import load_dotenv
from fastapi import Body, HTTPException, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import get_connection
from strategy_simulator import compare_strategies


app = FastAPI(title="AI Revenue Recovery API")
def supabase_headers():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        raise RuntimeError("Supabase credentials are missing")

    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def save_recovered_payment(event_id, customer_id, payment_id, order_id, amount):
    url = os.getenv("SUPABASE_URL")

    response = requests.post(
        f"{url}/rest/v1/recovered_payments",
        headers=supabase_headers(),
        json={
            "event_id": event_id,
            "customer_id": customer_id,
            "payment_id": payment_id,
            "order_id": order_id,
            "amount": amount,
            "status": "Recovered",
        },
        timeout=10,
    )

    if not response.ok:
        raise RuntimeError(
            f"Supabase save failed: {response.status_code} {response.text}"
        )


def get_recovered_payments_from_supabase():
    url = os.getenv("SUPABASE_URL")

    response = requests.get(
        f"{url}/rest/v1/recovered_payments",
        headers={
            **supabase_headers(),
            "Prefer": "return=representation",
        },
        params={
            "select": "event_id,customer_id,amount,payment_id,order_id,payment_date,status",
            "order": "payment_date.desc",
        },
        timeout=10,
    )

    if not response.ok:
        raise RuntimeError(
            f"Supabase fetch failed: {response.status_code} {response.text}"
        )

    return response.json()


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # fine for a hackathon demo
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# SUMMARY
# ============================================================

@app.get("/api/summary")
def get_summary():
    conn = get_connection()

    total_at_risk = (
        conn.execute(
            "SELECT SUM(amount) as total FROM events"
        ).fetchone()["total"]
        or 0
    )

    total_recoverable = (
        conn.execute(
            "SELECT SUM(amount) as total FROM events "
            "WHERE action_status = 'executed'"
        ).fetchone()["total"]
        or 0
    )

    total_recovered = (
        conn.execute(
            "SELECT SUM(recovered_amount) as total FROM events"
        ).fetchone()["total"]
        or 0
    )

    status_counts = conn.execute(
        "SELECT action_status, COUNT(*) as count "
        "FROM events GROUP BY action_status"
    ).fetchall()

    priority_counts = conn.execute(
        "SELECT priority, COUNT(*) as count "
        "FROM events GROUP BY priority"
    ).fetchall()

    reason_breakdown = conn.execute(
        "SELECT failure_reason, "
        "SUM(amount) as total_amount, "
        "COUNT(*) as count "
        "FROM events "
        "GROUP BY failure_reason "
        "ORDER BY total_amount DESC"
    ).fetchall()

    conn.close()

    recovery_rate = (
        total_recovered / total_recoverable * 100
        if total_recoverable > 0
        else 0
    )

    return {
        "total_at_risk": round(total_at_risk, 2),
        "total_recoverable": round(total_recoverable, 2),
        "total_recovered": round(total_recovered, 2),
        "recovery_rate": round(recovery_rate, 1),
        "status_breakdown": [dict(r) for r in status_counts],
        "priority_breakdown": [dict(r) for r in priority_counts],
        "failure_reason_breakdown": [dict(r) for r in reason_breakdown],
    }


# ============================================================
# EVENTS
# ============================================================

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


# ============================================================
# EVENT DETAIL + AUDIT TRAIL
# ============================================================

@app.get("/api/events/{event_id}")
def get_event_detail(event_id: str):
    conn = get_connection()

    event = conn.execute(
        "SELECT * FROM events WHERE event_id = ?",
        (event_id,)
    ).fetchone()

    if not event:
        conn.close()
        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    audit_trail = conn.execute(
        "SELECT * FROM audit_log "
        "WHERE event_id = ? "
        "ORDER BY timestamp",
        (event_id,)
    ).fetchall()

    conn.close()

    return {
        "event": dict(event),
        "audit_trail": [dict(a) for a in audit_trail],
    }


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "message": "AI Revenue Recovery API is running"
    }


# ============================================================
# STRATEGY COMPARISON
# ============================================================

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

    return razorpay.Client(
        auth=(key_id, key_secret)
    )


# ============================================================
# CREATE RAZORPAY ORDER
# ============================================================

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

        order = client.order.create(
            {
                "amount": amount_paise,
                "currency": "INR",
                "receipt": (
                    f"reviveai_{event_id}_{int(time.time())}"
                )[:40],
                "notes": {
                    "project": "ReviveAI",
                    "event_id": event_id,
                    "customer_id": customer_id or ""
                }
            }
        )

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


# ============================================================
# VERIFY RAZORPAY PAYMENT
# ============================================================

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

    # --------------------------------------------------------
    # Verify Razorpay signature
    # --------------------------------------------------------

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

        # ----------------------------------------------------
        # Payment validation
        # ----------------------------------------------------

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
                detail=(
                    f"Payment status is "
                    f"{payment.get('status')}"
                )
            )

        # ----------------------------------------------------
        # Record successful payment in existing audit_log
        # ----------------------------------------------------

        event_id = payload.get("event_id")
        customer_id = payload.get("customer_id")

        save_recovered_payment(
            event_id=event_id,
            customer_id=customer_id,
            payment_id=payment_id,
            order_id=order_id,
            amount=payment.get("amount", 0) / 100,
        )
        if event_id:
            conn = get_connection()

            conn.execute(
                """
                INSERT INTO audit_log
                (event_id, timestamp, step, detail)
                VALUES (?, ?, ?, ?)
                """,
                (
                    event_id,
                    time.strftime(
                        "%Y-%m-%dT%H:%M:%S"
                    ),
                    "razorpay_payment_recovered",
                    (
                        f"Payment ID: {payment_id} | "
                        f"Order ID: {order_id} | "
                        f"Amount: ₹"
                        f"{payment.get('amount', 0) / 100:.2f} | "
                        f"Status: captured"
                    )
                )
            )

            conn.commit()
                    # Update the recovery outcome for adaptive learning
        conn.execute(
            """
            UPDATE events
            SET
                recovery_result = 'recovered',
                recovered_amount = ?,
                action_status = 'executed'
            WHERE event_id = ?
            """,
            (
                payment.get("amount", 0) / 100,
                event_id
            )
        )

        conn.commit()
        conn.close()

        # ----------------------------------------------------
        # Successful response
        # ----------------------------------------------------

        return {
            "success": True,
            "message": (
                "Razorpay payment verified successfully"
            ),
            "payment_id": payment_id,
            "order_id": order_id,
            "status": payment.get("status")
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Payment verification failed: "
                f"{str(error)}"
            )
        )


# ============================================================
# RECOVERED RAZORPAY PAYMENTS
# ============================================================

@app.get("/api/recovered-payments")
def get_recovered_payments():
    conn = get_connection()

    rows = conn.execute(
        """
        SELECT
            a.event_id,
            e.customer_id,
            e.amount,
            e.timestamp AS recovery_case_date,
            a.timestamp AS payment_date,
            a.detail
        FROM audit_log a
        LEFT JOIN events e
            ON e.event_id = a.event_id
        WHERE a.step = 'razorpay_payment_recovered'
        ORDER BY a.timestamp DESC
        """
    ).fetchall()

    conn.close()

    payments = []

    for row in rows:
        detail = row["detail"] or ""

        payment_id = ""
        order_id = ""

        # Default to the original event amount.
        amount = row["amount"] or 0

        for part in detail.split(" | "):

            if part.startswith("Payment ID:"):
                payment_id = (
                    part
                    .replace("Payment ID:", "")
                    .strip()
                )

            elif part.startswith("Order ID:"):
                order_id = (
                    part
                    .replace("Order ID:", "")
                    .strip()
                )

            elif part.startswith("Amount:"):
                amount_text = (
                    part
                    .replace("Amount:", "")
                    .replace("₹", "")
                    .strip()
                )

                try:
                    amount = float(amount_text)
                except ValueError:
                    pass

        payments.append(
            {
                "event_id": row["event_id"],
                "customer_id": row["customer_id"],
                "amount": amount,
                "payment_id": payment_id,
                "order_id": order_id,
                "payment_date": row["payment_date"],
                "status": "recovered"
            }
        )

    return {
        "count": len(payments),
        "payments": payments
    }
