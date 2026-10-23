import { useEffect, useRef, useState } from 'react'

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/** Animates a number from its previous value to the new one. */
export function CountUp({ value, format, duration = 700 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)

  useEffect(() => {
    const start = performance.now()
    const begin = from.current
    if (begin === value) return
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setShown(begin + (value - begin) * easeOut(t))
      if (t < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <>{format(shown)}</>
}
