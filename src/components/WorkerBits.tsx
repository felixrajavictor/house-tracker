import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { TRADES, useT } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { supabase } from '../lib/supabase'
import { computeStats } from '../lib/stats'
import { errMsg, fmtINR } from '../lib/format'
import type { CashMode, Worker } from '../lib/types'
import { Badge, Button, Field, Group, Input, Segmented, Select, Sheet, Textarea } from './ui'

export { Avatar } from './ui'

/** Worker balance pill: positive = we owe them, negative = advance outstanding. */
export function BalanceBadge({ balance }: { balance: number }) {
  const { t } = useT()
  if (Math.abs(balance) < 1) return <Badge>{t('settled')}</Badge>
  const owe = balance > 0
  return (
    <Badge tone={owe ? 'serious' : 'warning'}>
      {owe ? t('toPay') : t('advance')} {fmtINR(Math.abs(balance))}
    </Badge>
  )
}

export function WorkerForm({ worker, onClose, onDeleted }: { worker?: Worker; onClose: () => void; onDeleted?: () => void }) {
  const { t, tradeName } = useT()
  const d = useData()
  const [f, setF] = useState({
    name: worker?.name ?? '',
    trade: worker?.trade ?? 'mason',
    daily_rate: worker ? String(worker.daily_rate) : '',
    phone: worker?.phone ?? '',
    active: worker?.active ?? true,
    notes: worker?.notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  async function save() {
    if (!f.name.trim()) return
    setBusy(true)
    setErr(null)
    try {
      const row = {
        name: f.name.trim(),
        trade: f.trade,
        daily_rate: Number(f.daily_rate) || 0,
        phone: f.phone.trim() || null,
        active: f.active,
        notes: f.notes.trim() || null,
      }
      const { error } = worker ? await supabase.from('workers').update(row).eq('id', worker.id) : await supabase.from('workers').insert(row)
      if (error) throw error
      await d.refresh()
      onClose()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function del() {
    if (!worker || !confirm(t('deleteWorkerConfirm'))) return
    setBusy(true)
    try {
      const { error } = await supabase.from('workers').delete().eq('id', worker.id)
      if (error) throw error
      await d.refresh()
      onClose()
      onDeleted?.()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={worker ? t('editWorker') : t('addWorker')}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {worker && (
            <Button variant="danger" size="lg" onClick={del} disabled={busy} aria-label={t('delete')}>
              <Trash2 size={18} />
            </Button>
          )}
          <Button className="grow" size="lg" onClick={save} disabled={busy || !f.name.trim()}>
            {busy ? t('saving') : t('save')}
          </Button>
        </div>
      }
    >
      <Field label={t('name')}>
        <Input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus={!worker} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('trade')}>
          <Select value={f.trade} onChange={(e) => set('trade', e.target.value)}>
            {TRADES.map((tr) => (
              <option key={tr} value={tr}>
                {tradeName(tr)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('dailyRate')}>
          <Input type="number" inputMode="numeric" placeholder="800" value={f.daily_rate} onChange={(e) => set('daily_rate', e.target.value)} />
        </Field>
      </div>
      <Field label={t('phone')}>
        <Input type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
      </Field>
      <Field label={t('notes')}>
        <Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      {worker && (
        <label className="flex items-center gap-3 py-1">
          <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
          <span>{t('active')}</span>
        </label>
      )}
      {err && <p className="text-sm text-critical">{err}</p>}
    </Sheet>
  )
}

export function PaySheet({
  worker,
  kind,
  defaultAmount,
  date,
  onClose,
}: {
  worker: Worker
  kind: 'wage' | 'advance'
  defaultAmount: number
  date: string
  onClose: () => void
}) {
  const { t } = useT()
  const d = useData()
  const { profile } = useAuth()
  const balance = useMemo(() => computeStats(d).workerBalances.get(worker.id)?.balance ?? 0, [d, worker.id])
  const [f, setF] = useState({
    amount: defaultAmount > 0 ? String(Math.round(defaultAmount)) : '',
    date,
    payment_mode: 'cash' as CashMode,
    notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  async function save() {
    const amount = Number(f.amount)
    if (!amount || amount <= 0) {
      setErr(t('amountRequired'))
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const { error } = await supabase.from('worker_payments').insert({
        date: f.date,
        worker_id: worker.id,
        amount,
        kind,
        payment_mode: f.payment_mode,
        paid_by: profile?.id ?? null,
        notes: f.notes.trim() || null,
      })
      if (error) throw error
      await d.refresh()
      onClose()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const amt = Number(f.amount)
  return (
    <Sheet
      title={`${kind === 'wage' ? t('payWage') : t('giveAdvance')} · ${worker.name}`}
      onClose={onClose}
      footer={
        <Button size="lg" className="w-full" onClick={save} disabled={busy}>
          {busy ? t('saving') : `${t('pay')}${amt > 0 ? ' ' + fmtINR(amt) : ''}`}
        </Button>
      }
    >
      <div className="rounded-xl bg-surface-2 p-3 text-sm flex items-center justify-between">
        <span className="text-ink-2">{t('balanceNow')}</span>
        <BalanceBadge balance={balance} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('amount')}>
          <Input type="number" inputMode="numeric" value={f.amount} onChange={(e) => set('amount', e.target.value)} autoFocus />
        </Field>
        <Field label={t('date')}>
          <Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
      </div>
      <Group label={t('paymentMode')}>
        <Segmented
          full
          value={f.payment_mode}
          onChange={(v) => set('payment_mode', v)}
          options={[
            { value: 'cash', label: t('cash') },
            { value: 'upi', label: 'UPI' },
            { value: 'bank', label: t('bank') },
          ]}
        />
      </Group>
      <Field label={t('notes')}>
        <Input value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      {err && <p className="text-sm text-critical">{err}</p>}
    </Sheet>
  )
}
