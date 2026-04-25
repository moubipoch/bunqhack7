import { useCallback, useRef } from 'react'
import { useAudioCapture, type AudioSource } from './useAudioCapture'
import type { GeminiSummary, HumeScores, InitiateRes, VerifyResult } from '../types'

interface RunParams {
  initiateRes: InitiateRes
  onHumeUpdate: (scores: HumeScores) => void
  onGeminiUpdate: (summary: GeminiSummary) => void
  onCountdown: (secondsLeft: number) => void
  onVideoStream: (stream: MediaStream | null) => void
  onAudioSource: (src: AudioSource) => void
  onComplete: (result: VerifyResult) => void
  onError: (msg: string) => void
}

export function useVerification() {
  const { startCapture, stopCapture, drainChunks } = useAudioCapture()
  const wsRef = useRef<WebSocket | null>(null)
  const intervalsRef = useRef<number[]>([])
  const videoStreamRef = useRef<MediaStream | null>(null)
  const humeRef = useRef<HumeScores | null>(null)
  const geminiRef = useRef<GeminiSummary | null>(null)
  const completedRef = useRef(false)

  const cleanup = useCallback(() => {
    intervalsRef.current.forEach((id) => clearInterval(id))
    intervalsRef.current = []
    stopCapture()
    videoStreamRef.current?.getTracks().forEach((t) => t.stop())
    videoStreamRef.current = null
    const ws = wsRef.current
    wsRef.current = null
    if (ws && ws.readyState < WebSocket.CLOSING) {
      ws.close()
    }
  }, [stopCapture])

  const run = useCallback(
    async (params: RunParams) => {
      const {
        initiateRes,
        onHumeUpdate,
        onGeminiUpdate,
        onCountdown,
        onVideoStream,
        onAudioSource,
        onComplete,
        onError,
      } = params

      completedRef.current = false
      humeRef.current = null
      geminiRef.current = null

      try {
        // 1. Audio
        const audioSrc = await startCapture()
        onAudioSource(audioSrc)

        // 2. Video (HIGH_RISK only)
        let captureVideoEl: HTMLVideoElement | null = null
        let captureCanvas: HTMLCanvasElement | null = null

        if (initiateRes.tier === 'HIGH_RISK') {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { width: 320, height: 240, facingMode: 'user' },
            })
            videoStreamRef.current = stream
            onVideoStream(stream)

            captureVideoEl = document.createElement('video')
            captureVideoEl.srcObject = stream
            captureVideoEl.muted = true
            captureVideoEl.playsInline = true
            captureVideoEl.autoplay = true
            await captureVideoEl.play()

            captureCanvas = document.createElement('canvas')
            captureCanvas.width = 320
            captureCanvas.height = 240
          } catch {
            onVideoStream(null)
          }
        }

        // 3. WebSocket
        const apiBase =
          (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8000'
        const wsBase = apiBase.replace(/^http/, 'ws')
        const ws = new WebSocket(`${wsBase}${initiateRes.ws_url}`)
        wsRef.current = ws

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string) as Record<string, unknown>
            if (msg.type === 'hume_partial') {
              humeRef.current = msg.scores as HumeScores
              onHumeUpdate(msg.scores as HumeScores)
            } else if (msg.type === 'gemini_partial') {
              geminiRef.current = msg.summary as GeminiSummary
              onGeminiUpdate(msg.summary as GeminiSummary)
            } else if (msg.type === 'decision') {
              completedRef.current = true
              cleanup()
              onComplete({
                verdict: msg.verdict as VerifyResult['verdict'],
                rationale: msg.rationale as string,
                humeScores: humeRef.current ?? undefined,
                geminiSummary: geminiRef.current ?? undefined,
              })
            } else if (msg.type === 'error') {
              completedRef.current = true
              cleanup()
              onError(msg.reason as string)
            }
          } catch {
            // ignore parse errors
          }
        }

        ws.onerror = () => {
          if (!completedRef.current) {
            completedRef.current = true
            cleanup()
            onError('WebSocket connection error')
          }
        }

        ws.onclose = (event) => {
          if (!event.wasClean && !completedRef.current) {
            completedRef.current = true
            cleanup()
            onError('Connection closed unexpectedly')
          }
        }

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'start' }))

          let countdown = 5
          let videoFrameCount = 0
          onCountdown(countdown)

          // Audio: drain every 250ms
          const audioId = window.setInterval(() => {
            const chunk = drainChunks()
            if (chunk && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'audio_chunk', data: chunk }))
            }
          }, 250)
          intervalsRef.current.push(audioId)

          // Video: capture frame every 500ms (cap at 8 frames)
          if (captureVideoEl && captureCanvas) {
            const ctx2d = captureCanvas.getContext('2d')!
            const videoId = window.setInterval(() => {
              if (videoFrameCount >= 8) return
              try {
                ctx2d.drawImage(captureVideoEl!, 0, 0, 320, 240)
                const data = captureCanvas!.toDataURL('image/jpeg', 0.7).split(',')[1]
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'video_frame', data }))
                  videoFrameCount++
                }
              } catch {
                // canvas may not be ready on first frames
              }
            }, 500)
            intervalsRef.current.push(videoId)
          }

          // Countdown: tick every 1s, send "end" at 0
          const countdownId = window.setInterval(() => {
            countdown--
            onCountdown(countdown)

            if (countdown <= 0) {
              // Clear all running intervals
              intervalsRef.current.forEach((id) => clearInterval(id))
              intervalsRef.current = []

              // Drain remaining audio before ending
              const finalChunk = drainChunks()
              if (finalChunk && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'audio_chunk', data: finalChunk }))
              }

              stopCapture()
              if (captureVideoEl) {
                captureVideoEl.pause()
                captureVideoEl.srcObject = null
              }

              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'end' }))
              }
            }
          }, 1000)
          intervalsRef.current.push(countdownId)
        }
      } catch (e) {
        cleanup()
        onError(`Setup failed: ${String(e)}`)
      }
    },
    [startCapture, stopCapture, drainChunks, cleanup],
  )

  return { run, cleanup }
}
