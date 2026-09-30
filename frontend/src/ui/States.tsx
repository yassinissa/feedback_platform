import type { ReactNode } from 'react'
import { moodVar } from '../lib/copy'

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="state">
      <div className="state-mark" aria-hidden>
        <svg width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" />
          <path d="M13 24c2 2.5 4.5 3.5 7 3.5s5-1 7-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="15" cy="16" r="1.8" fill="currentColor" />
          <circle cx="25" cy="16" r="1.8" fill="currentColor" />
        </svg>
      </div>
      <p className="state-title">{title}</p>
      <p className="state-body">{body}</p>
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state state-error" role="alert">
      <p className="state-title">Couldn't load this</p>
      <p className="state-body">{message}</p>
      {onRetry ? (
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  )
}

/** Five small pips — compact read-only rating for lists and tables. */
export function Stars({ value, size = 12 }: { value: number | null; size?: number }) {
  const color = moodVar(value)
  return (
    <span className="stars" role="img" aria-label={value == null ? 'Not rated' : `${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 12 12" aria-hidden>
          <path
            d="M6 .8l1.55 3.3 3.6.42-2.66 2.47.7 3.56L6 8.8 2.8 10.55l.71-3.56L.85 4.52l3.6-.42z"
            fill={value != null && i <= value ? color : 'var(--border-strong)'}
          />
        </svg>
      ))}
    </span>
  )
}
