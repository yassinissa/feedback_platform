const TOKEN_KEY = 'fb.token'

export class ApiError extends Error {
  status: number
  data: unknown
  constructor(status: number, data: unknown, message: string) {
    super(message)
    this.status = status
    this.data = data
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable (private mode) — login lasts for this tab only */
  }
}

/** First human-readable message out of a DRF error payload. */
export function errorMessage(data: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (!data || typeof data !== 'object') return fallback
  const d = data as Record<string, unknown>
  if (typeof d.detail === 'string') return d.detail
  for (const value of Object.values(d)) {
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
    if (typeof value === 'string') return value
  }
  return fallback
}

type Options = { method?: string; body?: unknown; auth?: boolean; signal?: AbortSignal }

export async function api<T = unknown>(
  path: string,
  { method = 'GET', body, auth = true, signal }: Options = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = auth ? getToken() : null
  if (token) headers.Authorization = `Token ${token}`

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })
  if (res.status === 401 && auth) {
    setToken(null)
    window.dispatchEvent(new Event('fb:logout'))
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data, errorMessage(data))
  return data as T
}

/** SWR fetcher — keys are API paths. */
export const fetcher = <T,>(path: string) => api<T>(path)

export async function uploadFile<T = unknown>(path: string, file: Blob, filename: string): Promise<T> {
  const form = new FormData()
  form.append('file', file, filename)
  const token = getToken()
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Token ${token}` } : {},
    body: form,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data, errorMessage(data, 'Upload failed. Try again.'))
  return data as T
}

export async function downloadFile(path: string, filename: string) {
  const token = getToken()
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Token ${token}` } : {} })
  if (!res.ok) throw new ApiError(res.status, null, 'Export failed. Try again.')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
