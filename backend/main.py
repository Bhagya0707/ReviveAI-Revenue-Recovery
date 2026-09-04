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


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="AI Revenue Recovery API",
    version="1.0.0"
)


# ============================================================
# SUPABASE
# ============================================================

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


def save_recovered_payment(
    event_id,
    customer_id,
    payment_id,
    order_id,
    amount
):
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
            f"Supabase save failed: "
            f"{response.status_code} {response.text}"
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
            "select": (
                "event_id,"
                "customer_id,"
                "amount,"
                "payment_id,"
                "order_id,"
                "payment_date,"
                "status"
            ),
            "order": "payment_date.desc",
        },
        timeout=10,
    )

    if not response.ok:
        raise RuntimeError(
            f"Supabase fetch failed: "
            f"{response.status_code} {response.text}"
        )

    return response.json()


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
        "status_breakdown": [
            dict(r) for r in status_counts
        ],
        "priority_breakdown": [
            dict(r) for r in priority_counts
        ],
        "failure_reason_breakdown": [
            dict(r) for r in reason_breakdown
        ],
    }


# ============================================================
# EVENTS
# ============================================================

@app.get("/api/events")
def get_events(
    status: str = None,
    priority: str = None
):
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

    rows = conn.execute(
        query,
        params
    ).fetchall()

    conn.close()

    return [dict(r) for r in rows]


# ============================================================
# FINANCIAL SAFETY / AGENT AUTHORIZATION ENGINE
# ============================================================

# Only actions explicitly approved by the safety policy
# can be executed automatically.
ALLOWED_RECOVERY_ACTIONS = {
    "retry_payment",
    "send_reminder",
    "suggest_alternate_method",
    "alternate_method",
    "retry",
    "reminder",
}

# Maximum number of previous retries allowed for
# autonomous recovery.
MAX_AUTONOMOUS_RETRY_COUNT = 2

# Minimum AI recovery probability required for
# autonomous execution.
MIN_AUTONOMOUS_RECOVERY_PROBABILITY = 0.35

# Synthetic buildathon event protection limit.
# Events above this amount require human review.
MAX_AUTONOMOUS_RECOVERY_AMOUNT = 10000.00


