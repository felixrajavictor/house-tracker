import { useMemo, useState } from 'react'
import { Download, KeyRound, LogOut, Plus, Trash2 } from 'lucide-react'
import { localName, useT } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { supabase } from '../lib/supabase'
import { computeStats } from '../lib/stats'
import { errMsg, fmtDate, fmtINR } from '../lib/format'
import type { AllowedMember, Role, StageStatus, Supplier } from '../lib/types'
import { Badge, Button, Card, Empty, Field, Group, Input, SectionTitle, Segmented, Select, Sheet } from '../components/ui'
import { Avatar } from '../components/WorkerBits'

export default function More() {
  const { t, lang, setLang } = useT()
  const { profile, session, isEditor, signOut } = useAuth()
  const [pw, setPw] = useState(false)

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={profile?.name ?? '?'} />
          <div className="min-w-0">
            <div className="font-semibold truncate">{profile?.name}</div>
            <div className="text-xs text-ink-2 truncate">{session?.user.email}</div>
          </div>
          <Badge>{isEditor ? t('editor') : t('viewer')}</Badge>
        </div>
        {!isEditor && <p className="text-xs text-muted">{t('viewOnly')}</p>}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-ink-2">{t('language')}</span>
          <Segmented
            value={lang}
            onChange={setLang}
            options={[
              { value: 'ta', label: 'தமிழ்' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setPw(true)}>
            <KeyRound size={16} />
            {t('changePassword')}
          </Button>
          <Button variant="secondary" onClick={signOut}>
            <LogOut size={16} />
            {t('logout')}
          </Button>
        </div>
      </Card>
      {pw && <PasswordSheet onClose={() => setPw(false)} />}

      <SettingsCard />
      <MembersCard />
      <SuppliersCard />
      <StagesCard />
      <ExportCard />
    </div>
  )
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)

  async function save() {
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setMsg({ kind: 'error', text: errMsg(error) })
    else {
      setMsg({ kind: 'ok', text: t('passwordChanged') })
      setTimeout(onClose, 1200)
    }
  }

  return (
    <Sheet
      title={t('changePassword')}
      onClose={onClose}
      footer={
        <Button size="lg" className="w-full" onClick={save} disabled={busy || pw.length < 4}>
          {busy ? t('saving') : t('save')}
        </Button>
      }
    >
      <Field label={t('newPassword')} hint={t('passwordHint')}>
        <Input type="password" autoComplete="new-password" minLength={4} value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      </Field>
      {msg && <p className={`text-sm ${msg.kind === 'error' ? 'text-critical' : 'text-good-text'}`}>{msg.text}</p>}
    </Sheet>
  )
}

function SettingsCard() {
  const { t } = useT()
  const d = useData()
  const { isEditor } = useAuth()
  const [name, setName] = useState(d.settings?.house_name ?? '')
  const [budget, setBudget] = useState(String(d.settings?.budget ?? ''))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const dirty = name !== (d.settings?.house_name ?? '') || Number(budget) !== (d.settings?.budget ?? 0)

  async function save() {
    setBusy(true)
    setErr(null)
    const { error } = await supabase.from('settings').update({ house_name: name.trim() || 'Our House', budget: Number(budget) || 0 }).eq('id', 1)
    if (error) setErr(errMsg(error))
    await d.refresh()
    setBusy(false)
  }

  return (
    <Card>
      <SectionTitle>{t('settings')}</SectionTitle>
      <fieldset disabled={!isEditor} className="space-y-3">
        <Field label={t('houseName')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('totalBudget')} hint={budget ? fmtINR(Number(budget)) : undefined}>
          <Input type="number" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </Field>
        {isEditor && dirty && (
          <Button onClick={save} disabled={busy}>
            {busy ? t('saving') : t('save')}
          </Button>
        )}
        {err && <p className="text-sm text-critical">{err}</p>}
      </fieldset>
    </Card>
  )
}

