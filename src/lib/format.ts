import { format, parseISO } from 'date-fns'

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export const fmtINR = (n: number) => (n < 0 ? '-' : '') + '₹' + inr.format(Math.round(Math.abs(n)))

/** ₹1.2L / ₹45K style, for tiles and axis ticks */
export function fmtCompact(n: number) {
  const a = Math.abs(n)
  const s = n < 0 ? '-' : ''
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)}Cr`
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(a >= 1e6 ? 1 : 2)}L`
  if (a >= 1e3) return `${s}₹${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K`
  return `${s}₹${Math.round(a)}`
}

export const todayISO = () => format(new Date(), 'yyyy-MM-dd')
export const fmtDate = (iso: string) => format(parseISO(iso), 'd MMM yyyy')
export const fmtDateShort = (iso: string) => format(parseISO(iso), 'd MMM')
export const fmtMonth = (ym: string) => format(parseISO(ym + '-01'), 'MMM yy')
export const monthKey = (iso: string) => iso.slice(0, 7)

/** Postgres numeric columns arrive as strings over the API */
export const num = (v: unknown) => (v == null || v === '' ? 0 : Number(v))

export const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + f(x), 0)

export function errMsg(e: unknown) {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}
