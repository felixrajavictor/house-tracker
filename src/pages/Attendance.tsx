import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, format, parseISO } from 'date-fns'
import { localName, useT } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { supabase } from '../lib/supabase'
import { computeStats } from '../lib/stats'
import { errMsg, fmtINR, todayISO } from '../lib/format'
import type { Worker } from '../lib/types'
import { Button, Card, Empty, Field, Segmented, Select } from '../components/ui'
import { Avatar, BalanceBadge, PaySheet } from '../components/WorkerBits'

export default function Attendance() {
  const { t, lang } = useT()
  const d = useData()
  const { isEditor, profile } = useAuth()
  const nav = useNavigate()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [stageId, setStageId] = useState<number>(() => d.stages.find((s) => s.status === 'ongoing')?.id ?? 0)
  const [paying, setPaying] = useState<{ worker: Worker; amount: number } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const stats = useMemo(() => computeStats(d), [d])
  const workers = d.workers.filter((w) => w.active)
  const attByWorker = useMemo(() => new Map(d.attendance.filter((a) => a.date === date).map((a) => [a.worker_id, a])), [d.attendance, date])
  const paidByWorker = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of d.payments) if (p.date === date && p.kind === 'wage') m.set(p.worker_id, (m.get(p.worker_id) ?? 0) + p.amount)
    return m
  }, [d.payments, date])

  let totalWages = 0
  let totalPaid = 0
  for (const [wid, a] of attByWorker) {
    totalWages += a.day_fraction * a.rate
    totalPaid += paidByWorker.get(wid) ?? 0
  }
  const remaining = Math.max(0, totalWages - totalPaid)

  const shift = (n: number) => setDate(format(addDays(parseISO(date), n), 'yyyy-MM-dd'))

  async function mark(w: Worker, fraction: number) {
    setBusyId(w.id)
    setErr(null)
    try {
      if (fraction === 0) {
        const { error } = await supabase.from('attendance').delete().eq('date', date).eq('worker_id', w.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('attendance')
          .upsert({ date, worker_id: w.id, day_fraction: fraction, rate: w.daily_rate, stage_id: stageId || null }, { onConflict: 'date,worker_id' })
        if (error) throw error
      }
      await d.refresh()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusyId(null)
    }
  }

  async function payAll() {
    if (!confirm(t('confirmPayAll'))) return
    const rows = []
    for (const [wid, a] of attByWorker) {
      const due = a.day_fraction * a.rate - (paidByWorker.get(wid) ?? 0)
      if (due > 0) rows.push({ date, worker_id: wid, amount: due, kind: 'wage', payment_mode: 'cash', paid_by: profile?.id ?? null })
    }
    if (!rows.length) return
    setErr(null)
    const { error } = await supabase.from('worker_payments').insert(rows)
    if (error) setErr(errMsg(error))
    await d.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => nav(-1)} className="h-10 w-10 grid place-items-center rounded-full hover:bg-surface-2 -ml-2" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-semibold text-lg">{t('attendance')}</h1>
      </div>

      <Card className="flex items-center justify-between gap-2 py-3">
        <button type="button" onClick={() => shift(-1)} className="h-10 w-10 rounded-full grid place-items-center hover:bg-surface-2" aria-label="Previous day">
          <ChevronLeft />
        </button>
        <div className="text-center">
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="bg-transparent font-semibold text-center text-base" />
          {date !== today && (
            <button type="button" className="block mx-auto text-xs text-accent mt-0.5" onClick={() => setDate(today)}>
              {t('today')}
            </button>
          )}
        </div>
        <button type="button" onClick={() => shift(1)} disabled={date >= today} className="h-10 w-10 rounded-full grid place-items-center hover:bg-surface-2 disabled:opacity-30" aria-label="Next day">
          <ChevronRight />
        </button>
      </Card>

      {isEditor && (
        <Field label={t('stageForDay')}>
          <Select value={stageId} onChange={(e) => setStageId(Number(e.target.value))}>
            <option value={0}>—</option>
            {d.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {localName(s, lang)}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {workers.length === 0 ? (
        <Empty>{t('noActiveWorkers')}</Empty>
      ) : (
        <Card className="p-0 divide-y divide-line overflow-hidden">
          {workers.map((w) => {
            const a = attByWorker.get(w.id)
            const fraction = a?.day_fraction ?? 0
            const wage = a ? a.day_fraction * a.rate : 0
            const paid = paidByWorker.get(w.id) ?? 0
            const due = wage - paid
            const bal = stats.workerBalances.get(w.id)?.balance ?? 0
            return (
              <div key={w.id} className="p-3 space-y-2.5">
                <div className="flex items-center gap-3">
                  <Avatar name={w.name} />
                  <div className="grow min-w-0">
                    <div className="font-medium truncate">{w.name}</div>
                    <div className="text-xs text-ink-2 truncate">
                      {fmtINR(w.daily_rate)}/{t('day')}
                      {Math.abs(bal) >= 1 && (
                        <>
                          {' · '}
                          <BalanceBadge balance={bal} />
                        </>
                      )}
                    </div>
                  </div>
                  {a &&
                    (due > 0.5 ? (
                      isEditor && (
                        <Button size="sm" onClick={() => setPaying({ worker: w, amount: due })}>
                          {t('pay')} {fmtINR(due)}
                        </Button>
                      )
                    ) : (
                      <span className="text-xs font-medium text-good-text inline-flex items-center gap-1 shrink-0">
                        <Check size={14} />
                        {t('paid')} {fmtINR(paid)}
                      </span>
                    ))}
                </div>
                <Segmented
                  full
                  disabled={!isEditor || busyId === w.id}
                  value={fraction}
                  onChange={(v) => mark(w, v)}
                  options={[
                    { value: 0, label: t('absent') },
                    { value: 0.5, label: '½' },
                    { value: 1, label: t('full') },
                    { value: 1.5, label: '1½' },
                  ]}
                />
              </div>
            )
          })}
        </Card>
      )}

      {err && <p className="text-sm text-critical">{err}</p>}

      <Card className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-ink-2">{date === today ? t('todaysWages') : t('dayWages')}</div>
          <div className="text-xl font-semibold tabular-nums">{fmtINR(totalWages)}</div>
          <div className="text-xs text-muted">
            {t('paid')} {fmtINR(totalPaid)}
          </div>
        </div>
        {isEditor && remaining > 0.5 && (
          <Button onClick={payAll} className="shrink-0">
            {t('payAllRemaining')} · {fmtINR(remaining)}
          </Button>
        )}
      </Card>

      {paying && <PaySheet worker={paying.worker} kind="wage" defaultAmount={paying.amount} date={date} onClose={() => setPaying(null)} />}
    </div>
  )
}
