# ReviveAI – AI Revenue Recovery

ReviveAI is an AI-powered revenue recovery system that detects revenue at risk, evaluates recovery opportunities, recommends the right intervention, and executes recovery actions within strict guardrails.

## 🎯 Problem

Businesses lose revenue because of failed payments, abandoned transactions, payment issues, and other recoverable cases.

The challenge is not simply identifying failed payments — it is deciding **which cases are worth recovering, what action should be taken, and when the AI should stop or escalate.**

## 💡 Solution

ReviveAI creates an intelligent recovery pipeline:

1. Detect revenue at risk
2. Calculate recovery risk and probability
3. Let AI recommend the best recovery action
4. Apply safety guardrails
5. Execute, stop, or escalate the action
6. Record every decision in an audit trail
7. Simulate and measure recovered revenue

## 🤖 Key Features

- AI-powered recovery decisions
- Revenue-at-risk scoring
- Recovery probability prediction
- Guardrail-based AI validation
- Automatic action execution from the dashboard
- Escalation for unsafe decisions
- Complete audit trail
- Hinglish customer outreach preview per case
- Recovery outcome simulation
- Dark-themed executive dashboard (React + TypeScript)

## 📊 ROI Snapshot

| Metric | Value |
| --- | --- |
| Revenue at risk detected | ₹35.90L |
| Revenue selected for recovery (guardrail-approved) | ₹9.80L |
| Revenue recovered | ₹5.20L |
| Recovery rate on attempted value | ~53% |
| Cases processed | 100 |
| Guardrail overrides | 43 |
| Audit log entries | 400+ |

Every recovered rupee is attributable: each case carries its AI diagnosis, the guardrail verdict, the outreach that was sent, and the execution outcome.

## 🏗️ System Architecture

```text
                        ┌──────────────────────────────┐
                        │  React + TS Dashboard (5173) │
                        │  KPI ribbon · Recovery queue │
                        │  Case inspector · Execute    │
                        └──────────────┬───────────────┘
                                       │ axios (JSON/HTTP)
                        ┌──────────────▼───────────────┐
                        │     FastAPI API (8000)       │
                        │  /api/summary  /api/events   │
                        │  /api/recovery/{id}/execute  │
                        └──────────────┬───────────────┘
                                       │
                        ┌──────────────▼───────────────┐
                        │       SQLite recovery.db     │
                        │      events · audit_log      │
                        └──────────────────────────────┘
```

Offline decision pipeline that populates the database:

```text
Payment Events (generate_data.py)
      ↓
Risk & Recovery Scoring (scoring_engine.py)
      ↓
AI Decision Engine — Gemini (ai_decision_engine.py)
      ↓
Guardrail Engine (guardrail_engine.py)
      ↓
Execute / Escalate / Stop
      ↓
Audit Trail (audit_trail.py)
      ↓
Recovery Simulation (recovery_simulator.py, strategy_simulator.py)
      ↓
Dashboard analytics
```

## 🛡️ Guardrail Rules

AI does not have unlimited control. Every AI recommendation passes through deterministic rules in `backend/guardrail_engine.py`:

| # | Rule | Condition | Verdict |
| --- | --- | --- | --- |
| 1 | Hard stop floor | `recovery_probability < 0.08` | `stopped` (override unless AI already chose `stop_attempts`) |
| 2 | Retry protection | AI says `retry_payment` and `retry_count >= 3` | `stopped` (override) |
| 3 | High value + uncertainty | `amount >= ₹40,000` and `recovery_probability < 0.5` | `escalated` (override unless AI already chose `escalate_to_human`) |
| 4 | Accepted decision | none of the above | AI action mapped to `executed` / `escalated` / `stopped` |

Allowed AI actions: `retry_payment`, `suggest_alternate_method`, `send_reminder`, `escalate_to_human`, `stop_attempts`. Anything else is rejected.

Only cases whose final status is `executed` can be run from the dashboard; `escalated` and `stopped` cases return HTTP 409.

## 🔌 API Documentation

Base URL: `http://localhost:8000`

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Health check |
| `GET` | `/api/summary` | Portfolio KPIs: at-risk, recoverable, recovered, recovery rate, status/priority/failure-reason breakdowns |
| `GET` | `/api/events` | Recovery queue, ordered by risk score. Optional `status` and `priority` query params |
| `GET` | `/api/events/{event_id}` | Case detail: event, full audit trail, Hinglish outreach preview |
| `POST` | `/api/recovery/{event_id}/execute` | Runs the guardrail-approved recovery action, updates `recovery_result` / `recovered_amount`, appends `EXECUTION_STARTED`, `OUTREACH_SENT`, `EXECUTION_RESULT` to `audit_log` |
| `GET` | `/api/strategy-comparison` | Current vs optimized guardrail policy simulation |

`POST /api/recovery/{event_id}/execute` response:

```json
{
  "success": true,
  "event_id": "8a32ce9c",
  "recovery_result": "recovered",
  "recovered_amount": 62648.1,
  "adjusted_probability": 0.71,
  "outreach": { "action": "send_reminder", "channel": "WhatsApp", "language": "Hinglish", "message": "..." },
  "event": { "...": "updated event row" },
  "audit_trail": [{ "log_id": 1, "step": "EXECUTION_STARTED", "detail": "..." }]
}
```

Errors: `404` unknown event, `409` case blocked by guardrails (`escalated` / `stopped`).

## 🚀 Running Locally

Backend (port 8000):

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API reads `recovery.db` from the backend directory. Override with `RECOVERY_DB_PATH=/path/to/other.db` — useful for experiments so the shipped database is never touched.

Frontend (port 5173):

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL` to point the dashboard at a non-local API (defaults to `http://localhost:8000`).

## ☁️ Deployment

- **Frontend → Vercel:** `frontend/vercel.json` (Vite framework preset, SPA rewrites). Set `VITE_API_URL` to the deployed API URL in the Vercel project settings.
- **Backend → Render / any container host:** `backend/Dockerfile` and `backend/render.yaml` (Docker web service, binds `$PORT`, health check on `/`). SQLite is bundled into the image, so mount a disk if the executed state must survive redeploys.

CORS on the API allows `http://localhost:5173` plus any HTTP(S) production origin.
