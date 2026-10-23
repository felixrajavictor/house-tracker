import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { errMsg, num } from './format'
import type {
  AllowedMember,
  Attendance,
  Category,
  Expense,
  Profile,
  Settings,
  Stage,
  Supplier,
  Worker,
  WorkerPayment,
} from './types'

export interface DataState {
  settings: Settings | null
  stages: Stage[]
  categories: Category[]
  suppliers: Supplier[]
  expenses: Expense[]
  workers: Worker[]
  attendance: Attendance[]
  payments: WorkerPayment[]
  profiles: Profile[]
  members: AllowedMember[]
}

const empty: DataState = {
  settings: null,
  stages: [],
  categories: [],
  suppliers: [],
  expenses: [],
  workers: [],
  attendance: [],
  payments: [],
  profiles: [],
  members: [],
}

export type DataCtx = DataState & {
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  categoryById: Map<number, Category>
  stageById: Map<number, Stage>
  supplierById: Map<number, Supplier>
  profileById: Map<string, Profile>
  workerById: Map<string, Worker>
}

const Ctx = createContext<DataCtx>(null!)

/** PostgREST caps a response at 1000 rows, so page through until a short page comes back. */
async function fetchAll<T>(table: string, order: string[] = []): Promise<T[]> {
  const page = 1000
  const out: T[] = []
  for (let from = 0; ; from += page) {
    let q = supabase.from(table).select('*').range(from, from + page - 1)
    for (const col of order) q = q.order(col, { ascending: false })
    const { data, error } = await q
    if (error) throw error
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < page) break
  }
  return out
}

const byDateDesc = <T extends { date: string; created_at?: string }>(a: T, b: T) =>
  b.date.localeCompare(a.date) || (b.created_at ?? '').localeCompare(a.created_at ?? '')

export function DataProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [state, setState] = useState<DataState>(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [settings, stages, categories, suppliers, expenses, workers, attendance, payments, profiles, members] =
        await Promise.all([
          supabase
            .from('settings')
            .select('*')
            .eq('id', 1)
            .maybeSingle()
            .then((r) => {
              if (r.error) throw r.error
              return r.data as Settings | null
            }),
          fetchAll<Stage>('stages'),
          fetchAll<Category>('categories'),
          fetchAll<Supplier>('suppliers'),
          fetchAll<Expense>('expenses', ['date', 'created_at']),
          fetchAll<Worker>('workers'),
          fetchAll<Attendance>('attendance', ['date']),
          fetchAll<WorkerPayment>('worker_payments', ['date', 'created_at']),
          fetchAll<Profile>('profiles'),
          fetchAll<AllowedMember>('allowed_members'),
        ])
      setState({
        settings: settings ? { ...settings, budget: num(settings.budget) } : null,
        stages: stages.sort((a, b) => a.sort_order - b.sort_order),
        categories: categories.sort((a, b) => a.sort_order - b.sort_order),
        suppliers: suppliers.sort((a, b) => a.name.localeCompare(b.name)),
        expenses: expenses
          .map((e) => ({
            ...e,
            amount: num(e.amount),
            paid_amount: num(e.paid_amount),
            quantity: e.quantity == null ? null : num(e.quantity),
          }))
          .sort(byDateDesc),
        workers: workers.map((w) => ({ ...w, daily_rate: num(w.daily_rate) })).sort((a, b) => a.name.localeCompare(b.name)),
        attendance: attendance.map((a) => ({ ...a, day_fraction: num(a.day_fraction), rate: num(a.rate) })),
        payments: payments.map((p) => ({ ...p, amount: num(p.amount) })).sort(byDateDesc),
        profiles: profiles.sort((a, b) => a.name.localeCompare(b.name)),
        members: members.sort((a, b) => a.name.localeCompare(b.name)),
      })
      setError(null)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const profileId = profile?.id
  useEffect(() => {
    if (!profileId) return
    refresh()
    // Any change by any family member → debounce and reload everything (the data set is small)
    let timer: number | undefined
    const channel = supabase
      .channel('house-db')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        window.clearTimeout(timer)
        timer = window.setTimeout(() => void refresh(), 400)
      })
      .subscribe()
    return () => {
      window.clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [profileId, refresh])

  const value = useMemo<DataCtx>(
    () => ({
      ...state,
      loading,
      error,
      refresh,
      categoryById: new Map(state.categories.map((c) => [c.id, c])),
      stageById: new Map(state.stages.map((s) => [s.id, s])),
      supplierById: new Map(state.suppliers.map((s) => [s.id, s])),
      profileById: new Map(state.profiles.map((p) => [p.id, p])),
      workerById: new Map(state.workers.map((w) => [w.id, w])),
    }),
    [state, loading, error, refresh],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useData = () => useContext(Ctx)
