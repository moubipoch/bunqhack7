import type { DemoButton } from '../types'
import { Play, ShieldAlert, PhoneCall, CheckCircle, ChevronRight, Info } from 'lucide-react'

export const DEMO_BUTTONS = [
  {
    label: 'Regular transaction',
    scenario: null,
    merchant: 'Albert Heijn',
    amount: 38.20,
    colorClass: 'bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/20',
    subtext: 'Albert Heijn • €38.20',
    description: 'Auto-approved — no verification triggered',
    icon: CheckCircle,
    iconColor: 'text-emerald-400'
  },
  {
    label: 'Suspicious transaction',
    scenario: 'mid_flagged',
    merchant: 'FastWire',
    amount: 600,
    colorClass: 'bg-amber-950/40 hover:bg-amber-900/40 border border-amber-500/20',
    subtext: 'FastWire • €600.00',
    description: 'Voice verification → held for review',
    icon: PhoneCall,
    iconColor: 'text-amber-400'
  },
  {
    label: 'Fraudulent transaction',
    scenario: 'high_fail',
    merchant: 'Unknown LLP',
    amount: 5000,
    colorClass: 'bg-red-950/40 hover:bg-red-900/40 border border-red-500/20',
    subtext: 'Unknown LLP • €5,000.00',
    description: 'Video + voice verification → frozen',
    icon: ShieldAlert,
    iconColor: 'text-red-400'
  },
]

const ACCENT: Record<string, string> = {
  'Regular transaction': '#34D399',
  'Suspicious transaction': '#FBBF24',
  'Fraudulent transaction': '#F87171',
}

interface Props {
  onDemoPress: (button: DemoButton) => void
  isLoading: boolean
}

export default function DemoControls({ onDemoPress, isLoading }: Props) {
  return (
    <div className="flex flex-col gap-3 w-[320px]">
      <div className="mb-2">
        <h3 className="text-[13px] font-black text-white uppercase tracking-widest flex items-center gap-2">
          <Play size={16} className="text-indigo-400" /> Demo Scenarios
        </h3>
        <p className="text-xs text-gray-400 mt-1.5 font-medium">Select a scenario to trigger on the phone.</p>
      </div>

      {DEMO_BUTTONS.map((btn) => {
        const Icon = btn.icon
        return (
        <button
          key={btn.label}
          onClick={() => !isLoading && onDemoPress(btn)}
          disabled={isLoading}
          className={`w-full text-left rounded-[24px] p-4 transition-all duration-200 disabled:opacity-50 active:scale-[0.98] ${btn.colorClass} backdrop-blur-sm group`}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl bg-white/5 border border-white/5 shadow-inner ${btn.iconColor}`}>
              <Icon size={20} strokeWidth={2.5} />
            </div>
            <div className="flex-1 pt-0.5">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-bold text-white mb-0.5 tracking-tight">{btn.label}</p>
                {isLoading ? (
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white/80 rounded-full animate-spin flex-none" />
                ) : (
                  <ChevronRight size={18} className="text-gray-500 group-hover:text-white transition-colors" />
                )}
              </div>
              <p className="text-[12px] font-bold tracking-wide mt-0.5" style={{ color: ACCENT[btn.label] }}>
                {btn.subtext}
              </p>
              <p className="text-[12px] font-medium text-gray-400 mt-2 leading-relaxed">{btn.description}</p>
            </div>
          </div>
        </button>
        )
      })}

      <div className="mt-4 p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 flex items-start gap-3">
        <Info size={16} className="text-indigo-400 mt-0.5 flex-none" />
        <p className="text-[11px] text-indigo-200/80 leading-relaxed font-medium">
          The backend API determines risk tier based on merchant and amount. The scenario forces the LLM outcome for demonstration purposes.
        </p>
      </div>
    </div>
  )
}