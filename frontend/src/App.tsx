import { useCallback, useEffect, useState } from 'react'
import { fetchTransactions, fetchUser, initiateTransaction, resetMock } from './api'
import PhoneFrame from './components/PhoneFrame'
import HomeScreen from './components/HomeScreen'
import VerifyingScreen from './components/VerifyingScreen'
import ResultScreen from './components/ResultScreen'
import DemoControls from './components/DemoControls'
import { useVerification } from './hooks/useVerification'
import type { AudioSource } from './hooks/useAudioCapture'
import type {
  DemoButton,
  GeminiSummary,
  HumeScores,
  Tier,
  Transaction,
  User,
  VerifyResult,
} from './types'

type Screen = 'home' | 'verifying' | 'result'

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [user, setUser] = useState<User | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Active verification state
  const [verifyingTier, setVerifyingTier] = useState<Tier>('MID_RISK')
  const [verifyingMerchant, setVerifyingMerchant] = useState('')
  const [humeScores, setHumeScores] = useState<HumeScores | null>(null)
  const [geminiSummary, setGeminiSummary] = useState<GeminiSummary | null>(null)
  const [countdown, setCountdown] = useState(5)
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const [audioSource, setAudioSource] = useState<AudioSource>('silent')
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)

  const verify = useVerification()

  const loadData = useCallback(async () => {
    try {
      const [u, txs] = await Promise.all([fetchUser(), fetchTransactions()])
      setUser(u)
      setTransactions(txs)
    } catch (e) {
      console.error('Failed to load data:', e)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDemoButton = useCallback(
    async (button: DemoButton) => {
      setIsLoading(true)
      let res: Awaited<ReturnType<typeof initiateTransaction>>
      try {
        res = await initiateTransaction(button.merchant, button.amount, button.scenario)
      } catch (e) {
        setIsLoading(false)
        alert(`Error: ${String(e)}`)
        return
      }
      setIsLoading(false)

      // NO_RISK: auto-approved, skip verification entirely
      if (res.tier === 'NO_RISK') {
        setVerifyResult({
          verdict: 'APPROVED',
          rationale: 'Low-risk transaction — approved automatically.',
        })
        setScreen('result')
        await loadData()
        return
      }

      // MID / HIGH: launch WebSocket verification
      setVerifyingTier(res.tier)
      setVerifyingMerchant(button.merchant)
      setCountdown(5)
      setHumeScores(null)
      setGeminiSummary(null)
      setVerifyResult(null)
      setVideoStream(null)
      setAudioSource('silent')
      setScreen('verifying')

      verify.run({
        initiateRes: res,
        onHumeUpdate: setHumeScores,
        onGeminiUpdate: setGeminiSummary,
        onCountdown: setCountdown,
        onVideoStream: setVideoStream,
        onAudioSource: setAudioSource,
        onComplete: (result) => {
          setVerifyResult(result)
          setScreen('result')
        },
        onError: (msg) => {
          setVerifyResult({
            verdict: 'HELD_FOR_REVIEW',
            rationale: `Verification error: ${msg}`,
          })
          setScreen('result')
        },
      })
    },
    [verify, loadData],
  )

  const handleBack = useCallback(async () => {
    verify.cleanup()
    setVideoStream(null)
    setScreen('home')
    try {
      await resetMock()
    } catch {
      // ignore
    }
    await loadData()
  }, [verify, loadData])

  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="flex items-center gap-10">
        {/* Phone */}
        <PhoneFrame>
          {screen === 'home' && (
            <HomeScreen user={user} transactions={transactions} />
          )}
          {screen === 'verifying' && (
            <VerifyingScreen
              tier={verifyingTier}
              humeScores={humeScores}
              geminiSummary={geminiSummary}
              countdown={countdown}
              videoStream={videoStream}
              audioSource={audioSource}
              merchant={verifyingMerchant}
            />
          )}
          {screen === 'result' && verifyResult && (
            <ResultScreen result={verifyResult} onBack={handleBack} />
          )}
        </PhoneFrame>

        {/* Demo controls — outside the phone */}
        <DemoControls onDemoPress={handleDemoButton} isLoading={isLoading} />
      </div>
    </div>
  )
}
