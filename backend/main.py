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