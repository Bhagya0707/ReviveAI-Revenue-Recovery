
from database import get_connection


def get_adaptive_strategy_performance():
    """
    Learn observed recovery performance from existing completed events.

    Returns success rates for each recovery action.
    Uses existing events only; does not modify the database.
    """
    conn = get_connection()

    rows = conn.execute("""
        SELECT
            recommended_action,
            COUNT(*) AS total,
            SUM(
                CASE
                    WHEN recovery_result = 'recovered'
                    THEN 1
                    ELSE 0
                END
            ) AS successful
        FROM events
        WHERE recommended_action IS NOT NULL
          AND recovery_result IN ('recovered', 'failed')
        GROUP BY recommended_action
    """).fetchall()

    conn.close()

    performance = {}

    for row in rows:
        total = row["total"]
        successful = row["successful"] or 0

        if total > 0:
            performance[row["recommended_action"]] = round(
                successful / total,
                2
            )

    return performance


def calculate_recovery_probability(event):
    """
    Returns a probability between 0 and 1 that this revenue is recoverable.
    Simple weighted formula - each factor nudges probability up or down.
    """
    score = 0.5  # baseline

    # Adaptive feedback from historical recovery outcomes
    adaptive_performance = get_adaptive_strategy_performance()

    # Previous payment behavior is the strongest signal
    score += (event["previous_success_rate"] - 0.5) * 0.4

    # More retries already attempted = lower remaining probability
    score -= event["retry_count"] * 0.08

    # The longer it's been, the colder the lead
    if event["days_since_last_payment"] > 60:
        score -= 0.15
    elif event["days_since_last_payment"] > 30:
        score -= 0.08

    # High-value customers tend to be more recoverable
    if event["customer_lifetime_value"] > 100000:
        score += 0.1
    elif event["customer_lifetime_value"] < 5000:
        score -= 0.05

    # Certain failure reasons are inherently more/less recoverable
    temporary_reasons = [
        "network_timeout",
        "otp_failed",
        "session_timeout"
    ]

    hard_reasons = [
        "disputed_amount",
        "mandate_revoked",
        "no_response"
    ]

    if event["failure_reason"] in temporary_reasons:
        score += 0.15
    elif event["failure_reason"] in hard_reasons:
        score -= 0.2

    # Small bounded adaptive adjustment
    # Historical strategy performance influences the score,
    # but never dominates the original scoring rules.
    action = event.get("recommended_action")

    if action in adaptive_performance:
        observed_rate = adaptive_performance[action]
        adaptive_adjustment = (observed_rate - 0.50) * 0.10
        score += adaptive_adjustment

    # Clamp between 0.05 and 0.97
    return round(max(0.05, min(0.97, score)), 2)


def calculate_risk_score(event):
    """
    Returns a 0-100 score representing how much this case matters.
    Based on amount, weighted slightly by customer lifetime value.
    """
    amount_component = min(event["amount"] / 750, 80)
    ltv_component = min(
        event["customer_lifetime_value"] / 10000,
        20
    )

    return round(amount_component + ltv_component, 1)


def calculate_priority(amount, recovery_probability):
    """
    Priority is based on EXPECTED RECOVERABLE VALUE = amount x probability.
    This is the number that should actually drive what gets worked first.
    """
    expected_value = amount * recovery_probability

    if expected_value >= 20000:
        return "HIGH"
    elif expected_value >= 5000:
        return "MEDIUM"
    else:
        return "LOW"


def score_all_events():
    conn = get_connection()
    cursor = conn.cursor()

    events = cursor.execute("SELECT * FROM events").fetchall()

    for event in events:
        event_dict = dict(event)

        recovery_probability = calculate_recovery_probability(event_dict)
        risk_score = calculate_risk_score(event_dict)
        priority = calculate_priority(
            event_dict["amount"],
            recovery_probability
        )

        cursor.execute("""
            UPDATE events
            SET recovery_probability = ?, risk_score = ?, priority = ?
            WHERE event_id = ?
        """, (
            recovery_probability,
            risk_score,
            priority,
            event_dict["event_id"]
        ))

    conn.commit()
    conn.close()

    print(f"Scored {len(events)} events.")


if __name__ == "__main__":
    score_all_events()

