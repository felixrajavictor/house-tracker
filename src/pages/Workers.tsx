import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ClipboardCheck, Plus } from 'lucide-react'
import { useT } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { computeStats } from '../lib/stats'
import { fmtDate, fmtINR, sum, todayISO } from '../lib/format'
import { Button, Card, Empty } from '../components/ui'
import { Avatar, BalanceBadge, WorkerForm } from '../components/WorkerBits'

export default function Workers() {
  const { t, tradeName } = useT()
  const d = useData()
  const { isEditor } = useAuth()
  const nav = useNavigate()
  const s = useMemo(() => computeStats(d), [d])
  const [showInactive, setShowInactive] = useState(false)
  const [adding, setAdding] = useState(false)

  const today = todayISO()
  const active = d.workers.filter((w) => w.active)
  const todayAtt = d.attendance.filter((a) => a.date === today)
  const todayWages = sum(todayAtt, (a) => a.day_fraction * a.rate)
  const todayPaid = sum(
    d.payments.filter((p) => p.date === today && p.kind === 'wage'),
    (p) => p.amount,
  )
  const list = d.workers.filter((w) => showInactive || w.active)
  const hasInactive = d.workers.some((w) => !w.active)

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-ink-2">
            {t('today')} · {fmtDate(today)}
          </div>
          <div className="text-2xl font-semibold mt-0.5">
            {todayAtt.length}/{active.length} <span className="text-base font-normal text-ink-2">{t('present')}</span>
          </div>
          <div className="text-sm text-ink-2 mt-0.5 truncate">
            {t('todaysWages')} {fmtINR(todayWages)} · {t('paidToday')} {fmtINR(todayPaid)}
          </div>
        </div>
        <Button onClick={() => nav('/attendance')} className="shrink-0">
          <ClipboardCheck size={18} />
          {t('markAttendance')}
        </Button>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          {t('workers')} ({list.length})
        </h2>
        {isEditor && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus size={16} />
            {t('addWorker')}
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <Empty>{t('noWorkers')}</Empty>
      ) : (
        <Card className="p-0 divide-y divide-line overflow-hidden">
          {list.map((w) => {
            const b = s.workerBalances.get(w.id)
            return (
              <button key={w.id} type="button" onClick={() => nav(`/workers/${w.id}`)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-surface-2">
                <Avatar name={w.name} />
                <div className="grow min-w-0">
                  <div className="font-medium truncate">
                    {w.name}
                    {!w.active && <span className="ml-2 text-xs text-muted font-normal">({t('inactive')})</span>}
                  </div>
                  <div className="text-xs text-ink-2 truncate">
                    {tradeName(w.trade)} · {fmtINR(w.daily_rate)}/{t('day')}
                  </div>
                </div>
                <BalanceBadge balance={b?.balance ?? 0} />
                <ChevronRight className="text-muted shrink-0" size={18} />
              </button>
            )
          })}
        </Card>
      )}

      {hasInactive && (
        <button type="button" className="text-sm text-accent px-1" onClick={() => setShowInactive((v) => !v)}>
          {showInactive ? t('hideInactive') : t('showInactive')}
        </button>
      )}

      {adding && <WorkerForm onClose={() => setAdding(false)} />}
    </div>
  )
}
