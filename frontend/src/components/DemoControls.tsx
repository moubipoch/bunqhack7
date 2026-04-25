import type { DemoButton } from '../types'

const DEMO_BUTTONS: DemoButton[] = [
  {
    label: 'Regular transaction',
    scenario: null,
    merchant: 'Albert Heijn',
    amount: 38.20,
    colorClass: 'border-green-800/60 hover:border-green-600 hover:bg-green-900/20',
    subtext: 'Albert Heijn • €38.20',
    description: 'Auto-approved, no verification',
  },
  {
    label: 'Suspicious transaction',
    scenario: 'mid_flagged',
    merchant: 'FastWire',
    amount: 600,
    colorClass: 'border-amber-800/60 hover:border-amber-600 hover:bg-amber-900/20',
    subtext: 'FastWire • €600.00',
    description: 'Voice verification → held for review',
  },
  {
    label: 'Fraudulent transaction',
    scenario: 'high_fail',
    merchant: 'Unknown LLP',
    amount: 5000,
    colorClass: 'border-red-800/60 hover:border-red-600 hover:bg-red-900/20',
    subtext: 'Unknown LLP • €5,000.00',
    description: 'Video + voice verification → frozen',
  },
]

interface Props {
  onDemoPress: (button: DemoButton) => void
  isLoading: boolean
}

export default function DemoControls({ onDemoPress, isLoading }: Props) {
  return (
    <div className="flex flex-col gap-3 w-64">
      <div className="mb-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Demo controls
        </p>
        <p className="text-[11px] text-gray-700 mt-0.5">Tap to trigger a scenario</p>
      </div>

      {DEMO_BUTTONS.map((btn) => (
        <button
          key={btn.label}
          onClick={() => !isLoading && onDemoPress(btn)}
          disabled={isLoading}
          className={`w-full text-left rounded-2xl border bg-[#0F0F0F] p-4 transition-all disabled:opacity-40 ${btn.colorClass}`}
        >
          <p className="text-sm font-semibold text-white mb-0.5">{btn.label}</p>
          <p className="text-xs text-gray-500">{btn.subtext}</p>
          <p className="text-[11px] text-gray-700 mt-1.5">{btn.description}</p>
        </button>
      ))}

      <div className="mt-1 pt-3 border-t border-[#1A1A1A]">
        <p className="text-[11px] text-gray-700 leading-relaxed">
          Buttons sit outside the phone frame intentionally — judges see both the app and the operator view simultaneously.
        </p>
      </div>
    </div>
  )
}
