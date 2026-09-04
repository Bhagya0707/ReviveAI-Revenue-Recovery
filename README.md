# ReviveAI – AI Revenue Recovery

An AI-powered revenue recovery agent that detects at-risk payments, recommends safe recovery actions, and executes controlled payment recovery workflows.


## Features

- Revenue-at-risk detection
- AI-powered recovery recommendations
- Recovery opportunity scoring
- Financial safety guardrails
- Human review for sensitive cases
- Controlled recovery execution
- Razorpay Test Mode integration
- Payment verification
- Persistent recovered-payment records
- Recovery audit trail
- Adaptive learning
- Recovery analytics dashboard


## Demo

Live Application:
https://reviveai-dashboard.onrender.com


## Tech Stack
Frontend: React, Vite, Recharts, Axios

Backend: Python, FastAPI, Uvicorn

AI: Google Gemini

Payments: Razorpay Test Mode

Database: SQLite, Supabase PostgreSQL

Deployment: GitHub, Render


## Installation
Clone the repository and install the required dependencies.

Backend:

cd backend
pip install -r requirements.txt

Frontend:

cd frontend
npm install
    
## Run Locally

Start the backend:

cd backend
uvicorn main:app --reload

The backend will run at:
http://127.0.0.1:8000

In a new terminal, start the frontend:

cd frontend
npm run dev

Open the local Vite URL shown in the terminal.


## Environment Variables

The application requires API credentials for Google Gemini, Razorpay, and Supabase.

Create a `.env` file in the backend directory and add:

GEMINI_API_KEY=your_gemini_api_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

Never commit real API keys or secret credentials to GitHub.


## Usage/Examples

Run the application locally and open the ReviveAI dashboard.

The dashboard allows you to:

- View revenue at risk
- Review AI recovery recommendations
- Check recovery opportunity scores
- View safety policy decisions
- Review recovery cases
- Execute eligible recovery payments
- Complete payments using Razorpay Test Mode
- View recovered payments
- Inspect audit information
- Monitor recovery performance

Example recovery flow:

Payment Risk → AI Recommendation → Safety Check → Recovery Action → Payment Verification → Recovered Payment

## Deployment


The application is deployed using Render.

Frontend:
https://reviveai-dashboard.onrender.com

Backend API:
https://reviveai-revenue-recovery.onrender.com

The frontend communicates with the deployed FastAPI backend, while Supabase
provides persistent storage for recovered payment records.

Razorpay is configured in Test Mode for the payment recovery demonstration.

## Repository

https://github.com/Bhagya0707/ReviveAI-Revenue-Recovery
## Hackathon

Built for the Razorpay Buildathon 2026.

Track 03 – AI Revenue Recovery

ReviveAI focuses on identifying revenue at risk, selecting the right recovery
intervention, validating it through financial safety guardrails, and executing
a controlled recovery workflow.

The project demonstrates how AI can help businesses recover lost revenue while
keeping financial actions safe, bounded, and auditable.
## License


This project was developed for the Razorpay Buildathon 2026 for demonstration and educational purposes.
## Authors


Bhagya Lakshmi Taddi
B.Tech – Computer Science and Engineering
