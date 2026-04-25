import { useEffect, useState } from 'react'
import { Shield, Fingerprint, Video, ShieldAlert } from 'lucide-react'

const STEPS = [
  {
    title: 'The Future of Security.',
    subtitle: 'Zero-friction biometric verification for high-risk transactions.',
    icon: Shield,
    color: 'text-white'
  },
  {
    title: 'Real-time Telemetry.',
    subtitle: 'Analyzing voice patterns and distress markers instantly.',
    icon: Fingerprint,
    color: 'text-indigo-400'
  },
  {
    title: 'Human Interception.',
    subtitle: 'Suspicious transactions are gracefully paused for manual review.',
    icon: ShieldAlert,
    color: 'text-amber-400'
  },
  {
    title: 'Seamless Integration.',
    subtitle: 'All happening seamlessly within the bunq app ecosystem.',
    icon: Shield,
    color: 'text-white'
  },
  {
    title: 'Visual Risk Factors.',
    subtitle: 'Live environment scanning to detect physical duress.',
    icon: Video,
    color: 'text-fuchsia-400'
  },
  {
    title: 'Absolute Security.',
    subtitle: 'Fraud is frozen before the money leaves the account.',
    icon: ShieldAlert,
    color: 'text-red-400'
  },
  {
    title: 'bunq.',
    subtitle: 'Bank of the free. And the secure.',
    icon: Shield,
    color: 'text-white'
  }
]

export default function CinematicText({ step }: { step: number }) {
  const [visible, setVisible] = useState(false)
  const current = STEPS[Math.min(step, STEPS.length - 1)]

  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 300) // wait for exit animation
    return () => clearTimeout(t)
  }, [step])

  const Icon = current.icon

  return (
    <div className="flex flex-col items-start max-w-[500px]">
      <div 
        className={`transition-all duration-1000 ease-out transform ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className={`mb-6 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md inline-block shadow-2xl`}>
          <Icon size={32} className={current.color} strokeWidth={1.5} />
        </div>
        <h1 className="text-[48px] font-extrabold text-white leading-[1.1] tracking-tight mb-6">
          {current.title}
        </h1>
        <p className="text-[20px] font-medium text-gray-400 leading-relaxed max-w-[400px]">
          {current.subtitle}
        </p>
      </div>
    </div>
  )
}
