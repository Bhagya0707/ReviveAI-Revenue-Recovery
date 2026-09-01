from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from database import get_connection
from outreach import build_outreach
from recovery_simulator import simulate_recovery
from strategy_simulator import compare_strategies

app = FastAPI(title="AI Revenue Recovery API")

# Allow the React frontend (running on a different port) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"https?://.*",  # production frontends (Vercel previews etc.)
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

    event = dict(event)

    return {
        "event": event,
        "audit_trail": [dict(a) for a in audit_trail],
        "outreach": build_outreach(event),
    }


@app.post("/api/recovery/{event_id}/execute")
def execute_recovery(event_id: str):
    """Run the guardrail-approved recovery action and append the audit trail."""
    conn = get_connection()

    row = conn.execute("SELECT * FROM events WHERE event_id = ?", (event_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Event not found")

    event = dict(row)

    if event["action_status"] != "executed":
        conn.close()
        raise HTTPException(
            status_code=409,
            detail=(
                f"Guardrails marked this case as '{event['action_status']}'; "
                "only approved cases can be executed."
            ),
        )

    outreach = build_outreach(event)
    result, recovered_amount, adjusted_probability = simulate_recovery(event)
    now = datetime.now(timezone.utc).isoformat()

    logs = [
        (
            "EXECUTION_STARTED",
            f"Recovery workflow triggered from dashboard for action "
            f"'{event['recommended_action']}' (Rs.{event['amount']:,.2f} at risk).",
        ),
        (
            "OUTREACH_SENT",
            f"{outreach['language']} outreach dispatched via {outreach['channel']}: "
            f"{outreach['message']}",
        ),
        (
            "EXECUTION_RESULT",
            f"Outcome: {result} | Recovered: Rs.{recovered_amount:,.2f} | "
            f"Adjusted probability: {adjusted_probability:.2f}",
        ),
    ]

    for step, detail in logs:
        conn.execute(
            "INSERT INTO audit_log (event_id, timestamp, step, detail) VALUES (?, ?, ?, ?)",
            (event_id, now, step, detail),
        )

    conn.execute(
        "UPDATE events SET recovery_result = ?, recovered_amount = ? WHERE event_id = ?",
        (result, recovered_amount, event_id),
    )
    conn.commit()

    updated = dict(conn.execute("SELECT * FROM events WHERE event_id = ?", (event_id,)).fetchone())
    audit_trail = conn.execute(
        "SELECT * FROM audit_log WHERE event_id = ? ORDER BY log_id", (event_id,)
    ).fetchall()
    conn.close()

    return {
        "success": True,
        "event_id": event_id,
        "recovery_result": result,
        "recovered_amount": round(recovered_amount, 2),
        "adjusted_probability": round(adjusted_probability, 2),
        "outreach": outreach,
        "event": updated,
        "audit_trail": [dict(a) for a in audit_trail],
    }


@app.get("/")
def root():
    return {"message": "AI Revenue Recovery API is running"}


@app.get("/api/strategy-comparison")
def get_strategy_comparison():
    return compare_strategies()