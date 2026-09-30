import { useCallback, useDeferredValue, useEffect, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { api, downloadFile } from '../lib/api'
import { moodVar } from '../lib/copy'
import { dayLabel, fmtAvg, longDay } from '../lib/format'
import type { Feedback, HistoryDay, Paginated } from '../lib/types'
import { Button } from '../ui/Button'
import { EmptyState, ErrorState } from '../ui/States'
import { useToast } from '../ui/Toast'
import { FeedbackCard } from './FeedbackCard'
import { FilterBar, useFilters } from './filters'

const RATINGS = [
  { key: '', label: 'All ratings' },
  { key: 'low', label: '1–2★' },
  { key: '3', label: '3★' },
  { key: 'high', label: '4–5★' },
]

export default function History() {
  const filters = useFilters('30d')
  const { params, set } = filters
  const toast = useToast()
  const rating = params.get('rating') ?? ''
  const status = params.get('status') ?? ''
  const followup = params.get('followup') === '1'
  const [search, setSearch] = useState(params.get('q') ?? '')
  const deferredSearch = useDeferredValue(search)
  const [exporting, setExporting] = useState(false)

  // Commit search to the URL once typing settles.
  const committedSearch = params.get('q') ?? ''
  useEffect(() => {
    const value = deferredSearch.trim()
    if (value === committedSearch) return
    const t = window.setTimeout(() => set({ q: value || null }), 350)
    return () => window.clearTimeout(t)
  }, [deferredSearch, committedSearch, set])

  const q = new URLSearchParams(filters.query)
  if (rating) q.set('rating', rating)
  if (status) q.set('status', status)
  if (followup) q.set('followup', '1')
  if (params.get('q')) q.set('q', params.get('q')!)
  const qs = q.toString()

  const { data: days, error, isLoading, mutate } = useSWR<HistoryDay[]>(`/history/?${qs}`)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const firstDay = days?.[0]?.date

  // Open the most recent day by default.
  useEffect(() => {
    if (firstDay) setOpen((cur) => (cur.size ? cur : new Set([firstDay])))
  }, [firstDay])

  const toggle = useCallback((date: string) => {
    setOpen((cur) => {
      const next = new Set(cur)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }, [])

  async function exportCsv() {
    setExporting(true)
    try {
      await downloadFile(`/feedback/export/?${qs}`, `feedback_${filters.from}_${filters.to}.csv`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setExporting(false)
    }
  }

  const total = days?.reduce((s, d) => s + d.count, 0) ?? 0

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">History</h1>
          <p className="muted">Every day's feedback, newest first. Open a day to read each guest.</p>
        </div>
      </header>

      <FilterBar filters={filters}>
        <Button size="sm" onClick={exportCsv} pending={exporting} disabled={!total}>
          Export CSV
        </Button>
      </FilterBar>

      <div className="filterbar filterbar-2">
        <div className="segmented" role="group" aria-label="Rating">
          {RATINGS.map((r) => (
            <button key={r.key || 'all'} aria-pressed={rating === r.key} onClick={() => set({ rating: r.key || null })}>
              {r.label}
            </button>
          ))}
        </div>
        <label>
          <span className="sr-only">Status</span>
          <select className="input input-sm" value={status} onChange={(e) => set({ status: e.target.value || null })}>
            <option value="">Any status</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <button className="chip" aria-pressed={followup} onClick={() => set({ followup: followup ? null : '1' })}>
          Asked for a follow-up
        </button>
        <label className="search">
          <span className="sr-only">Search comments, names, servers or table</span>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <circle cx="7" cy="7" r="4.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.6 10.6L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            className="input input-sm"
            type="search"
            placeholder="Search comments, names, table…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {error ? <ErrorState message={error.message} onRetry={() => mutate()} /> : null}
      {isLoading && !days ? (
        <div className="days">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 76 }} />
          ))}
        </div>
      ) : null}
      {days && !days.length ? (
        <EmptyState title="Nothing matches these filters" body="Widen the date range or clear the rating and status filters." />
      ) : null}

      {days && days.length ? (
        <ol className="days">
          {days.map((d) => (
            <DayGroup
              key={d.date}
              day={d}
              open={open.has(d.date)}
              onToggle={toggle}
              baseQuery={qs}
              showBranch={filters.location === 'all'}
              onSummaryChange={() => mutate()}
            />
          ))}
        </ol>
      ) : null}
    </div>
  )
}

