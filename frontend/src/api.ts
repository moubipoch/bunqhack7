import type { InitiateRes, Transaction, User } from './types'

function base(): string {
  return (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8000'
}

export async function fetchUser(): Promise<User> {
  const res = await fetch(`${base()}/api/user`)
  if (!res.ok) throw new Error(`GET /api/user failed: ${res.status}`)
  return res.json() as Promise<User>
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const res = await fetch(`${base()}/api/transactions`)
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
    const sc = await fetch(`${b}/api/mock/scenario/${scenario}`, { method: 'POST' })
    if (!sc.ok) throw new Error(`POST /api/mock/scenario/${scenario} failed: ${sc.status}`)
  }
  const body: Record<string, unknown> = { amount_eur: amountEur, merchant }
  if (scenario === null) body.force_tier = 'NO_RISK'
  const res = await fetch(`${b}/api/transaction/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST /api/transaction/initiate failed: ${res.status}`)
  return res.json() as Promise<InitiateRes>
}

export async function resetMock(): Promise<void> {
  await fetch(`${base()}/api/mock/reset`, { method: 'POST' })
}