def evaluate_recovery_policy(event):
    """
    Deterministic financial safety engine.

    The AI recommends an action.
    The policy engine independently decides
    whether that action is allowed.

    AI proposes.
    Policy authorizes.
    """

    checks = []

    event_id = event.get("event_id")
    customer_id = event.get("customer_id")

    try:
        retry_count = int(
            event.get("retry_count") or 0
        )
    except (TypeError, ValueError):
        retry_count = 999

    try:
        recovery_probability = float(
            event.get("recovery_probability") or 0
        )
    except (TypeError, ValueError):
        recovery_probability = 0

    try:
        amount = float(
            event.get("amount") or 0
        )
    except (TypeError, ValueError):
        amount = 0

    recommended_action = (
        event.get("recommended_action")
        or event.get("ai_recommendation")
        or event.get("action")
        or ""
    )

    normalized_action = (
        str(recommended_action)
        .strip()
        .lower()
        .replace(" ", "_")
        .replace("-", "_")
    )

    # --------------------------------------------------------
    # 1. EVENT IDENTITY
    # --------------------------------------------------------

    identity_valid = bool(event_id)

    checks.append({
        "name": "Event identity",
        "passed": identity_valid,
        "detail": (
            "Valid recovery event identified"
            if identity_valid
            else "Recovery event identity is missing"
        )
    })

    # --------------------------------------------------------
    # 2. CUSTOMER IDENTITY
    # --------------------------------------------------------

    customer_valid = bool(customer_id)

    checks.append({
        "name": "Customer identity",
        "passed": customer_valid,
        "detail": (
            "Customer identity available"
            if customer_valid
            else "Customer identity is missing — human review required"
        )
    })

    # --------------------------------------------------------
    # 3. RETRY PROTECTION
    # --------------------------------------------------------

    retry_safe = (
        retry_count <= MAX_AUTONOMOUS_RETRY_COUNT
    )

    checks.append({
        "name": "Retry protection",
        "passed": retry_safe,
        "detail": (
            f"Retry count {retry_count} is within policy limit"
            if retry_safe
            else (
                f"Retry count {retry_count} exceeds "
                f"autonomous limit"
            )
        )
    })

    # --------------------------------------------------------
    # 4. RECOVERY CONFIDENCE
    # --------------------------------------------------------

    confidence_safe = (
        recovery_probability >=
        MIN_AUTONOMOUS_RECOVERY_PROBABILITY
    )

    checks.append({
        "name": "Recovery confidence",
        "passed": confidence_safe,
        "detail": (
            f"Recovery probability "
            f"{recovery_probability * 100:.1f}% "
            f"meets minimum threshold"
            if confidence_safe
            else (
                f"Recovery probability "
                f"{recovery_probability * 100:.1f}% "
                f"is below autonomous threshold"
            )
        )
    })

    # --------------------------------------------------------
    # 5. FINANCIAL AMOUNT PROTECTION
    # --------------------------------------------------------

    amount_safe = (
        amount > 0
        and amount <= MAX_AUTONOMOUS_RECOVERY_AMOUNT
    )

    checks.append({
        "name": "Amount protection",
        "passed": amount_safe,
        "detail": (
            f"Amount ₹{amount:,.2f} is within "
            f"autonomous policy limit"
            if amount_safe
            else (
                f"Amount ₹{amount:,.2f} exceeds "
                f"autonomous limit — human review required"
            )
        )
    })

    # --------------------------------------------------------
    # 6. ACTION ALLOWLIST
    # --------------------------------------------------------

    action_safe = (
        normalized_action in ALLOWED_RECOVERY_ACTIONS
    )

    checks.append({
        "name": "Action allowlist",
        "passed": action_safe,
        "detail": (
            "AI-recommended recovery action is permitted"
            if action_safe
            else (
                f"Action '{recommended_action}' "
                f"is not permitted for autonomous execution"
            )
        )
    })

    # --------------------------------------------------------
    # 7. DUPLICATE RECOVERY PROTECTION
    # --------------------------------------------------------

    recovery_result = str(
        event.get("recovery_result") or ""
    ).strip().lower()

    already_recovered = (
        recovery_result == "recovered"
    )

    recovery_status_safe = not already_recovered

    checks.append({
        "name": "Duplicate recovery protection",
        "passed": recovery_status_safe,
        "detail": (
            "No previous successful recovery recorded"
            if recovery_status_safe
            else "Payment has already been recovered"
        )
    })

    # --------------------------------------------------------
    # 8. FINAL DECISION
    # --------------------------------------------------------

    failed_checks = [
        check
        for check in checks
        if not check["passed"]
    ]

    # These conditions are serious enough to completely
    # block autonomous recovery.
    hard_block = (
        not identity_valid
        or already_recovered
        or not action_safe
        or amount <= 0
    )

    if hard_block:
        verdict = "BLOCK RECOVERY"
        authorization = "blocked"

    elif len(failed_checks) == 0:
        verdict = "SAFE TO RECOVER"
        authorization = "auto_recover"

    else:
        verdict = "HUMAN REVIEW"
        authorization = "human_review"

    passed_count = (
        len(checks) - len(failed_checks)
    )

    return {
        "verdict": verdict,
        "authorization": authorization,
        "passed_checks": passed_count,
        "total_checks": len(checks),
        "checks": checks,
        "policy": {
            "max_retry_count":
                MAX_AUTONOMOUS_RETRY_COUNT,

            "min_recovery_probability":
                MIN_AUTONOMOUS_RECOVERY_PROBABILITY,

            "max_autonomous_amount":
                MAX_AUTONOMOUS_RECOVERY_AMOUNT,
        }
    }


# ============================================================
# RECOVERY POLICY ENDPOINT
#
# IMPORTANT:
# This endpoint MUST appear BEFORE:
# /api/events/{event_id}
#
# because the latter is a generic dynamic route.
# ============================================================

