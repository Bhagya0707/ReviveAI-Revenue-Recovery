"""Hinglish customer outreach copy for each recovery action."""

ACTION_TEMPLATES = {
    "retry_payment": (
        "Hi {customer}, aapka {event_label} of Rs.{amount:,.0f} complete nahi ho paya "
        "({reason_label}). Hum ise abhi dobara try kar rahe hain - kuch karne ki zarurat nahi, "
        "bas apna {method_label} active rakhiye."
    ),
    "suggest_alternate_method": (
        "Hi {customer}, aapka payment of Rs.{amount:,.0f} {method_label} se fail ho gaya "
        "({reason_label}). Kya aap UPI ya koi dusra card try karenge? 30 second lagenge, "
        "link neeche hai."
    ),
    "send_reminder": (
        "Hi {customer}, gentle reminder - Rs.{amount:,.0f} ka {event_label} abhi pending hai "
        "({reason_label}). Jab time mile, ek click mein complete kar dijiye."
    ),
    "escalate_to_human": (
        "Hi {customer}, aapke Rs.{amount:,.0f} ke case ko humari recovery team dekh rahi hai. "
        "Ek executive aaj aapko call karega - koi automated retry nahi hoga."
    ),
    "stop_attempts": (
        "Hi {customer}, humne aapke Rs.{amount:,.0f} ke pending payment par aur attempts "
        "band kar diye hain. Zarurat ho to aap kabhi bhi khud complete kar sakte hain."
    ),
}

CHANNELS = {
    "retry_payment": "In-app + SMS",
    "suggest_alternate_method": "WhatsApp",
    "send_reminder": "WhatsApp",
    "escalate_to_human": "Human callback",
    "stop_attempts": "Email",
}

REASON_LABELS = {
    "insufficient_funds": "balance kam tha",
    "card_expired": "card expire ho gaya",
    "bank_declined": "bank ne decline kiya",
    "network_timeout": "network timeout hua",
    "otp_failed": "OTP verify nahi hua",
    "price_hesitation": "checkout adhoora reh gaya",
    "session_timeout": "session timeout ho gaya",
    "payment_form_error": "payment form mein error aaya",
    "mandate_revoked": "auto-pay mandate cancel ho gaya",
    "awaiting_approval": "approval pending hai",
    "budget_delay": "budget approval mein delay hai",
    "disputed_amount": "amount par query hai",
    "no_response": "koi response nahi mila",
    "unknown": "reason confirm nahi hua",
}

METHOD_LABELS = {
    "credit_card": "credit card",
    "debit_card": "debit card",
    "upi": "UPI",
    "netbanking": "netbanking",
    "wallet": "wallet",
}


def build_outreach(event):
    """Return the Hinglish outreach message planned for an event."""
    action = event.get("recommended_action") or "send_reminder"
    template = ACTION_TEMPLATES.get(action, ACTION_TEMPLATES["send_reminder"])

    message = template.format(
        customer=event.get("customer_id", "there"),
        amount=event.get("amount") or 0,
        event_label=(event.get("event_type") or "payment").replace("_", " "),
        reason_label=REASON_LABELS.get(event.get("failure_reason"), "payment issue"),
        method_label=METHOD_LABELS.get(event.get("payment_method"), "payment method"),
    )

    return {
        "action": action,
        "channel": CHANNELS.get(action, "WhatsApp"),
        "language": "Hinglish",
        "message": message,
    }
