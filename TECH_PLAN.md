Good — let me give you a concrete plan you can execute on. I'll split this into architecture, work distribution, and a realistic demo strategy.

---

## What the App Actually Is (Demo Strategy First)

Before architecture, decide what the demo is. For a 24h hackathon judges watch for ~3 minutes per team. So:

**Don't build a real banking app.** Build a **demo harness** that visually represents the protection layer. It should look like a Bunq-style mobile screen, but the heart of it is the verification flows, not the banking UI.

**Recommended approach: a single-page web app that simulates a phone screen**, with a "Make Payment" button that lets the demo operator pick the risk tier. This lets you control the story precisely during the pitch.

### What's real vs. mocked

| Component | Real or mocked? |
|---|---|
| Bunq API | **Mocked.** Real Bunq sandbox auth burns hours and judges can't see the difference. Hardcode 3-4 fake transactions and a balance. |
| Risk scoring | **Mocked / scripted.** Demo operator picks the tier. Judges don't care about the embedding math; they care about what happens after the flag. |
| Hume API | **Real.** This is the core wow factor. Live mic input, real prosody scores. |
| Gemini Live | **Real.** Video feed, real environmental analysis. |
| Claude orchestration | **Real.** Real reasoning over the merged signals. |
| Compliance review screen | **Mocked dashboard.** A simple admin view that shows tickets being created. Looks impressive, takes 30 min to build. |

The demo magic comes from the user seeing the verification flow trigger and the AI actually responding to their voice/face in real time. Everything else is theater.

---

## Backend Architecture

### Language: Python (FastAPI)
Right call. FastAPI gives you async-first, WebSocket support, easy SDK integration with Hume/Gemini/Anthropic. No reason to use anything else.

### High-level architecture

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js or plain React + Tailwind)           │
│  - Phone-screen UI                                       │
│  - WebSocket connection for real-time verification      │
│  - Mic + camera capture                                 │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS + WebSocket
                     ▼
┌─────────────────────────────────────────────────────────┐
│  BACKEND (FastAPI, Python 3.11+)                        │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ /api/transaction/initiate                         │  │
│  │   - takes amount, merchant, mocked user_id       │  │
│  │   - calls risk_scorer                            │  │
│  │   - returns tier + verification_id               │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ /ws/verify/{verification_id}                      │  │
│  │   WebSocket — handles MID + HIGH risk flow       │  │
│  │   Streams audio/video to Hume + Gemini in        │  │
│  │   parallel, calls Claude to merge & decide       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ /api/admin/tickets                                │  │
│  │   - returns flagged transactions                 │  │
│  │   - powers the compliance dashboard              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  Modules:                                              │
│  • risk_scorer.py        — mock tier classifier       │
│  • hume_client.py        — Hume Expression Measurement│
│  • gemini_client.py      — Gemini Live video         │
│  • claude_orchestrator.py — final decision logic     │
│  • mock_bunq.py          — fake transaction store    │
│  • audit_log.py          — SQLite or in-memory       │
└─────────────────────────────────────────────────────────┘
```

### Storage
**Don't bother with a real database.** SQLite via SQLAlchemy, or just an in-memory dict if you're feeling fast and loose. Two tables:
- `transactions` — id, amount, merchant, tier, status, timestamp
- `audit_logs` — verification_id, transaction_id, hume_scores, gemini_summary, claude_decision, created_at

That's it. The audit log is what powers the "compliance dashboard" and it's also what you wave at the judges as "PSD3 evidence."

### How the verification flow runs (technically)

```python
# Pseudo-code for /ws/verify/{verification_id}

async def verification_websocket(websocket, verification_id):
    tx = get_transaction(verification_id)
    
    # Open connections in parallel
    hume_task = asyncio.create_task(stream_to_hume(websocket))
    
    if tx.tier == "HIGH_RISK":
        gemini_task = asyncio.create_task(stream_to_gemini(websocket))
    
    # Collect signals as they arrive
    hume_scores = await hume_task
    gemini_summary = await gemini_task if HIGH_RISK else None
    
    # Pass everything to Claude for final decision
    decision = await claude_decide(
        tier=tx.tier,
        hume_scores=hume_scores,
        gemini_summary=gemini_summary,
        merchant_reputation=check_merchant(tx.merchant),
        transaction=tx
    )
    
    # Log + respond
    save_audit_log(...)
    update_transaction_status(...)
    await websocket.send_json(decision)
