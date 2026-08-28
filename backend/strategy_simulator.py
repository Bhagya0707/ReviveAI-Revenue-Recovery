import random
from database import get_connection

def apply_guardrails_with_policy(event, max_retry, escalation_amount, escalation_ceiling, stop_floor):
    ai_action = event["recommended_action"]
    amount = event["amount"]
    retry_count = event["retry_count"]
    recovery_probability = event["recovery_probability"]

    if recovery_probability < stop_floor:
        return "stopped"
    if ai_action == "retry_payment" and retry_count >= max_retry:
        return "stopped"
    if amount >= escalation_amount and recovery_probability < escalation_ceiling:
        return "escalated"

    action_to_status = {
        "retry_payment": "executed",
        "suggest_alternate_method": "executed",
        "send_reminder": "executed",
        "escalate_to_human": "escalated",
        "stop_attempts": "stopped",
    }
    return action_to_status.get(ai_action, "executed")


def simulate_policy(events, policy, seed=42):
    """Run guardrails + recovery simulation for a given policy. Same seed = fair comparison."""
    random.seed(seed)
    total_recoverable = 0.0
    total_recovered = 0.0
    executed_count = 0
    escalated_count = 0
    stopped_count = 0

    for event in events:
        status = apply_guardrails_with_policy(
            event,
            policy["max_retry"],
            policy["escalation_amount"],
            policy["escalation_ceiling"],
            policy["stop_floor"],
        )

        if status == "executed":
            executed_count += 1
            total_recoverable += event["amount"]
            if random.random() <= event["recovery_probability"]:
                total_recovered += event["amount"]
        elif status == "escalated":
            escalated_count += 1
        else:
            stopped_count += 1

    return {
        "total_recoverable": round(total_recoverable, 2),
        "total_recovered": round(total_recovered, 2),
        "executed_count": executed_count,
        "escalated_count": escalated_count,
        "stopped_count": stopped_count,
    }


def compare_strategies():
    conn = get_connection()
    events = [dict(e) for e in conn.execute("SELECT * FROM events").fetchall()]
    conn.close()

    current_policy = {
        "max_retry": 3,
        "escalation_amount": 40000,
        "escalation_ceiling": 0.5,
        "stop_floor": 0.08,
    }

    # Optimized: escalate less aggressively (trust the AI/automation a bit more
    # on medium-value cases), but keep the same hard safety floor
    optimized_policy = {
        "max_retry": 3,
        "escalation_amount": 55000,   # only escalate the highest-value cases
        "escalation_ceiling": 0.35,   # only escalate if AI is quite unsure
        "stop_floor": 0.08,           # safety floor unchanged - non-negotiable
    }

    current_result = simulate_policy(events, current_policy)
    optimized_result = simulate_policy(events, optimized_policy)

    delta = optimized_result["total_recovered"] - current_result["total_recovered"]

    print("=== CURRENT POLICY ===")
    print(current_result)
    print("\n=== OPTIMIZED POLICY ===")
    print(optimized_result)
    print(f"\nPotential additional recovery: Rs.{delta:,.2f}")

    return {
        "current": current_result,
        "optimized": optimized_result,
        "additional_recovery": round(delta, 2),
    }


if __name__ == "__main__":
    compare_strategies()