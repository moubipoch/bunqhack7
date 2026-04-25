# FUTURE_AI_INTEGRATIONS.md

> Forward design for the real AI stack behind the bunqhack7 fraud-detection demo: Hume real-time emotion analysis, Gemini Live (or polled multimodal) environment detection, Claude Sonnet 4.6 orchestration with question generation, and embedding-based risk scoring.
>
> This is the spec to peel `MOCK_MODE` off layer by layer. Today the backend has working real-API code paths gated behind canned scenario presets. This document defines the architecture, system prompts, and concrete code that turns each stub into a real component.

> **Verified currency** (April 25, 2026): Gemini Embedding 2 (multimodal) confirmed GA 2026-04-22; Hume Expression Measurement Streaming confirmed alive in SDK v0.13.11 (released 2026-04-09); Gemini 3.1 Flash Live confirmed current Live model.

---

## 0. End-to-end pipeline (target state)

```
   ┌──────────────────────────────────────────────────────────────────┐
   │                       NEW TRANSACTION                            │
   └────────────────────────────┬─────────────────────────────────────┘
                                ▼
                 ┌────────────────────────────┐
                 │  Embedding-based risk      │  (Gemini Embedding 001)
                 │  scorer: n_emb + n_amt +   │  vs user history
                 │  p_merch  →  tier          │
                 └──────────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
   NO_RISK                  MID_RISK                HIGH_RISK
   (proceed,            (voice only)             (video + voice)
    audit only)              │                        │
                             ▼                        ▼
                ┌────────────────────────┐  ┌────────────────────────┐
                │ Claude generates Q1..Qn│  │ Claude generates Q1..Qn│
                │  using tx context      │  │ Gemini Live silent     │
                │ TTS speaks each Q      │  │  vision watches feed   │
                │ Hume Streaming scores  │  │ Hume Streaming scores  │
                │  each answer (per Q)   │  │  each answer (per Q)   │
                └───────────┬────────────┘  └───────────┬────────────┘
                            │                           │
                            ▼                           ▼
                  ┌──────────────────────────────────────────┐
                  │ Claude Sonnet 4.6 final verdict tool     │
                  │  inputs: per-Q transcripts + emotion     │
                  │  buckets + Gemini env reports + score    │
                  │  output: verdict + rationale + audit     │
                  └─────────────────────┬────────────────────┘
                                        ▼
                       APPROVED  /  HELD_FOR_REVIEW  /  FROZEN
                                  + signed PSD3 audit log
```

Three things this pipeline gets right that today's mock pipeline does not:

1. **Per-question emotion buckets**, not a single end-of-session score. Lets Claude reason about *which* answer was distressed.
2. **Live emission** — Hume bars animate during the call because Hume streams scores per utterance, and Gemini emits per-poll structured reports.
3. **Real risk score** — embeddings of the new transaction vs user history, combined with amount z-score and merchant reputation. The €250/€2000 thresholds are gone.

---

## 1. Hume — real-time voice emotion scoring per answer

### 1.1 SDK + endpoint

