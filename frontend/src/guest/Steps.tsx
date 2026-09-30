import { useId, type ReactNode } from 'react'
import { CATEGORY_LABELS, HIGHLIGHT_LABELS, NEGATIVE_HIGHLIGHTS, RATING_WORDS } from '../lib/copy'
import { GUEST_CATEGORIES, hasPoor, useForm, type GuestCategory } from './FormContext'

export const COMMENT_MAX = 2000

const MOUTHS = [
  'M15 35 Q24 26 33 35', // 1 — frown
  'M16 33 Q24 29.5 32 33',
  'M16 31.5 L32 31.5',
  'M16 29.5 Q24 35 32 29.5',
  'M14 28 Q24 40 34 28', // 5 — beam
]

function Face({ rating }: { rating: number }) {
  return (
    <svg className="face-svg" viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="21" className="face-ring" />
      <circle cx="17.5" cy="19.5" r="2.1" className="face-eye" />
      <circle cx="30.5" cy="19.5" r="2.1" className="face-eye" />
      <path d={MOUTHS[rating - 1]} className="face-mouth" />
    </svg>
  )
}

const ICONS: Record<GuestCategory, ReactNode> = {
  // cloche
  food: (
    <>
      <path d="M3 17h18M5 17a7 7 0 0114 0" />
      <path d="M12 7.5V6M10.5 6h3" />
    </>
  ),
  // service bell
  service: (
    <>
      <path d="M4 17h16M6 17a6 6 0 0112 0" />
      <path d="M12 11V9M10 20h4" />
    </>
  ),
  // pendant lamp
  ambiance: (
    <>
      <path d="M12 3v4M7 13a5 5 0 0110 0z" />
      <path d="M10.5 16a1.5 1.5 0 003 0M5 20l1.2-1.2M19 20l-1.2-1.2M12 21v-1.5" />
    </>
  ),
}

function RatingCard({ category, missing }: { category: GuestCategory; missing: boolean }) {
  const { state, dispatch, meta } = useForm()
  const value = state.ratings[category]
  const label = CATEGORY_LABELS[category][meta.lang]
  const labelId = useId()
  return (
    <section
      className="rate-card"
      data-mood={value}
      data-missing={missing || undefined}
      aria-labelledby={labelId}
      id={`rate-${category}`}
    >
      <header className="rate-head">
        <span className="rate-icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="22" height="22">
            {ICONS[category]}
          </svg>
        </span>
        <h2 className="rate-label" id={labelId}>
          {label}
        </h2>
        {value ? null : <span className="rate-hint">{meta.t.tapToRate}</span>}
      </header>
      <div className="faces" role="radiogroup" aria-labelledby={labelId} data-chosen={value ? true : undefined}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            className="face"
            data-mood={n}
            onClick={() => dispatch({ type: 'rate', key: category, value: n })}
          >
            <Face rating={n} />
            <span className="face-word">{RATING_WORDS[meta.lang][n - 1]}</span>
          </button>
        ))}
      </div>
      {missing ? (
        <p className="rate-error" role="alert">
          {meta.t.rateMissing(label)}
        </p>
      ) : null}
    </section>
  )
}

