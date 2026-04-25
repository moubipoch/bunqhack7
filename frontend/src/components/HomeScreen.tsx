import type { Transaction, User } from '../types'

// Deterministic color per merchant
const PALETTE = ['#7C3AED', '#2563EB', '#0D9488', '#D97706', '#16A34A', '#C2410C', '#0369A1', '#7E22CE']
function avatarColor(merchant: string): string {
  const h = merchant.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return PALETTE[h % PALETTE.length]
}

function formatAmount(amount: number, status: string): JSX.Element {
  const isIncome = status === 'APPROVED' && amount < 0
  return (
    <span className={isIncome ? 'text-green-400' : 'text-[#F97316]'}>
      −€{amount.toFixed(2)}
    </span>
  )
}

const NAV = [
  { icon: '⌂', label: 'Home', active: true },
  { icon: '▣', label: 'Cards', active: false },
  { icon: '◎', label: 'Savings', active: false },
  { icon: '↗', label: 'Stocks', active: false },
  { icon: '₿', label: 'Crypto', active: false },
]

interface Props {
  user: User | null
  transactions: Transaction[]
}

export default function HomeScreen({ user, transactions }: Props) {
  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] text-white overflow-y-auto">
      {/* Top padding for status bar */}
      <div className="pt-14 px-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-3xl font-bold text-white">Home</h1>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold">
            {user?.name?.charAt(0) ?? 'L'}
          </div>
        </div>

        {/* Spending insight */}
        <div className="flex items-center gap-3 bg-[#1A1A1A] rounded-2xl px-4 py-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
            <span className="text-orange-400 text-base">↑</span>
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              Balance: €{user?.balance_eur.toLocaleString('nl-NL', { minimumFractionDigits: 2 }) ?? '–'}
            </p>
            <p className="text-xs text-gray-500">Personal • NL15 BUNQ 2100 0752 09</p>
          </div>
          <span className="ml-auto text-gray-600 text-sm">›</span>
        </div>

        {/* Action row */}
        <div className="flex gap-2 mb-6">
          {[
            { label: '↑ Pay', from: 'from-orange-500', to: 'to-red-500' },
            { label: '↓ Request', from: 'from-blue-600', to: 'to-blue-400' },
            { label: '+ Add', from: 'from-purple-600', to: 'to-purple-400' },
          ].map(({ label, from, to }) => (
            <button
              key={label}
              className={`flex-1 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r ${from} ${to}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Recent transactions */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Recent Transactions
            </p>
            <button className="text-xs text-purple-400">Search</button>
          </div>

          <div className="space-y-1">
            {transactions.slice(0, 6).map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 py-3 border-b border-[#1A1A1A] last:border-0">
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-none"
                  style={{ background: avatarColor(tx.merchant) }}
                >
                  {tx.merchant.charAt(0).toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{tx.merchant}</p>
                  <p className="text-xs text-gray-500">
                    {tx.status === 'HELD_FOR_REVIEW'
                      ? '⚠ Held for review'
                      : tx.status === 'FROZEN'
                        ? '✕ Frozen'
                        : 'Card payment'}
                  </p>
                </div>
                {/* Amount */}
                <span className="text-sm font-semibold text-[#F97316] flex-none">
                  −€{tx.amount_eur.toFixed(2)}
                </span>
              </div>
            ))}
            {transactions.length === 0 && (
              <p className="text-sm text-gray-600 py-4 text-center">No transactions yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom nav */}
      <div className="flex-none border-t border-[#1A1A1A] bg-[#0A0A0A]">
        <div className="flex items-center justify-around px-2 py-2">
          {NAV.map(({ icon, label, active }) => (
            <button key={label} className="flex flex-col items-center gap-0.5 px-3 py-1.5">
              <span className={`text-lg ${active ? 'text-white' : 'text-gray-600'}`}>{icon}</span>
              <span className={`text-[10px] ${active ? 'text-white font-medium' : 'text-gray-600'}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
