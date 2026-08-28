import random
from database import get_connection

def simulate_recovery(event):
    """
    For 'executed' cases only: use recovery_probability as the literal chance
    of success. Returns (recovery_result, recovered_amount).
    """
    if event["action_status"] != "executed":
        return "not_attempted", 0.0

    roll = random.random()  # 0.0 to 1.0
    if roll <= event["recovery_probability"]:
        return "recovered", event["amount"]
    else:
        return "failed", 0.0


def run_simulation():
    conn = get_connection()
    cursor = conn.cursor()

    events = cursor.execute("SELECT * FROM events").fetchall()

    total_at_risk = 0.0
    total_recoverable = 0.0  # sum of amount for 'executed' cases only
    total_recovered = 0.0

    for event in events:
        e = dict(event)
        result, recovered_amount = simulate_recovery(e)

        cursor.execute("""
            UPDATE events
            SET recovery_result = ?, recovered_amount = ?
            WHERE event_id = ?
        """, (result, recovered_amount, e["event_id"]))

        total_at_risk += e["amount"]
        if e["action_status"] == "executed":
            total_recoverable += e["amount"]
        total_recovered += recovered_amount

    conn.commit()
    conn.close()

    print(f"Simulation complete for {len(events)} events.")
    print(f"Total revenue at risk:        Rs.{total_at_risk:,.2f}")
    print(f"Revenue selected for recovery: Rs.{total_recoverable:,.2f}")
    print(f"Revenue successfully recovered: Rs.{total_recovered:,.2f}")
    if total_recoverable > 0:
        print(f"Recovery rate (of attempted):   {(total_recovered/total_recoverable)*100:.1f}%")


if __name__ == "__main__":
    run_simulation()