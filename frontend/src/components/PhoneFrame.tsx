import type { ReactNode } from 'react'
import { Wifi, Battery, Signal } from 'lucide-react'

export default function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-[414px] h-[896px] bg-[#2C2C2E] rounded-[60px] shadow-[0_0_100px_rgba(0,0,0,0.8)] p-[12px] flex flex-col border border-[#48484A]">
      {/* Hardware Buttons */}
      <div className="absolute top-[120px] left-[-3px] w-[3px] h-[30px] bg-[#48484A] rounded-l-md" />
      <div className="absolute top-[180px] left-[-3px] w-[3px] h-[60px] bg-[#48484A] rounded-l-md" />
      <div className="absolute top-[260px] left-[-3px] w-[3px] h-[60px] bg-[#48484A] rounded-l-md" />
      <div className="absolute top-[200px] right-[-3px] w-[3px] h-[90px] bg-[#48484A] rounded-r-md" />

      {/* Inner Screen */}
      <div className="relative w-full h-full bg-[#000000] rounded-[48px] overflow-hidden flex flex-col">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[130px] h-[32px] bg-[#000000] rounded-b-[24px] z-50 flex items-end justify-center pb-2">
          <div className="absolute top-0 left-[-16px] w-[16px] h-[16px] bg-transparent" style={{ boxShadow: '8px -8px 0 8px #000000', borderTopRightRadius: '16px' }} />
          <div className="absolute top-0 right-[-16px] w-[16px] h-[16px] bg-transparent" style={{ boxShadow: '-8px -8px 0 8px #000000', borderTopLeftRadius: '16px' }} />
          
          <div className="w-[45px] h-[5px] rounded-full bg-[#2C2C2E] opacity-70" />
        </div>

        {/* Status bar */}
        <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-8 pt-[14px] pointer-events-none">
          <span className="text-[14px] font-bold text-white tracking-tight ml-2">9:41</span>
          <div className="flex items-center gap-1.5 text-white mr-1">
            <Signal size={15} className="fill-white" />
            <Wifi size={15} className="fill-white" />
            <Battery size={18} className="fill-white" />
          </div>
        </div>

        {/* Screen Content */}
        <div className="flex flex-col w-full h-full overflow-hidden mask-image-rounded relative z-10">
          {children}
        </div>
        
        {/* Home Indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[134px] h-[5px] bg-white rounded-full z-50 pointer-events-none" />
      </div>
    </div>
  )
}