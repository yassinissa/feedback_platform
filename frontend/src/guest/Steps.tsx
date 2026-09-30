import { useId } from 'react'
import {
  CATEGORY_LABELS,
  HIGHLIGHT_LABELS,
  NEGATIVE_HIGHLIGHTS,
  POSITIVE_HIGHLIGHTS,
  RATING_WORDS,
} from '../lib/copy'
import { CATEGORY_KEYS, type CategoryKey } from '../lib/types'
import { useForm } from './FormContext'

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
      <circle cx="17" cy="19" r="2.6" className="face-feature-fill" />
      <circle cx="31" cy="19" r="2.6" className="face-feature-fill" />
      <path d={MOUTHS[rating - 1]} className="face-feature" />
    </svg>
  )
}

export function RatingFaces({ onPick }: { onPick: (n: number) => void }) {
  const { state, meta } = useForm()
  return (
    <div className="faces" role="radiogroup" aria-label={meta.t.welcomeTitle}>
      {[1, 2, 3, 4, 5].map((n) => {
        const selected = state.overall === n
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected}
            className="face"
            data-mood={n}
            data-selected={selected || undefined}
            onClick={() => onPick(n)}
          >
            <Face rating={n} />
            <span className="face-label">{RATING_WORDS[meta.lang][n - 1]}</span>
          </button>
        )
      })}
    </div>
  )
}

function CategoryRow({ k }: { k: CategoryKey }) {
  const { state, dispatch, meta } = useForm()
  const value = state.categories[k] ?? 0
  const label = CATEGORY_LABELS[k][meta.lang]
  const labelId = useId()
  return (
    <div className="cat-row">
      <span className="cat-label" id={labelId}>
        {label}
      </span>
      <div className="cat-scale" role="radiogroup" aria-labelledby={labelId} data-mood={value || undefined}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={meta.t.rateAria(label, n)}
            className="cat-cell"
            data-on={n <= value || undefined}
            onClick={() => dispatch({ type: 'category', key: k, value: n })}
          >
            <span aria-hidden>{n}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function DetailsStep() {
  const { state, dispatch, meta } = useForm()
  const positive = (state.overall ?? 5) >= 4
  const options = positive ? POSITIVE_HIGHLIGHTS : NEGATIVE_HIGHLIGHTS
  return (
    <>
      <header className="step-head">
        <h1 className="step-title" tabIndex={-1}>{meta.t.detailsTitle}</h1>
        <p className="step-sub">{meta.t.detailsSub}</p>
      </header>
      <div className="card cat-card">
        {CATEGORY_KEYS.map((k) => (
          <CategoryRow key={k} k={k} />
        ))}
      </div>
      <fieldset className="chip-group">
        <legend className="group-label">{positive ? meta.t.standout : meta.t.improve}</legend>
        <div className="chips">
          {options.map((key) => (
            <button
              key={key}
              type="button"
              className="chip chip-lg"
              aria-pressed={state.highlights.includes(key)}
              onClick={() => dispatch({ type: 'toggleHighlight', key })}
            >
              {HIGHLIGHT_LABELS[key][meta.lang]}
            </button>
          ))}
        </div>
      </fieldset>
    </>
  )
}

const COMMENT_MAX = 2000

function npsTone(n: number) {
  return n <= 6 ? 'low' : n <= 8 ? 'mid' : 'high'
}

export function WordsStep() {
  const { state, dispatch, meta } = useForm()
  const commentId = useId()
  const npsId = useId()
  return (
    <>
      <header className="step-head">
        <h1 className="step-title" tabIndex={-1}>{meta.t.wordsTitle}</h1>
      </header>
      <div className="field">
        <label className="group-label" htmlFor={commentId}>
          {meta.t.commentLabel}
        </label>
        <textarea
          id={commentId}
          className="input input-lg"
          rows={5}
          maxLength={COMMENT_MAX}
          dir="auto"
          placeholder={meta.t.commentPlaceholder}
          value={state.comment}
          onChange={(e) => dispatch({ type: 'text', field: 'comment', value: e.target.value })}
        />
        <span className="field-hint count tabular" aria-live="off">
          {meta.t.chars(state.comment.length, COMMENT_MAX)}
        </span>
      </div>
      <div className="nps">
        <span className="group-label" id={npsId}>
          {meta.t.npsLabel}
        </span>
        <div className="nps-scale" role="radiogroup" aria-labelledby={npsId}>
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={state.nps === n}
              className="nps-cell tabular"
              data-tone={npsTone(n)}
              onClick={() => dispatch({ type: 'nps', value: n })}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="nps-legend" aria-hidden>
          <span>{meta.t.npsLow}</span>
          <span>{meta.t.npsHigh}</span>
        </div>
      </div>
    </>
  )
}

export function AboutStep({ contactError }: { contactError?: string }) {
  const { state, dispatch, meta } = useForm()
  const ids = { name: useId(), table: useId(), server: useId(), contact: useId(), consent: useId() }
  const low = (state.overall ?? 5) <= 3
  return (
    <>
      <header className="step-head">
        <h1 className="step-title" tabIndex={-1}>{meta.t.youTitle}</h1>
        <p className="step-sub">{meta.t.youSub}</p>
      </header>
      <div className="about-grid">
        <div className="field span-2">
          <label className="field-label" htmlFor={ids.name}>
            {meta.t.name}
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
          <label className="field-label" htmlFor={ids.table}>
            {meta.t.table}
          </label>
          <input
            id={ids.table}
            className="input input-lg"
            inputMode="numeric"
            maxLength={20}
            placeholder={meta.t.tablePh}
            value={state.table_number}
            onChange={(e) => dispatch({ type: 'text', field: 'table_number', value: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={ids.server}>
            {meta.t.server}
          </label>
          <input
            id={ids.server}
            className="input input-lg"
            maxLength={60}
            dir="auto"
            placeholder={meta.t.serverPh}
            value={state.server_name}
            onChange={(e) => dispatch({ type: 'text', field: 'server_name', value: e.target.value })}
          />
        </div>
      </div>

      <div className={`consent card${low ? ' consent-emph' : ''}`}>
        <label className="consent-row" htmlFor={ids.consent}>
          <input
            id={ids.consent}
            type="checkbox"
            className="switch"
            checked={state.contact_consent}
            onChange={(e) => dispatch({ type: 'consent', value: e.target.checked })}
          />
          <span>{low ? meta.t.consentLow : meta.t.consent}</span>
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
              inputMode="email"
              autoComplete="tel"
              dir="ltr"
              spellCheck={false}
              maxLength={120}
              placeholder={meta.t.contactPh}
              value={state.guest_contact}
              aria-invalid={contactError ? true : undefined}
              aria-describedby={`${ids.contact}-hint`}
              onChange={(e) => dispatch({ type: 'text', field: 'guest_contact', value: e.target.value })}
            />
            <span className="field-hint" id={`${ids.contact}-hint`}>
              {meta.t.contactHint}
            </span>
            {contactError ? (
              <span className="field-error" role="alert">
                {contactError}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

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
    </>
  )
}
