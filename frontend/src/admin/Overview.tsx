import { Link } from 'react-router-dom'
import useSWR from 'swr'
import { CATEGORY_LABELS, HIGHLIGHT_LABELS, isNegativeHighlight, moodVar } from '../lib/copy'
import { fmtAvg, fmtNps, relativeTime, timeOf } from '../lib/format'
import { CATEGORY_KEYS, type Feedback, type Paginated, type Stats } from '../lib/types'
import { EmptyState, ErrorState, Stars } from '../ui/States'
import { useAuth } from './auth'
import { CategoryBars, Distribution, TrendChart } from './charts'
import { FilterBar, useFilters } from './filters'

function Delta({ now, before, unit = '', digits = 0 }: { now: number | null; before: number | null; unit?: string; digits?: number }) {
  if (now == null || before == null) return <span className="delta muted">No earlier data</span>
  const d = now - before
  const r = Number(d.toFixed(digits))
  if (r === 0) return <span className="delta muted">Same as previous period</span>
  const up = r > 0
  return (
    <span className={`delta ${up ? 'delta-up' : 'delta-down'}`}>
      <span aria-hidden>{up ? '↑' : '↓'}</span> {Math.abs(r).toFixed(digits)}
      {unit} vs previous period
    </span>
  )
}

function Kpi({ label, value, children, tone }: { label: string; value: string; children?: React.ReactNode; tone?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value tabular" style={tone ? { color: tone } : undefined}>
        {value}
      </span>
      {children}
    </div>
  )
}

export default function Overview() {
  const { me } = useAuth()
  const filters = useFilters('7d')
  const qs = filters.query.toString()
  const { data, error, mutate, isLoading } = useSWR<Stats>(`/stats/?${qs}`)
  const recent = useSWR<Paginated<Feedback>>(`/feedback/?${qs}&page_size=6&has_comment=1`)

  const greeting = (() => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  })()

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">
            {greeting}, {me?.name.split(' ')[0]}
          </h1>
          <p className="muted">How guests felt across your branches.</p>
        </div>
      </header>
      <FilterBar filters={filters} />

      {error ? <ErrorState message={error.message} onRetry={() => mutate()} /> : null}
      {isLoading && !data ? <OverviewSkeleton /> : null}

      {data && data.count === 0 ? (
        <EmptyState
          title="No feedback in this period"
          body="Share a branch's guest link or QR code, or pick a wider date range."
          action={
            <Link className="btn btn-secondary btn-sm" to="/locations">
              Get guest links
            </Link>
          }
        />
      ) : null}

      {data && data.count > 0 ? (
        <>
          <section className="kpis" aria-label="Key numbers">
            <Kpi label="Responses" value={String(data.count)}>
              <Delta now={data.count} before={data.previous.count} />
            </Kpi>
            <Kpi label="Average rating" value={`${fmtAvg(data.avg)}★`} tone={moodVar(data.avg)}>
              <Delta now={data.avg} before={data.previous.avg} digits={2} />
            </Kpi>
            <Kpi label="Net Promoter Score" value={fmtNps(data.nps)}>
              {data.nps_responses ? (
                <Delta now={data.nps} before={data.previous.nps} />
              ) : (
                <span className="delta muted">No NPS answers yet</span>
              )}
            </Kpi>
            <Link
              to={`/history?${new URLSearchParams({ ...Object.fromEntries(filters.params), rating: 'low', status: 'new' })}`}
              className={`kpi kpi-link${data.attention ? ' kpi-alert' : ''}`}
            >
              <span className="kpi-label">Needs attention</span>
              <span className="kpi-value tabular">{data.attention}</span>
              <span className="delta muted">{data.attention ? '1–2★ not yet reviewed →' : 'All low ratings handled'}</span>
            </Link>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Daily trend</h2>
            </div>
            <TrendChart series={data.series} />
          </section>

          <div className="grid-2">
            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Rating mix</h2>
              </div>
              <Distribution dist={data.distribution} total={data.count} />
            </section>
            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Scores by area</h2>
                <span className="muted small">Average of 1–5</span>
              </div>
              <CategoryBars items={CATEGORY_KEYS.map((k) => ({ label: CATEGORY_LABELS[k].en, value: data.categories[k] }))} />
            </section>
          </div>

          {data.by_location.length > 1 ? (
            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Branches compared</h2>
              </div>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Branch</th>
                      <th scope="col" className="num">Responses</th>
                      <th scope="col" className="num">Avg</th>
                      <th scope="col" className="num">NPS</th>
                      <th scope="col" className="num">1–2★</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_location.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <Link className="row-link" to={`/history?location=${l.id}&range=${filters.preset}`}>
                            {l.name}
                          </Link>
                        </td>
                        <td className="num tabular">{l.count}</td>
                        <td className="num tabular">
                          <span className="avg-cell">
                            <i className="dot-mini" style={{ background: moodVar(l.avg) }} aria-hidden />
                            {fmtAvg(l.avg)}
                          </span>
                        </td>
                        <td className="num tabular">{fmtNps(l.nps)}</td>
                        <td className="num tabular">{l.low || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <div className="grid-2">
            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">What guests mention</h2>
              </div>
              {data.highlights.length ? (
                <div className="mentions">
                  {data.highlights.map((h) => (
                    <span key={h.key} className={`mention ${isNegativeHighlight(h.key) ? 'mention-neg' : 'mention-pos'}`}>
                      {HIGHLIGHT_LABELS[h.key]?.en ?? h.key}
                      <b className="tabular">{h.count}</b>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted">No highlights picked in this period.</p>
              )}
            </section>
            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Latest comments</h2>
                <Link className="btn btn-ghost btn-sm" to={`/history?${filters.params.toString()}`}>
                  Open history
                </Link>
              </div>
              <ul className="quotes">
                {recent.data?.results
                  .filter((f) => f.comment)
                  .slice(0, 4)
                  .map((f) => (
                    <li key={f.id} className="quote">
                      <Stars value={f.overall} />
                      <p dir="auto">{f.comment}</p>
                      <span className="muted small">
                        {f.guest_name || 'Anonymous'} · {f.location_name} · {relativeTime(f.created_at)} at {timeOf(f.created_at)}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          </div>
        </>
      ) : null}
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <>
      <div className="kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 108 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 280 }} />
    </>
  )
}
