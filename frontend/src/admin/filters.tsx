import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import useSWR from 'swr'
import { addDays, shortDay, toISODate } from '../lib/format'
import type { Location } from '../lib/types'

export const PRESETS = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
] as const

export type PresetKey = (typeof PRESETS)[number]['key'] | 'custom'

/** Location + date range live in the URL so any view can be bookmarked or shared. */
export function useFilters(defaultPreset: PresetKey = '30d') {
  const [params, setParams] = useSearchParams()
  const location = params.get('location') ?? 'all'
  const preset = (params.get('range') as PresetKey | null) ?? defaultPreset

  const { from, to } = useMemo(() => {
    if (preset === 'custom') {
      const today = toISODate(new Date())
      return { from: params.get('from') ?? today, to: params.get('to') ?? today }
    }
    const p = PRESETS.find((x) => x.key === preset) ?? PRESETS[2]
    const end = new Date()
    return { from: toISODate(addDays(end, -(p.days - 1))), to: toISODate(end) }
  }, [preset, params])

  const set = useCallback(
    (patch: Record<string, string | null>) => {
      setParams(
        (cur) => {
          const next = new URLSearchParams(cur)
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === '') next.delete(k)
            else next.set(k, v)
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const query = useMemo(() => {
    const q = new URLSearchParams({ from, to })
    if (location !== 'all') q.set('location', location)
    return q
  }, [from, to, location])

  return { location, preset, from, to, query, set, params }
}

export function useLocations() {
  return useSWR<Location[]>('/locations/')
}

export function FilterBar({ filters, children }: { filters: ReturnType<typeof useFilters>; children?: React.ReactNode }) {
  const { data: locations } = useLocations()
  const { location, preset, from, to, set } = filters
  return (
    <div className="filterbar">
      {locations && locations.length > 1 ? (
        <label className="select-wrap">
          <span className="sr-only">Branch</span>
          <select className="input input-sm" value={location} onChange={(e) => set({ location: e.target.value === 'all' ? null : e.target.value })}>
            <option value="all">All branches</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="segmented" role="group" aria-label="Date range">
        {PRESETS.map((p) => (
          <button key={p.key} aria-pressed={preset === p.key} onClick={() => set({ range: p.key, from: null, to: null })}>
            {p.label}
          </button>
        ))}
        <button aria-pressed={preset === 'custom'} onClick={() => set({ range: 'custom', from, to })}>
          Custom
        </button>
      </div>
      {preset === 'custom' ? (
        <div className="date-pair">
          <label>
            <span className="sr-only">From</span>
            <input type="date" className="input input-sm" value={from} max={to} onChange={(e) => e.target.value && set({ from: e.target.value })} />
          </label>
          <span aria-hidden>–</span>
          <label>
            <span className="sr-only">To</span>
            <input type="date" className="input input-sm" value={to} min={from} onChange={(e) => e.target.value && set({ to: e.target.value })} />
          </label>
        </div>
      ) : (
        <span className="range-caption tabular">
          {from === to ? shortDay(from) : `${shortDay(from)} – ${shortDay(to)}`}
        </span>
      )}
      {children ? <div className="filterbar-end">{children}</div> : null}
    </div>
  )
}
