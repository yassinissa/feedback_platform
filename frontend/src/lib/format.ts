const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const longDayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const shortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

/** Parse YYYY-MM-DD as a local calendar date (not UTC midnight). */
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

export function dayLabel(iso: string): string {
  if (iso === toISODate(new Date())) return 'Today'
  if (iso === toISODate(addDays(new Date(), -1))) return 'Yesterday'
  return dayFmt.format(parseDay(iso))
}

export const longDay = (iso: string) => longDayFmt.format(parseDay(iso))
export const shortDay = (iso: string) => shortFmt.format(parseDay(iso))
export const timeOf = (iso: string) => timeFmt.format(new Date(iso))

export function relativeTime(iso: string | null): string {
  if (!iso) return 'No feedback yet'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'Yesterday' : `${d} days ago`
}

export const fmtAvg = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(2))
export const fmtNps = (n: number | null | undefined) => (n == null ? '—' : n > 0 ? `+${n}` : String(n))