@app.get("/api/events/{event_id}/recovery-policy")
def get_recovery_policy(event_id: str):

    conn = get_connection()

    event = conn.execute(
        "SELECT * FROM events WHERE event_id = ?",
        (event_id,)
    ).fetchone()

    conn.close()

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    policy = evaluate_recovery_policy(
        dict(event)
    )

    return {
        "event_id": event_id,
        "policy": policy
    }


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
        "audit_trail": [
            dict(a) for a in audit_trail
        ],
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
# RAZORPAY TEST MODE
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

    # Safety requirement:
    # never allow production keys in this buildathon
    # test environment.
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
def create_razorpay_order(
    payload: dict = Body(...)
):

    event_id = payload.get("event_id")
    customer_id = payload.get("customer_id")

    if not event_id:
        raise HTTPException(
            status_code=400,
            detail="event_id is required"
        )

    # --------------------------------------------------------
    # LOAD EVENT
    # --------------------------------------------------------

    conn = get_connection()

    event = conn.execute(
        "SELECT * FROM events WHERE event_id = ?",
        (event_id,)
    ).fetchone()

    conn.close()

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Recovery event not found"
        )

    # --------------------------------------------------------
    # FINANCIAL SAFETY AUTHORIZATION
    # --------------------------------------------------------

    policy = evaluate_recovery_policy(
        dict(event)
    )

    if policy["authorization"] == "blocked":
        raise HTTPException(
            status_code=403,
            detail={
                "message": (
                    "Recovery blocked by "
                    "financial safety policy"
                ),
                "verdict": policy["verdict"],
                "policy": policy
            }
        )

    if policy["authorization"] == "human_review":
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    "Recovery requires "
                    "human review"
                ),
                "verdict": policy["verdict"],
                "policy": policy
            }
        )

    # --------------------------------------------------------
    # RAZORPAY ORDER CREATION
    # --------------------------------------------------------

    try:

        client = get_razorpay_client()

        # Safe fixed amount for Razorpay TEST MODE.
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
                    "customer_id": customer_id or "",
                    "agent": "ReviveAI",
                    "authorization": "auto_recover",
                    "policy": "financial_safety_engine"
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
            detail=(
                f"Razorpay order creation failed: "
                f"{str(error)}"
            )
        )


# ============================================================
# VERIFY RAZORPAY PAYMENT
# ============================================================

@app.post("/api/razorpay/verify-payment")
def verify_razorpay_payment(
    payload: dict = Body(...)
):

    payment_id = payload.get(
        "razorpay_payment_id"
    )

    order_id = payload.get(
        "razorpay_order_id"
    )

    signature = payload.get(
        "razorpay_signature"
    )

    if not payment_id or not order_id or not signature:
        raise HTTPException(
            status_code=400,
            detail="Payment verification data is incomplete"
        )

    key_secret = os.getenv(
        "RAZORPAY_KEY_SECRET"
    )

    if not key_secret:
        raise HTTPException(
            status_code=500,
            detail="Razorpay secret is missing"
        )

    # --------------------------------------------------------
    # VERIFY RAZORPAY SIGNATURE
    # --------------------------------------------------------

    message = (
        f"{order_id}|{payment_id}"
    )

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

    # --------------------------------------------------------
    # FETCH AND VALIDATE PAYMENT
    # --------------------------------------------------------

    try:

        client = get_razorpay_client()

        payment = client.payment.fetch(
            payment_id
        )

        if payment.get("order_id") != order_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Payment does not belong "
                    "to this order"
                )
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
        # PAYMENT INFORMATION
        # ----------------------------------------------------

        event_id = payload.get("event_id")
        customer_id = payload.get("customer_id")

        # ----------------------------------------------------
        # PERMANENT RECOVERY LEDGER
        # ----------------------------------------------------

        save_recovered_payment(
            event_id=event_id,
            customer_id=customer_id,
            payment_id=payment_id,
            order_id=order_id,
            amount=payment.get(
                "amount",
                0
            ) / 100,
        )

        # ----------------------------------------------------
        # EXISTING AUDIT TRAIL
        # ----------------------------------------------------

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

            # ------------------------------------------------
            # UPDATE RECOVERY OUTCOME
            # ------------------------------------------------

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
                    payment.get(
                        "amount",
                        0
                    ) / 100,
                    event_id
                )
            )

            conn.commit()
            conn.close()

        # ----------------------------------------------------
        # SUCCESS
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

    try:

        payments = (
            get_recovered_payments_from_supabase()
        )

        return {
            "count": len(payments),
            "payments": [
                {
                    "event_id": row.get(
                        "event_id"
                    ),
                    "customer_id": row.get(
                        "customer_id"
                    ),
                    "amount": float(
                        row.get("amount") or 0
                    ),
                    "payment_id": row.get(
                        "payment_id"
                    ),
                    "order_id": row.get(
                        "order_id"
                    ),
                    "payment_date": row.get(
                        "payment_date"
                    ),
                    "status": "recovered"
                }
                for row in payments
            ]
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to fetch recovered payments: "
                f"{str(error)}"
            )
        )