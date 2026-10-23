import { X } from 'lucide-react'
import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { useT } from '../lib/i18n'

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...p }: ButtonProps) {
  const v = {
    primary: 'bg-accent text-white hover:brightness-95 active:brightness-90',
    secondary: 'bg-surface-2 text-ink hover:bg-hairline',
    ghost: 'text-ink hover:bg-surface-2',
    danger: 'bg-critical text-white hover:brightness-95',
  }[variant]
  const s = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-12 px-5 text-base' }[size]
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition disabled:opacity-50 disabled:pointer-events-none',
        v,
        s,
        className,
      )}
      {...p}
    />
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-2xl bg-surface border border-line p-4', className)}>{children}</section>
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('font-semibold mb-3', className)}>{children}</h3>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-xs font-medium text-ink-2 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  )
}

/** Like Field, but for controls that are not a single input (e.g. a Segmented group). */
export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="min-w-0">
      <span className="block text-xs font-medium text-ink-2 mb-1">{label}</span>
      {children}
    </div>
  )
}

const inputCls =
  'w-full h-11 rounded-xl border border-line bg-surface px-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60 [&.w-auto]:w-auto'

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputCls, className)} {...p} />
}

export function Select({ className, compact, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { compact?: boolean }) {
  // compact: content-width pill for inline use in list rows
  return <select className={cn(inputCls, compact && 'h-8 w-auto max-w-[55%] text-xs py-0 pl-2 pr-6 rounded-lg', className)} {...p} />
}

export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputCls, 'h-auto min-h-20 py-2', className)} {...p} />
}

/** Bottom sheet on phones, centered dialog on wider screens. */
export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92dvh] flex flex-col bg-surface rounded-t-3xl sm:rounded-3xl shadow-xl">
        <div className="flex items-center justify-between pl-4 pr-2 h-14 border-b border-line shrink-0">
          <h2 className="font-semibold truncate">{title}</h2>
          <button type="button" onClick={onClose} className="h-10 w-10 grid place-items-center rounded-full hover:bg-surface-2" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 space-y-4 grow">{children}</div>
        {footer && <div className="px-4 pt-3 border-t border-line shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  )
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  full,
  disabled,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  full?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <div
      className={cn('rounded-xl bg-surface-2 p-1', full ? 'grid' : 'inline-flex', disabled && 'opacity-60', className)}
      style={full ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
      role="radiogroup"
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-9 px-2 rounded-lg text-sm font-medium transition truncate',
            o.value === value ? 'bg-surface shadow-sm text-ink' : 'text-ink-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-8 px-3 rounded-full text-sm border whitespace-nowrap shrink-0',
        active ? 'bg-ink text-bg border-ink' : 'border-line text-ink-2 bg-surface',
      )}
    >
      {children}
    </button>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-center text-muted text-sm py-10 px-4">{children}</div>
}

export function Spinner({ full }: { full?: boolean }) {
  return (
    <div className={cn('flex justify-center items-center', full ? 'min-h-dvh bg-bg' : 'py-10')}>
      <div className="h-6 w-6 rounded-full border-2 border-line border-t-accent animate-spin" />
    </div>
  )
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface border border-line p-3 min-w-0">
      <div className="text-xs text-ink-2 truncate">{label}</div>
      <div className="text-lg font-semibold mt-0.5 truncate">{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5 truncate">{sub}</div>}
    </div>
  )
}

/** Tinted pill whose meaning is always carried by its text, never by colour alone. */
export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'warning' | 'serious' | 'good'; children: ReactNode }) {
  const bg = {
    neutral: 'var(--surface-2)',
    warning: 'color-mix(in oklab, var(--warning) 24%, var(--surface))',
    serious: 'color-mix(in oklab, var(--serious) 22%, var(--surface))',
    good: 'color-mix(in oklab, var(--good) 18%, var(--surface))',
  }[tone]
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full text-ink whitespace-nowrap" style={{ background: bg }}>
      {children}
    </span>
  )
}

export function LangToggle() {
  const { lang, setLang } = useT()
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
      className="h-8 px-3 rounded-full border border-line bg-surface text-sm font-medium"
      aria-label="Switch language"
    >
      {lang === 'en' ? 'தமிழ்' : 'English'}
    </button>
  )
}