function MembersCard() {
  const { t } = useT()
  const d = useData()
  const { isEditor, session } = useAuth()
  // sheet: null = closed, 'new' = add member, otherwise the member whose password is being reset
  const [sheet, setSheet] = useState<'new' | AllowedMember | null>(null)
  const [f, setF] = useState({ email: '', name: '', role: 'viewer' as Role, password: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)
  const myEmail = session?.user.email?.toLowerCase()

  function open(target: 'new' | AllowedMember) {
    setMsg(null)
    setF(target === 'new' ? { email: '', name: '', role: 'viewer', password: '' } : { email: target.email, name: target.name, role: target.role, password: '' })
    setSheet(target)
  }

  // Creates the login (or resets the password) directly — no signup, no email.
  // A new member gets a hidden login id generated server-side from their name.
  async function save() {
    if (!f.name.trim() || f.password.length < 4) return
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.rpc('upsert_member', {
      p_email: sheet === 'new' ? null : f.email,
      p_password: f.password,
      p_name: f.name.trim(),
      p_role: f.role,
    })
    await d.refresh()
    setBusy(false)
    if (error) setMsg({ kind: 'error', text: errMsg(error) })
    else {
      setMsg({ kind: 'ok', text: t('memberSaved') })
      setTimeout(() => setSheet(null), 1500)
    }
  }

  async function changeRole(email: string, role: Role) {
    await supabase.from('allowed_members').update({ role }).eq('email', email)
    await d.refresh()
  }

  async function remove(email: string) {
    if (!confirm(t('removeMember'))) return
    await supabase.from('allowed_members').delete().eq('email', email)
    await d.refresh()
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <SectionTitle className="mb-0">{t('members')}</SectionTitle>
        {isEditor && (
          <Button size="sm" variant="secondary" onClick={() => open('new')}>
            <Plus size={16} />
            {t('addMember')}
          </Button>
        )}
      </div>
      <ul className="divide-y divide-line -mx-4">
        {d.members.map((m) => {
          const me = m.email.toLowerCase() === myEmail
          return (
            <li key={m.email} className="flex items-center gap-2 px-4 py-2.5 text-sm">
              <div className="grow min-w-0">
                <div className="font-medium truncate">
                  {m.name}
                  {me && <span className="text-muted font-normal"> ({t('you')})</span>}
                </div>
                {!m.email.endsWith('@veedu.family') && <div className="text-xs text-ink-2 truncate">{m.email}</div>}
              </div>
              {isEditor && !me ? (
                <>
                  <Select compact value={m.role} onChange={(e) => changeRole(m.email, e.target.value as Role)}>
                    <option value="editor">{t('editor')}</option>
                    <option value="viewer">{t('viewer')}</option>
                  </Select>
                  <button type="button" onClick={() => open(m)} className="h-8 w-8 grid place-items-center text-muted hover:text-ink" aria-label={t('resetPassword')} title={t('resetPassword')}>
                    <KeyRound size={16} />
                  </button>
                  <button type="button" onClick={() => remove(m.email)} className="h-8 w-8 grid place-items-center text-muted hover:text-critical" aria-label={t('delete')}>
                    <Trash2 size={16} />
                  </button>
                </>
              ) : (
                <Badge>{m.role === 'editor' ? t('editor') : t('viewer')}</Badge>
              )}
            </li>
          )
        })}
      </ul>

      {sheet && (
        <Sheet
          title={sheet === 'new' ? t('addMember') : `${t('resetPassword')} · ${sheet.name}`}
          onClose={() => setSheet(null)}
          footer={
            <Button size="lg" className="w-full" onClick={save} disabled={busy || !f.name.trim() || f.password.length < 4}>
              {busy ? t('saving') : t('save')}
            </Button>
          }
        >
          {sheet === 'new' && (
            <>
              <Field label={t('name')}>
                <Input value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} autoFocus placeholder="Amala" />
              </Field>
              <Group label={t('role')}>
                <Segmented
                  full
                  value={f.role}
                  onChange={(role) => setF((p) => ({ ...p, role }))}
                  options={[
                    { value: 'editor', label: t('editor') },
                    { value: 'viewer', label: t('viewer') },
                  ]}
                />
              </Group>
            </>
          )}
          <Field label={sheet === 'new' ? t('password') : t('newPassword')} hint={sheet === 'new' ? t('memberHint') : t('passwordHint')}>
            <Input type="text" autoComplete="off" minLength={4} value={f.password} onChange={(e) => setF((p) => ({ ...p, password: e.target.value }))} autoFocus={sheet !== 'new'} />
          </Field>
          {msg && <p className={`text-sm ${msg.kind === 'error' ? 'text-critical' : 'text-good-text'}`}>{msg.text}</p>}
        </Sheet>
      )}
    </Card>
  )
}

