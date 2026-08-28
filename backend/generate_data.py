import sqlite3
import random
import uuid
from datetime import datetime, timedelta
from faker import Faker
from database import get_connection, init_db

fake = Faker()

EVENT_TYPES = ["payment_failed", "checkout_abandoned", "subscription_failed", "invoice_overdue"]

FAILURE_REASONS = {
    "payment_failed": ["insufficient_funds", "card_expired", "bank_declined", "network_timeout", "otp_failed"],
    "checkout_abandoned": ["price_hesitation", "session_timeout", "payment_form_error", "unknown"],
    "subscription_failed": ["card_expired", "insufficient_funds", "mandate_revoked", "bank_declined"],
    "invoice_overdue": ["awaiting_approval", "budget_delay", "disputed_amount", "no_response"],
}

PAYMENT_METHODS = ["credit_card", "debit_card", "upi", "netbanking", "wallet"]

def generate_event():
    event_type = random.choice(EVENT_TYPES)
    amount = round(random.uniform(299, 75000), 2)
    retry_count = random.randint(0, 4)
    previous_success_rate = round(random.uniform(0, 1), 2)
    customer_lifetime_value = round(random.uniform(500, 200000), 2)
    days_since_last_payment = random.randint(0, 90)
    timestamp = (datetime.now() - timedelta(hours=random.randint(0, 240))).isoformat()

    return {
        "event_id": str(uuid.uuid4())[:8],
        "customer_id": f"CUST{random.randint(1000,9999)}",
        "event_type": event_type,
        "amount": amount,
        "timestamp": timestamp,
        "failure_reason": random.choice(FAILURE_REASONS[event_type]),
        "payment_method": random.choice(PAYMENT_METHODS),
        "retry_count": retry_count,
        "previous_success_rate": previous_success_rate,
        "customer_lifetime_value": customer_lifetime_value,
        "days_since_last_payment": days_since_last_payment,
        "risk_score": None,
        "recovery_probability": None,
        "priority": None,
        "diagnosis": None,
        "recommended_action": None,
        "action_reasoning": None,
        "action_status": "pending",
        "recovery_result": "pending",
        "recovered_amount": None,
    }

def generate_batch(n=100):
    init_db()
    conn = get_connection()
    cursor = conn.cursor()

    for _ in range(n):
        e = generate_event()
        cursor.execute("""
            INSERT INTO events (
                event_id, customer_id, event_type, amount, timestamp,
                failure_reason, payment_method, retry_count, previous_success_rate,
                customer_lifetime_value, days_since_last_payment,
                risk_score, recovery_probability, priority, diagnosis,
                recommended_action, action_reasoning, action_status,
                recovery_result, recovered_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            e["event_id"], e["customer_id"], e["event_type"], e["amount"], e["timestamp"],
            e["failure_reason"], e["payment_method"], e["retry_count"], e["previous_success_rate"],
            e["customer_lifetime_value"], e["days_since_last_payment"],
            e["risk_score"], e["recovery_probability"], e["priority"], e["diagnosis"],
            e["recommended_action"], e["action_reasoning"], e["action_status"],
            e["recovery_result"], e["recovered_amount"]
        ))

    conn.commit()
    conn.close()
    print(f"Inserted {n} synthetic revenue-at-risk events into recovery.db")

if __name__ == "__main__":
    generate_batch(100)