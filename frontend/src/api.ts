import type { InitiateRes, Transaction, User } from './types'

function base(): string {
  return (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8000'
}

// Per-tab session id. Each new browser tab/window gets its own isolated DB
// + embedding cache on the backend. Refreshes within the same tab keep the
// session (state survives) — opening the link in a new tab is a clean slate.
const SESSION_KEY = 'bunqhack-session-id'

function makeSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const fresh = makeSessionId()
    sessionStorage.setItem(SESSION_KEY, fresh)
    return fresh
  } catch {
    // sessionStorage unavailable (private mode, SSR) — fall back to ephemeral.
    return makeSessionId()
  }
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return { 'X-Session-Id': getSessionId(), ...(extra ?? {}) }
}

export async function fetchUser(): Promise<User> {
  const res = await fetch(`${base()}/api/user`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/user failed: ${res.status}`)
  return res.json() as Promise<User>
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const res = await fetch(`${base()}/api/transactions`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/transactions failed: ${res.status}`)
  return res.json() as Promise<Transaction[]>
}

// scenario === null → force NO_RISK (no scenario pin, no WebSocket)
// scenario === string → pin scenario first, then initiate (MID or HIGH risk)
export async function initiateTransaction(
  merchant: string,
  amountEur: number,
  scenario: string | null,
): Promise<InitiateRes> {
  const b = base()
  if (scenario !== null) {
    const sc = await fetch(`${b}/api/mock/scenario/${scenario}`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!sc.ok) throw new Error(`POST /api/mock/scenario/${scenario} failed: ${sc.status}`)
  }
  const body: Record<string, unknown> = { amount_eur: amountEur, merchant }
  if (scenario === null) body.force_tier = 'NO_RISK'
  const res = await fetch(`${b}/api/transaction/initiate`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST /api/transaction/initiate failed: ${res.status}`)
  return res.json() as Promise<InitiateRes>
}

export async function resetMock(): Promise<void> {
  await fetch(`${base()}/api/mock/reset`, { method: 'POST', headers: authHeaders() })
}

export interface RiskPreview {
  tier: 'NO_RISK' | 'MID_RISK' | 'HIGH_RISK'
  merchant_reputation: 'GOOD' | 'BAD' | 'UNKNOWN'
  risk: number | null
  n_emb: number | null
  n_amt: number | null
  n_time: number | null
  p_merch: number | null
  descriptor: string | null
  cold_start: boolean
}

// Score a transaction WITHOUT persisting it. Use for the "check risk" button.
export async function previewRisk(merchant: string, amountEur: number): Promise<RiskPreview> {
  const res = await fetch(`${base()}/api/risk/preview`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ merchant, amount_eur: amountEur }),
  })
  if (!res.ok) throw new Error(`POST /api/risk/preview failed: ${res.status}`)
  return res.json() as Promise<RiskPreview>
}
