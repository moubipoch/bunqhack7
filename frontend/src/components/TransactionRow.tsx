import type { Transaction } from '../types'
import StatusBadge from './StatusBadge'

export default function TransactionRow({ tx }: { tx: Transaction }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
          {tx.merchant.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">{tx.merchant}</p>
          <StatusBadge status={tx.status} />
        </div>
      </div>
      <span className="text-sm font-semibold text-gray-700">
        −€{tx.amount_eur.toFixed(2)}
      </span>
    </div>
  )
}
