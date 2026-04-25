import { ArrowLeft, CheckCircle2, AlertTriangle, ShieldAlert, Activity, Eye } from 'lucide-react'
import type { VerifyResult } from '../types'

const CONFIG = {
  APPROVED: {
    glow: 'shadow-[0_0_80px_rgba(16,185,129,0.3)]',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    iconBorder: 'border-emerald-500/20',
    icon: CheckCircle2,
    title: 'Payment Approved',
    subtitle: 'Security checks passed successfully',
  },
  HELD_FOR_REVIEW: {
    glow: 'shadow-[0_0_80px_rgba(245,158,11,0.3)]',
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    iconBorder: 'border-amber-500/20',
    icon: AlertTriangle,
    title: 'Payment Held',
    subtitle: 'Pending human verification',
  },
  FROZEN: {
    glow: 'shadow-[0_0_80px_rgba(239,68,68,0.3)]',
    iconColor: 'text-red-400',
    iconBg: 'bg-red-500/10',
    iconBorder: 'border-red-500/20',
    icon: ShieldAlert,
    title: 'Account Frozen',
    subtitle: 'High risk of fraud detected',
  },
}

interface Props {
  result: VerifyResult
  onBack: () => void
}

export default function ResultScreen({ result, onBack }: Props) {
  const cfg = CONFIG[result.verdict]
  const Icon = cfg.icon

  return (
    <div className="flex flex-col h-full bg-[#050505] text-white relative overflow-hidden">
      
      <div className={`absolute top-0 left-0 right-0 h-72 bg-gradient-to-b opacity-20 pointer-events-none ${
        result.verdict === 'APPROVED' ? 'from-emerald-500 to-transparent' :
        result.verdict === 'FROZEN' ? 'from-red-500 to-transparent' :
        'from-amber-500 to-transparent'
      }`} />

      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10 pt-10">

        <div className="relative mb-10">
          <div className={`absolute inset-0 rounded-full blur-2xl ${
            result.verdict === 'APPROVED' ? 'bg-emerald-500/40' :
            result.verdict === 'FROZEN' ? 'bg-red-500/40' :
            'bg-amber-500/40'
          }`} />
          <div
            className={`w-32 h-32 rounded-full flex items-center justify-center border backdrop-blur-md relative z-10 ${cfg.iconBg} ${cfg.iconBorder} ${cfg.glow}`}
          >
            <Icon size={56} className={cfg.iconColor} strokeWidth={2} />
          </div>
        </div>

        <h1 className="text-[28px] font-extrabold mb-2 text-center tracking-tight text-white">{cfg.title}</h1>
        <p className="text-xs font-bold text-gray-400 text-center mb-10 tracking-widest uppercase">
          {cfg.subtitle}
        </p>
        
        <div className="bg-white/5 border border-white/10 rounded-[24px] p-6 backdrop-blur-md w-full shadow-2xl">
          <p className="text-[14px] font-medium text-gray-300 text-center leading-relaxed mb-6">
            {result.rationale}
          </p>

          <div className="w-full space-y-3">
            {result.humeScores && (
              <div className="bg-black/50 rounded-xl px-4 py-3.5 flex items-center justify-between border border-white/5">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-gray-400" />
                  <p className="text-xs font-bold text-gray-300 tracking-wide uppercase">Biometrics</p>
                </div>
                <p
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{
                    color:
                      result.humeScores.verdict_hint === 'CLEAN'
                        ? '#34D399'
                        : result.humeScores.verdict_hint === 'FLAGGED'
                          ? '#F87171'
                          : '#FBBF24',
                  }}
                >
                  {result.humeScores.verdict_hint === 'CLEAN' && 'Stable'}
                  {result.humeScores.verdict_hint === 'AMBIGUOUS' && 'Mixed'}
                  {result.humeScores.verdict_hint === 'FLAGGED' && 'Distress'}
                </p>
              </div>
            )}

            {result.geminiSummary && result.geminiSummary.duress_signals.length > 0 && (
              <div className="bg-red-950/20 rounded-xl px-4 py-3.5 border border-red-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Eye size={16} className="text-red-400" />
                  <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Visual Risk Factors</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.geminiSummary.duress_signals.map((s) => (
                    <span key={s} className="text-[10px] font-bold bg-red-500/10 text-red-400 px-2.5 py-1 rounded-md border border-red-500/20 uppercase tracking-wider">
                      {s.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-none px-6 pb-10 relative z-10 pt-6">
        <button
          onClick={onBack}
          className="w-full py-4.5 rounded-[20px] flex items-center justify-center gap-2 text-white font-bold text-[15px] bg-white/10 hover:bg-white/15 active:scale-[0.98] transition-all border border-white/10 backdrop-blur-md shadow-lg"
          style={{ paddingBottom: '1.125rem', paddingTop: '1.125rem' }}
        >
          <ArrowLeft size={20} />
          Back to Home
        </button>
      </div>
    </div>
  )
}