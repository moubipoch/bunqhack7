import { useEffect, useRef } from 'react'
import type { AudioSource } from '../hooks/useAudioCapture'
import type { GeminiSummary, HumeScores, Tier } from '../types'

interface Props {
  tier: Tier
  humeScores: HumeScores | null
  geminiSummary: GeminiSummary | null
  countdown: number
  videoStream: MediaStream | null
  audioSource: AudioSource
  merchant?: string
}

export default function VerifyingScreen({
  tier,
  humeScores,
  geminiSummary,
  countdown,
  videoStream,
  audioSource,
  merchant,
}: Props) {
  const selfViewRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (selfViewRef.current && videoStream) {
      selfViewRef.current.srcObject = videoStream
      selfViewRef.current.play().catch(() => {})
    }
  }, [videoStream])

  const isProcessing = countdown <= 0
  const timerStr = `0:${Math.max(0, countdown).toString().padStart(2, '0')}`
  const isVideo = tier === 'HIGH_RISK'

  return (
    <div className="relative flex flex-col h-full bg-[#0A0A0A] text-white overflow-hidden">

      {/* Self-view (video call inset, top-right) */}
      {isVideo && (
        <div className="absolute top-14 right-4 z-20 w-24 h-32 rounded-2xl overflow-hidden border-2 border-[#2A2A2A] shadow-lg">
          {videoStream ? (
            <video
              ref={selfViewRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="w-full h-full bg-[#1A1A1A] flex items-center justify-center">
              <span className="text-2xl">📷</span>
            </div>
          )}
          <div className="absolute bottom-1 inset-x-0 text-center text-[9px] text-white/60">You</div>
        </div>
      )}

      {/* Main call content */}
      <div className="flex flex-col items-center flex-1 pt-16 px-6">

        {/* Call type label */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-8">
          {isVideo ? 'Video verification' : 'Voice verification'}
        </p>

        {/* Avatar with gradient ring */}
        <div className="relative mb-6">
          {/* Pulsing ring */}
          {!isProcessing && (
            <span className="absolute inset-[-8px] rounded-full animate-ping opacity-20"
              style={{ background: 'conic-gradient(from 0deg, #FF6B6B, #FFD700, #4ADE80, #60A5FA, #C084FC, #FF6B6B)' }}
            />
          )}
          {/* Gradient border ring */}
          <div
            className="w-28 h-28 rounded-full p-[3px]"
            style={{ background: 'conic-gradient(from 0deg, #FF6B6B, #FFD700, #4ADE80, #60A5FA, #C084FC, #FF6B6B)' }}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-700 via-violet-600 to-pink-600 flex items-center justify-center border-2 border-[#0A0A0A]">
              <span className="text-4xl font-black text-white" style={{ fontFamily: 'serif' }}>b</span>
            </div>
          </div>
        </div>

        {/* Caller info */}
        <h2 className="text-2xl font-bold text-white mb-1">bunq Security</h2>
        <p className="text-sm text-gray-400 mb-8">
          {merchant ? `Verifying payment to ${merchant}` : 'Verifying transaction'}
        </p>

        {/* Timer / status */}
        {isProcessing ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Analyzing signals...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <p className="text-4xl font-light font-mono text-white tracking-widest">{timerStr}</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <p className="text-xs text-gray-500">
                {isVideo ? 'Voice & environment active' : 'Voice analysis active'}
              </p>
            </div>
          </div>
        )}

        {/* Mic fallback notice */}
        {audioSource === 'silent' && (
          <div className="mt-4 px-3 py-1.5 bg-amber-900/40 rounded-lg border border-amber-700/40">
            <p className="text-xs text-amber-400">Mic unavailable — silent mode</p>
          </div>
        )}
      </div>

      {/* Analysis panel — bottom */}
      <div className="flex-none px-6 pb-6 space-y-4">

        {/* Hume bars */}
        {(humeScores || !isProcessing) && (
          <div className="bg-[#141414] rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-3">
              Voice analysis
            </p>
            <div className="space-y-2">
              {[
                { key: 'calmness' as const, label: 'Calm', color: 'bg-emerald-500' },
                { key: 'fear' as const, label: 'Fear', color: 'bg-red-500' },
                { key: 'distress' as const, label: 'Distress', color: 'bg-orange-500' },
                { key: 'anxiety' as const, label: 'Anxiety', color: 'bg-amber-400' },
              ].map(({ key, label, color }) => {
                const pct = humeScores ? Math.round(humeScores[key] * 100) : 0
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-12 flex-none">{label}</span>
                    <div className="flex-1 h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color} rounded-full transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-600 w-7 text-right flex-none">
                      {humeScores ? `${pct}%` : '–'}
                    </span>
                  </div>
                )
              })}
            </div>
            {humeScores && (
              <p className="text-[10px] text-gray-600 mt-2">
                {humeScores.verdict_hint === 'CLEAN' && '✓ Signal: calm'}
                {humeScores.verdict_hint === 'AMBIGUOUS' && '~ Signal: mixed'}
                {humeScores.verdict_hint === 'FLAGGED' && '⚠ Signal: distress'}
              </p>
            )}
          </div>
        )}

        {/* Gemini summary */}
        {isVideo && geminiSummary && (
          <div className="bg-[#141414] rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Environment
            </p>
            <p className="text-xs text-gray-400 mb-2">{geminiSummary.raw_text}</p>
            {geminiSummary.duress_signals.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {geminiSummary.duress_signals.map((s) => (
                  <span key={s} className="text-[10px] bg-red-900/50 text-red-300 rounded-full px-2 py-0.5 border border-red-800/50">
                    {s.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
