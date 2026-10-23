import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { localName, useT } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { supabase } from '../lib/supabase'
import { computeStats } from '../lib/stats'
import { fmtDate, fmtINR, monthKey, sum, todayISO } from '../lib/format'
import type { WorkerPayment } from '../lib/types'
import { Button, Card, Empty, Segmented } from '../components/ui'
import { Avatar, PaySheet, WorkerForm } from '../components/WorkerBits'

export default function WorkerDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { t, lang, tradeName } = useT()
  const d = useData()
  const { isEditor } = useAuth()
  const [edit, setEdit] = useState(false)
  const [pay, setPay] = useState<'wage' | 'advance' | null>(null)
  const [tab, setTab] = useState<'attendance' | 'payments'>('attendance')

  const w = id ? d.workerById.get(id) : undefined
  const s = useMemo(() => computeStats(d), [d])
  const att = useMemo(() => d.attendance.filter((a) => a.worker_id === id).sort((a, b) => b.date.localeCompare(a.date)), [d.attendance, id])
  const pays = useMemo(() => d.payments.filter((p) => p.worker_id === id), [d.payments, id])

  if (!w) return <Empty>{t('noData')}</Empty>
  const b = s.workerBalances.get(w.id) ?? { earned: 0, paid: 0, balance: 0, days: 0 }
  const thisMonth = monthKey(todayISO())
  const daysThisMonth = sum(
    att.filter((a) => monthKey(a.date) === thisMonth),
    (a) => a.day_fraction,
  )

  async function delPayment(p: WorkerPayment) {
    if (!confirm(t('confirmDelete'))) return
    await supabase.from('worker_payments').delete().eq('id', p.id)
    await d.refresh()
  }

  const fractionLabel = (f: number) => (f === 1 ? t('full') : f === 0.5 ? t('half') : `${f}×`)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => nav('/workers')} className="h-10 w-10 grid place-items-center rounded-full hover:bg-surface-2 -ml-2" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <Avatar name={w.name} />
        <div className="grow min-w-0">
          <h1 className="font-semibold text-lg truncate">
            {w.name}
            {!w.active && <span className="ml-2 text-xs text-muted font-normal">({t('inactive')})</span>}
          </h1>
          <div className="text-sm text-ink-2 truncate">
            {tradeName(w.trade)} · {fmtINR(w.daily_rate)}/{t('day')}
            {w.phone && ` · ${w.phone}`}
          </div>
        </div>
        {isEditor && (
          <Button variant="secondary" size="sm" onClick={() => setEdit(true)}>
            <Pencil size={14} />
            {t('edit')}
          </Button>
        )}
      </div>

      <Card className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xs text-ink-2">{t('earned')}</div>
          <div className="font-semibold tabular-nums mt-0.5">{fmtINR(b.earned)}</div>
        </div>
        <div>
          <div className="text-xs text-ink-2">{t('paid')}</div>
          <div className="font-semibold tabular-nums mt-0.5">{fmtINR(b.paid)}</div>
        </div>
        <div>
          <div className="text-xs text-ink-2">{Math.abs(b.balance) < 1 ? t('balanceNow') : b.balance > 0 ? t('toPay') : t('advanceGiven')}</div>
          <div className={`font-semibold tabular-nums mt-0.5 ${b.balance > 0.5 ? 'text-critical' : ''}`}>{Math.abs(b.balance) < 1 ? t('settled') : fmtINR(Math.abs(b.balance))}</div>
        </div>
      </Card>

      <div className="text-sm text-ink-2 px-1">
        {b.days} {t('daysWorked')} · {daysThisMonth} {t('thisMonthShort')}
      </div>

      {isEditor && (
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" onClick={() => setPay('wage')}>
            {t('payWage')}
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setPay('advance')}>
            {t('giveAdvance')}
          </Button>
        </div>
      )}

      <Segmented
        full
        value={tab}
        onChange={setTab}
        options={[
          { value: 'attendance', label: `${t('attendance')} (${att.length})` },
          { value: 'payments', label: `${t('payments')} (${pays.length})` },
        ]}
      />

      {tab === 'attendance' ? (
        att.length ? (
          <Card className="p-0 divide-y divide-line overflow-hidden">
            {att.slice(0, 120).map((a) => {
              const st = a.stage_id != null ? d.stageById.get(a.stage_id) : undefined
              return (
                <div key={a.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <div className="font-medium">{fmtDate(a.date)}</div>
                    <div className="text-xs text-ink-2">{st ? localName(st, lang) : fractionLabel(a.day_fraction)}</div>
                  </div>
                  <div className="text-right">
                    <div className="tabular-nums">{fmtINR(a.day_fraction * a.rate)}</div>
                    {st && <div className="text-xs text-ink-2">{fractionLabel(a.day_fraction)}</div>}
                  </div>
                </div>
              )
            })}
          </Card>
        ) : (
          <Empty>{t('noHistory')}</Empty>
        )
      ) : pays.length ? (
        <Card className="p-0 divide-y divide-line overflow-hidden">
          {pays.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 text-sm">
              <div className="grow min-w-0">
                <div className="font-medium">
                  {fmtDate(p.date)} · {p.kind === 'advance' ? t('advance') : t('wage')}
                </div>
                <div className="text-xs text-ink-2 truncate">
                  {[t(p.payment_mode), p.paid_by ? d.profileById.get(p.paid_by)?.name : null, p.notes].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="tabular-nums font-medium">{fmtINR(p.amount)}</div>
              {isEditor && (
                <button type="button" onClick={() => delPayment(p)} className="h-8 w-8 grid place-items-center text-muted hover:text-critical" aria-label={t('delete')}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </Card>
      ) : (
        <Empty>{t('noHistory')}</Empty>
      )}

      {edit && <WorkerForm worker={w} onClose={() => setEdit(false)} onDeleted={() => nav('/workers')} />}
      {pay && <PaySheet worker={w} kind={pay} defaultAmount={pay === 'wage' ? Math.max(0, b.balance) : 0} date={todayISO()} onClose={() => setPay(null)} />}
    </div>
  )
}