interface DayGroupProps {
  day: HistoryDay
  open: boolean
  onToggle: (date: string) => void
  baseQuery: string
  showBranch: boolean
  onSummaryChange: () => void
}

function DayGroup({ day, open, onToggle, baseQuery, showBranch, onSummaryChange }: DayGroupProps) {
  const panelId = `day-${day.date}`
  return (
    <li className={`day${open ? ' day-open' : ''}`}>
      <button className="day-head" aria-expanded={open} aria-controls={panelId} onClick={() => onToggle(day.date)}>
        <span className="day-date">
          <span className="day-label">{dayLabel(day.date)}</span>
          <span className="muted small">{longDay(day.date)}</span>
        </span>
        <span className="day-stats">
          <span className="day-stat">
            <b className="tabular">{day.count}</b>
            <span>{day.count === 1 ? 'response' : 'responses'}</span>
          </span>
          <span className="day-stat">
            <b className="tabular" style={{ color: moodVar(day.avg) }}>
              {fmtAvg(day.avg)}★
            </b>
            <span>average</span>
          </span>
          <span className="day-stat hide-sm">
            <b className="tabular">{day.comments}</b>
            <span>{day.comments === 1 ? 'comment' : 'comments'}</span>
          </span>
          <span className="day-badges">
            {day.low ? <span className="badge badge-danger tabular">{day.low} low</span> : null}
            {day.new ? <span className="badge badge-accent tabular">{day.new} new</span> : null}
          </span>
        </span>
        <svg className="chev" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div id={panelId} className="day-body">
          <DayFeed date={day.date} newCount={day.new} baseQuery={baseQuery} showBranch={showBranch} onSummaryChange={onSummaryChange} />
        </div>
      ) : null}
    </li>
  )
}

function DayFeed({
  date,
  newCount,
  baseQuery,
  showBranch,
  onSummaryChange,
}: {
  date: string
  newCount: number
  baseQuery: string
  showBranch: boolean
  onSummaryChange: () => void
}) {
  const toast = useToast()
  const { mutate: globalMutate } = useSWRConfig()
  const q = new URLSearchParams(baseQuery)
  q.delete('from')
  q.delete('to')
  q.set('date', date)
  q.set('page_size', '200')
  const key = `/feedback/?${q}`
  const { data, error, mutate } = useSWR<Paginated<Feedback>>(key)
  const [marking, setMarking] = useState(false)

  const onChange = useCallback(
    (updated: Feedback) => {
      mutate((cur) => cur && { ...cur, results: cur.results.map((f) => (f.id === updated.id ? updated : f)) }, {
        revalidate: false,
      })
      onSummaryChange()
    },
    [mutate, onSummaryChange],
  )

  async function markAll() {
    setMarking(true)
    try {
      const mq = new URLSearchParams(q)
      mq.delete('page_size')
      const res = await api<{ updated: number }>(`/feedback/mark_reviewed/?${mq}`, { method: 'POST' })
      toast.success(`${res.updated} marked as reviewed`)
      await mutate()
      onSummaryChange()
      globalMutate((k) => typeof k === 'string' && k.startsWith('/stats/'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update. Try again.')
    } finally {
      setMarking(false)
    }
  }

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />
  if (!data)
    return (
      <div className="feed">
        <div className="skeleton" style={{ height: 150 }} />
        <div className="skeleton" style={{ height: 150 }} />
      </div>
    )

  return (
    <div className="feed">
      {newCount > 0 ? (
        <div className="feed-bar">
          <span className="muted small">
            {newCount} new {newCount === 1 ? 'entry' : 'entries'} waiting for review
          </span>
          <Button size="sm" variant="secondary" pending={marking} onClick={markAll}>
            Mark day as reviewed
          </Button>
        </div>
      ) : null}
      {data.results.map((f) => (
        <FeedbackCard key={f.id} item={f} showBranch={showBranch} onChange={onChange} />
      ))}
    </div>
  )
}
