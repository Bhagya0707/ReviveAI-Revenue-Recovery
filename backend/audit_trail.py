from database import get_connection
from datetime import datetime, timedelta


def build_audit_trail():
    conn = get_connection()
    cursor = conn.cursor()

    # Clear previous audit logs
    cursor.execute("DELETE FROM audit_log")

    # Get all events
    events = cursor.execute("SELECT * FROM events").fetchall()

    for event in events:
        e = dict(event)

        base_time = datetime.fromisoformat(e["timestamp"])

        # ==================================================
        # STEP 1: EVENT DETECTED
        # ==================================================
        cursor.execute("""
            INSERT INTO audit_log (event_id, timestamp, step, detail)
            VALUES (?, ?, ?, ?)
        """, (
            e["event_id"],
            base_time.isoformat(),
            "DETECTED",
            f"{e['event_type'].replace('_', ' ').title()} detected: "
            f"Rs.{e['amount']} ({e['failure_reason']})"
        ))

        # ==================================================
        # STEP 2: RISK & RECOVERY SCORED
        # ==================================================
        scored_time = base_time + timedelta(seconds=2)

        cursor.execute("""
            INSERT INTO audit_log (event_id, timestamp, step, detail)
            VALUES (?, ?, ?, ?)
        """, (
            e["event_id"],
            scored_time.isoformat(),
            "SCORED",
            f"Risk score: {e['risk_score']}, "
            f"Recovery probability: {e['recovery_probability']}, "
            f"Priority: {e['priority']}"
        ))

        # ==================================================
        # STEP 3: AI DIAGNOSIS
        # ==================================================
        diagnosed_time = base_time + timedelta(seconds=5)

        cursor.execute("""
            INSERT INTO audit_log (event_id, timestamp, step, detail)
            VALUES (?, ?, ?, ?)
        """, (
            e["event_id"],
            diagnosed_time.isoformat(),
            "AI_DIAGNOSED",
            f"{e['diagnosis']} | "
            f"Recommended: {e['recommended_action']} | "
            f"Reasoning: {e['action_reasoning']}"
        ))

        # ==================================================
        # STEP 4: GUARDRAIL VERDICT
        # ==================================================
        guardrail_time = base_time + timedelta(seconds=6)

        ai_action = e["recommended_action"]
        final_status = e["action_status"]
        guardrail_reason = e.get("guardrail_reason")

        expected_status = {
            "retry_payment": "executed",
            "suggest_alternate_method": "executed",
            "send_reminder": "executed",
            "escalate_to_human": "escalated",
            "stop_attempts": "stopped",
        }.get(ai_action, "executed")

        was_overridden = final_status != expected_status

        if was_overridden:
            verdict_detail = (
                f"OVERRIDDEN: AI recommended '{ai_action}' "
                f"but guardrails changed the decision to "
                f"'{final_status}'. "
                f"Reason: {guardrail_reason}"
            )
        else:
            verdict_detail = (
                f"APPROVED: AI recommended '{ai_action}' "
                f"and guardrails accepted the decision. "
                f"Reason: {guardrail_reason}"
            )

        cursor.execute("""
            INSERT INTO audit_log (event_id, timestamp, step, detail)
            VALUES (?, ?, ?, ?)
        """, (
            e["event_id"],
            guardrail_time.isoformat(),
            "GUARDRAIL_VERDICT",
            verdict_detail
        ))

    conn.commit()
    conn.close()

    print(
        f"Audit trail built for {len(events)} events "
        f"({len(events) * 4} log entries total)."
    )


if __name__ == "__main__":
    build_audit_trail()