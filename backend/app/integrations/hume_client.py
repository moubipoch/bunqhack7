"""Hume Expression Measurement integration.

The real path uses Hume's streaming WebSocket via the official SDK. We
collect the client-streamed audio chunks into one buffer and submit it;
this keeps latency acceptable while avoiding chunk-boundary issues.

The wrapper ALWAYS returns a HumeScores; errors flip service_available
to False so the orchestrator can still produce a verdict.
"""

from __future__ import annotations

import structlog

from ..config import settings
from ..schemas import HumeScores
from ..state import state
from . import mocks

log = structlog.get_logger()


async def score_audio(pcm_bytes: bytes) -> HumeScores:
    if state.mock_mode or not settings.hume_api_key:
        return mocks.hume_for(state.scenario)

    try:
        return await _score_real(pcm_bytes)
    except Exception as e:  # noqa: BLE001 — provider failures must not kill verification
        log.warning("hume_failed", error=str(e))
        fallback = mocks.hume_for(state.scenario)
        return fallback.model_copy(update={"service_available": False, "note": f"hume error: {e}"})


async def _score_real(pcm_bytes: bytes) -> HumeScores:
    """Submit a combined PCM16 16kHz mono buffer to Hume and normalize the result.

    Hume's streaming Expression Measurement API expects WAV/WebM/MP3/MP4 — not
    raw PCM — so we wrap the buffer in a WAV envelope before submitting. Hume
    returns per-emotion scores (48 prosody categories); we collapse the most
    relevant dimensions into calmness / fear / distress / anxiety.
    """
    import io
    import tempfile
    import wave
    from pathlib import Path

    from hume import AsyncHumeClient
    from hume.expression_measurement.stream import Config

    # Wrap PCM16 16kHz mono into a WAV (Hume v0.13.11 send_file accepts a path).
    wav_buf = io.BytesIO()
    with wave.open(wav_buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(pcm_bytes)
    wav_bytes = wav_buf.getvalue()

    client = AsyncHumeClient(api_key=settings.hume_api_key)
    aggregate: dict[str, list[float]] = {}

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(wav_bytes)
        tmp_path = Path(tmp.name)
    try:
        async with client.expression_measurement.stream.connect() as socket:
            result = await socket.send_file(tmp_path, config=Config(prosody={}))

        prosody = getattr(result, "prosody", None)
        predictions = getattr(prosody, "predictions", None) or [] if prosody else []
        for prediction in predictions:
            for emotion in prediction.emotions or []:
                aggregate.setdefault(emotion.name, []).append(emotion.score)
    finally:
        tmp_path.unlink(missing_ok=True)

    def avg(name: str) -> float:
        values = aggregate.get(name, [])
        return sum(values) / len(values) if values else 0.0

    calmness = max(avg("Calmness"), avg("Contentment"))
    fear = max(avg("Fear"), avg("Horror"))
    distress = max(avg("Distress"), avg("Anxiety"))
    anxiety = avg("Anxiety")

    hint: str
    if calmness > 0.6 and fear < 0.2 and distress < 0.2:
        hint = "CLEAN"
    elif fear > 0.5 or distress > 0.5:
        hint = "FLAGGED"
    else:
        hint = "AMBIGUOUS"

    return HumeScores(
        calmness=calmness,
        fear=fear,
        distress=distress,
        anxiety=anxiety,
        confidence_overall=max(calmness, fear, distress),
        verdict_hint=hint,  # type: ignore[arg-type]
        note=f"Aggregated over {sum(len(v) for v in aggregate.values())} emotion samples.",
    )
