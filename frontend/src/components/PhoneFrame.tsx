import type { ReactNode } from 'react'

export default function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-[390px] h-[844px] bg-[#0A0A0A] rounded-[44px] shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col border border-[#2A2A2A]">
      {/* Status bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 pt-4 pointer-events-none">
        <span className="text-xs font-semibold text-white">9:41</span>
        <div className="flex items-center gap-1.5 text-white">
          <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
            <rect x="0" y="4" width="3" height="8" rx="1" opacity="0.4"/>
            <rect x="4.5" y="2.5" width="3" height="9.5" rx="1" opacity="0.6"/>
            <rect x="9" y="0.5" width="3" height="11.5" rx="1" opacity="0.8"/>
            <rect x="13.5" y="0" width="3" height="12" rx="1"/>
          </svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
            <path d="M8 2.4C10.5 2.4 12.7 3.5 14.2 5.2L15.5 3.9C13.6 1.8 11 0.5 8 0.5C5 0.5 2.4 1.8 0.5 3.9L1.8 5.2C3.3 3.5 5.5 2.4 8 2.4Z" opacity="0.4"/>
            <path d="M8 5.2C9.7 5.2 11.2 5.9 12.3 7.1L13.6 5.8C12.1 4.2 10.2 3.2 8 3.2C5.8 3.2 3.9 4.2 2.4 5.8L3.7 7.1C4.8 5.9 6.3 5.2 8 5.2Z" opacity="0.7"/>
            <path d="M8 8C9 8 9.9 8.4 10.5 9.1L8 12L5.5 9.1C6.1 8.4 7 8 8 8Z"/>
          </svg>
          <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
            <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="white" strokeOpacity="0.35"/>
            <rect x="2" y="2" width="17" height="8" rx="2" fill="white"/>
            <path d="M23 4.5V7.5C23.8 7.2 24.5 6.4 24.5 6C24.5 5.6 23.8 4.8 23 4.5Z" fill="white" fillOpacity="0.4"/>
          </svg>
        </div>
      </div>
      <div className="flex flex-col w-full h-full overflow-hidden">
        {children}
      </div>
    </div>
  )
}