function SuppliersCard() {
  const { t } = useT()
  const d = useData()
  const [open, setOpen] = useState<Supplier | null>(null)

  const rows = useMemo(
    () =>
      d.suppliers
        .map((s) => {
          const ex = d.expenses.filter((e) => e.supplier_id === s.id)
          const total = ex.reduce((a, e) => a + e.amount, 0)
          const due = ex.reduce((a, e) => a + (e.amount - e.paid_amount), 0)
          return { s, total, due, count: ex.length }
        })
        .sort((a, b) => b.due - a.due || b.total - a.total),
    [d.suppliers, d.expenses],
  )

  return (
    <Card>
      <SectionTitle>{t('suppliers')}</SectionTitle>
      {rows.length === 0 ? (
        <Empty>{t('noSuppliers')}</Empty>
      ) : (
        <ul className="divide-y divide-line -mx-4">
          {rows.map(({ s, total, due, count }) => (
            <li key={s.id}>
              <button type="button" onClick={() => setOpen(s)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-surface-2">
                <div className="grow min-w-0">
                  <div className="font-medium truncate">{s.name}</div>
                  <div className="text-xs text-ink-2">
                    {count} {t('entries')} · {t('total')} {fmtINR(total)}
                  </div>
                </div>
                {due > 0.5 ? (
                  <Badge tone="warning">
                    {t('creditPending')} {fmtINR(due)}
                  </Badge>
                ) : (
                  <Badge>{t('settled')}</Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <SupplierSheet supplier={open} onClose={() => setOpen(null)} />}
    </Card>
  )
}

function SupplierSheet({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const { t } = useT()
  const d = useData()
  const { isEditor } = useAuth()
  const [name, setName] = useState(supplier.name)
  const [phone, setPhone] = useState(supplier.phone ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const unpaid = d.expenses.filter((e) => e.supplier_id === supplier.id && e.amount - e.paid_amount > 0.5)

  async function saveInfo() {
    setBusy('info')
    await supabase.from('suppliers').update({ name: name.trim() || supplier.name, phone: phone.trim() || null }).eq('id', supplier.id)
    await d.refresh()
    setBusy(null)
  }

  async function markPaid(id: string, amount: number) {
    setBusy(id)
    await supabase.from('expenses').update({ paid_amount: amount }).eq('id', id)
    await d.refresh()
    setBusy(null)
  }

  const infoDirty = name !== supplier.name || phone !== (supplier.phone ?? '')

  return (
    <Sheet title={supplier.name} onClose={onClose}>
      <fieldset disabled={!isEditor} className="grid grid-cols-2 gap-3">
        <Field label={t('supplierName')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('phone')}>
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        {isEditor && infoDirty && (
          <Button onClick={saveInfo} disabled={busy === 'info'} className="col-span-2">
            {t('save')}
          </Button>
        )}
      </fieldset>
      <div>
        <div className="text-xs font-medium text-ink-2 mb-2">{t('unpaidBills')}</div>
        {unpaid.length === 0 ? (
          <Empty>{t('noUnpaid')}</Empty>
        ) : (
          <ul className="rounded-xl border border-line divide-y divide-line">
            {unpaid.map((e) => (
              <li key={e.id} className="flex items-center gap-3 p-3 text-sm">
                <div className="grow min-w-0">
                  <div className="font-medium truncate">{e.description || fmtDate(e.date)}</div>
                  <div className="text-xs text-ink-2">
                    {fmtDate(e.date)} · {t('toPay')} {fmtINR(e.amount - e.paid_amount)} / {fmtINR(e.amount)}
                  </div>
                </div>
                {isEditor && (
                  <Button size="sm" variant="secondary" onClick={() => markPaid(e.id, e.amount)} disabled={busy === e.id}>
                    {t('markPaid')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  )
}

function StagesCard() {
  const { t, lang } = useT()
  const d = useData()
  const { isEditor } = useAuth()
  const s = useMemo(() => computeStats(d), [d])
  const statusLabel: Record<StageStatus, string> = { pending: t('statusPending'), ongoing: t('statusOngoing'), done: t('statusDone') }

  async function setStatus(id: number, status: StageStatus) {
    await supabase.from('stages').update({ status }).eq('id', id)
    await d.refresh()
  }

  return (
    <Card>
      <SectionTitle>{t('stages')}</SectionTitle>
      <ul className="divide-y divide-line -mx-4">
        {d.stages.map((st) => (
          <li key={st.id} className="flex items-center gap-3 px-4 py-2 text-sm">
            <div className="grow min-w-0">
              <div className="truncate">{localName(st, lang)}</div>
              <div className="text-xs text-ink-2 tabular-nums">
                {t('cost')} {fmtINR(s.byStage.get(st.id) ?? 0)}
              </div>
            </div>
            {isEditor ? (
              <Select compact value={st.status} onChange={(e) => setStatus(st.id, e.target.value as StageStatus)}>
                <option value="pending">{statusLabel.pending}</option>
                <option value="ongoing">{statusLabel.ongoing}</option>
                <option value="done">{statusLabel.done}</option>
              </Select>
            ) : (
              <Badge tone={st.status === 'ongoing' ? 'warning' : st.status === 'done' ? 'good' : 'neutral'}>{statusLabel[st.status]}</Badge>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function csvCell(v: unknown) {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function ExportCard() {
  const { t, lang } = useT()
  const d = useData()

  function exportCsv() {
    const rows: unknown[][] = [
      ['Type', 'Date', 'Category', 'Stage', 'Shop / Worker', 'Description', 'Qty', 'Unit', 'Amount', 'Paid', 'Payment mode', 'Paid by', 'Notes'],
    ]
    for (const e of d.expenses) {
      const c = e.category_id != null ? d.categoryById.get(e.category_id) : undefined
      const st = e.stage_id != null ? d.stageById.get(e.stage_id) : undefined
      rows.push([
        'Expense',
        e.date,
        c ? localName(c, lang) : '',
        st ? localName(st, lang) : '',
        e.supplier_id != null ? d.supplierById.get(e.supplier_id)?.name ?? '' : '',
        e.description ?? '',
        e.quantity ?? '',
        e.unit ?? '',
        e.amount,
        e.paid_amount,
        e.payment_mode,
        e.paid_by ? d.profileById.get(e.paid_by)?.name ?? '' : '',
        e.notes ?? '',
      ])
    }
    for (const p of d.payments) {
      rows.push([
        p.kind === 'advance' ? 'Advance' : 'Wage',
        p.date,
        t('dailyWages'),
        '',
        d.workerById.get(p.worker_id)?.name ?? '',
        '',
        '',
        '',
        p.amount,
        p.amount,
        p.payment_mode,
        p.paid_by ? d.profileById.get(p.paid_by)?.name ?? '' : '',
        p.notes ?? '',
      ])
    }
    for (const a of d.attendance) {
      const st = a.stage_id != null ? d.stageById.get(a.stage_id) : undefined
      rows.push([
        'Attendance',
        a.date,
        t('dailyWages'),
        st ? localName(st, lang) : '',
        d.workerById.get(a.worker_id)?.name ?? '',
        `${a.day_fraction} day`,
        a.day_fraction,
        'day',
        a.day_fraction * a.rate,
        '',
        '',
        '',
        a.notes ?? '',
      ])
    }
    rows.sort((a, b) => (a[0] === 'Type' ? -1 : b[0] === 'Type' ? 1 : String(b[1]).localeCompare(String(a[1]))))
    // BOM so Excel opens Tamil text correctly
    const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `house-expenses-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  return (
    <Card className="flex items-center justify-between gap-3">
      <div>
        <div className="font-semibold">{t('exportCsv')}</div>
        <div className="text-xs text-ink-2">{t('exportHint')}</div>
      </div>
      <Button variant="secondary" onClick={exportCsv}>
        <Download size={16} />
      </Button>
    </Card>
  )
}
