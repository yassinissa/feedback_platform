import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError, uploadFile } from '../lib/api'
import { relativeTime } from '../lib/format'
import type { Location } from '../lib/types'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { EmptyState, ErrorState } from '../ui/States'
import { useToast } from '../ui/Toast'
import { useAuth } from './auth'
import { useLocations } from './filters'

const guestUrl = (slug: string, table?: string) =>
  `${window.location.origin}/f/${slug}${table ? `?table=${encodeURIComponent(table)}` : ''}`

export default function Locations() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const { data, error, mutate, isLoading } = useLocations()
  const [editing, setEditing] = useState<Location | 'new' | null>(null)
  const [qrFor, setQrFor] = useState<Location | null>(null)

  async function copy(slug: string) {
    try {
      await navigator.clipboard.writeText(guestUrl(slug))
      toast.success('Guest link copied')
    } catch {
      window.prompt('Copy this link', guestUrl(slug))
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Branches</h1>
          <p className="muted">Each branch has its own guest link. Open it on the branch iPad, or print its QR code.</p>
        </div>
        {isAdmin ? (
          <Button variant="primary" onClick={() => setEditing('new')}>
            + New branch
          </Button>
        ) : null}
      </header>

      {error ? <ErrorState message={error.message} onRetry={() => mutate()} /> : null}
      {isLoading && !data ? (
        <div className="loc-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 210 }} />
          ))}
        </div>
      ) : null}
      {data && !data.length ? (
        <EmptyState
          title="No branches yet"
          body={isAdmin ? 'Add your first branch to get its guest feedback link.' : 'An admin hasn’t assigned you to a branch yet.'}
          action={
            isAdmin ? (
              <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
                + New branch
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {data && data.length ? (
        <ul className="loc-grid">
          {data.map((l) => (
            <li key={l.id} className={`loc${l.is_active ? '' : ' loc-off'}`}>
              <div className="loc-top">
                <span className="logo-preview logo-sm" data-bg={l.logo_url ? l.logo_bg : 'none'} aria-hidden>
                  {l.logo_url ? <img src={l.logo_url} alt="" width={48} height={48} /> : l.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="loc-title">
                  <h2 className="loc-name">{l.name}</h2>
                  <p className="muted small">
                    {[l.name_ar, l.city].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <span className={`badge ${l.is_active ? 'badge-success' : 'badge-muted'}`}>{l.is_active ? 'Live' : 'Paused'}</span>
              </div>
              <div className="loc-stats">
                <span>
                  <b className="tabular">{l.feedback_count}</b> total responses
                </span>
                <span className="muted">Last: {relativeTime(l.last_feedback_at)}</span>
              </div>
              <code className="loc-link" title={guestUrl(l.slug)}>
                /f/{l.slug}
              </code>
              <div className="loc-actions">
                <Button size="sm" onClick={() => copy(l.slug)}>
                  Copy link
                </Button>
                <Button size="sm" onClick={() => setQrFor(l)}>
                  QR code
                </Button>
                <a className="btn btn-sm btn-ghost" href={guestUrl(l.slug)} target="_blank" rel="noreferrer">
                  Open form ↗
                </a>
                {isAdmin ? (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>
                    Edit
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {editing ? (
        <LocationForm
          location={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null)
            mutate()
            toast.success(msg)
          }}
        />
      ) : null}
      {qrFor ? <QrModal location={qrFor} onClose={() => setQrFor(null)} /> : null}
    </div>
  )
}

/** Downscale to ≤512px PNG in the browser so uploads stay small (iOS 15-safe: no WebP encode). */
async function resizeLogo(file: File, max = 512): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('That file could not be read as an image.'))
      el.src = url
    })
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the image.'))), 'image/png'),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

type LogoChange = { kind: 'keep' } | { kind: 'remove' } | { kind: 'new'; blob: Blob; preview: string }

function LogoField({
  current,
  change,
  onChange,
  bg,
  onBg,
  name,
}: {
  current: string | null
  change: LogoChange
  onChange: (c: LogoChange) => void
  bg: 'light' | 'dark'
  onBg: (bg: 'light' | 'dark') => void
  name: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string>()
  const preview = change.kind === 'new' ? change.preview : change.kind === 'remove' ? null : current

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(undefined)
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError('Use a PNG, JPG or WebP image.')
    try {
      const blob = await resizeLogo(file)
      onChange({ kind: 'new', blob, preview: URL.createObjectURL(blob) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.')
    }
  }

  return (
    <div className="field">
      <span className="field-label">Logo</span>
      <div className="logo-field">
        <span className="logo-preview" data-bg={preview ? bg : 'none'} aria-hidden>
          {preview ? <img src={preview} alt="" width={72} height={72} /> : (name || 'B').slice(0, 1).toUpperCase()}
        </span>
        <div className="logo-controls">
          <div className="logo-buttons">
            <Button size="sm" onClick={() => inputRef.current?.click()}>
              {preview ? 'Replace logo' : 'Upload logo'}
            </Button>
            {preview ? (
              <Button size="sm" variant="ghost" onClick={() => onChange({ kind: current ? 'remove' : 'keep' })}>
                Remove
              </Button>
            ) : null}
          </div>
          {preview ? (
            <div className="segmented" role="group" aria-label="Tile behind the logo">
              <button type="button" aria-pressed={bg === 'light'} onClick={() => onBg('light')}>
                Light tile
              </button>
              <button type="button" aria-pressed={bg === 'dark'} onClick={() => onBg('dark')}>
                Dark tile
              </button>
            </div>
          ) : null}
          <span className="field-hint">PNG, JPG or WebP. Square logos look best; use the dark tile for white logos.</span>
          {error ? (
            <span className="field-error" role="alert">
              {error}
            </span>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose logo file"
          onChange={(e) => {
            onFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

function LocationForm({
  location,
  onClose,
  onSaved,
}: {
  location: Location | null
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const [name, setName] = useState(location?.name ?? '')
  const [nameAr, setNameAr] = useState(location?.name_ar ?? '')
  const [city, setCity] = useState(location?.city ?? '')
  const [active, setActive] = useState(location?.is_active ?? true)
  const [logoBg, setLogoBg] = useState<'light' | 'dark'>(location?.logo_bg ?? 'light')
  const [logo, setLogo] = useState<LogoChange>({ kind: 'keep' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  useEffect(
    () => () => {
      if (logo.kind === 'new') URL.revokeObjectURL(logo.preview)
    },
    [logo],
  )

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setErrors({ name: 'Give the branch a name.' })
    setPending(true)
    setErrors({})
    try {
      const body = { name: name.trim(), name_ar: nameAr.trim(), city: city.trim(), is_active: active, logo_bg: logoBg }
      const saved = location
        ? await api<Location>(`/locations/${location.id}/`, { method: 'PATCH', body })
        : await api<Location>('/locations/', { method: 'POST', body })
      if (logo.kind === 'new') await uploadFile(`/locations/${saved.id}/logo/`, logo.blob, 'logo.png')
      if (logo.kind === 'remove') await api(`/locations/${saved.id}/logo/`, { method: 'DELETE' })
      onSaved(location ? 'Branch saved' : 'Branch created. Its guest link is ready.')
    } catch (err) {
      const data = err instanceof ApiError ? (err.data as Record<string, string[]>) : null
      setErrors(
        data && typeof data === 'object'
          ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)]))
          : { name: err instanceof Error ? err.message : 'Could not save. Try again.' },
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal
      title={location ? 'Edit branch' : 'New branch'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="loc-form" pending={pending}>
            {location ? 'Save branch' : 'Create branch'}
          </Button>
        </>
      }
    >
      <form id="loc-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <LogoField current={location?.logo_url ?? null} change={logo} onChange={setLogo} bg={logoBg} onBg={setLogoBg} name={name} />
        {errors.file ? <span className="field-error">{errors.file}</span> : null}
        <Field label="Branch name" required error={errors.name}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Avenues" />
        </Field>
        <Field label="Arabic name" hint="Shown to guests who switch the form to Arabic.">
          <input className="input" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="الأفنيوز" />
        </Field>
        <Field label="City or area">
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Kuwait City" />
        </Field>
        {location ? (
          <label className="check-row">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>
              <b>Accepting feedback</b>
              <span className="muted small"> — pausing hides the guest form but keeps all history.</span>
            </span>
          </label>
        ) : null}
      </form>
    </Modal>
  )
}

function QrModal({ location, onClose }: { location: Location; onClose: () => void }) {
  const [table, setTable] = useState('')
  const [src, setSrc] = useState<string | null>(null)
  const url = guestUrl(location.slug, table.trim())

  useEffect(() => {
    let alive = true
    import('qrcode').then((QR) =>
      QR.toDataURL(url, { width: 640, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b0b10', light: '#ffffff' } }).then(
        (data) => alive && setSrc(data),
      ),
    )
    return () => {
      alive = false
    }
  }, [url])

  const filename = `qr-${location.slug}${table ? `-table-${table}` : ''}.png`

  return (
    <Modal
      title={`QR code · ${location.name}`}
      onClose={onClose}
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={() => window.print()}>
            Print
          </Button>
          <a className={`btn btn-primary${src ? '' : ' is-disabled'}`} href={src ?? undefined} download={filename}>
            Download PNG
          </a>
        </>
      }
    >
      <div className="qr-print">
        <div className="qr-card">
          {src ? <img src={src} alt={`QR code linking to ${url}`} width={260} height={260} /> : <div className="skeleton" style={{ width: 260, height: 260 }} />}
          <p className="qr-caption">
            <b>Tell us about your visit</b>
            <span lang="ar" dir="rtl">
              شاركنا رأيك في زيارتك
            </span>
            {table ? <span className="muted small">Table {table}</span> : null}
          </p>
        </div>
      </div>
      <Field label="Table number (optional)" hint="Adds the table to every answer from this code, e.g. for table tents.">
        <input className="input" inputMode="numeric" value={table} onChange={(e) => setTable(e.target.value)} placeholder="e.g. 12" />
      </Field>
      <code className="loc-link">{url}</code>
    </Modal>
  )
}
