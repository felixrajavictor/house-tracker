import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { localName, useT } from '../lib/i18n'
import { useData } from '../lib/data'
import { useUi } from '../lib/uiContext'
import { computeStats } from '../lib/stats'
import { fmtCompact, fmtDateShort, fmtINR, fmtMonth } from '../lib/format'
import { Badge, Card, Empty, SectionTitle, StatTile } from '../components/ui'
import { BarList, Meter, MonthlyColumns, type ColumnDatum } from '../components/charts'
import type { StageStatus } from '../lib/types'

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

  const catItems = useMemo(() => {
    const arr = [...s.byCategory.entries()]
      .map(([k, value]) => {
        const c = k === 'wages' || k === 'none' ? undefined : d.categoryById.get(Number(k))
        const label = k === 'wages' ? t('dailyWages') : c ? localName(c, lang) : t('others')
        return { label, value }
      })
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value)
    if (arr.length <= 8) return arr
    const rest = arr.slice(7).reduce((a, i) => a + i.value, 0)
    return [...arr.slice(0, 7), { label: t('others'), value: rest }]
  }, [s, d.categoryById, lang, t])

  const stageItems = d.stages.map((st) => ({ st, cost: s.byStage.get(st.id) ?? 0 })).filter((x) => x.cost > 0 || x.st.status !== 'pending')
  const untagged = s.byStage.get(0) ?? 0

  const memberItems = [...s.byMember.entries()]
    .map(([id, value]) => ({ id, name: d.profileById.get(id)?.name ?? '—', value }))
    .sort((a, b) => b.value - a.value)

  const recent = useMemo(() => {
    type Item = { id: string; date: string; created: string; title: string; sub: string; amount: number; onClick: () => void }
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
        onClick: () => nav(`/workers/${p.worker_id}`),
      })
    }
    return items.sort((a, b) => b.date.localeCompare(a.date) || b.created.localeCompare(a.created)).slice(0, 6)
  }, [d, lang, t, openExpense, nav])

  const statusLabel: Record<StageStatus, string> = { pending: t('statusPending'), ongoing: t('statusOngoing'), done: t('statusDone') }

  return (
    <div className="space-y-4">
      <Card>
        <div className="text-sm text-ink-2">{t('spent')}</div>
        <div className="text-[2.5rem] leading-none font-semibold tracking-tight mt-1">{fmtINR(s.spent)}</div>
        <div className="text-sm text-ink-2 mt-2">
          {t('ofBudget')} {fmtINR(budget)} · {Math.round(pct * 100)}%
        </div>
        <Meter value={s.spent} max={budget} className="mt-3" />
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-surface-2 p-3 min-w-0">
            <div className="text-xs text-ink-2">{balance >= 0 ? t('balance') : t('overBudget')}</div>
            <div className={`text-lg font-semibold tabular-nums truncate ${balance < 0 ? 'text-critical' : ''}`}>{fmtINR(Math.abs(balance))}</div>
          </div>
          <div className="rounded-xl bg-surface-2 p-3 min-w-0">
            <div className="text-xs text-ink-2">{t('pending')}</div>
            <div className="text-lg font-semibold tabular-nums truncate">{fmtINR(s.pending)}</div>
            <div className="text-xs text-muted mt-0.5 truncate">
              {t('toShops')} {fmtCompact(s.expensePending)} · {t('toWorkers')} {fmtCompact(Math.max(0, s.workerPending))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label={t('material')} value={fmtCompact(s.material)} />
        <StatTile label={t('labour')} value={fmtCompact(s.labour)} />
        <StatTile label={t('others')} value={fmtCompact(s.other)} />
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
        <SectionTitle>{t('byStage')}</SectionTitle>
        {stageItems.length === 0 && untagged === 0 ? (
          <Empty>{t('noData')}</Empty>
        ) : (
          <ul className="divide-y divide-line -mx-4">
            {stageItems.map(({ st, cost }) => (
              <li key={st.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="grow truncate">{localName(st, lang)}</span>
                <Badge tone={st.status === 'ongoing' ? 'warning' : st.status === 'done' ? 'good' : 'neutral'}>{statusLabel[st.status]}</Badge>
                <span className="tabular-nums text-ink-2 shrink-0 w-24 text-right">{fmtINR(cost)}</span>
              </li>
            ))}
            {untagged > 0 && (
              <li className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-2">
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
              <li key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="truncate">{m.name}</span>
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
                <button type="button" onClick={r.onClick} className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-2">
                  <span className="text-xs text-muted w-12 shrink-0">{fmtDateShort(r.date)}</span>
                  <span className="grow min-w-0">
                    <span className="block truncate">{r.title}</span>
                    {r.sub && <span className="block text-xs text-ink-2 truncate">{r.sub}</span>}
                  </span>
                  <span className="tabular-nums font-medium shrink-0">{fmtINR(r.amount)}</span>
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
