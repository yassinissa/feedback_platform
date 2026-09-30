import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ApiError } from '../lib/api'
import type { Lang } from '../lib/copy'
import '../styles/guest.css'
import { FormProvider, GUEST_CATEGORIES, averageRating, hasPoor, toPayload, useForm, type GuestCategory } from './FormContext'
import { STRINGS, defaultLang } from './i18n'
import { flushQueue, submitFeedback, uuid } from './queue'
import { AboutStep, RateStep } from './Steps'

interface PublicLocation {
  name: string
  name_ar: string
  city: string
  slug: string
  logo_url: string | null
  logo_bg: 'light' | 'dark'
}

const IDLE_MS = 60_000
const IDLE_COUNTDOWN = 15
const THANKS_SECONDS = 10
const STEPS = 2 // 0: rate + words, 1: about you, 2: thanks

type LoadState = { kind: 'loading' } | { kind: 'ready'; location: PublicLocation } | { kind: 'missing' } | { kind: 'error' }

export default function GuestApp() {
  const { slug = '' } = useParams()
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' })
  const [lang, setLang] = useState<Lang>(defaultLang)
  const [session, setSession] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const table = new URLSearchParams(window.location.search).get('table') ?? ''

  useEffect(() => {
    const ctrl = new AbortController()
    setLoad({ kind: 'loading' })
    fetch(`/api/public/locations/${encodeURIComponent(slug)}/`, { signal: ctrl.signal })
      .then(async (res) => {
        if (res.status === 404) return setLoad({ kind: 'missing' })
        if (!res.ok) throw new Error(String(res.status))
        setLoad({ kind: 'ready', location: await res.json() })
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setLoad({ kind: 'error' })
      })
    return () => ctrl.abort()
  }, [slug, attempt])

  // Send anything saved while offline: now, when the connection returns, and every minute.
  useEffect(() => {
    flushQueue()
    const onOnline = () => flushQueue()
    window.addEventListener('online', onOnline)
    const timer = window.setInterval(flushQueue, 60_000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.clearInterval(timer)
    }
  }, [])

  // Installed-app support: cache the kiosk so it opens even without Wi-Fi.
  useEffect(() => {
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js', { scope: '/f/' })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        const loaded = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((u) => /\/assets\/|\/api\/public\/.+\/(logo|icon-)|fonts\.(googleapis|gstatic)\.com/.test(u))
        reg.active?.postMessage({ type: 'precache', urls: [window.location.href, `/api/public/locations/${slug}/`, ...loaded] })
      })
      .catch(() => undefined)
  }, [slug])

  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  const t = STRINGS[lang]
  const newGuest = useCallback(() => {
    setSession((s) => s + 1)
    setLang(defaultLang())
    window.scrollTo(0, 0)
  }, [])

  if (load.kind !== 'ready') {
    return (
      <div className="guest min-h-screen" dir={dir}>
        <div className="guest-center">
          {load.kind === 'loading' ? <span className="spinner" aria-label="Loading" /> : null}
          {load.kind === 'missing' ? (
            <div className="notice">
              <h1 className="step-title">{t.notFoundTitle}</h1>
              <p className="step-sub">{t.notFoundBody}</p>
            </div>
          ) : null}
          {load.kind === 'error' ? (
            <div className="notice" role="alert">
              <p className="step-sub">{t.loadError}</p>
              <button className="btn btn-secondary" onClick={() => setAttempt((a) => a + 1)}>
                {t.retry}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <FormProvider key={session} lang={lang} table={table}>
      <Flow location={load.location} onToggleLang={() => setLang((l) => (l === 'en' ? 'ar' : 'en'))} onDone={newGuest} />
    </FormProvider>
  )
}

function BranchMark({ location, name, size = 'md' }: { location: PublicLocation; name: string; size?: 'md' | 'lg' }) {
  return (
    <span className={`mark mark-${size}`} data-bg={location.logo_url ? location.logo_bg : 'none'} aria-hidden>
      {location.logo_url ? <img src={location.logo_url} alt="" width={96} height={96} /> : name.slice(0, 1)}
    </span>
  )
}

function Flow({ location, onToggleLang, onDone }: { location: PublicLocation; onToggleLang: () => void; onDone: () => void }) {
  const { state, meta } = useForm()
  const { t, lang, dir } = meta
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<'fwd' | 'back'>('fwd')
  const [missing, setMissing] = useState<GuestCategory[]>([])
  const [sending, setSending] = useState(false)
  const [contactError, setContactError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const clientId = useRef(uuid())
  const stageRef = useRef<HTMLDivElement>(null)
  const name = lang === 'ar' && location.name_ar ? location.name_ar : location.name

  // Clear a "please rate" message as soon as that card gets a rating.
  useEffect(() => {
    setMissing((cur) => (cur.length ? cur.filter((c) => state.ratings[c] == null) : cur))
  }, [state.ratings])

  useEffect(() => {
    if (step === 0) return
    stageRef.current?.querySelector<HTMLElement>('h1')?.focus()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  function next() {
    const unrated = GUEST_CATEGORIES.filter((c) => state.ratings[c] == null)
    if (unrated.length) {
      setMissing(unrated)
      document.getElementById(`rate-${unrated[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setDirection('fwd')
    setStep(1)
  }

  function back() {
    setDirection('back')
    setStep(0)
  }

  async function submit() {
    if (state.contact_consent && !state.guest_contact.trim()) {
      setContactError(t.contactMissing)
      return
    }
    setContactError(undefined)
    setFormError(undefined)
    setSending(true)
    try {
      await submitFeedback(location.slug, toPayload(state, lang, clientId.current))
      setDirection('fwd')
      setStep(2)
    } catch (e) {
      const data = e instanceof ApiError ? (e.data as Record<string, string[]> | null) : null
      if (data?.guest_contact) setContactError(data.guest_contact[0])
      else setFormError(e instanceof Error ? e.message : t.checkFields)
    } finally {
      setSending(false)
    }
  }

  const inForm = step < STEPS

  return (
    <div className="guest min-h-screen" dir={dir}>
      <header className="guest-top">
        <div className="venue">
          <BranchMark location={location} name={name} />
          <span className="venue-text">
            <span className="venue-name" translate="no">
              {name}
            </span>
            {location.city ? <span className="venue-city">{location.city}</span> : null}
          </span>
        </div>
        <div className="top-actions">
          {inForm ? (
            <span className="step-pill tabular" aria-label={t.stepOf(step + 1, STEPS)}>
              <span className="step-dots" aria-hidden>
                <i data-on />
                <i data-on={step >= 1 || undefined} />
              </span>
              <bdi dir="ltr">
                {step + 1} / {STEPS}
              </bdi>
            </span>
          ) : null}
          {inForm ? (
            <button className="lang-btn" onClick={onToggleLang} aria-label={t.langSwitchLabel} lang={lang === 'en' ? 'ar' : 'en'}>
              {t.langSwitch}
            </button>
          ) : null}
        </div>
      </header>

      <main className="stage" ref={stageRef}>
        <div key={step} className={`step step-${direction}${step === 2 ? ' step-center' : ''}`}>
          {step === 0 ? (
            <>
              <header className="step-head intro">
                <p className="eyebrow">{t.welcome(name)}</p>
                <h1 className="step-title title-xl">{t.rateTitle}</h1>
                <p className="step-sub">{t.rateSub}</p>
              </header>
              <RateStep missing={missing} />
            </>
          ) : null}
          {step === 1 ? <AboutStep contactError={contactError} /> : null}
          {step === 2 ? <Thanks location={location} name={name} onDone={onDone} /> : null}
        </div>
      </main>

      {inForm ? (
        <footer className="guest-actions">
          {formError ? (
            <p className="field-error form-error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className={`guest-actions-row${step === 0 ? ' only-next' : ''}`}>
            {step === 1 ? (
              <button className="btn btn-ghost btn-xl" onClick={back}>
                <Arrow flip={dir === 'ltr'} />
                {t.back}
              </button>
            ) : null}
            {step === 0 ? (
              <button className="btn btn-primary btn-xl" onClick={next}>
                {t.next}
                <Arrow flip={dir === 'rtl'} />
              </button>
            ) : (
              <button className="btn btn-primary btn-xl" onClick={submit} disabled={sending} aria-busy={sending || undefined}>
                {sending ? <span className="spinner" aria-hidden /> : null}
                {sending ? t.sending : t.submit}
              </button>
            )}
          </div>
        </footer>
      ) : null}

      {inForm ? <IdleGuard onReset={onDone} /> : null}
    </div>
  )
}

function Arrow({ flip }: { flip: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M4 9h10M10 5l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Thanks({ location, name, onDone }: { location: PublicLocation; name: string; onDone: () => void }) {
  const { state, meta } = useForm()
  const { t } = meta
  const [left, setLeft] = useState(THANKS_SECONDS)
  const avg = averageRating(state.ratings) ?? 5

  useEffect(() => {
    const timer = window.setInterval(() => setLeft((s) => s - 1), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (left <= 0) onDone()
  }, [left, onDone])

  const firstName = state.guest_name.trim().split(/\s+/)[0] ?? ''
  const body = hasPoor(state.ratings) ? t.thanksSorry : avg >= 4 ? t.thanksHigh : t.thanksMid
  return (
    <section className="thanks" aria-live="polite">
      <div className="thanks-mark">
        <BranchMark location={location} name={name} size="lg" />
        <svg className="check" viewBox="0 0 96 96" aria-hidden>
          <circle cx="48" cy="48" r="44" className="check-ring" />
          <path d="M30 49l12 12 24-26" className="check-tick" />
        </svg>
      </div>
      <h1 className="hero-title" tabIndex={-1}>
        {t.thanks(firstName)}
      </h1>
      <p className="step-sub thanks-body">{body}</p>
      <button className="btn btn-secondary btn-xl" onClick={onDone}>
        {t.startNew}
      </button>
      <div className="countdown" aria-hidden>
        <span className="countdown-bar" style={{ animationDuration: `${THANKS_SECONDS}s` }} />
      </div>
      <p className="field-hint tabular">{t.nextGuest(Math.max(0, left))}</p>
    </section>
  )
}

/** Clears an abandoned form so the next guest never sees someone else's answers. */
function IdleGuard({ onReset }: { onReset: () => void }) {
  const { meta } = useForm()
  const [warning, setWarning] = useState<number | null>(null)
  const idleTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const arm = () => {
      window.clearTimeout(idleTimer.current)
      idleTimer.current = window.setTimeout(() => setWarning(IDLE_COUNTDOWN), IDLE_MS)
    }
    const onActivity = () => {
      setWarning((w) => (w === null ? w : null))
      arm()
    }
    arm()
    const events = ['pointerdown', 'touchstart', 'click', 'keydown', 'input', 'scroll'] as const
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }))
    return () => {
      window.clearTimeout(idleTimer.current)
      events.forEach((ev) => window.removeEventListener(ev, onActivity))
    }
  }, [])

  useEffect(() => {
    if (warning === null) return
    if (warning <= 0) {
      onReset()
      return
    }
    const timer = window.setTimeout(() => setWarning((w) => (w === null ? null : w - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [warning, onReset])

  if (warning === null) return null
  return (
    <div className="overlay" role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
      <div className="modal idle">
        <div className="modal-body" style={{ textAlign: 'center', alignItems: 'center' }}>
          <h2 className="modal-title" id="idle-title">
            {meta.t.idleTitle}
          </h2>
          <p className="step-sub tabular">{meta.t.idleBody(Math.max(0, warning))}</p>
          <div className="idle-actions">
            <button className="btn btn-ghost btn-xl" onClick={onReset}>
              {meta.t.idleReset}
            </button>
            <button className="btn btn-primary btn-xl" onClick={() => setWarning(null)} autoFocus>
              {meta.t.idleStay}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
