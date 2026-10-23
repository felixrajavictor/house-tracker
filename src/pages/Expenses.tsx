import { useMemo, useState } from 'react'
import { HardHat, Package, Paperclip, Receipt, Truck } from 'lucide-react'
import { localName, useT } from '../lib/i18n'
import { useData } from '../lib/data'
import { useUi } from '../lib/uiContext'
import { fmtDate, fmtINR, monthKey, todayISO } from '../lib/format'
import type { CategoryKind, Expense } from '../lib/types'
import { Badge, Card, Chip, Empty, IconChip, Input, Select } from '../components/ui'
import { categorySlot } from '../lib/colors'

const kindIcon: Record<CategoryKind, typeof Package> = { material: Package, labour: HardHat, service: Truck, other: Receipt }

export default function Expenses() {
  const { t, lang } = useT()
  const d = useData()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'month' | 'pending'>('all')
  const [cat, setCat] = useState(0)
  const thisMonth = monthKey(todayISO())

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return d.expenses.filter((e) => {
      if (filter === 'month' && monthKey(e.date) !== thisMonth) return false
      if (filter === 'pending' && e.paid_amount >= e.amount) return false
      if (cat && e.category_id !== cat) return false
      if (ql) {
        const c = e.category_id != null ? d.categoryById.get(e.category_id) : undefined
        const sup = e.supplier_id != null ? d.supplierById.get(e.supplier_id) : undefined
        const hay = [e.description, e.notes, sup?.name, c?.name_en, c?.name_ta, String(e.amount)].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(ql)) return false
      }
      return true
    })
  }, [d.expenses, d.categoryById, d.supplierById, q, filter, cat, thisMonth])

  const groups = useMemo(() => {
    const m = new Map<string, Expense[]>()
    for (const e of list) {
      const arr = m.get(e.date)
      if (arr) arr.push(e)
      else m.set(e.date, [e])
    }
    return [...m.entries()]
  }, [list])

  const total = list.reduce((a, e) => a + e.amount, 0)

  return (
    <div className="space-y-3">
      <Input placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} type="search" />
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          {t('all')}
        </Chip>
        <Chip active={filter === 'month'} onClick={() => setFilter('month')}>
          {t('thisMonth')}
        </Chip>
        <Chip active={filter === 'pending'} onClick={() => setFilter('pending')}>
          {t('pendingOnly')}
        </Chip>
        <Select compact value={cat} onChange={(e) => setCat(Number(e.target.value))} className="rounded-full text-sm max-w-none">
          <option value={0}>{t('allCategories')}</option>
          {d.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {localName(c, lang)}
            </option>
          ))}
        </Select>
      </div>
      <div className="text-sm text-ink-2 px-1">
        {list.length} {t('entries')} · <span className="font-medium text-ink tabular-nums">{fmtINR(total)}</span>
      </div>

      {groups.length === 0 && <Empty>{d.expenses.length === 0 ? t('noExpenses') : t('noData')}</Empty>}

      {groups.map((group) => (
        <div key={group[0]} className="animate-fade-up">
          <div className="text-xs font-medium text-muted px-1 mb-1.5 mt-2">{fmtDate(group[0])}</div>
          <Card className="p-0 divide-y divide-line overflow-hidden">
            {group[1].map((e) => (
              <ExpenseRow key={e.id} e={e} />
            ))}
          </Card>
        </div>
      ))}
    </div>
  )
}

function ExpenseRow({ e }: { e: Expense }) {
  const { t, lang } = useT()
  const d = useData()
  const { openExpense } = useUi()
  const c = e.category_id != null ? d.categoryById.get(e.category_id) : undefined
  const sup = e.supplier_id != null ? d.supplierById.get(e.supplier_id) : undefined
  const payer = e.paid_by ? d.profileById.get(e.paid_by) : undefined
  const due = e.amount - e.paid_amount
  const Icon = kindIcon[c?.kind ?? 'other']
  const modeLabel = e.payment_mode === 'credit' ? t('creditShort') : t(e.payment_mode)
  const sub = [c && e.description ? localName(c, lang) : null, sup?.name, modeLabel, payer?.name].filter(Boolean).join(' · ')

  return (
    <button type="button" onClick={() => openExpense(e)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-surface-2 transition-colors">
      <IconChip slot={categorySlot(c)}>
        <Icon size={18} />
      </IconChip>
      <div className="grow min-w-0">
        <div className="font-medium truncate">{e.description || (c ? localName(c, lang) : t('others'))}</div>
        <div className="text-xs text-ink-2 truncate">{sub}</div>
      </div>
      <div className="text-right shrink-0 flex flex-col items-end gap-1">
        <div className="font-medium tabular-nums inline-flex items-center gap-1">
          {e.receipt_path && <Paperclip size={12} className="text-muted" />}
          {fmtINR(e.amount)}
        </div>
        {due > 0.5 && (
          <Badge tone="warning">
            {t('toPay')} {fmtINR(due)}
          </Badge>
        )}
      </div>
    </button>
  )
}
