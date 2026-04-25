import { useState } from 'react'
import type { Transaction } from '../types'
import { Clock, Snowflake, AlertTriangle, XCircle } from 'lucide-react'

// Using Google Favicon API for highly reliable logos without auth/referrer blocks
const KNOWN_LOGOS: Record<string, string> = {
  'Albert Heijn': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://ah.nl&size=128',
  'Claude': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://anthropic.com&size=128',
  'DUO Dienst Uitvoering On...': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://duo.nl&size=128',
  'Zettle_* t Je van het': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://zettle.com&size=128',
  'Netflix': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://netflix.com&size=128',
  'Spotify': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://spotify.com&size=128',
  'Uber': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://uber.com&size=128',
  'Amazon': 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://amazon.com&size=128',
}

function LogoAvatar({ merchant }: { merchant: string }) {
  const [error, setError] = useState(false)
  
  const logoUrl = KNOWN_LOGOS[merchant] || Object.entries(KNOWN_LOGOS).find(([key]) => merchant.includes(key))?.[1]

  if (logoUrl && !error) {
    return (
      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden flex-none shadow-sm p-1">
        <img 
          src={logoUrl} 
          alt={merchant} 
          className="w-full h-full object-contain rounded-full" 
          onError={() => setError(true)} 
        />
      </div>
    )
  }

  // Fallback avatar
  return (
    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden flex-none shadow-sm">
      <span className="text-[15px] font-bold text-gray-800">
        {merchant.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

export default function TransactionRow({ tx, isLast }: { tx: Transaction; isLast?: boolean }) {
  const displayAmount = tx.amount_eur;
  const [int, dec] = displayAmount.toFixed(2).split('.')

  // Subtitle logic
  let subtitle = "Online Payment"
  let subtitleColor = "text-[#A0A0A0]"
  let StatusIcon = null
  let iconColor = ""
  let rowBg = "bg-[#1C1C1E]"

  if (tx.status === 'PENDING_VERIFICATION') {
    subtitle = "Verifying..."
    StatusIcon = Clock
    iconColor = "text-[#A0A0A0]"
  } else if (tx.status === 'HELD_FOR_REVIEW') {
    subtitle = "Pending Review"
    subtitleColor = "text-[#FFCC00]" // Yellow
    StatusIcon = AlertTriangle
    iconColor = "text-[#FFCC00]"
    rowBg = "bg-[#FFCC00]/10"
  } else if (tx.status === 'FROZEN') {
    subtitle = "Frozen"
    subtitleColor = "text-[#00E5FF]" // Celeste blue
    StatusIcon = Snowflake
    iconColor = "text-[#00E5FF]"
    rowBg = "bg-[#00E5FF]/10"
  } else if (tx.status === 'REJECTED') {
    subtitle = "Rejected"
    StatusIcon = XCircle
    iconColor = "text-[#FF3B30]"
  }

  return (
    <div className={`relative ${rowBg} hover:brightness-110 active:brightness-90 transition-all cursor-pointer`}>
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <LogoAvatar merchant={tx.merchant} />
          
          <div className="flex flex-col">
            <p className="text-[16px] font-medium text-white tracking-tight">{tx.merchant}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {StatusIcon && <StatusIcon size={12} className={iconColor} />}
              <p className={`text-[13px] ${subtitleColor} leading-none`}>{subtitle}</p>
            </div>
          </div>
        </div>

        <span className={`text-[17px] font-medium tracking-tight text-[#FF8C00]`}>
          € -{int}.<span className="text-[0.75em] leading-none">{dec}</span>
        </span>
      </div>
      
      {/* Separator line - rendered inside the row to fix background color overlapping issues */}
      {!isLast && (
        <div className="absolute bottom-0 left-[72px] right-0 h-[1px] bg-white/[0.05]" />
      )}
    </div>
  )
}