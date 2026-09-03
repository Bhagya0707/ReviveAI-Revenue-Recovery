import os
import json
import time
from dotenv import load_dotenv
from google import genai
from database import get_connection
from scoring_engine import get_adaptive_strategy_performance

# ============================================================
# CONFIGURATION
# ============================================================

load_dotenv()

API_KEY = os.getenv("GOOGLE_API_KEY")

if not API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in .env file")

client = genai.Client(api_key=API_KEY)

# Confirmed working model for your account
MODEL_NAME = "gemini-3.5-flash-lite"


# ============================================================
# AI SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = """
You are a revenue recovery specialist AI for a payments company.

Your job is to analyze a revenue-at-risk event and recommend ONE
bounded recovery action.

Allowed actions ONLY:

1. "retry_payment"
   Use for temporary or technical payment failures where another
   automated attempt has a reasonable chance of success.

2. "suggest_alternate_method"
   Use when the current payment method is the likely problem and
   another payment method could improve recovery.

3. "send_reminder"
   Use for checkout abandonment, pending approvals, or overdue
   payments where a reminder could reasonably recover revenue.

4. "escalate_to_human"
   Use for high-value, disputed, repeatedly-failed, or complex
   cases that require human judgment.

5. "stop_attempts"
   Use when recovery is unlikely to be worthwhile, especially
   when recovery probability is very low or retry attempts are
   already exhausted.

IMPORTANT:
- Choose exactly ONE action.
- Do not invent new actions.
- Consider all case information.
- Do not blindly retry every failed payment.
- Give case-specific reasoning.
- Return ONLY valid JSON.
- Do NOT use markdown.
- Do NOT include ```json.

Return exactly this structure:

{
  "diagnosis": "one or two sentence explanation of why revenue is at risk",
  "recommended_action": "one allowed action",
  "reasoning": "one or two sentences explaining why this action fits the case",
  "confidence": 0.0
}
"""


# ============================================================
# BUILD CASE PROMPT
# ============================================================

def build_case_prompt(event):
    adaptive_performance = get_adaptive_strategy_performance()

    return f"""
Analyze the following revenue recovery case.

Case details:

Event ID:
{event['event_id']}

Event type:
{event['event_type']}

Amount:
Rs.{event['amount']}

Failure reason:
{event['failure_reason']}

Payment method:
{event['payment_method']}

Retry attempts so far:
{event['retry_count']}

Customer previous payment success rate:
{event['previous_success_rate']}

Customer lifetime value:
Rs.{event['customer_lifetime_value']}

Days since last successful payment:
{event['days_since_last_payment']}

Calculated recovery probability:
{event['recovery_probability']}

Priority:
{event['priority']}
Historical recovery strategy performance:

{json.dumps(adaptive_performance)}

Use this historical performance as an additional signal when choosing
the recommended action. Prefer strategies with stronger observed
recovery performance when they are otherwise appropriate for this case.
Do not ignore the case-specific information or the guardrails.
Based on all of the above:

1. Diagnose the reason revenue is at risk.
2. Select the single best bounded recovery action.
3. Explain why that action fits this specific case.
4. Give a confidence score between 0.0 and 1.0.

Return ONLY valid JSON.
"""


# ============================================================
# GET AI DECISION
# ============================================================

def get_ai_decision(event):

    prompt = SYSTEM_PROMPT + "\n\n" + build_case_prompt(event)

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt
    )

    raw_text = response.text.strip()

    # Remove accidental markdown fences
    raw_text = raw_text.replace("```json", "")
    raw_text = raw_text.replace("```", "")
    raw_text = raw_text.strip()

    try:
        decision = json.loads(raw_text)

    except json.JSONDecodeError:

        print(
            f"WARNING: Could not parse AI JSON for "
            f"{event['event_id']}"
        )

        print("AI response:")
        print(raw_text)

        return None

    # --------------------------------------------------------
    # Validate AI output
    # --------------------------------------------------------

    allowed_actions = {
        "retry_payment",
        "suggest_alternate_method",
        "send_reminder",
        "escalate_to_human",
        "stop_attempts"
    }

    action = decision.get("recommended_action")

    if action not in allowed_actions:

        print(
            f"WARNING: Invalid action '{action}' "
            f"for event {event['event_id']}"
        )

        return None

    # Ensure confidence exists
    confidence = decision.get("confidence", 0.0)

    try:
        confidence = float(confidence)
    except (ValueError, TypeError):
        confidence = 0.0

    # Keep confidence between 0 and 1
    confidence = max(0.0, min(1.0, confidence))

    decision["confidence"] = confidence

    return decision


# ============================================================
# PROCESS EVENTS
# ============================================================

def run_decisions(limit=100):

    conn = get_connection()
    cursor = conn.cursor()

    # IMPORTANT:
    # Only process events that do not already have an AI decision.
    events = cursor.execute(
        """
        SELECT *
        FROM events
        WHERE diagnosis IS NULL
        LIMIT ?
        """,
        (limit,)
    ).fetchall()

    total = len(events)

    print()
    print("=" * 60)
    print("AI REVENUE RECOVERY ENGINE")
    print("=" * 60)
    print(f"Model: {MODEL_NAME}")
    print(f"Remaining events: {total}")
    print("=" * 60)
    print()

    if total == 0:

        print("All events already have AI decisions.")
        conn.close()
        return

    successful = 0
    failed = 0

    for index, event in enumerate(events, start=1):

        event_dict = dict(event)

        print(
            f"[{index}/{total}] "
            f"Processing {event_dict['event_id']}..."
        )

        try:

            decision = get_ai_decision(event_dict)

            if decision is None:

                failed += 1

                print(
                    "  ERROR: AI response could not be processed."
                )
                print(
                    "  The event was NOT marked as completed."
                )
                print()

                continue

            # ------------------------------------------------
            # Save decision immediately
            # ------------------------------------------------

            cursor.execute(
                """
                UPDATE events
                SET
                    diagnosis = ?,
                    recommended_action = ?,
                    action_reasoning = ?
                WHERE event_id = ?
                """,
                (
                    decision["diagnosis"],
                    decision["recommended_action"],
                    decision["reasoning"],
                    event_dict["event_id"]
                )
            )

            # Commit after EVERY event.
            # This prevents losing progress.
            conn.commit()

            successful += 1

            print(
                f"  Action: "
                f"{decision['recommended_action']}"
            )

            print(
                f"  Diagnosis: "
                f"{decision['diagnosis']}"
            )

            print(
                f"  Reasoning: "
                f"{decision['reasoning']}"
            )

            print(
                f"  Confidence: "
                f"{decision['confidence']}"
            )

            print()

            # Small delay to reduce request pressure
            time.sleep(1)

        except Exception as e:

            failed += 1

            print(
                f"  ERROR processing event "
                f"{event_dict['event_id']}: {e}"
            )

            print(
                "  The event was NOT marked as completed."
            )

            print()

            # If quota is exceeded, stop rather than
            # hammering the API with more requests.
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):

                print("=" * 60)
                print("GEMINI QUOTA LIMIT REACHED")
                print("=" * 60)
                print(
                    "Stopping safely so no more requests are wasted."
                )
                print()
                print(
                    "Already completed events have been saved."
                )
                print(
                    "Run this script again after the quota resets."
                )
                print("=" * 60)

                break

    conn.close()

    print()
    print("=" * 60)
    print("AI DECISION PROCESS COMPLETE")
    print("=" * 60)
    print(f"Successfully processed: {successful}")
    print(f"Failed: {failed}")
    print("=" * 60)
    print()


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    run_decisions(limit=100)