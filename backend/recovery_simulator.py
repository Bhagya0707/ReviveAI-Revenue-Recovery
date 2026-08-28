import random
from database import get_connection


def get_strategy_multiplier(action):
    """
    Small strategy adjustment to reflect that different recovery
    interventions have different effectiveness.
    The AI's recovery_probability remains the main signal.
    """
    multipliers = {
        "retry_payment": 1.00,
        "suggest_alternate_method": 1.08,
        "send_reminder": 0.92,
        "escalate_to_human": 1.10,
        "stop_attempts": 0.00,
    }

    return multipliers.get(action, 1.00)


def simulate_recovery(event):
    """
    Simulate the outcome of the final action approved by guardrails.

    The AI recovery_probability is the base probability.
    The selected intervention slightly adjusts the probability
    to model different recovery strategies.
    """

    if event["action_status"] != "executed":
        return "not_attempted", 0.0, 0.0

    base_probability = event["recovery_probability"]
    action = event["recommended_action"]

    multiplier = get_strategy_multiplier(action)

    # Keep probability safely between 0 and 1.
    adjusted_probability = min(
        max(base_probability * multiplier, 0.0),
        1.0
    )

    roll = random.random()

    if roll <= adjusted_probability:
        return "recovered", event["amount"], adjusted_probability

    return "failed", 0.0, adjusted_probability


def run_simulation():
    conn = get_connection()
    cursor = conn.cursor()

    events = cursor.execute("SELECT * FROM events").fetchall()

    total_at_risk = 0.0
    total_recoverable = 0.0
    total_recovered = 0.0

    recovered_count = 0
    failed_count = 0
    not_attempted_count = 0

    action_stats = {}

    for event in events:
        e = dict(event)

        result, recovered_amount, adjusted_probability = simulate_recovery(e)

        cursor.execute(
            """
            UPDATE events
            SET recovery_result = ?, recovered_amount = ?
            WHERE event_id = ?
            """,
            (
                result,
                recovered_amount,
                e["event_id"]
            )
        )

        total_at_risk += e["amount"]

        if e["action_status"] == "executed":
            total_recoverable += e["amount"]

        total_recovered += recovered_amount

        # Outcome counters
        if result == "recovered":
            recovered_count += 1
        elif result == "failed":
            failed_count += 1
        else:
            not_attempted_count += 1

        # Strategy statistics
        action = e["recommended_action"]

        if action not in action_stats:
            action_stats[action] = {
                "cases": 0,
                "recovered": 0,
                "revenue_recovered": 0.0
            }

        action_stats[action]["cases"] += 1

        if result == "recovered":
            action_stats[action]["recovered"] += 1
            action_stats[action]["revenue_recovered"] += recovered_amount

    conn.commit()
    conn.close()

    recovery_rate = (
        total_recovered / total_recoverable * 100
        if total_recoverable > 0
        else 0
    )

    expected_recovery = sum(
        e["amount"] * e["recovery_probability"]
        for e in [dict(event) for event in events]
        if e["action_status"] == "executed"
    )

    print("\n========================================")
    print("       AI REVENUE RECOVERY RESULTS")
    print("========================================")

    print(f"\nCases processed:              {len(events)}")
    print(f"Total revenue at risk:        Rs.{total_at_risk:,.2f}")
    print(f"Revenue selected for recovery: Rs.{total_recoverable:,.2f}")
    print(f"Expected recovery value:      Rs.{expected_recovery:,.2f}")
    print(f"Revenue successfully recovered: Rs.{total_recovered:,.2f}")

    print(f"\nRecovery rate:                {recovery_rate:.1f}%")
    print(f"Successful recoveries:        {recovered_count}")
    print(f"Failed attempts:              {failed_count}")
    print(f"Not attempted:                {not_attempted_count}")

    print("\n----------------------------------------")
    print("RECOVERY STRATEGY BREAKDOWN")
    print("----------------------------------------")

    for action, stats in action_stats.items():
        success_rate = (
            stats["recovered"] / stats["cases"] * 100
            if stats["cases"] > 0
            else 0
        )

        print(f"\nAction: {action}")
        print(f"  Cases:              {stats['cases']}")
        print(f"  Recovered cases:    {stats['recovered']}")
        print(f"  Success rate:       {success_rate:.1f}%")
        print(
            f"  Revenue recovered:  "
            f"Rs.{stats['revenue_recovered']:,.2f}"
        )

    print("\n========================================")


if __name__ == "__main__":
    run_simulation()