```

The async parallelism is critical — if you sequence Hume → then Gemini → then Claude, the user waits 5 seconds between speaking and getting a verdict. If you parallelize, it's under 2.

---

## Work Distribution (4 people, 24 hours)

### Backend Engineer 1 — "Verification Pipeline"
Owns the AI integration layer. This is the hardest, most important work.

- Hour 0-3: Hume Expression Measurement integration. Get real-time prosody scores from a recorded clip, then from a WebSocket stream.
- Hour 3-6: Gemini Live video integration. Get the model to describe an environment from a video feed.
- Hour 6-10: Build the orchestrator — the WebSocket endpoint that streams audio + video, gets scores back, hands them to Claude.
- Hour 10-14: Claude decision logic — prompt engineering for the verdict given (tier, Hume scores, Gemini summary, merchant rep).
- Hour 14-18: Tuning and demo robustness. Make sure scores are interpretable and the flagged-vs-clean distinction is reliable.

### Backend Engineer 2 — "App Backbone"
Owns the FastAPI app structure, mocking, storage, admin dashboard backend.

- Hour 0-2: FastAPI scaffold, project structure, Docker if you want, otherwise just a venv.
- Hour 2-5: Mock Bunq transaction system — fake user, fake balance, fake history, transaction initiation endpoint.
- Hour 5-8: Risk scoring module (mockable + scriptable so the demo operator can force tiers).
- Hour 8-11: Audit log system + SQLite + the `/api/admin/tickets` endpoint.
- Hour 11-15: Merchant reputation check (mocked — hardcode a list of "good" and "sus" merchants).
- Hour 15-20: Integration with Eng 1's verification pipeline. Wire it all together. Test the full flow end-to-end.
- Hour 20-24: Bug fixing + demo recording as backup.

These two can work in parallel from hour 0. The integration point is the WebSocket endpoint contract — agree on that in hour 1 and don't break it.

### Frontend Engineer 1 — "User App"
Owns the phone-screen UI, the part judges look at most.

- Hour 0-3: Next.js + Tailwind scaffold, design a phone-frame layout (looks like a Bunq screen).
- Hour 3-7: Home screen with mock balance and transaction history. "Make Payment" button with merchant + amount entry.
- Hour 7-11: Verification screen — handles incoming WebSocket events, captures mic via `MediaRecorder`, captures camera via `getUserMedia`, streams to backend.
- Hour 11-15: Status states — "verifying...", "approved", "held for review", "frozen". Smooth transitions, clear visuals.
- Hour 15-20: Polish, animations, soft hold visualization.
- Hour 20-24: Help debug + record demo videos.

### Frontend Engineer 2 — "Compliance Dashboard"
Owns the admin/bank-side view. This is the secret weapon for the pitch — judges love seeing both sides.

- Hour 0-3: Separate Next.js page or just a different route. Simple table layout.
- Hour 3-7: Live ticket list — shows flagged transactions with risk tier badges, Hume scores, Gemini findings, Claude verdict.
- Hour 7-11: Audit log detail view — click a ticket, see the full evidence trail (timestamps, scores, transcripts).
- Hour 11-15: "Approve" / "Reject" buttons that update transaction status (mocked compliance officer).
- Hour 15-20: Visual polish — emotion score charts using Recharts, nice typography, looks like a real bank tool.
- Hour 20-24: Debug + demo.

This person can also help Frontend Eng 1 once their dashboard is solid (around hour 16+).

---

## Critical Coordination Points

**Hour 1 — API contract lock-in.** All four people in a room for 30 minutes. Agree on:
- The WebSocket message format
- The transaction object schema
- The audit log object schema

Document it in a shared file. Don't change it after hour 1 unless absolutely necessary.

**Hour 8 — First integration test.** Backend Eng 2 and Frontend Eng 1 should have working end-to-end NO_RISK flow by now. If you don't, replan.

**Hour 16 — Full integration.** All flows working end-to-end with real Hume + Gemini. If something is failing here, you cut it from the demo.

**Hour 20 — Demo freeze.** Stop building. Start practicing the pitch. Record a backup video in case live demo fails.

---

## Specific Tech Choices

**Hume:** Use the streaming WebSocket, not batch. The Python SDK handles this:
```python
from hume import AsyncHumeClient
```

**Gemini Live:** WebSocket via the `google-genai` SDK with `gemini-3.1-flash-live-preview`. Streams video frames + audio chunks, returns structured analysis.

**Claude:** `claude-sonnet-4-6` for orchestration. Use **structured outputs** — define a Pydantic model for the verdict and force JSON schema compliance. Don't parse free-form text.

**Frontend:** Next.js 15 with Tailwind. Use `react-webcam` for camera, native `MediaRecorder` for audio. WebSocket via native `WebSocket` API, no library needed.

**Don't use:** Auth0, Postgres, Docker (unless one of you really wants it), Redis, queues, microservices, or any kind of cloud deployment unless you've done it before. Run it all on localhost.

---

## The Three Demo Scenarios (Script These)

1. **NO_RISK happy path** (10 seconds) — small transaction, goes through silently, shows the system isn't intrusive.
2. **MID_RISK clean** (30 seconds) — €600 transaction, voice call, user speaks calmly, Hume returns clean scores, transaction approved. Show the compliance dashboard logging it.
3. **MID_RISK flagged** (45 seconds) — same transaction, user speaks under simulated stress, Hume flags it, soft hold engages, ticket opens in compliance dashboard.
4. **HIGH_RISK** (60 seconds) — €5,000 transaction, video + audio call, Gemini comments on environment, Hume on emotion, Claude makes the verdict. Show the dual-signal magic.

Don't try to demo all four. Pick the two that tell the cleanest story (probably 2 + 4) and rehearse them until they're seamless.

---

## What I'd Cut If Time Is Tight

If by hour 16 you're behind, drop in this order:
1. Compliance dashboard polish (keep it functional but ugly)
2. Soft hold visualization (just say "transaction held" in text)
3. Merchant reputation check (skip MID_RISK ambiguous branch)
4. HIGH_RISK video flow (keep voice only — Gemini Live is the hardest integration)

If you have to drop the video flow, the demo still works — you have the core "voice emotion catches coercion" story and that's enough to win.

Go fast. Don't overthink. Build the demo, not the product.