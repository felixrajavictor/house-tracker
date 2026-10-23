import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, HardHat, Package, Receipt, Wallet } from 'lucide-react'
import { localName, useT } from '../lib/i18n'
import { useData } from '../lib/data'
import { useUi } from '../lib/uiContext'
import { computeStats } from '../lib/stats'
import { fmtCompact, fmtDateShort, fmtINR, fmtMonth } from '../lib/format'
import { categorySlot, seriesColor } from '../lib/colors'
import { Avatar, Badge, Card, Empty, IconChip, SectionTitle, StatTile } from '../components/ui'
import { BarList, Meter, MonthlyColumns, type BarItem, type ColumnDatum } from '../components/charts'
import { CountUp } from '../components/CountUp'
import type { StageStatus } from '../lib/types'

const statusTone: Record<StageStatus, 'neutral' | 'warning' | 'good'> = { pending: 'neutral', ongoing: 'warning', done: 'good' }
const statusDot: Record<StageStatus, string> = { pending: 'var(--muted)', ongoing: 'var(--warning)', done: 'var(--good)' }

export default function Dashboard() {
  const { t, lang } = useT()
  const d = useData()
  const nav = useNavigate()
  const { openExpense } = useUi()
  const s = useMemo(() => computeStats(d), [d])

  const budget = d.settings?.budget ?? 0
  const balance = budget - s.spent
  const pct = budget > 0 ? s.spent / budget : 0

  const months = useMemo<ColumnDatum[]>(() => {
    const out: ColumnDatum[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      const v = s.byMonth.get(key) ?? { bills: 0, wages: 0 }
      out.push({ key, label: fmtMonth(key), values: [v.bills, v.wages] })
    }
    return out
  }, [s])

  const catItems = useMemo<BarItem[]>(() => {
    const arr = [...s.byCategory.entries()]
      .map(([k, value]) => {
        const c = k === 'wages' || k === 'none' ? undefined : d.categoryById.get(Number(k))
        const label = k === 'wages' ? t('dailyWages') : c ? localName(c, lang) : t('others')
        const slot = k === 'wages' ? 2 : categorySlot(c)
        return { label, value, slot }
      })
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value)
    if (arr.length <= 8) return arr
    const rest = arr.slice(7).reduce((a, i) => a + i.value, 0)
    return [...arr.slice(0, 7), { label: t('others'), value: rest, slot: 8 }]
  }, [s, d.categoryById, lang, t])

  const stageItems = d.stages.map((st) => ({ st, cost: s.byStage.get(st.id) ?? 0 })).filter((x) => x.cost > 0 || x.st.status !== 'pending')
  const untagged = s.byStage.get(0) ?? 0
  const doneCount = d.stages.filter((st) => st.status === 'done').length

  const memberItems = [...s.byMember.entries()]
    .map(([id, value]) => ({ id, name: d.profileById.get(id)?.name ?? '—', value }))
    .sort((a, b) => b.value - a.value)

  const recent = useMemo(() => {
    type Item = { id: string; date: string; created: string; title: string; sub: string; amount: number; slot: number; kind: 'expense' | 'worker'; name: string; onClick: () => void }
    const items: Item[] = []
    for (const e of d.expenses.slice(0, 10)) {
      const c = e.category_id != null ? d.categoryById.get(e.category_id) : undefined
      const sup = e.supplier_id != null ? d.supplierById.get(e.supplier_id) : undefined
      items.push({
        id: e.id,
        date: e.date,
        created: e.created_at,
        title: e.description || (c ? localName(c, lang) : t('others')),
        sub: [c && e.description ? localName(c, lang) : null, sup?.name].filter(Boolean).join(' · '),
        amount: e.amount,
        slot: categorySlot(c),
        kind: 'expense',
        name: '',
        onClick: () => openExpense(e),
      })
    }
    for (const p of d.payments.slice(0, 10)) {
      const w = d.workerById.get(p.worker_id)
      items.push({
        id: p.id,
        date: p.date,
        created: p.created_at,
        title: w?.name ?? '—',
        sub: p.kind === 'advance' ? t('advance') : t('wage'),
        amount: p.amount,
        slot: 2,
        kind: 'worker',
        name: w?.name ?? '?',
        onClick: () => nav(`/workers/${p.worker_id}`),
      })
    }
    return items.sort((a, b) => b.date.localeCompare(a.date) || b.created.localeCompare(a.created)).slice(0, 6)
  }, [d, lang, t, openExpense, nav])

  const statusLabel: Record<StageStatus, string> = { pending: t('statusPending'), ongoing: t('statusOngoing'), done: t('statusDone') }

  return (
    <div className="space-y-4 stagger">
      <section className="hero-gradient text-white rounded-3xl p-5 shadow-lg shadow-accent/25">
        <div className="flex items-center justify-between">
          <div className="text-sm/5 opacity-90">{t('spent')}</div>
          <div className="h-9 w-9 rounded-full bg-white/20 grid place-items-center">
            <Wallet size={18} />
          </div>
        </div>
        <div className="text-[2.6rem] leading-none font-bold tracking-tight mt-2 tabular-nums">
          <CountUp value={s.spent} format={fmtINR} />
        </div>
        <div className="text-sm opacity-90 mt-2">
          {t('ofBudget')} {fmtINR(budget)} · <span className="font-semibold">{Math.round(pct * 100)}%</span>
        </div>
        <Meter value={s.spent} max={budget} className="mt-3" onDark />
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-2xl bg-white/15 p-3 min-w-0 backdrop-blur-sm">
            <div className="text-xs opacity-90">{balance >= 0 ? t('balance') : t('overBudget')}</div>
            <div className="text-lg font-semibold tabular-nums truncate">
              <CountUp value={Math.abs(balance)} format={fmtINR} />
            </div>
          </div>
          <div className="rounded-2xl bg-white/15 p-3 min-w-0 backdrop-blur-sm">
            <div className="text-xs opacity-90">{t('pending')}</div>
            <div className="text-lg font-semibold tabular-nums truncate">
              <CountUp value={s.pending} format={fmtINR} />
            </div>
            <div className="text-[11px] opacity-80 mt-0.5 truncate">
              {t('toShops')} {fmtCompact(s.expensePending)} · {t('toWorkers')} {fmtCompact(Math.max(0, s.workerPending))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label={t('material')} value={fmtCompact(s.material)} slot={1} icon={<Package size={16} />} />
        <StatTile label={t('labour')} value={fmtCompact(s.labour)} slot={2} icon={<HardHat size={16} />} />
        <StatTile label={t('others')} value={fmtCompact(s.other)} slot={6} icon={<Receipt size={16} />} />
      </div>

      <Card>
        <SectionTitle>{t('byMonth')}</SectionTitle>
        <MonthlyColumns
          data={months}
          series={[
            { name: t('bills'), color: 'var(--series-1)' },
            { name: t('dailyWages'), color: 'var(--series-2)' },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>{t('byCategory')}</SectionTitle>
        {catItems.length ? <BarList items={catItems} /> : <Empty>{t('noData')}</Empty>}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle className="mb-0">{t('byStage')}</SectionTitle>
          <span className="text-xs text-ink-2">
            {doneCount}/{d.stages.length} {t('statusDone')}
          </span>
        </div>
        {/* progress strip: one segment per stage, coloured by status */}
        <div className="flex gap-1 mb-3">
          {d.stages.map((st) => (
            <span key={st.id} className="h-1.5 grow rounded-full" style={{ background: st.status === 'pending' ? 'var(--surface-2)' : statusDot[st.status] }} title={localName(st, lang)} />
          ))}
        </div>
        {stageItems.length === 0 && untagged === 0 ? (
          <Empty>{t('noData')}</Empty>
        ) : (
          <ul className="divide-y divide-line -mx-4">
            {stageItems.map(({ st, cost }) => (
              <li key={st.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: statusDot[st.status] }} />
                <span className="grow truncate">{localName(st, lang)}</span>
                <Badge tone={statusTone[st.status]}>{statusLabel[st.status]}</Badge>
                <span className="tabular-nums text-ink-2 shrink-0 w-24 text-right">{fmtINR(cost)}</span>
              </li>
            ))}
            {untagged > 0 && (
              <li className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-surface-2" />
                <span className="grow">{t('others')}</span>
                <span className="tabular-nums shrink-0 w-24 text-right">{fmtINR(untagged)}</span>
              </li>
            )}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>{t('byMember')}</SectionTitle>
        {memberItems.length ? (
          <ul className="divide-y divide-line -mx-4">
            {memberItems.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Avatar name={m.name} size="sm" />
                <span className="grow truncate font-medium">{m.name}</span>
                <span className="tabular-nums text-ink-2">{fmtINR(m.value)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{t('noData')}</Empty>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle className="mb-0">{t('recent')}</SectionTitle>
          <Link to="/expenses" className="text-sm text-accent inline-flex items-center">
            {t('viewAll')}
            <ChevronRight size={16} />
          </Link>
        </div>
        {recent.length ? (
          <ul className="divide-y divide-line -mx-4">
            {recent.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={r.onClick} className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-2 transition-colors">
                  {r.kind === 'worker' ? (
                    <Avatar name={r.name} size="sm" />
                  ) : (
                    <IconChip slot={r.slot} size="sm">
                      <Receipt size={15} />
                    </IconChip>
                  )}
                  <span className="grow min-w-0">
                    <span className="block truncate font-medium">{r.title}</span>
                    <span className="block text-xs text-ink-2 truncate">
                      {fmtDateShort(r.date)}
                      {r.sub && ` · ${r.sub}`}
                    </span>
                  </span>
                  <span className="tabular-nums font-semibold shrink-0" style={{ color: seriesColor(r.slot) }}>
                    {fmtINR(r.amount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{t('noExpenses')}</Empty>
        )}
      </Card>
    </div>
  )
}
