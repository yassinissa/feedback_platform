/**
 * Offline-tolerant submission for shared iPads.
 * If Wi-Fi drops or the server is waking up, the entry is kept in
 * localStorage and retried later. client_id makes retries idempotent.
 */
import { ApiError, errorMessage } from '../lib/api'

const KEY = 'fb.queue.v1'

interface QueuedItem {
  slug: string
  payload: Record<string, unknown>
  queuedAt: number
}

function read(): QueuedItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as QueuedItem[]) : []
  } catch {
    return []
  }
}

function write(items: QueuedItem[]) {
  try {
    if (items.length) localStorage.setItem(KEY, JSON.stringify(items.slice(-200)))
    else localStorage.removeItem(KEY)
  } catch {
    /* storage full or blocked — nothing more we can do on-device */
  }
}

/** crypto.randomUUID needs Safari 15.4; iPads may be on 15.0. */
export function uuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

async function post(slug: string, payload: Record<string, unknown>): Promise<Response> {
  return fetch(`/api/public/locations/${encodeURIComponent(slug)}/feedback/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  })
}

const retryable = (status: number) => status >= 500 || status === 429 || status === 408

/** Returns 'sent' or 'queued'. Throws ApiError for validation problems the guest can fix. */
export async function submitFeedback(slug: string, payload: Record<string, unknown>): Promise<'sent' | 'queued'> {
  let res: Response
  try {
    res = await post(slug, payload)
  } catch {
    write([...read(), { slug, payload, queuedAt: Date.now() }])
    return 'queued'
  }
  if (res.ok) return 'sent'
  if (retryable(res.status)) {
    write([...read(), { slug, payload, queuedAt: Date.now() }])
    return 'queued'
  }
  const data = await res.json().catch(() => null)
  throw new ApiError(res.status, data, errorMessage(data))
}

let flushing = false

export async function flushQueue() {
  if (flushing) return
  const items = read()
  if (!items.length) return
  flushing = true
  const remaining: QueuedItem[] = []
  for (const item of items) {
    try {
      const res = await post(item.slug, item.payload)
      if (!res.ok && retryable(res.status)) remaining.push(item)
      // Non-retryable 4xx (e.g. branch deactivated) are dropped.
    } catch {
      remaining.push(item)
    }
  }
  // Keep anything queued while we were flushing.
  const added = read().filter((i) => !items.some((o) => o.payload.client_id === i.payload.client_id))
  write([...remaining, ...added])
  flushing = false
}
