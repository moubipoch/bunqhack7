import type { HumeScores } from '../types'

const BARS = [
  { key: 'calmness' as const, label: 'Calmness', color: 'bg-green-400' },
  { key: 'fear' as const, label: 'Fear', color: 'bg-red-400' },
  { key: 'distress' as const, label: 'Distress', color: 'bg-orange-400' },
  { key: 'anxiety' as const, label: 'Anxiety', color: 'bg-amber-400' },
]

export default function HumeScoreBars({ scores }: { scores: HumeScores | null }) {
  return (
    <div className="space-y-2 w-full">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Voice analysis
      </p>
      {BARS.map(({ key, label, color }) => {
        const pct = scores ? Math.round(scores[key] * 100) : 0
        return (
          <div key={key}>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <span>{label}</span>
              <span>{scores ? `${pct}%` : '–'}</span>
            </div>
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${color} rounded-full transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
      {scores && (
        <p className="text-xs text-gray-500 mt-2 italic">
          {scores.verdict_hint === 'CLEAN' && '✓ Voice signal: calm'}
          {scores.verdict_hint === 'AMBIGUOUS' && '~ Voice signal: mixed'}
          {scores.verdict_hint === 'FLAGGED' && '⚠ Voice signal: distress detected'}
        </p>
      )}
    </div>
  )
}
