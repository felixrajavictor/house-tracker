import { useEffect, useState, type ChangeEvent } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { localName, useT } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { supabase } from '../lib/supabase'
import { receiptUrl, removeReceipt, uploadReceipt } from '../lib/upload'
import { errMsg, todayISO } from '../lib/format'
import type { Expense, PaymentMode } from '../lib/types'
import { Button, Field, Group, Input, Segmented, Select, Sheet, Textarea } from '../components/ui'

export default function ExpenseForm({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const { t, lang } = useT()
  const { profile, isEditor } = useAuth()
  const d = useData()
  const ongoing = d.stages.find((s) => s.status === 'ongoing')

  const [f, setF] = useState(() => ({
    date: expense?.date ?? todayISO(),
    amount: expense ? String(expense.amount) : '',
    category_id: expense?.category_id ?? d.categories[0]?.id ?? 0,
    stage_id: expense?.stage_id ?? ongoing?.id ?? 0,
    supplier_id: expense?.supplier_id ?? 0,
    new_supplier: '',
    description: expense?.description ?? '',
    quantity: expense?.quantity != null ? String(expense.quantity) : '',
    unit: expense?.unit ?? '',
    payment_mode: (expense?.payment_mode ?? 'cash') as PaymentMode,
    paid_by: expense?.paid_by ?? profile?.id ?? '',
    paid_amount: expense ? String(expense.paid_amount) : '',
    notes: expense?.notes ?? '',
  }))
  const [paidTouched, setPaidTouched] = useState(!!expense)
  const [file, setFile] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  // "Paid now" follows the amount until the user edits it; a credit purchase starts at 0
  const effectivePaid = paidTouched ? f.paid_amount : f.payment_mode === 'credit' ? '0' : f.amount

  const existingPath = expense?.receipt_path ?? null
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setPreview(url)
      return () => URL.revokeObjectURL(url)
    }
    if (existingPath && !removePhoto) {
      let alive = true
      receiptUrl(existingPath)
        .then((u) => alive && setPreview(u))
        .catch(() => alive && setPreview(null))
      return () => {
        alive = false
      }
    }
    setPreview(null)
  }, [file, existingPath, removePhoto])

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (picked) {
      setFile(picked)
      setRemovePhoto(false)
    }
    e.target.value = ''
  }

  async function save() {
    const amount = Number(f.amount)
    if (!amount || amount <= 0) {
      setErr(t('amountRequired'))
      return
    }
    const paid = Math.min(amount, Math.max(0, Number(effectivePaid) || 0))
    setBusy(true)
    setErr(null)
    try {
      let supplier_id: number | null = f.supplier_id > 0 ? f.supplier_id : null
      if (f.supplier_id === -1 && f.new_supplier.trim()) {
        const { data, error } = await supabase.from('suppliers').insert({ name: f.new_supplier.trim() }).select('id').single()
        if (error) throw error
        supplier_id = data.id
      }
      let receipt_path = existingPath
      if (removePhoto && receipt_path) {
        await removeReceipt(receipt_path)
        receipt_path = null
      }
      if (file) receipt_path = await uploadReceipt(file)

      const row = {
        date: f.date,
        amount,
        paid_amount: paid,
        category_id: f.category_id || null,
        stage_id: f.stage_id || null,
        supplier_id,
        description: f.description.trim() || null,
        quantity: f.quantity ? Number(f.quantity) : null,
        unit: f.unit.trim() || null,
        payment_mode: f.payment_mode,
        paid_by: f.paid_by || null,
        receipt_path,
        notes: f.notes.trim() || null,
      }
      const { error } = expense ? await supabase.from('expenses').update(row).eq('id', expense.id) : await supabase.from('expenses').insert(row)
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
    if (!expense || !confirm(t('confirmDelete'))) return
    setBusy(true)
    setErr(null)
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
      if (error) throw error
      if (expense.receipt_path) await removeReceipt(expense.receipt_path)
      await d.refresh()
      onClose()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const readOnly = !isEditor

  return (
    <Sheet
      title={expense ? t('editExpense') : t('addExpense')}
      onClose={onClose}
      footer={
        readOnly ? (
          <p className="text-xs text-muted text-center">{t('viewOnly')}</p>
        ) : (
          <div className="flex gap-2">
            {expense && (
              <Button variant="danger" size="lg" onClick={del} disabled={busy} aria-label={t('delete')}>
                <Trash2 size={18} />
              </Button>
            )}
            <Button className="grow" size="lg" onClick={save} disabled={busy}>
              {busy ? t('saving') : t('save')}
            </Button>
          </div>
        )
      }
    >
      <fieldset disabled={readOnly} className="space-y-4 min-w-0">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('date')}>
            <Input type="date" value={f.date} max={todayISO()} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label={t('amount')}>
            <Input type="number" inputMode="decimal" placeholder="0" value={f.amount} onChange={(e) => set('amount', e.target.value)} autoFocus={!expense} />
          </Field>
        </div>

        <Field label={t('category')}>
          <Select value={f.category_id} onChange={(e) => set('category_id', Number(e.target.value))}>
            {d.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {localName(c, lang)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('description')}>
          <Input value={f.description} onChange={(e) => set('description', e.target.value)} placeholder={lang === 'ta' ? 'உதா: 50 மூட்டை சிமெண்ட்' : 'e.g. 50 bags cement'} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('quantity')}>
            <Input type="number" inputMode="decimal" value={f.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </Field>
          <Field label={t('unit')}>
            <Input value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="bags / load / kg" />
          </Field>
        </div>

        <Field label={t('supplier')}>
          <Select value={f.supplier_id} onChange={(e) => set('supplier_id', Number(e.target.value))}>
            <option value={0}>—</option>
            {d.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value={-1}>{t('newSupplier')}</option>
          </Select>
        </Field>
        {f.supplier_id === -1 && (
          <Field label={t('supplierName')}>
            <Input value={f.new_supplier} onChange={(e) => set('new_supplier', e.target.value)} autoFocus />
          </Field>
        )}

        <Field label={t('stage')}>
          <Select value={f.stage_id} onChange={(e) => set('stage_id', Number(e.target.value))}>
            <option value={0}>—</option>
            {d.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {localName(s, lang)}
              </option>
            ))}
          </Select>
        </Field>

        <Group label={t('paymentMode')}>
          <Segmented
            full
            disabled={readOnly}
            value={f.payment_mode}
            onChange={(v) => set('payment_mode', v)}
            options={[
              { value: 'cash', label: t('cash') },
              { value: 'upi', label: 'UPI' },
              { value: 'bank', label: t('bank') },
              { value: 'credit', label: t('creditShort') },
            ]}
          />
        </Group>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('paidBy')}>
            <Select value={f.paid_by} onChange={(e) => set('paid_by', e.target.value)}>
              <option value="">—</option>
              {d.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('paidAmount')} hint={t('paidAmountHint')}>
            <Input
              type="number"
              inputMode="decimal"
              value={effectivePaid}
              onChange={(e) => {
                setPaidTouched(true)
                set('paid_amount', e.target.value)
              }}
            />
          </Field>
        </div>

        <Field label={t('receipt')}>
          {preview ? (
            <div>
              <a href={preview} target="_blank" rel="noreferrer">
                <img src={preview} alt="" className="w-full max-h-64 object-contain rounded-xl bg-surface-2" />
              </a>
              {!readOnly && (
                <div className="flex gap-2 mt-2">
                  <label className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-surface-2 text-sm font-medium cursor-pointer">
                    <Camera size={16} />
                    {t('changePhoto')}
                    <input type="file" accept="image/*" className="hidden" onChange={onFile} />
                  </label>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setFile(null)
                      setRemovePhoto(true)
                    }}
                  >
                    {t('removePhoto')}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 h-20 rounded-xl border border-dashed border-line text-ink-2 cursor-pointer hover:bg-surface-2">
              <Camera size={20} />
              {t('addPhoto')}
              <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={readOnly} />
            </label>
          )}
        </Field>

        <Field label={t('notes')}>
          <Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        {err && <p className="text-sm text-critical">{err}</p>}
      </fieldset>
    </Sheet>
  )
}
