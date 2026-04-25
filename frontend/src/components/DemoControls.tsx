import { useState } from 'react'
import type { DemoButton } from '../types'
import { Play, ShieldAlert, PhoneCall, CheckCircle, ChevronRight, Info, Sliders, Activity, Zap } from 'lucide-react'

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
  onCheckRisk?: (merchant: string, amount: number) => Promise<string>
  isLoading: boolean
}

export default function DemoControls({ onDemoPress, onCheckRisk, isLoading }: Props) {
  const [tab, setTab] = useState<'presets' | 'builder'>('presets')
  
  // Builder state
  const [bMerchant, setBMerchant] = useState('Apple Store')
  const [bAmount, setBAmount] = useState<number>(1200)
  const [bTime, setBTime] = useState<number>(14)
  const [checkResult, setCheckResult] = useState<string | null>(null)

  const handleLaunch = () => {
    onDemoPress({
      label: 'Custom Transaction',
      scenario: null, // Let the backend decide tier naturally
      merchant: bMerchant || 'Unknown',
      amount: bAmount,
      colorClass: '',
      subtext: `${bMerchant} • €${bAmount.toFixed(2)}`,
      description: 'Custom generated scenario',
      // @ts-ignore
      icon: Activity,
      iconColor: 'text-indigo-400'
    })
  }

  const handleCheck = async () => {
    if (!onCheckRisk) return
    setCheckResult('Checking...')
    const res = await onCheckRisk(bMerchant || 'Unknown', bAmount)
    setCheckResult(res)
    setTimeout(() => setCheckResult(null), 5000)
  }

  return (
    <div className="flex flex-col gap-3 w-[340px]">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-black text-white uppercase tracking-widest flex items-center gap-2">
          {tab === 'presets' ? <Play size={16} className="text-indigo-400" /> : <Sliders size={16} className="text-pink-400" />} 
          {tab === 'presets' ? 'Demo Scenarios' : 'Scenario Builder'}
        </h3>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-white/5 rounded-xl border border-white/10 mb-2">
        <button 
          onClick={() => setTab('presets')}
          className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${tab === 'presets' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Presets
        </button>
        <button 
          onClick={() => setTab('builder')}
          className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${tab === 'builder' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Builder
        </button>
      </div>

      {tab === 'presets' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-400 font-medium mb-1">Select a scenario to trigger on the phone.</p>
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
        </div>
      )}

      {tab === 'builder' && (
        <div className="flex flex-col gap-4 p-5 rounded-[24px] bg-white/[0.03] border border-white/10 backdrop-blur-sm">
          
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Merchant Name</label>
            <input 
              type="text" 
              value={bMerchant}
              onChange={e => setBMerchant(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-[14px] focus:outline-none focus:border-pink-500/50 transition-colors font-medium"
            />
          </div>

          <div className="space-y-1.5 mt-2">
            <div className="flex justify-between items-end">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Amount</label>
              <span className="text-[15px] font-mono font-bold text-pink-400">€{bAmount.toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min="1" max="10000" step="10"
              value={bAmount}
              onChange={e => setBAmount(Number(e.target.value))}
              className="w-full accent-pink-500"
            />
          </div>

          <div className="space-y-1.5 mt-2">
            <div className="flex justify-between items-end">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Time of Day</label>
              <span className="text-[13px] font-bold text-gray-300">{bTime.toString().padStart(2, '0')}:00</span>
            </div>
            <input 
              type="range" 
              min="0" max="23" step="1"
              value={bTime}
              onChange={e => setBTime(Number(e.target.value))}
              className="w-full accent-gray-500"
            />
          </div>

          <div className="h-[1px] w-full bg-white/10 my-2" />

          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleLaunch}
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-[13px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(219,39,119,0.3)] disabled:opacity-50"
            >
              {isLoading ? <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Play size={16} fill="currentColor" />}
              Launch Live Verification
            </button>
            
            <button
              onClick={handleCheck}
              disabled={isLoading || !onCheckRisk}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-[12px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Zap size={14} className="text-yellow-400" />
              Check Risk Embedding Only
            </button>

            {checkResult && (
              <div className={`mt-1 p-2.5 rounded-lg border text-center font-bold text-[12px] uppercase tracking-widest ${
                checkResult.includes('HIGH') ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                checkResult.includes('MID') ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                checkResult.includes('Check') ? 'bg-white/5 border-white/10 text-gray-400' :
                'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>
                Result: {checkResult}
              </div>
            )}
          </div>

        </div>
      )}

      <div className="mt-2 p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 flex items-start gap-3">
        <Info size={16} className="text-indigo-400 mt-0.5 flex-none" />
        <p className="text-[11px] text-indigo-200/80 leading-relaxed font-medium">
          The backend API determines risk tier based on merchant and amount. The presets force the LLM outcome for deterministic demonstration purposes.
        </p>
      </div>
    </div>
  )
}