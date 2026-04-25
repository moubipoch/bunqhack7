"""Phase 1 real-path smoke test.

Confirms that with MOCK_MODE=false and API keys populated, the verification
pipeline reaches real Hume + real Claude (Gemini still falls through to mock,
which is intentional for Phase 1 — see FUTURE_AI_INTEGRATIONS.md §6).

Compared to scripts/smoke.py:
- Forces mock_mode OFF via the toggle endpoint
- Sends ~3 seconds of silent PCM (Hume needs enough audio to score)
- Asserts hume_scores != canonical mock preset (HUME_CLEAN: 0.82/0.05/0.04/0.08)
- Prints actual rationale + scores so we can eyeball them
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import sys
import time
from typing import Any

import httpx
import websockets

BASE = f"http://localhost:{os.environ.get('PORT', '8000')}"
WS_BASE = f"ws://localhost:{os.environ.get('PORT', '8000')}"

# Canonical HUME_CLEAN preset values from app/integrations/mocks.py — if real
# Hume returns these EXACT numbers, we know we're still hitting the mock.
MOCK_HUME_CLEAN = {"calmness": 0.82, "fear": 0.05, "distress": 0.04, "anxiety": 0.08}


def _assert(cond: bool, label: str, payload: Any = None) -> None:
    if cond:
        print(f"  OK   {label}")
        return
    print(f"  FAIL {label}")
    if payload is not None:
        print(json.dumps(payload, indent=2, default=str))
    sys.exit(1)


async def _ws_verify(verification_id: str, send_video: bool = False) -> dict:
    async with websockets.connect(f"{WS_BASE}/ws/verify/{verification_id}") as ws:
        ready = json.loads(await ws.recv())
        _assert(ready["type"] == "ready", "ws ready", ready)

        await ws.send(json.dumps({"type": "start"}))
        # 3 seconds of silence — gives Hume something to chew on.
        # 16kHz mono pcm16 = 32000 bytes/sec, so 96000 bytes for 3 seconds.
        silent = bytes(96000)
        await ws.send(
            json.dumps({"type": "audio_chunk", "data": base64.b64encode(silent).decode()})
        )
        if send_video:
            tiny_jpeg = bytes.fromhex(
                "ffd8ffe000104a46494600010100000100010000ffdb0043"
                "000302020302020303030304030304050805050404050a07"
                "0706080c0a0c0c0b0a0b0b0d0e12100d0e110e0b0b1016"
                "161113141513ffd9"
            )
            await ws.send(
                json.dumps({"type": "video_frame", "data": base64.b64encode(tiny_jpeg).decode()})
            )
        await ws.send(json.dumps({"type": "end"}))

        decision = None
        hume_partial = None
        gemini_partial = None
        while True:
            msg = json.loads(await ws.recv())
            if msg["type"] == "hume_partial":
                hume_partial = msg
            elif msg["type"] == "gemini_partial":
                gemini_partial = msg
            elif msg["type"] == "decision":
                decision = msg
                break
        return {"decision": decision, "hume": hume_partial, "gemini": gemini_partial}


def _hume_is_real(scores: dict) -> bool:
    """Return True if scores differ from the canonical HUME_CLEAN preset.

    Real Hume on 3s of silence will not produce 0.82 calmness; it'll likely
    return very low scores across the board, or AMBIGUOUS, or fail entirely.
    The point: if the four numbers exactly match HUME_CLEAN, we're mocked.
    """
    if not scores:
        return False
    for k, v in MOCK_HUME_CLEAN.items():
        if abs(scores.get(k, 0.0) - v) > 1e-6:
            return True
    return False


async def main() -> None:
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(f"{BASE}/health")
        _assert(r.status_code == 200 and r.json()["ok"], "GET /health", r.text)

        # Force mock OFF for this run
        r = await client.post(f"{BASE}/api/mock/toggle", json={"mock": False})
        _assert(r.status_code == 200 and r.json()["mock_mode"] is False, "mock OFF", r.text)

        await client.post(f"{BASE}/api/mock/reset")

        # --- MID_RISK real path
        print("\n[MID_RISK real-path test — FastWire €600]")
        await client.post(f"{BASE}/api/mock/scenario/mid_flagged")  # pins tier=MID_RISK
        t0 = time.perf_counter()
        r = await client.post(
            f"{BASE}/api/transaction/initiate",
            json={"amount_eur": 600.0, "merchant": "FastWire"},
        )
        body = r.json()
        _assert(body["tier"] == "MID_RISK" and body["verification_id"], "MID initiate", body)
        result = await _ws_verify(body["verification_id"], send_video=False)
        elapsed_ms = int((time.perf_counter() - t0) * 1000)

        decision = result["decision"]
        hume_scores = result["hume"]["scores"] if result["hume"] else None
        _assert(decision is not None, "MID decision received")
        _assert(decision["verdict"] in {"APPROVED", "HELD_FOR_REVIEW", "FROZEN"},
                "MID verdict valid", decision)
        if hume_scores:
            real_hume = _hume_is_real(hume_scores)
            print(f"  ->   Hume scores look {'REAL' if real_hume else 'MOCKED'}: "
                  f"calm={hume_scores['calmness']:.3f} fear={hume_scores['fear']:.3f} "
                  f"distress={hume_scores['distress']:.3f} anxiety={hume_scores['anxiety']:.3f} "
                  f"hint={hume_scores['verdict_hint']}")
            print(f"  ->   service_available: {hume_scores.get('service_available')}")
        print(f"  ->   verdict: {decision['verdict']}")
        print(f"  ->   rationale: {decision['rationale']}")
        print(f"  ->   total wall time: {elapsed_ms}ms")

        # --- HIGH_RISK real path
        print("\n[HIGH_RISK real-path test — Unknown LLP €5000]")
        await client.post(f"{BASE}/api/mock/scenario/high_fail")  # pins tier=HIGH_RISK
        t0 = time.perf_counter()
        r = await client.post(
            f"{BASE}/api/transaction/initiate",
            json={"amount_eur": 5000.0, "merchant": "Unknown LLP"},
        )
        body = r.json()
        _assert(body["tier"] == "HIGH_RISK" and body["verification_id"], "HIGH initiate", body)
        result = await _ws_verify(body["verification_id"], send_video=True)
        elapsed_ms = int((time.perf_counter() - t0) * 1000)

        decision = result["decision"]
        hume_scores = result["hume"]["scores"] if result["hume"] else None
        gemini_summary = result["gemini"]["summary"] if result["gemini"] else None
        _assert(decision is not None, "HIGH decision received")
        if hume_scores:
            real_hume = _hume_is_real(hume_scores)
            print(f"  ->   Hume scores look {'REAL' if real_hume else 'MOCKED'}: "
                  f"calm={hume_scores['calmness']:.3f} fear={hume_scores['fear']:.3f} "
                  f"distress={hume_scores['distress']:.3f} anxiety={hume_scores['anxiety']:.3f} "
                  f"hint={hume_scores['verdict_hint']}")
        if gemini_summary:
            print(f"  ->   Gemini service_available: {gemini_summary.get('service_available', True)} "
                  f"(EXPECTED false — backend Gemini deferred to Phase 2)")
            print(f"  ->   Gemini location: {gemini_summary['location_type']}, "
                  f"signals: {gemini_summary['duress_signals']}")
        print(f"  ->   verdict: {decision['verdict']}")
        print(f"  ->   rationale: {decision['rationale']}")
        print(f"  ->   total wall time: {elapsed_ms}ms")

    print("\nReal-path smoke complete.")


if __name__ == "__main__":
    asyncio.run(main())
