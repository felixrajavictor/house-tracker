import type { Category } from './types'

/** The 8 categorical slots defined in index.css (--series-1 … --series-8), light/dark aware. */
export const seriesColor = (slot: number) => `var(--series-${slot})`

/** Soft tinted background of a slot colour on the current surface. */
export const tint = (slot: number, pct = 16) => `color-mix(in oklab, var(--series-${slot}) ${pct}%, var(--surface))`

/** Every category gets a stable colour; labour is always orange to match the wages series in charts. */
export function categorySlot(c?: Category | null): number {
  if (!c) return 8
  if (c.kind === 'labour') return 2
  const pool = [1, 3, 7, 5, 4, 6, 8]
  return pool[c.id % pool.length]
}

/** Stable colour per person, from their name. */
export function nameSlot(name: string): number {
  let h = 0
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (h % 8) + 1
}
