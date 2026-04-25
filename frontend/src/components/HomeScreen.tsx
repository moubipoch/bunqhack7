import { User as UserIcon, Clover, ScanLine, ArrowUp, ArrowDown, Plus, Search, Home, CreditCard, PiggyBank, TrendingUp, Bitcoin, Star, ChevronRight, Triangle } from 'lucide-react'
import type { Transaction, User } from '../types'
import TransactionRow from './TransactionRow'

function FormattedAmount({ amount, className = '', sign = '' }: { amount: number, className?: string, sign?: string }) {
  const absAmount = Math.abs(amount);
  const [int, dec] = absAmount.toFixed(2).split('.')
  return (
    <span className={className}>
      {sign}€ {int}.<span className="text-[0.75em] leading-none align-baseline">{dec}</span>
    </span>
  )
}

const NAV = [
  { icon: Home, label: 'Home', active: true },
  { icon: CreditCard, label: 'Cards', active: false },
  { icon: PiggyBank, label: 'Savings', active: false },
  { icon: TrendingUp, label: 'Stocks', active: false },
  { icon: Bitcoin, label: 'Crypto', active: false },
]

interface Props {
  user: User | null
  transactions: Transaction[]
}

export default function HomeScreen({ user, transactions }: Props) {
  const balance = user?.balance_eur ?? 653.40

  return (
    <div className="flex flex-col h-full bg-black text-white relative">
      <div className="flex-1 overflow-y-auto no-scrollbar pt-12 px-5 pb-6">
        
        {/* Header icons */}
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 rounded-full bg-[#E0E0E0] flex items-center justify-center overflow-hidden">
            <UserIcon size={32} className="text-white mt-3" strokeWidth={1.5} />
          </div>
          <div className="flex items-center gap-4">
            <Clover size={24} className="text-white" />
            <ScanLine size={24} className="text-white" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-[34px] font-bold mb-6 tracking-tight">Home</h1>

        {/* Net Wealth */}
        <div className="bg-[#1C1C1E] rounded-[24px] py-4 px-5 flex flex-col items-center justify-center relative mb-6">
          <p className="text-[#A0A0A0] text-[15px] mb-0.5">Net Wealth</p>
          <div className="flex items-center gap-1">
             <FormattedAmount amount={balance} className="text-[26px] font-medium" />
          </div>
          <p className="text-[#A0A0A0] text-[13px] mt-1 flex items-center gap-1.5">
            Today <Triangle size={8} className="fill-[#A0A0A0]" /> € 0.<span className="text-[10px]">00</span>
          </p>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A0A0A0]">
            <ChevronRight size={24} />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mb-8">
          <button className="flex-1 py-2.5 px-2 rounded-xl border border-[#E67E22] bg-[#E67E22]/10 flex items-center justify-center gap-2 active:bg-[#E67E22]/20 transition-colors">
            <div className="w-[18px] h-[18px] rounded-full bg-[#E67E22] flex items-center justify-center">
              <ArrowUp size={12} className="text-white" strokeWidth={3} />
            </div>
            <span className="text-white text-[14px] font-bold">Pay</span>
          </button>
          <button className="flex-1 py-2.5 px-2 rounded-xl border border-[#00A0FF] bg-[#00A0FF]/10 flex items-center justify-center gap-2 active:bg-[#00A0FF]/20 transition-colors">
            <div className="w-[18px] h-[18px] rounded-full bg-[#00A0FF] flex items-center justify-center">
              <ArrowDown size={12} className="text-white" strokeWidth={3} />
            </div>
            <span className="text-white text-[14px] font-bold">Request</span>
          </button>
          <button className="flex-1 py-2.5 px-2 rounded-xl border border-[#A000FF] bg-[#A000FF]/10 flex items-center justify-center gap-2 active:bg-[#A000FF]/20 transition-colors">
            <div className="w-[18px] h-[18px] rounded-full bg-[#A000FF] flex items-center justify-center">
              <Plus size={12} className="text-white" strokeWidth={3} />
            </div>
            <span className="text-white text-[14px] font-bold">Add Money</span>
          </button>
        </div>

        {/* Bank Accounts */}
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-[17px] font-bold text-white">Bank Accounts</h2>
          <FormattedAmount amount={balance} className="text-[15px] text-[#A0A0A0]" />
        </div>
        <div className="bg-[#1C1C1E] rounded-[24px] mb-8 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-white/[0.05]">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#D35400] flex items-center justify-center">
                <Star size={20} className="text-white fill-white" />
              </div>
              <span className="text-[17px] font-medium text-white">Principal</span>
            </div>
            <FormattedAmount amount={balance} className="text-[15px] text-white" />
          </div>
          <button className="w-full text-left p-4 text-[#00A0FF] text-[15px] font-medium active:bg-white/[0.02] transition-colors">
            Add an Extra Bank Account
          </button>
        </div>

        {/* Recent Transactions */}
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-[17px] font-bold text-white">Recent Transactions</h2>
          <Search size={20} className="text-white" />
        </div>
        
        <div className="bg-[#1C1C1E] rounded-[24px] overflow-hidden flex flex-col mb-4">
          {transactions.slice(0, 8).map((tx, idx) => (
            <TransactionRow key={tx.id} tx={tx} isLast={idx === Math.min(transactions.length, 8) - 1} />
          ))}
          {transactions.length === 0 && (
            <p className="text-sm text-[#A0A0A0] py-6 text-center">No transactions yet</p>
          )}
          {transactions.length > 0 && (
            <button className="w-full text-left p-4 text-[#00A0FF] text-[15px] font-medium active:bg-white/[0.02] transition-colors relative z-10 border-t border-white/[0.05]">
              Show more
            </button>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex-none bg-black border-t border-white/[0.05] pb-6 pt-2 px-6 z-20">
        <div className="flex items-center justify-between">
          {NAV.map(({ icon: Icon, label, active }) => (
            <button key={label} className="flex flex-col items-center gap-1 p-2 active:opacity-70 transition-opacity">
              <Icon
                size={24}
                className={`${active ? 'text-[#00A0FF]' : 'text-[#A0A0A0]'}`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className={`text-[11px] font-medium ${active ? 'text-[#00A0FF]' : 'text-[#A0A0A0]'}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}