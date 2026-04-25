# bunqhack7 — AI-Powered Transaction Verification

Real-time biometric consent verification for high-risk bank transactions. When bunq detects a suspicious payment, the user is challenged with voice questions analyzed by Hume AI (emotion scoring), Gemini (video context), and Claude (final verdict). Every decision is logged in a tamper-evident audit trail.

Built at bunq Hackathon 7 · April 2026

---

## How it works

1. User initiates a transaction
2. An embedding-based risk classifier (Gemini + numpy) scores it against the user's behavioral history
3. **NO_RISK** → auto-approved, logged
4. **MID_RISK** → voice verification (2–3 questions, Hume emotion analysis)
5. **HIGH_RISK** → voice + live video verification (Hume + Gemini vision + Claude decides)
6. Claude renders a final verdict: APPROVED / HELD_FOR_REVIEW / FROZEN
7. Each outcome writes an audit log with confidence scores, transcripts, and Hume signals

Each browser session gets a fully isolated in-memory database — no state leaks between demo users.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | FastAPI + uvicorn + WebSockets |
| Risk scoring | Gemini Embedding + numpy (cosine similarity) |
| Emotion AI | Hume AI (voice prosody) |
| Vision AI | Gemini Flash (live video frames) |
| Verdict | Claude Sonnet (structured reasoning) |
| DB | SQLite in-memory (per session) |
| Hosting | Vercel (frontend) + Render (backend) |

---

## Local setup

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
cp .env.example .env   # fill in API keys
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
# optional: create frontend/.env.local with: VITE_API_BASE=http://localhost:8000
npm run dev
```

Open http://localhost:5173

---

## Environment variables

Set in `backend/.env` locally or in the Render dashboard for production:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `HUME_API_KEY` | Hume AI key |
| `GOOGLE_API_KEY` | Gemini API key |
| `MOCK_MODE` | `true` skips all AI calls and returns scripted responses |
| `PORT` | Server port (Render sets this automatically) |

The frontend needs `VITE_API_BASE` pointing at the backend URL — set this in Vercel's environment variables before the build runs.

---

## Deployment

**Backend → Render**
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Add `ANTHROPIC_API_KEY`, `HUME_API_KEY`, `GOOGLE_API_KEY` as env vars

**Frontend → Vercel**
- Root directory: `frontend`
- Add env var: `VITE_API_BASE=https://<your-render-service>.onrender.com`

---

## Demo scenarios

Use the control panel (right of the phone) to trigger scenarios:

| Button | Merchant | Tier |
|---|---|---|
| Grocery run | Albert Heijn | NO_RISK — auto-approved |
| Suspicious wire | FastWire | MID_RISK — voice challenge |
| Fraudulent transfer | Unknown LLP | HIGH_RISK — voice + video |

Add `?autopilot=true` to the URL for a hands-free cinematic presentation mode.
