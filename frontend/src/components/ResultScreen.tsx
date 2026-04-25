import type { VerifyResult } from '../types'

const CONFIG = {
  APPROVED: {
    accent: '#16A34A',
    iconBg: 'bg-green-900/40',
    icon: '✓',
    title: 'Transaction Approved',
    border: 'border-green-800/50',
  },
  HELD_FOR_REVIEW: {
    accent: '#D97706',
    iconBg: 'bg-amber-900/40',
    icon: '⚠',
    title: 'Transaction Held',
    border: 'border-amber-800/50',
  },
  FROZEN: {
    accent: '#DC2626',
    iconBg: 'bg-red-900/40',
    icon: '✕',
    title: 'Transaction Frozen',
    border: 'border-red-800/50',
  },
}

interface Props {
  result: VerifyResult
  onBack: () => void
}

export default function ResultScreen({ result, onBack }: Props) {
  const cfg = CONFIG[result.verdict]

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] text-white">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Result card */}
        <div
          className={`w-full rounded-3xl border ${cfg.border} bg-[#141414] p-8 flex flex-col items-center text-center`}
          style={{ boxShadow: `0 0 60px ${cfg.accent}22` }}
        >
          {/* Icon */}
          <div
            className={`w-20 h-20 rounded-full ${cfg.iconBg} flex items-center justify-center text-4xl mb-5 border ${cfg.border}`}
            style={{ color: cfg.accent }}
          >
            {cfg.icon}
          </div>

          <h1 className="text-xl font-bold text-white mb-3">{cfg.title}</h1>

          <p className="text-sm text-gray-400 leading-relaxed">{result.rationale}</p>

          {/* Signal summary */}
          {result.humeScores && (
            <div className="mt-5 w-full bg-[#1A1A1A] rounded-xl p-3 text-left">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Voice signal</p>
              <p className="text-xs text-gray-300">
                {result.humeScores.verdict_hint === 'CLEAN' && 'Calm — no distress detected'}
                {result.humeScores.verdict_hint === 'AMBIGUOUS' && 'Mixed — unclear signals'}
                {result.humeScores.verdict_hint === 'FLAGGED' && 'Distress markers detected'}
              </p>
            </div>
          )}

          {result.geminiSummary && result.geminiSummary.duress_signals.length > 0 && (
            <div className="mt-2 w-full bg-[#1A1A1A] rounded-xl p-3 text-left">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">
                Environment
              </p>
              <p className="text-xs text-gray-300">
                {result.geminiSummary.duress_signals.join(' • ').replace(/_/g, ' ')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Back button */}
      <div className="flex-none px-6 pb-10">
        <button
          onClick={onBack}
          className="w-full py-4 rounded-2xl border border-[#2A2A2A] text-white font-semibold text-base bg-[#141414] hover:bg-[#1A1A1A] active:bg-[#222222] transition-all"
        >
          Back to home
        </button>
      </div>
    </div>
  )
}