export function RateStep({ missing }: { missing: GuestCategory[] }) {
  const { state, dispatch, meta } = useForm()
  const commentId = useId()
  const improveId = useId()
  return (
    <div className="rate-layout">
      <div className="rate-col">
        {GUEST_CATEGORIES.map((c) => (
          <RatingCard key={c} category={c} missing={missing.includes(c)} />
        ))}
      </div>
      <div className="rate-col rate-col-side">
        <section className="panel-g" aria-labelledby={improveId}>
          <h2 className="group-label" id={improveId}>
            {meta.t.improve}
            <span className="opt">{meta.t.optional}</span>
          </h2>
          <div className="toggles">
            {NEGATIVE_HIGHLIGHTS.map((key) => (
              <button
                key={key}
                type="button"
                className="toggle"
                aria-pressed={state.highlights.includes(key)}
                onClick={() => dispatch({ type: 'toggleHighlight', key })}
              >
                <span className="toggle-box" aria-hidden>
                  <svg viewBox="0 0 12 12" width="12" height="12">
                    <path d="M2.5 6.2l2.3 2.3 4.7-4.9" />
                  </svg>
                </span>
                {HIGHLIGHT_LABELS[key][meta.lang]}
              </button>
            ))}
          </div>
        </section>
        <section className="panel-g panel-grow">
          <label className="group-label" htmlFor={commentId}>
            {meta.t.commentLabel}
            <span className="opt">{meta.t.optional}</span>
          </label>
          <textarea
            id={commentId}
            className="input input-lg comment-box"
            maxLength={COMMENT_MAX}
            dir="auto"
            placeholder={meta.t.commentPlaceholder}
            value={state.comment}
            onChange={(e) => dispatch({ type: 'text', field: 'comment', value: e.target.value })}
          />
          <span className="field-hint count tabular" aria-live="off">
            <bdi dir="ltr">{meta.t.chars(state.comment.length, COMMENT_MAX)}</bdi>
          </span>
        </section>
      </div>
    </div>
  )
}

export function AboutStep({ contactError }: { contactError?: string }) {
  const { state, dispatch, meta } = useForm()
  const ids = { name: useId(), server: useId(), contact: useId(), consent: useId() }
  const sorry = hasPoor(state.ratings)
  return (
    <div className="about">
      <header className="step-head">
        <h1 className="step-title" tabIndex={-1}>
          {meta.t.youTitle}
        </h1>
        <p className="step-sub">{meta.t.youSub}</p>
      </header>

      <div className="about-grid">
        <div className="field">
          <label className="field-label" htmlFor={ids.name}>
            {meta.t.name} <span className="opt">{meta.t.optional}</span>
          </label>
          <input
            id={ids.name}
            className="input input-lg"
            autoComplete="given-name"
            maxLength={80}
            dir="auto"
            placeholder={meta.t.namePh}
            value={state.guest_name}
            onChange={(e) => dispatch({ type: 'text', field: 'guest_name', value: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={ids.server}>
            {meta.t.server} <span className="opt">{meta.t.optional}</span>
          </label>
          <input
            id={ids.server}
            className="input input-lg"
            autoComplete="off"
            maxLength={60}
            dir="auto"
            placeholder={meta.t.serverPh}
            value={state.server_name}
            onChange={(e) => dispatch({ type: 'text', field: 'server_name', value: e.target.value })}
          />
        </div>
      </div>

      <section className={`contact-card${sorry ? ' contact-sorry' : ''}`}>
        {sorry ? (
          <div className="sorry">
            <div className="sorry-text">
              <p className="sorry-title">{meta.t.sorryTitle}</p>
              <p className="sorry-body">{meta.t.sorryBody}</p>
            </div>
          </div>
        ) : null}
        <label className="consent-row" htmlFor={ids.consent}>
          <input
            id={ids.consent}
            type="checkbox"
            className="switch"
            checked={state.contact_consent}
            onChange={(e) => dispatch({ type: 'consent', value: e.target.checked })}
          />
          <span className="consent-text">
            <span className="consent-title">{meta.t.consent}</span>
            {sorry ? null : <span className="field-hint">{meta.t.consentHint}</span>}
          </span>
        </label>
        {state.contact_consent ? (
          <div className="field consent-field">
            <label className="field-label" htmlFor={ids.contact}>
              {meta.t.contact}
            </label>
            <input
              id={ids.contact}
              className="input input-lg"
              type="text"
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
              maxLength={120}
              placeholder={meta.t.contactPh}
              value={state.guest_contact}
              aria-invalid={contactError ? true : undefined}
              onChange={(e) => dispatch({ type: 'text', field: 'guest_contact', value: e.target.value })}
            />
            {contactError ? (
              <span className="field-error" role="alert">
                {contactError}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Honeypot — hidden from people and assistive tech; bots fill it in. */}
      <div className="hp" aria-hidden>
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={state.website}
            onChange={(e) => dispatch({ type: 'text', field: 'website', value: e.target.value })}
          />
        </label>
      </div>
    </div>
  )
}
