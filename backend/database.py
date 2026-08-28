import sqlite3

DB_PATH = "recovery.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        customer_id TEXT,
        event_type TEXT,              -- payment_failed / checkout_abandoned / subscription_failed / invoice_overdue
        amount REAL,
        timestamp TEXT,
        failure_reason TEXT,
        payment_method TEXT,
        retry_count INTEGER,
        previous_success_rate REAL,
        customer_lifetime_value REAL,
        days_since_last_payment INTEGER,

        -- filled in by later steps (AI + scoring engine), NULL for now
        risk_score REAL,
        recovery_probability REAL,
        priority TEXT,
        diagnosis TEXT,
        recommended_action TEXT,
        action_reasoning TEXT,
        action_status TEXT,           -- pending / executed / escalated / stopped
        recovery_result TEXT,         -- recovered / failed / pending
        recovered_amount REAL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_log (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT,
        timestamp TEXT,
        step TEXT,
        detail TEXT
    )
    """)

    conn.commit()
    conn.close()
    print("Database initialized: recovery.db")

if __name__ == "__main__":
    init_db()