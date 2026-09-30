// Thin typed fetch wrapper around wwc-api. One place owns the base URL, the
// bearer header, and turning non-2xx responses into a typed error - mirrors the
// iOS app's URLSessionAPIClient so the two clients behave the same way.

// In dev the Vite proxy serves the API under /api (same origin, no CORS). In
// prod VITE_API_BASE_URL points straight at the deployed API.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

const TOKEN_KEY = 'wwc.jwt'

export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  readonly status: number
  readonly detail: string | null

  constructor(status: number, detail: string | null) {
    super(detail ?? `Request failed (${status})`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }

  /** True when the server rejected our token, not our request. */
  get isUnauthorized() {
    return this.status === 401
  }
}

// Fired the moment any authed request comes back 401 - wired by AuthContext to
// clear the stored token and drop back to the login screen. Kept as a module
// hook (not a param on every call) so callers never have to thread it through.
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** Set false for the login call, which carries no token by design. */
  auth?: boolean
  signal?: AbortSignal
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = options
  const headers: Record<string, string> = { Accept: 'application/json' }

  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = tokenStore.get()
    if (!token) {
      onUnauthorized?.()
      throw new ApiError(401, 'Not signed in')
    }
    headers.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, 'Network error - check your connection')
  }

  if (response.status === 401 && auth) {
    onUnauthorized?.()
    throw new ApiError(401, 'Your session has expired - sign in again')
  }

  if (!response.ok) {
    const detail = await response
      .json()
      .then((b: { detail?: string }) => b.detail ?? null)
      .catch(() => null)
    throw new ApiError(response.status, detail)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/** Fetches a file (e.g. a CSV export) with auth and triggers a browser
 *  download. Kept separate from `request`, which parses JSON. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = tokenStore.get()
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    if (response.status === 401) onUnauthorized?.()
    throw new ApiError(response.status, 'Could not download the file')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
