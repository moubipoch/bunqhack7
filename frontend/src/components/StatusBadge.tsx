import type { TransactionStatus } from '../types'

const CONFIG: Record<TransactionStatus, { dot: string; label: string }> = {
  APPROVED: { dot: 'bg-green-500', label: 'Approved' },
  PENDING_VERIFICATION: { dot: 'bg-yellow-400', label: 'Pending' },
  HELD_FOR_REVIEW: { dot: 'bg-amber-500', label: 'Held' },
  FROZEN: { dot: 'bg-red-500', label: 'Frozen' },
  REJECTED: { dot: 'bg-gray-400', label: 'Rejected' },
}

export default function StatusBadge({ status }: { status: TransactionStatus }) {
  const { dot, label } = CONFIG[status] ?? CONFIG.APPROVED
  return (
    <span className="flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-xs text-gray-500">{label}</span>
    </span>
  )
}
