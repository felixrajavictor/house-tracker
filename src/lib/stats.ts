import type { DataCtx } from './data'
import { monthKey, sum } from './format'

export interface WorkerBalance {
  earned: number
  paid: number
  /** earned − paid: positive = we owe the worker, negative = advance outstanding */
  balance: number
  days: number
}

type Input = Pick<DataCtx, 'expenses' | 'attendance' | 'payments' | 'workers' | 'categoryById'>

/**
 * Money model:
 *  - "spent" is cost incurred: every bill's full amount + every day's wages earned (credit included)
 *  - "paid out" is cash that actually left: bills' paid_amount + worker payments (wages and advances)
 *  - "pending" = what is still owed to shops and to workers
 */
export function computeStats(d: Input) {
  const expenseTotal = sum(d.expenses, (e) => e.amount)
  const expensePaid = sum(d.expenses, (e) => e.paid_amount)
  const expensePending = expenseTotal - expensePaid

  const wagesEarned = sum(d.attendance, (a) => a.day_fraction * a.rate)
  const wagesPaid = sum(d.payments, (p) => p.amount)
  const workerPending = wagesEarned - wagesPaid

  const spent = expenseTotal + wagesEarned
  const paidOut = expensePaid + wagesPaid
  const pending = expensePending + Math.max(0, workerPending)

  let material = 0
  let labour = wagesEarned
  let other = 0
  const byCategory = new Map<string, number>()
  const add = <K,>(m: Map<K, number>, k: K, v: number) => m.set(k, (m.get(k) ?? 0) + v)

  for (const e of d.expenses) {
    const c = e.category_id != null ? d.categoryById.get(e.category_id) : undefined
    const kind = c?.kind ?? 'other'
    if (kind === 'material') material += e.amount
    else if (kind === 'labour') labour += e.amount
    else other += e.amount
    add(byCategory, c ? String(c.id) : 'none', e.amount)
  }
  if (wagesEarned > 0) byCategory.set('wages', wagesEarned)

  const byMonth = new Map<string, { bills: number; wages: number }>()
  for (const e of d.expenses) {
    const m = monthKey(e.date)
    const cur = byMonth.get(m) ?? { bills: 0, wages: 0 }
    cur.bills += e.amount
    byMonth.set(m, cur)
  }
  for (const a of d.attendance) {
    const m = monthKey(a.date)
    const cur = byMonth.get(m) ?? { bills: 0, wages: 0 }
    cur.wages += a.day_fraction * a.rate
    byMonth.set(m, cur)
  }

  // Stage cost = bills tagged to the stage + wages for days tagged to the stage; 0 = untagged
  const byStage = new Map<number, number>()
  for (const e of d.expenses) add(byStage, e.stage_id ?? 0, e.amount)
  for (const a of d.attendance) add(byStage, a.stage_id ?? 0, a.day_fraction * a.rate)

  // Who actually handed over the money
  const byMember = new Map<string, number>()
  for (const e of d.expenses) if (e.paid_by) add(byMember, e.paid_by, e.paid_amount)
  for (const p of d.payments) if (p.paid_by) add(byMember, p.paid_by, p.amount)

  const workerBalances = new Map<string, WorkerBalance>()
  for (const w of d.workers) workerBalances.set(w.id, { earned: 0, paid: 0, balance: 0, days: 0 })
  for (const a of d.attendance) {
    const b = workerBalances.get(a.worker_id)
    if (b) {
      b.earned += a.day_fraction * a.rate
      b.days += a.day_fraction
    }
  }
  for (const p of d.payments) {
    const b = workerBalances.get(p.worker_id)
    if (b) b.paid += p.amount
  }
  for (const b of workerBalances.values()) b.balance = b.earned - b.paid

  return {
    expenseTotal,
    expensePaid,
    expensePending,
    wagesEarned,
    wagesPaid,
    workerPending,
    spent,
    paidOut,
    pending,
    material,
    labour,
    other,
    byCategory,
    byMonth,
    byStage,
    byMember,
    workerBalances,
  }
}

export type Stats = ReturnType<typeof computeStats>
