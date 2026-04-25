import { Clock, ShieldAlert, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import type { TransactionStatus } from '../types'

const CONFIG: Record<TransactionStatus, { icon: any; color: string; bg: string; label: string }> = {
  APPROVED: { icon: CheckCircle2, color: 'text-gray-400', bg: 'bg-transparent', label: 'Card payment' },
  PENDING_VERIFICATION: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-800/50 border border-gray-700', label: 'Verifying...' },
  HELD_FOR_REVIEW: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10 border border-amber-500/20', label: 'Pending review' },
  FROZEN: { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-400/10 border border-red-500/20', label: 'Frozen' },
  REJECTED: { icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-800/50 border border-gray-700', label: 'Rejected' },
}

export default function StatusBadge({ status }: { status: TransactionStatus }) {
  const { icon: Icon, color, bg, label } = CONFIG[status] ?? CONFIG.APPROVED
  
  if (status === 'APPROVED') {
    return (
      <span className="text-[11px] font-bold text-gray-500 tracking-wide uppercase">
        {label}
      </span>
    )
  }

  return (
    <span className={`flex items-center gap-1.5 px-2 py-[3px] rounded-md w-fit ${bg}`}>
      <Icon size={12} className={color} strokeWidth={2.5} />
      <span className={`text-[10px] font-bold ${color} tracking-wider uppercase`}>{label}</span>
    </span>
  )
}