- **Package**: `hume` v0.13.11 on PyPI (released 2026-04-09). `pip install hume`. Python 3.9–3.13, all OSes incl. Windows. Streaming is bundled — the older `hume[stream]` extra is no longer required.
- **Three products under the same SDK** (verified 2026-04-25 against [the live sitemap](https://dev.hume.ai/sitemap.xml) and the [v0.13.11 release notes](https://github.com/HumeAI/hume-python-sdk/releases/tag/v0.13.11)):
  - **Expression Measurement** (analysis-only) — batch + streaming, models for prosody, vocal-burst, language, face. **Streaming is alive** at `/reference/expression-measurement-api/stream/models`. SDK module: `hume.expression_measurement.stream`. The streaming docs sit under "Expression Measurement → Quickstart / Models / Science / FAQ" with no separate "Streaming" tab — easy to miss but not deprecated.
  - **Speech-to-Speech (EVI 3)** — full conversational stack: built-in LLM, TTS, turn-taking, prosody scores embedded in `user_message` events. Custom Language Model hook lets you bring Claude (mirrors OpenAI chat-completions). v0.13.10 added `claude-opus-4-6` as a built-in LLM option; v0.13.11 added turn-detection and interruption configs.
  - **Octave TTS** — voice design, voice cloning, voice conversion, streaming endpoints.

**Decision: Expression Measurement Streaming, not EVI 3.**

Rationale:
- We already drive decisions with Claude Sonnet 4.6 via the Anthropic SDK. Wrapping it inside EVI's CLM constrains us to OpenAI-shape responses and adds a hop between FastAPI and Claude.
- Our flow is asymmetric — bank speaks scripted (Claude-generated) questions, user answers freely. EVI's strength is open-ended dialog, which we don't need.
- We want **deterministic Q→A→score buckets** for audit and replay. Controlling chunking ourselves gives clean per-question windows.
- The browser already ships PCM16 16 kHz mono. Wrapping each answer-window into a WAV header server-side is trivial.

EVI is the right pick only when we eventually want fully natural back-and-forth dialog with interruption handling — overkill for fraud verification.

### 1.2 Audio format

| Product | Accepted format |
|---|---|
| Expression Measurement Streaming | base64-encoded `.wav` / `.mp3` / `.mp4` / `.webm` chunks. **No raw PCM.** Wrap the browser's PCM16 into a WAV envelope server-side per turn. |
| EVI 3 | raw `linear16` PCM, sample rate + channels declared via a `session_settings` message; 16 kHz mono is supported. |

The browser already produces PCM16 16 kHz mono via `ScriptProcessorNode` (see `frontend/src/hooks/useAudioCapture.ts`). For Expression Measurement, we wrap each turn into a WAV server-side:

```python
import io, wave

def pcm16_to_wav(pcm: bytes, sr: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(pcm)
    return buf.getvalue()
```

### 1.3 Per-question architecture

One Hume socket **per question**. Predictions' `time.{begin,end}` are seconds **relative to the start of the audio sent on that socket** — because we open a fresh socket per question, every prediction is already in answer-local coordinates. No clock alignment needed.

```
For each question q in Q1..Qn:
  1. Claude (orchestrator) picks q.text  -> "What is this payment for?"
  2. TTS speaks q.text                   -> WAV streamed to client
  3. Browser plays WAV, then opens mic capture
  4. Server marks t_q_end = now()
  5. Server opens Hume Expression Measurement Streaming socket
  6. While answer in progress:
       - PCM chunks arrive from browser via WS
       - VAD (webrtcvad / silero) detects answer-end OR 12s timeout
       - On VAD-end: wrap accumulated PCM in WAV, send via Hume socket
       - Hume returns prosody.predictions[] with time + emotions
  7. Close Hume socket
  8. Aggregate scores into question bucket:
       summary[name] = weighted_mean(scores by utterance duration)
  9. Store EmotionBucket(question_id, transcript, summary, raw_48d)
 10. Pass bucket back to Claude as next-step context
```

### 1.4 Code sketch — `app/integrations/hume_stream.py`

```python
# requirements: hume>=0.13.11
import asyncio, io, os, wave
from hume import AsyncHumeClient
from hume.expression_measurement.stream.types import Config, StreamProsody

HUME = AsyncHumeClient(api_key=os.environ["HUME_API_KEY"])
PROSODY_CFG = Config(prosody=StreamProsody(granularity="utterance"))

def pcm16_to_wav(pcm: bytes, sr: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(pcm)
    return buf.getvalue()

async def score_answer(question_id: str, pcm_chunks: asyncio.Queue) -> dict:
    """One Hume socket per question. Returns aggregated emotion summary."""
    buckets: dict[str, list[tuple[float, float]]] = {}   # name -> [(score, dur)]
    async with HUME.expression_measurement.stream.connect(
        options={"config": PROSODY_CFG}
    ) as socket:
        while True:
            chunk = await pcm_chunks.get()
            if chunk is None:                       # sentinel from VAD = done
                break
            wav = pcm16_to_wav(chunk)
            event = await socket.send_file(io.BytesIO(wav))
            if not event.prosody or not event.prosody.predictions:
                continue
            for pred in event.prosody.predictions:
                dur = max(0.05, pred.time.end - pred.time.begin)
                for emo in pred.emotions:
                    buckets.setdefault(emo.name, []).append((emo.score, dur))

    def wmean(pairs):
        num = sum(s * d for s, d in pairs); den = sum(d for _, d in pairs)
        return num / den if den else 0.0

    summary = {name: wmean(pairs) for name, pairs in buckets.items()}
    return {
        "question_id": question_id,
        "calmness":  summary.get("Calmness", 0.0),
        "fear":      summary.get("Fear", 0.0),
        "distress":  summary.get("Distress", 0.0),
        "anxiety":   summary.get("Anxiety", 0.0),
        "raw":       summary,                       # full 48-dim for Claude
    }
```

### 1.5 Calibration trick — first-question baseline

Hume scores are **0–1 intensities, not probabilities**, and they are **not mutually exclusive** — a calm answer can have non-zero Fear. To make per-user thresholds meaningful, the **first question is always benign** (`"Please confirm your first name."`) and used as a baseline. Subsequent answers are scored as deltas from baseline.

```python
delta = lambda new, base: {k: max(0.0, new[k] - base[k]) for k in ("fear", "distress", "anxiety")}
```

The `verdict_hint` (CLEAN/AMBIGUOUS/FLAGGED) is then derived from deltas, not absolutes:

```python
def hint(d: dict) -> str:
    if d["fear"] > 0.5 or d["distress"] > 0.5: return "FLAGGED"
    if d["fear"] > 0.25 or d["anxiety"] > 0.4: return "AMBIGUOUS"
    return "CLEAN"
```

### 1.6 Persistence

```sql
CREATE TABLE emotion_bucket (
  id              TEXT PRIMARY KEY,
  verification_id TEXT NOT NULL,
  question_id     TEXT NOT NULL,
  question_text   TEXT NOT NULL,
  transcript      TEXT,                       -- from Whisper or browser STT
  calmness        REAL, fear REAL, distress REAL, anxiety REAL,
  raw_48d         TEXT,                       -- full Hume vector as JSON
  baseline_id     TEXT,                       -- pointer to baseline bucket
  recorded_at     TEXT NOT NULL
);
```

This is the audit gold. Every held/frozen ticket attaches the full per-question emotion trail. Compliance can replay any answer.

### 1.7 TTS choice

We need a voice for Claude's questions. Options:

| Option | Notes |
|---|---|
| **Browser `SpeechSynthesis`** | Free, instant, no server cost. Quality varies by OS. Recommended for the demo. |
| **Hume Octave** | Empathic, but our use case wants *neutral / authoritative*, not warm. Also pays Hume twice. |
| **ElevenLabs** | High quality, ~$0.30 per 1K chars, neutral voices available. Drop-in if browser TTS sounds amateur in the demo room. |

**Default: browser `SpeechSynthesis`. Fallback to ElevenLabs if voice quality matters at the live pitch.** Either way, TTS happens on the **frontend** so there's no audio round-trip — the backend only sends question text, the browser speaks it locally.

### 1.8 Open questions / risks (Hume)

- **`send_file` vs `send_bytes`** — the [official streaming example](https://github.com/HumeAI/hume-api-examples/blob/main/expression-measurement/streaming/python-streaming-example/main.py) uses `socket.send_file(file_bytes, config=Config(prosody=StreamProsody()))`. Confirmed against v0.13.11 source tree.
- **Per-chunk overhead** — Streaming is closer to "fast batch over a persistent socket" than truly continuous. Sending many small chunks may be less efficient than one well-formed WAV per VAD turn. We default to **one Hume call per question**.
- **Doc IA quirk** — there's no "Streaming" tab in the Expression Measurement nav; the WebSocket reference lives at `/reference/expression-measurement-api/stream/models` under the Quickstart group. Easy to miss, not deprecated.
- **Migration optionality** — if we eventually want bundled TTS + LLM in one pipe, EVI 3's `models.prosody.scores` in `user_message` events gives the same prosody data with the conversational stack on top. Out of scope for the hackathon.

---

## 2. Gemini Live — silent video environment detection

### 2.1 The user's three concerns, addressed

> *"Gemini Live is conversational — we don't want it to talk back."*
> *"Recording video gets analyzed too late — fraud could pass before we react."*
> *"Ideally Gemini Live with a prompt that makes it do exactly what we want, OR a different model."*

**Short answer**: Gemini Live *can* be coerced into silent structured-only mode using `response_modalities=[TEXT]` + function-calling-only system prompt + `gemini-3.1-flash-live-preview` (the half-cascade variant — native-audio variants currently reject TEXT modality). But there are real catches: (a) a **2-minute session cap on audio+video**, (b) turn-trigger semantics for video-only TEXT mode are not crisply documented, (c) the SDK has open bugs around TEXT mode on native-audio models.

**Recommendation: polled `gemini-3-flash` multimodal as primary, Gemini Live as a stretch goal.** Reasoning below.

### 2.2 Gemini Live current state (April 2026)

- **Model ID**: `gemini-3.1-flash-live-preview` is the current Live model. The earlier 2.5-flash-live and native-audio previews are deprecated; the latter is removed March 19, 2026.
- **Modalities**: text + images + audio + video in; text + audio out. Video input capped at **1 FPS** and counts as **258 tokens/sec**.
- **Output controls**: `response_modalities` accepts `["TEXT"]` *or* `["AUDIO"]` per session, **not both**. Only the half-cascade (`gemini-3.1-flash-live-preview`) accepts `["TEXT"]`. Native-audio models reject TEXT modality (open SDK issues with 1007 close codes).
- **Function calling**: Supported. `gemini-3.1-flash-live-preview` supports **sequential** calling. The Live API does not auto-handle responses — you must reply via `session.send_tool_response(function_responses=[...])`.
- **Session limits — the headline constraint**:
  - Audio-only: 15 min.
  - Audio + video: **2 min**.
  - Video-only: docs do not carve out a separate cap, so assume 2 min.
  - Single connection lifetime: ~10 min.
  - Workarounds: **context-window compression** (unlimited duration) and **session resumption** (handles valid 24h).
- **Cost**: ~258 tok/s × 600s × $0.75/M ≈ $0.12 input for a 10-min call, plus per-emission output.

### 2.3 Live vs polled multimodal

| Dimension | Live (`gemini-3.1-flash-live-preview`) | Polled (`gemini-3-flash` every 3s) |
|---|---|---|
| Detection latency | ~1–2 s when emission triggers cleanly | 3–5 s (poll interval + ~1s inference) |
| Session duration | **2-min cap with video** — needs resumption + compression | Unlimited, every poll independent |
| Code complexity | High: WebSocket, tool-call loop, resumption, manual turn triggers | Low — current `gemini_client.py` is 90% there |
| Failure recovery | Reconnect + replay | Next poll succeeds — trivially restartable |
| Fraud-signal coverage | Marginally faster reaction to acute events | Adequate — duress signals don't resolve in <3s |
| Maturity | Preview, several open SDK bugs around TEXT mode | GA, stable |

### 2.4 Recommended path: polled multimodal

A 3-second poll loop using `gemini-3-flash` (or whatever's the current GA Flash) with the existing `analyze_av()` shape. This is what `gemini_client.py` already does — wrong cadence, right idea.

```
Frontend (existing — Gemini already wired):
  every 3s, draw <video> frame to <canvas>, JPEG-encode, push to backend ring buffer

Backend ring buffer (per verification_id):
  deque of last 8 frames

Backend worker (every 3s while verification active):
  call analyze_av(buffer, audio_pcm=None) -> GeminiSummary
  emit ws message: {"type": "gemini_partial", "summary": {...}}

Orchestrator escalation rule:
  if confidence > 0.6 AND any duress_signal appears in 2 consecutive polls:
    flag for Claude + freeze the verification turn
```

The 2-poll debounce kills single-frame false positives (motion blur, momentary occlusion). The frontend already has a Gemini integration working — wire it into the WS as `client_gemini` events so the backend orchestrator gets real summaries instead of `mocks.GEMINI_DURESS`.

### 2.5 Gemini Live code sketch (stretch goal — for reference)

```python
from google import genai
from google.genai import types

MODEL = "gemini-3.1-flash-live-preview"

REPORT_TOOL = types.Tool(function_declarations=[types.FunctionDeclaration(
    name="report_environment",
    description="Report what you see. Call this every few seconds.",
    parameters={
        "type": "object",
        "properties": {
            "location_type": {"type": "string", "enum": [
                "home_indoor", "office", "public_outdoor",
                "public_unfamiliar", "vehicle", "unknown"]},
            "duress_signals": {"type": "array", "items": {"type": "string"}},
            "confidence": {"type": "number"},
            "raw_text": {"type": "string"},
        },
        "required": ["location_type", "duress_signals", "confidence"],
    },
)])

config = types.LiveConnectConfig(
    response_modalities=[types.Modality.TEXT],
    system_instruction=types.Content(parts=[types.Part(text=GEMINI_SYSTEM_PROMPT)]),
    tools=[REPORT_TOOL],
)

async def watch(frame_iter, on_report):
    client = genai.Client(api_key=settings.google_api_key)
    async with client.aio.live.connect(model=MODEL, config=config) as session:

        async def push_frames():
            async for jpeg in frame_iter:                       # ~1 FPS
                await session.send_realtime_input(
                    video=types.Blob(data=jpeg, mime_type="image/jpeg"))
                # Manual nudge — no audio VAD to trigger turns
                await session.send_client_content(turns=[types.Content(
                    role="user", parts=[types.Part(text="report now")])])

        async def consume():
            async for msg in session.receive():
                if msg.tool_call:
                    for fc in msg.tool_call.function_calls:
                        if fc.name == "report_environment":
                            await on_report(fc.args)
                        await session.send_tool_response(function_responses=[
                            types.FunctionResponse(
                                id=fc.id, name=fc.name, response={"ok": True})])

        await asyncio.gather(push_frames(), consume())
```

### 2.6 System prompt — Gemini (silent + structured only)

```
GEMINI_SYSTEM_PROMPT = """
You are a silent fraud-monitoring vision system observing a bank customer
during a video verification call. You do not speak. You do not greet.
You do not acknowledge. You do not produce conversational text.

Your ONLY permitted output is a call to the function `report_environment`.
Emit one call every 2-4 seconds, or immediately if a high-severity signal
appears (second person enters frame, hand gesture suggesting coercion,
phone/screen pointed at the user, abrupt camera movement, signs of struggle).

Never output free-form text. If you have nothing to report, still call
`report_environment` with confidence=0 and an empty duress_signals array.

Duress signals to watch for:
- second_person_visible, second_person_partial (shadow, hand, reflection)
- user_glances_offscreen, user_appears_distressed, partial_face_cover
- low_light, unfamiliar_location, vehicle_interior
- signs_of_struggle, restrained_posture
- screen_or_phone_pointed_at_user (someone coaching them)

Be conservative — false positives cost users money. Only flag a signal
when you can point to a specific visual cue.
"""
```

The same prompt works for the polled path (with a one-shot prompt instead of a Live system instruction).

### 2.7 Open questions / risks (Gemini)

- **Turn-trigger semantics for video-only TEXT mode are undocumented**. With no audio VAD, it's unclear when the model emits tool calls without a text nudge. Verify empirically before committing to Live.
- **2-minute video cap is real**. Bank verification calls *can* run longer. Need session resumption + context-window compression to bridge — non-trivial plumbing.
- **TEXT modality on native-audio Live models is broken** (1007 close codes). Stay on `gemini-3.1-flash-live-preview` (half-cascade); never switch to a native-audio variant.
- **Preview model** — schema and IDs may shift before GA. The deprecation of the 2.5 native-audio preview on March 19, 2026 shows churn is real.
- **Frontend may already be using Live**. If so, sending video to two Live sessions (frontend conversational + backend silent) doubles cost. Have the frontend forward frames to backend rather than open a second session.
- **`response_mime_type="application/json"`** (already in the polled code) is the simpler reliable path to structured output. Function calling shines when you need *streamed* structured events — exactly the Live use case, not the polled one.
- **GDPR/AVG**: continuous server-side video analysis during a banking call has real privacy implications. Out of scope for the design but worth flagging.

---

## 3. Claude Sonnet 4.6 — orchestrator + question generator

Claude does three jobs:

1. **Generate verification questions** tailored to the transaction (one tool call before the call begins).
2. **Decide next action after each answer** — keep asking, escalate, or release.
3. **Produce the final verdict** — same as today, but now with per-question emotion buckets and Gemini reports as input.

### 3.1 Question generation

Generated up front (before the call) so the frontend can pre-load TTS. 3–5 questions, the first one always benign (Hume baseline).

**Tool definition:**

```python
GENERATE_QUESTIONS_TOOL = {
    "name": "generate_questions",
    "description": "Generate 3-5 verification questions for a flagged bank transaction.",
    "input_schema": {
        "type": "object",
        "properties": {
            "questions": {
                "type": "array",
                "minItems": 3,
                "maxItems": 5,
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "description": "stable id, e.g. q1, q2"},
                        "text": {"type": "string", "description": "question to speak to the user"},
                        "purpose": {
                            "type": "string",
                            "enum": ["baseline", "intent", "context", "knowledge_check", "stress_probe"]
                        },
                        "expected_answer_shape": {
                            "type": "string",
                            "description": "One short clause describing what a coherent answer looks like."
                        }
                    },
                    "required": ["id", "text", "purpose", "expected_answer_shape"]
                }
            }
        },
        "required": ["questions"]
    }
}
```

**System prompt — question generation:**

```
CLAUDE_QGEN_SYSTEM = """
You are the verification-question planner for a bank's intent-verification system.
A transaction has been flagged for voice (and optionally video) verification.

You must generate 3-5 questions to ask the user. The questions are spoken
by a TTS system; the user's voice answers are scored for emotional state by
Hume. Your goal: design questions that distinguish a calm, willing user
from a coerced or scammed one.

Rules:
- The FIRST question MUST be benign and identity-confirming, used to
  baseline the user's voice. Examples: "Please confirm your first name." or
  "Could you say today's date?"
- Subsequent questions probe INTENT in three ways:
  (a) intent — "What is this payment for?"
  (b) context — "Who is the recipient and how did you find them?"
  (c) knowledge_check — small details only the rightful payer would know
      (e.g., "Is this part of a larger plan, or a one-off?")
- One question may be a stress_probe — designed to surface tension if the
  user is being coerced or scammed (e.g., "Is anyone with you right now
  who suggested this transaction?"). Use this only on HIGH_RISK.
- Questions must be conversational, under 18 words, and answerable in 1-2
  sentences. Avoid yes/no when possible.
- Tailor to the transaction. If the merchant is unfamiliar or the amount
  unusual, ask about it. Do NOT volunteer the bank's suspicion ("we noticed
  this is unusual") — keep questions neutral.

You MUST call the generate_questions tool. Do not respond with prose.
"""
```

**User payload:**

```python
{
    "tier": "MID_RISK",
    "transaction": {
        "amount_eur": 600.0,
        "merchant": "FastWire",
        "merchant_reputation": "BAD",
        "embedding_signals": {
            "n_emb": 0.81,        # very novel relative to user history
            "n_amt": 0.62,        # ~3x typical outflow
            "p_merch": 0.6        # unknown merchant
        }
    },
    "user_history_summary": "Recurring groceries (Albert Heijn, Jumbo), Spotify, monthly rent. No prior wire transfers."
}
```

### 3.2 Answer evaluation (per question)

After each Hume bucket arrives, Claude decides next-action. Tool: `evaluate_turn`.

```python
EVALUATE_TURN_TOOL = {
    "name": "evaluate_turn",
    "description": "After a user answers one verification question, decide the next move.",
    "input_schema": {
        "type": "object",
        "properties": {
            "next_action": {
                "type": "string",
                "enum": ["next_question", "escalate", "release", "ask_followup"]
            },
            "followup_text": {
                "type": "string",
                "description": "Required if next_action='ask_followup'. The dynamic followup question."
            },
            "running_assessment": {
                "type": "string",
                "description": "1-2 sentences of internal reasoning so far (for audit)."
            }
        },
        "required": ["next_action", "running_assessment"]
    }
}
```

**System prompt — turn evaluation:**

```
CLAUDE_TURN_SYSTEM = """
You are evaluating a live bank-fraud verification call, one answer at a time.

After every answer, you receive:
- The question that was asked (text + purpose).
- The user's transcript.
- Hume prosody scores (calmness, fear, distress, anxiety + 44 others) for
  this answer, AND for the baseline question (Q1). Reason about DELTAS,
  not absolute values.
- For HIGH_RISK calls: the latest Gemini environment report.
- The full transaction context.

Decide next_action:
- "next_question": continue with the planned questions. Default if nothing
  is alarming yet.
- "ask_followup": you suspect something but want one targeted clarification
  (e.g., user gave a vague "for someone" answer about recipient — ask who).
  Followup must be ONE sentence, neutral, under 15 words.
- "escalate": clear distress signal OR incoherent answer to a knowledge_check
  OR Gemini reports a duress signal with confidence > 0.6.
- "release": only if all planned questions are done AND no concern surfaced.

Bias toward continuing the call. Bias toward escalation over release if
the embedding novelty is high (n_emb > 0.7) — the upstream score already
says this is unusual.

Always include running_assessment so the audit log captures your reasoning.
"""
```

### 3.3 Final verdict

Same shape as today's `claude_client.decide`, but the user payload now includes per-question buckets:

```python
{
    "tier": "MID_RISK",
    "transaction": {...},
    "merchant_reputation": "BAD",
    "embedding_signals": {"n_emb": 0.81, "n_amt": 0.62, "p_merch": 0.6, "risk": 0.71},
    "questions": [
        {
            "id": "q1", "text": "Please confirm your first name.", "purpose": "baseline",
            "transcript": "My name is Lena.",
            "hume": {"calmness": 0.78, "fear": 0.04, "distress": 0.03, "anxiety": 0.06},
            "is_baseline": True
        },
        {
            "id": "q2", "text": "What is this 600 euro payment for?", "purpose": "intent",
            "transcript": "Um, it's for a friend, he asked me to send it.",
            "hume": {"calmness": 0.32, "fear": 0.41, "distress": 0.38, "anxiety": 0.55},
            "is_baseline": False,
            "delta_vs_baseline": {"fear": 0.37, "distress": 0.35, "anxiety": 0.49}
        },
        ...
    ],
    "gemini_reports": [...],   # HIGH_RISK only
}
```

The decision rubric in the existing `claude_client.SYSTEM_PROMPT` still applies but should explicitly reference deltas:

```
- MID_RISK + Hume CLEAN deltas across all questions → APPROVED
- MID_RISK + any answer with delta(distress) > 0.3 OR delta(fear) > 0.4 → HELD_FOR_REVIEW
- HIGH_RISK + any duress_signal with confidence > 0.6 in 2+ consecutive Gemini reports → FROZEN
- HIGH_RISK + Hume FLAGGED on intent question → FROZEN
- HIGH_RISK + Hume CLEAN + no Gemini duress → APPROVED
- Anything ambiguous → HELD_FOR_REVIEW (never APPROVED if signals are mixed on HIGH_RISK)
```

### 3.4 Prompt caching

System prompts are stable across every verification — mark them `cache_control: ephemeral` (already done in `claude_client.py:109`). Question generation and turn evaluation get separate cached system prompts.

---

## 4. Embedding-based risk scoring

Replace the amount-threshold rule with a real behavioral signal.

### 4.1 Embedding model

**Recommendation: `gemini-embedding-2` (Google), 768-dim Matryoshka truncation.**

`gemini-embedding-2` went **GA 2026-04-22** ([blog.google announcement](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-embedding-2-generally-available/)). It is Google's first **natively multimodal** embedding model — text + image + video + audio + PDF map into one shared 3072-dim vector space. Matryoshka truncation is supported (recommended outputs: 768, 1536, 3072).

| Model | Modalities | Dims | $/1M tok | Notes |
|---|---|---|---|---|
| **gemini-embedding-2** | text + image + video + audio + PDF, mixable in one call | 3072 (MRL → 768/1536/3072) | $0.20 ($0.10 batch) | **Default pick.** GA 2026-04-22. 8K text tokens per input. |
| gemini-embedding-001 | text only | 3072 (MRL) | $0.15 | Legacy. Fine if we want zero risk on a brand-new GA model. |
| voyage-3.5-lite | text only | 2048/1024/512/256 | $0.02 | Anthropic's recommended partner; cheaper, separate key. |
| text-embedding-3-large | text only | 3072 (truncatable) | $0.13 | No advantage for us. |
| jina-embeddings-v3 (local) | text only | 1024 | $0 | 570M params, CPU-runnable, multilingual MTEB ~65.5 — drop-in if zero-network desired. |

768-dim is plenty for <100 vectors per user; truncation is Matryoshka-safe.

**Migration warning**: the embedding spaces of `-001` and `-2` are **incompatible** — vectors cannot be mixed across the two models. If we start on one and switch, the entire history corpus must be re-embedded.

**Why pick `-2` even though we're text-only today**: same architecture family, marginally more expensive, but it puts the multimodal door on the latch. If we later want to embed merchant logos / receipt photos / voice memos *into the same space* as the transaction descriptors (see §4.8), no model swap needed.

### 4.2 Storage

**Plain SQLite + numpy in memory. Do NOT pull in `sqlite-vec`, FAISS, or Chroma.**

For <100 vectors per user, a linear scan through 100 × 768 floats is sub-millisecond. Native extensions on Windows demo machines are loader-path landmines we don't need.

```sql
CREATE TABLE tx_embedding (
  tx_id      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  amount     REAL NOT NULL,
  merchant   TEXT NOT NULL,
  category   TEXT,
  text_blob  TEXT NOT NULL,    -- the serialized sentence (debuggable)
  vector     BLOB NOT NULL     -- np.float32 .tobytes(), 768*4 = 3072 bytes
);
```

Load all of a user's vectors into a single `(N, 768)` numpy array on request; cosine via one matmul.

### 4.3 Tx → text serialization — semantic descriptor (NOT raw fields)

This is where v1 of this doc was wrong. Embedding models cluster on semantic similarity in their training distribution, and they **do not encode numerical magnitude well**. Putting `"38.20 EUR ... at 14:23"` into the embedding text turns precise numbers and clock times into noise — vectors drift without buying separation.

**Audit of what an embedding cluster actually picks up:**

| Field | Useful in the embedding? | Why |
|---|---|---|
| Merchant identity | **Yes** | Models know "Albert Heijn" ≈ "Jumbo" (Dutch supermarkets), and ≠ "Unknown LLP". Largest signal. |
| Category | **Yes** | "groceries" vs "wire transfer" produces large vector distance. |
| Counterparty type (known/unknown to user) | **Yes** | Phrased as text it embeds well. |
| Recurrence pattern (recurring weekly / one-off) | **Yes** | The model treats this as a categorical label. |
| Weekday vs weekend, business hours vs overnight | **Yes** as buckets | Categorical labels embed; raw `Tuesday 14:23` does not. |
| Raw amount (e.g. `38.20`) | **No** | Transformers tokenize digits poorly; magnitude ≠ semantic distance. Handled by `n_amt` z-score instead. |
| Raw HH:MM | **No** | Same reason. Handled by `n_time` histogram instead. |

**Design rule**: the embedding's job is to encode *what kind of transaction is this* (counterparty + category + pattern). Magnitude axes (amount, time) are scored by closed-form math separately and combined in the hybrid formula.

**Serialization template — semantic descriptor**:

```
{counterparty_kind}: {merchant_name}{counterparty_qualifier}.
Category: {category}.
Amount bucket: {amount_bucket}.
Timing: {weekday_class}, {hour_class}.
User history with this counterparty: {history_with_counterparty}.
User history in this category: {history_in_category}.
```

Where each placeholder is a small categorical vocabulary:

- `counterparty_kind` ∈ `domestic retail payment | domestic transfer | international wire transfer | subscription | cash withdrawal | refund | salary deposit`
- `counterparty_qualifier` ∈ `(known Dutch supermarket chain) | (Dutch public transport operator) | (no public reputation, unknown jurisdiction) | (recurring subscription provider) | …`
- `amount_bucket` ∈ `tiny (<€20) | small (€20–100) | medium (€100–500) | large (€500–2000) | very large (>€2000)`
- `weekday_class` ∈ `weekday | weekend`
- `hour_class` ∈ `business hours | evening | overnight`
- `history_with_counterparty` ∈ `none | first time | occasional (1–3 prior) | frequent (4+ prior, recurring weekly/monthly)`
- `history_in_category` ∈ `none | occasional | frequent`

**Two examples — known good vs suspicious:**

```
Good:
  Domestic retail payment: Albert Heijn (known Dutch supermarket chain).
  Category: groceries.
  Amount bucket: small.
  Timing: weekday, evening.
  User history with this counterparty: frequent (weekly recurring pattern).
  User history in this category: frequent.

Suspicious:
  International wire transfer: Unknown LLP (no public reputation, unknown jurisdiction).
  Category: wire transfer.
  Amount bucket: very large.
  Timing: weekday, overnight.
  User history with this counterparty: none.
  User history in this category: none.
```

These cluster *far apart* in embedding space because the descriptors are semantically dissimilar in ways the model is good at — **exactly what we want.** The Albert Heijn vector sits near the user's other supermarket-and-subscription history; the Unknown LLP vector sits near nothing in the user's corpus, so `n_emb` (= 1 − max cosine sim) shoots up.

**Why this serialization is robust:**

- One short paragraph, ~50–70 tokens, well under any limit.
- Everything is a categorical label or a known proper noun — both encoded reliably.
- No raw numbers or timestamps where they'd just be noise.
- Lossless human-readable — debuggable in `text_blob`.
- Same template used at scoring time (for the new tx) and at seed time (for history) — clusters are aligned.

**Building the descriptor:**

The placeholders are derived deterministically from the raw transaction record + a tiny lookup of merchant qualifiers (the existing `merchant_check.GOOD/BAD` set extended with descriptive blurbs). No LLM call needed — this is a 30-line `descriptor_for(tx, history)` function. If we later want richer qualifiers ("Spotify is a music subscription service"), Claude can pre-fill a per-merchant blurb table at startup; not on the hot path.

### 4.4 Risk score formula

**Hybrid: embedding + amount z-score + time-of-day novelty + merchant reputation.** Pure embedding distance is brittle on 5–30 historical points; pure z-score is the rule we're replacing; embeddings don't encode magnitude or clock time. Combine.

Four components, each normalized to [0, 1]:

1. **Embedding novelty `n_emb`** = `1 - mean(top-3 cos_sim(new, h_i) for h_i in history)`. Top-3 instead of top-1 dampens single-outlier sensitivity (one weird historical "test charge" shouldn't make a near-duplicate later look benign). k-NN family is the standard choice in deep-anomaly-detection literature for small-data regimes — centroid washes out multi-modal spending.
2. **Amount novelty `n_amt`** — robust z-score on log-amount: `z = (log(amt) - median(log(history))) / (1.4826 * MAD)`, then `n_amt = sigmoid((|z| - 2) / 1.5)` so |z|<2 ≈ 0, |z|=4 ≈ 0.79.
3. **Time-of-day novelty `n_time`** — `1 - p(hour)` against the user's hour-of-day histogram. 1.0 if the user has *never* transacted in this hour. Catches "3am" anomalies the embedding glosses over.
4. **Merchant reputation penalty `p_merch`** — 0 if merchant in user history, 0.3 if in curated allowlist, 0.6 otherwise.

**Combined score:**
```
risk = 0.45 * n_emb + 0.25 * n_amt + 0.15 * n_time + 0.15 * p_merch
```

Embedding's weight is reduced from a v1 of 0.55 because the descriptor already absorbs some of what `n_time` and `p_merch` independently capture; weighting the magnitude axes separately gives them their own teeth. Calibrate against seed data; nudge weights if a believable bad tx fails to clear 0.65.

**Tier mapping:**
```
risk < 0.35                       -> NO_RISK
0.35 <= risk < 0.65               -> MID_RISK
risk >= 0.65   OR  n_amt >= 0.9   -> HIGH_RISK   # amount kill-switch keeps the old €2k story working
```

Calibrate by replaying seed data and confirming all known-good txs land NO_RISK; tune the 0.35/0.65 cuts if not.

### 4.5 Code sketch — `app/services/risk_embeddings.py`

```python
import numpy as np
from datetime import datetime
from google import genai

client = genai.Client()
EMB_MODEL = "gemini-embedding-2"
EMB_DIM = 768

# --- descriptor builders ----------------------------------------------------

AMOUNT_BUCKETS = [
    (20,    "tiny (<€20)"),
    (100,   "small (€20–100)"),
    (500,   "medium (€100–500)"),
    (2000,  "large (€500–2000)"),
    (1e12,  "very large (>€2000)"),
]
def amount_bucket(eur: float) -> str:
    a = abs(eur)
    return next(label for cap, label in AMOUNT_BUCKETS if a < cap)

def hour_class(hour: int) -> str:
    if 9 <= hour <= 18:  return "business hours"
    if 18 < hour <= 23:  return "evening"
    return "overnight"

def history_with_counterparty(merchant: str, history) -> str:
    n = sum(1 for h in history if h["merchant"].lower() == merchant.lower())
    if n == 0:  return "none"
    if n <= 3:  return f"occasional ({n} prior)"
    return f"frequent ({n} prior, recurring pattern)"

def descriptor_for(tx, history, merchant_qualifiers) -> str:
    """Build the semantic descriptor sentence for embedding."""
    dt = datetime.fromisoformat(tx["timestamp"])
    qual = merchant_qualifiers.get(tx["merchant"], "no public reputation, unknown jurisdiction")
    cat = tx.get("category", "uncategorized")
    return (
        f"{tx.get('counterparty_kind','domestic retail payment')}: "
        f"{tx['merchant']} ({qual}). "
        f"Category: {cat}. "
        f"Amount bucket: {amount_bucket(tx['amount'])}. "
        f"Timing: {'weekend' if dt.weekday()>=5 else 'weekday'}, {hour_class(dt.hour)}. "
        f"User history with this counterparty: {history_with_counterparty(tx['merchant'], history)}. "
        f"User history in this category: "
        f"{'frequent' if sum(1 for h in history if h.get('category')==cat) >= 4 else 'occasional' if any(h.get('category')==cat for h in history) else 'none'}."
    )

# --- embedding + scoring ----------------------------------------------------

def embed_text(text: str) -> np.ndarray:
    resp = client.models.embed_content(
        model=EMB_MODEL, contents=text,
        config={"output_dimensionality": EMB_DIM})
    v = np.array(resp.embeddings[0].values, dtype=np.float32)
    return v / np.linalg.norm(v)

def score_tx(new_tx, history, merchant_qualifiers, allowlist):
    desc = descriptor_for(new_tx, history, merchant_qualifiers)
    v_new = embed_text(desc)
    H = np.stack([h["vec"] for h in history])         # (N, 768) L2-normed
    sims = H @ v_new
    # k-NN with k=3 to dampen single-outlier sensitivity
    topk = np.partition(sims, -3)[-3:] if len(sims) >= 3 else sims
    n_emb = float(1.0 - topk.mean())

    log_amts = np.log(np.array([abs(h["amount"]) for h in history]) + 1e-6)
    med = np.median(log_amts)
    mad = np.median(np.abs(log_amts - med)) + 1e-6
    z = (np.log(abs(new_tx["amount"])) - med) / (1.4826 * mad)
    n_amt = 1 / (1 + np.exp(-(abs(z) - 2) / 1.5))

    # NEW: time-of-day novelty (separate axis from amount)
    hours = np.array([datetime.fromisoformat(h["timestamp"]).hour for h in history])
    hour_hist = np.bincount(hours, minlength=24) / max(1, len(hours))
    h_new = datetime.fromisoformat(new_tx["timestamp"]).hour
    n_time = float(1.0 - hour_hist[h_new])            # 1 if hour never seen, 0 if dominant

    seen_merchants = {h["merchant"].lower() for h in history}
    m = new_tx["merchant"].lower()
    p_merch = 0.0 if m in seen_merchants else (0.3 if m in allowlist else 0.6)

    risk = 0.45 * n_emb + 0.25 * n_amt + 0.15 * n_time + 0.15 * p_merch
    return {"risk": risk, "n_emb": n_emb, "n_amt": n_amt,
            "n_time": n_time, "p_merch": p_merch, "z_amount": z,
            "descriptor": desc}

def classify_tier(s):
    if s["risk"] >= 0.65 or s["n_amt"] >= 0.9: return "HIGH_RISK"
    if s["risk"] >= 0.35:                       return "MID_RISK"
    return "NO_RISK"
```

### 4.6 Seed history shape

4–6 weeks of believable history. Schema per row: `{date, time, merchant, category, amount_eur, recurring_tag}`.

Patterns the seed should encode:

- **Salary** — 25th of month, +€2,800, "Bunq Payroll BV", category=income.
- **Rent** — 1st of month, -€1,150, "Stichting Woonbron", recurring.
- **Groceries** — 2× per week (Sat + Wed eve), €25–€55, alternating Albert Heijn / Jumbo.
- **Spotify** — monthly, -€10.99, "Spotify AB".
- **Public transport** — 8–12× per month, €2–€8, NS Reizigers / GVB.
- **Coffee** — weekday mornings, €3–€5, varied cafés.
- **Bol.com** — 1–3× per month, €15–€80.
- **Dinner out** — Fri/Sat evenings, €25–€60.

Example rows:

| date | time | merchant | category | amount | tag |
|---|---|---|---|---|---|
| 2026-03-25 | 09:00 | Bunq Payroll BV | income | +2800.00 | salary |
| 2026-04-01 | 06:30 | Stichting Woonbron | rent | -1150.00 | rent |
| 2026-04-04 | 18:12 | Albert Heijn | groceries | -42.30 | groceries |
| 2026-04-05 | 11:00 | Spotify AB | subscription | -10.99 | sub |
| 2026-04-07 | 08:14 | NS Reizigers | transport | -5.40 | commute |
| 2026-04-09 | 19:55 | Jumbo | groceries | -28.10 | groceries |
| 2026-04-12 | 20:30 | Bistro Saint Marc | dining | -47.00 | leisure |
| 2026-04-15 | 13:02 | Bol.com | shopping | -34.50 | shopping |

Demo "bad tx": `2026-04-25 03:14, "Unknown LLP", -5000.00` → novel merchant + off-distribution time + off-distribution amount → all three components fire.

### 4.7 Cold start

With <5 historical txs, both k-NN distance and the MAD denominator are unstable. Gate:

```python
if len(history) < 5:
    return classify_amount_threshold(new_tx)   # fall back to old rule
```

Surface this in the UI ("not enough history yet") — it's the honest behavior for a new account.

### 4.8 Multimodal expansion (v2 — when ready)

`gemini-embedding-2` accepts images, audio, video, and PDFs in the same call as text — all in one shared 3072-dim space. Concrete future demos this unlocks (deferred from hackathon scope):

- **Merchant-logo phishing detection.** When the bunq app surfaces a merchant logo at confirmation time, embed `(logo_image, descriptor_text)` together. A fake "Netfllix" logo with the right visual brand cues lands near real Netflix in vector space — but only if the user has historical Netflix vectors built the same way. Cosine similarity to historical genuine merchant vectors becomes a *visual* anomaly check on top of the textual one.
- **Receipt photos.** If a user attaches a receipt to a transaction in-app, embed the photo alongside the descriptor. Receipt visuals encode merchant identity and context the text descriptor cannot.
- **Voice memos.** A user can leave a 5-second "what is this for" voice note. Embed the audio in the same space. A sudden outlier voice memo (different speaker, distressed tone) sits far from the user's prior audio — another anomaly axis.

For the hackathon: **stay text-only.** The multimodal angle is documented as a v2 path the model already supports without re-platforming. The shared embedding space means historical text-only vectors and future image+text vectors stay comparable — no corpus rebuild needed when adding modalities.

---

## 5. Orchestration spec — end-to-end flow

### 5.1 MID_RISK voice-only flow

```
1. POST /api/transaction/initiate
   - embed new tx -> risk score -> tier=MID_RISK
   - persist Transaction(status=PENDING_VERIFICATION)
   - persist Verification(status=PENDING)
   - return ws_url

2. WS /ws/verify/{verification_id} opens
   - Server: Claude.generate_questions(tx_context) -> 3 questions
   - Server -> Client: {type:"questions", items:[...]}
   - Server -> Client: {type:"ready", tier:"MID_RISK"}

3. For each question q:
   - Client speaks q.text via SpeechSynthesis
   - Client opens mic, streams PCM16 chunks: {type:"audio_chunk", q_id, data}
   - Server forwards chunks to Hume socket (one socket per q)
   - Server runs VAD on chunks; on answer-end:
       - close Hume socket
       - aggregate emotion bucket
       - run STT (Whisper) on accumulated PCM -> transcript
       - Server -> Client: {type:"hume_partial", q_id, scores}
   - Server: Claude.evaluate_turn(q, transcript, hume_bucket) -> next_action
   - If next_action == "ask_followup": insert dynamic followup, repeat
   - If next_action == "escalate": break loop, jump to step 5

4. After last planned q (or escalate):
   - Server: Claude.decide(tier, all_buckets, gemini=None, embedding_signals)
       -> Verdict
   - Persist AuditLog (tier, all buckets, gemini=None, verdict)
   - Update Transaction.status, Verification.status
   - Open Ticket if verdict in {HELD_FOR_REVIEW, FROZEN}

5. Server -> Client: {type:"decision", verdict, rationale, audit_log_id}
   Server closes WS.
```

### 5.2 HIGH_RISK video + voice flow

Same as 5.1 plus:

- Client sends `{type:"video_frame", data}` every 3s during the call.
- Server keeps a per-verification ring buffer (last 8 frames).
- A background task polls Gemini every 3s with the buffer → `GeminiSummary`.
- Each summary is forwarded as `{type:"gemini_partial", summary}` and stored.
- `Claude.evaluate_turn` and `Claude.decide` receive the *latest* Gemini summary in addition to Hume buckets.
- Escalation rule: if any duress signal appears in **2 consecutive** polls with confidence > 0.6, force `next_action="escalate"` regardless of Hume.

### 5.3 WS protocol additions

| Direction | Type | Payload | When |
|---|---|---|---|
| S → C | `questions` | `{items: [{id, text, purpose}]}` | Right after WS open, before first question |
| S → C | `tts_done` (optional) | `{q_id}` | If server-side TTS used; skipped if browser TTS |
| C → S | `audio_chunk` | `{q_id, data}` | Per audio frame, includes which question is being answered |
| S → C | `hume_partial` | `{q_id, scores, delta_vs_baseline}` | After Hume returns for that question |
| C → S | `video_frame` | `{data}` | HIGH_RISK only, every 3s |
| S → C | `gemini_partial` | `{summary, poll_index}` | After each Gemini poll, HIGH_RISK only |
| S → C | `claude_thinking` (optional) | `{running_assessment}` | After each `evaluate_turn`, for the live UI |
| S → C | `decision` | `{verdict, rationale, audit_log_id}` | Final verdict, terminates session |

### 5.4 Database additions

- `EmotionBucket` table (see §1.6).
- `tx_embedding` table (see §4.2).
- `gemini_reports` table per verification: `verification_id, poll_index, summary_json, recorded_at`.
- `AuditLog.questions_json` — JSON column attaching the per-question transcript+emotion+claude_assessment array. This is the PSD3 receipt payload.

### 5.5 Failure modes

| Provider down | Behavior |
|---|---|
| Hume unreachable | Skip emotion analysis for that question; mark `service_available=false`. Claude still decides but is told to be conservative on missing signals. |
| Gemini unreachable (HIGH_RISK) | Latest known summary used + `service_available=false`. Per existing rubric: HIGH_RISK with missing signal → minimum HELD_FOR_REVIEW. |
| Claude unreachable | Fall back to `mocks.fallback_verdict()` rule over signals (already implemented). |
| Embedding API timeout > 2s | Fall back to amount-threshold rule for that transaction; mark embedding_signals=null. |

---

## 6. Migration plan (peel order)

Match the executive summary in the conversation. Each step is independently shippable.

1. **Drop API keys, set `MOCK_MODE=false`** — real Hume buffered + real Claude verdicts immediately. Frontend Gemini already real. Nothing else changes. *~1 hour incl. testing.*
2. **Switch Hume to streaming with per-question buckets** (§1.3–1.5). Replaces `hume_client.score_audio` with `hume_stream.score_answer`. Frontend WS handler routes `audio_chunk` by `q_id`. *~half day.*
3. **Wire frontend Gemini summaries into the WS** as `client_gemini` events; orchestrator uses real summaries instead of `mocks.GEMINI_DURESS`. Optionally swap to backend-polled. *~half day.*
4. **Question generation + turn evaluation via Claude** (§3). Frontend renders the question on `VerifyingScreen` and speaks it via `SpeechSynthesis`. *~1 day.*
5. **Embedding-based risk scoring** (§4). Pre-embed seed history at startup. Drop `risk_scorer.classify`'s amount thresholds and `state.force_tier` one-shot override. *~1 day incl. seed expansion.*
6. **PSD3 receipt artifact** — `GET /api/transaction/{id}/receipt` returns signed JSON of the audit log. Frontend "Download evidence" button on result screen. *~half day.*
7. **Operator/compliance dashboard** — admin routes already exist; build the UI. *~1 day.*

---

## 7. Sources

**Hume**
- [Hume Python SDK on GitHub](https://github.com/HumeAI/hume-python-sdk)
- [hume on PyPI](https://pypi.org/project/hume/)
- [Expression Measurement overview](https://dev.hume.ai/docs/expression-measurement/overview)
- [Speech Prosody model (48 dims)](https://dev.hume.ai/docs/expression-measurement/models/prosody)
- [EVI Audio guide (linear16, session_settings)](https://dev.hume.ai/docs/speech-to-speech-evi/guides/audio)
- [EVI overview](https://dev.hume.ai/docs/speech-to-speech-evi/overview)
- [Announcing EVI 3 (latency, custom LLM)](https://www.hume.ai/blog/announcing-evi-3-api)
- [EVI Custom Language Model guide](https://dev.hume.ai/docs/speech-to-speech-evi/guides/custom-language-model)
- [Expression Measurement streaming example (Python)](https://github.com/HumeAI/hume-api-examples/tree/main/expression-measurement/streaming/python-streaming-example)
- [Hume pricing page](https://www.hume.ai/pricing)

**Gemini Live**
- [Gemini 3.1 Flash Live model card](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview)
- [Build with Gemini 3.1 Flash Live (launch blog)](https://blog.google/innovation-and-ai/technology/developers-tools/build-with-gemini-3-1-flash-live/)
- [Gemini API changelog (deprecations)](https://ai.google.dev/gemini-api/docs/changelog)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Tool use with Live API](https://ai.google.dev/gemini-api/docs/live-api/tools)
- [Live API capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities)
- [Live API session management](https://ai.google.dev/gemini-api/docs/live-session)
- [Live API best practices](https://ai.google.dev/gemini-api/docs/live-api/best-practices)
- [google-genai SDK docs](https://googleapis.github.io/python-genai/)
- [Open SDK issue: TEXT mode on native-audio Live](https://github.com/googleapis/python-genai/issues/1780)

**Embeddings / risk scoring**
- [Gemini Embedding 2 — natively multimodal (announcement)](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-embedding-2/)
- [Gemini Embedding 2 — GA announcement (2026-04-22)](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-embedding-2-generally-available/)
- [Gemini API embeddings docs (model IDs, dims, modalities, SDK example)](https://ai.google.dev/gemini-api/docs/embeddings)
- [Gemini Embedding 2 — Vertex AI docs (per-call limits, GA stage)](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/embedding-2)
- [Gemini API release notes / changelog](https://ai.google.dev/gemini-api/docs/changelog)
- [Voyage AI pricing](https://docs.voyageai.com/docs/pricing)
- [Anthropic embeddings docs (recommends Voyage)](https://platform.claude.com/docs/en/build-with-claude/embeddings)
- [jina-embeddings-v3 paper](https://arxiv.org/abs/2409.10173)
- [Deep Nearest Neighbor Anomaly Detection (Reiss & Hoshen)](https://arxiv.org/pdf/2002.10445)
- [Out-of-Distribution Detection with Deep Nearest Neighbors (Sun et al.)](https://proceedings.mlr.press/v162/sun22d/sun22d.pdf)
- [Text Serialization for Tabular ML (arXiv 2406.13846)](https://arxiv.org/html/2406.13846v1)
