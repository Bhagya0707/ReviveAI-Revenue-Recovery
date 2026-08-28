from database import get_connection

# ---------------------------------------------------------
# GUARDRAIL POLICY
# ---------------------------------------------------------

MAX_RETRY_COUNT = 3

ESCALATION_AMOUNT_THRESHOLD = 40000

ESCALATION_PROBABILITY_CEILING = 0.5

HARD_STOP_PROBABILITY_FLOOR = 0.08


def apply_guardrails(event):
    """
    Takes the AI recommendation and applies deterministic
    safety/business rules.

    Returns:
        final_status
        guardrail_reason

    guardrail_reason is:
        None -> AI decision accepted
        text -> AI decision was overridden
    """

    ai_action = event["recommended_action"]
    amount = event["amount"]
    retry_count = event["retry_count"]
    recovery_probability = event["recovery_probability"]

    # -----------------------------------------------------
    # RULE 1 — Very low recovery probability
    # -----------------------------------------------------

    if recovery_probability < HARD_STOP_PROBABILITY_FLOOR:

        # If AI already wanted to stop, this is NOT an override.
        if ai_action == "stop_attempts":
            return "stopped", None

        return (
            "stopped",
            f"OVERRIDDEN: AI recommended '{ai_action}' "
            f"but recovery probability "
            f"{recovery_probability:.2f} is below the minimum "
            f"threshold of {HARD_STOP_PROBABILITY_FLOOR:.2f}."
        )

    # -----------------------------------------------------
    # RULE 2 — Maximum retry protection
    # -----------------------------------------------------

    if ai_action == "retry_payment" and retry_count >= MAX_RETRY_COUNT:

        return (
            "stopped",
            f"OVERRIDDEN: AI recommended 'retry_payment' "
            f"but retry count ({retry_count}) has reached "
            f"the maximum allowed limit of {MAX_RETRY_COUNT}."
        )

    # -----------------------------------------------------
    # RULE 3 — High-value + uncertain recovery
    # -----------------------------------------------------

    if (
        amount >= ESCALATION_AMOUNT_THRESHOLD
        and recovery_probability < ESCALATION_PROBABILITY_CEILING
    ):

        # AI already chose escalation.
        # Therefore, this is an accepted decision, NOT an override.
        if ai_action == "escalate_to_human":
            return "escalated", None

        return (
            "escalated",
            f"OVERRIDDEN: AI recommended '{ai_action}' "
            f"but this is a high-value case "
            f"(Rs.{amount:,.2f}) with uncertain recovery "
            f"probability {recovery_probability:.2f}; "
            f"human approval required."
        )

    # -----------------------------------------------------
    # RULE 4 — AI decision accepted
    # -----------------------------------------------------

    action_to_status = {
        "retry_payment": "executed",
        "suggest_alternate_method": "executed",
        "send_reminder": "executed",
        "escalate_to_human": "escalated",
        "stop_attempts": "stopped",
    }

    final_status = action_to_status.get(
        ai_action,
        "executed"
    )

    return final_status, None


def run_guardrails():

    conn = get_connection()
    cursor = conn.cursor()

    events = cursor.execute(
        "SELECT * FROM events"
    ).fetchall()

    override_count = 0
    accepted_count = 0

    for event in events:

        event_dict = dict(event)

        final_status, guardrail_reason = apply_guardrails(
            event_dict
        )

        # -------------------------------------------------
        # Save final decision + guardrail explanation
        # -------------------------------------------------

        cursor.execute(
            """
            UPDATE events
            SET
                action_status = ?,
                guardrail_reason = ?
            WHERE event_id = ?
            """,
            (
                final_status,
                guardrail_reason,
                event_dict["event_id"]
            )
        )

        # -------------------------------------------------
        # Track AI acceptance vs override
        # -------------------------------------------------

        if guardrail_reason:

            override_count += 1

            print(
                f"[OVERRIDE] "
                f"{event_dict['event_id']}: "
                f"AI said '{event_dict['recommended_action']}' "
                f"-> '{final_status}'"
            )

            print(
                f"   Reason: {guardrail_reason}\n"
            )

        else:

            accepted_count += 1

    conn.commit()
    conn.close()

    print(
        f"Guardrails applied to {len(events)} events."
    )

    print(
        f"AI decisions accepted: {accepted_count}"
    )

    print(
        f"AI decisions overridden: {override_count}"
    )


if __name__ == "__main__":
    run_guardrails()