import type { SessionContext } from './sessionRepository.ts'

export const CSRF_COOKIE_NAME = 'leaveit_csrf'
export const CSRF_HEADER_NAME = 'x-csrf-token'

/**
 * Security headers applied to all API responses to mitigate XSS, clickjacking, and MIME sniffing.
 */
export const API_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
}

export function generateCsrfToken(): string {
  const bytes = new Uint8Array(24)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function buildSetCsrfCookie(
  csrfToken: string,
  maxAgeSeconds = 24 * 60 * 60,
): string {
  return `${CSRF_COOKIE_NAME}=${encodeURIComponent(csrfToken)}; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`
}

export function buildClearCsrfCookie(): string {
  return `${CSRF_COOKIE_NAME}=; SameSite=Lax; Path=/; Max-Age=0`
}

/**
 * Strips dangerous HTML tags, script blocks, inline event handlers, and javascript:/data: URIs
 * from a single string value to prevent Stored and Reflected XSS.
 */
export function sanitizeStringForXss(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/\bon[a-z]+\s*=/gi, '')
    .replace(/[<>]/g, '')
}

/**
 * Recursively sanitizes all strings inside a parsed JSON payload or query object.
 */
export function sanitizePayloadForXss<T>(value: T): T {
  if (typeof value === 'string') {
    return sanitizeStringForXss(value) as unknown as T
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayloadForXss(item)) as unknown as T
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizePayloadForXss(v)
    }
    return out as T
  }
  return value
}

export function isStateChangingMethod(method: string): boolean {
  const upper = method.toUpperCase()
  return (
    upper === 'POST' ||
    upper === 'PUT' ||
    upper === 'PATCH' ||
    upper === 'DELETE'
  )
}

function extractHeaderCaseInsensitive(
  headers: Record<string, string | undefined> | undefined,
  targetName: string,
): string | undefined {
  if (!headers) return undefined
  const lower = targetName.toLowerCase()
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) {
      return v
    }
  }
  return undefined
}

function extractHostFromUrl(rawUrl: string): string | null {
  const match = /^https?:\/\/([^/?#]+)/i.exec(rawUrl.trim())
  return match ? match[1].toLowerCase() : null
}

/**
 * Validates CSRF protection for state-changing requests:
 * 1) Origin / Referer header verification (when Host and Origin/Referer are present).
 * 2) Synchronizer token check: if the active session has a csrfToken, the request's
 *    X-CSRF-Token header must match it.
 */
export function verifyCsrfProtection(params: {
  method: string
  pathname: string
  headers?: Record<string, string | undefined>
  session?: SessionContext | null
}): { valid: true } | { valid: false; reason: string } {
  const { method, pathname, headers, session } = params

  if (!isStateChangingMethod(method)) {
    return { valid: true }
  }

  // Login creates the initial session & CSRF token, but still undergoes Origin/Referer verification
  const host = extractHeaderCaseInsensitive(headers, 'host')?.toLowerCase()
  const origin = extractHeaderCaseInsensitive(headers, 'origin')
  const referer = extractHeaderCaseInsensitive(headers, 'referer')

  if (host) {
    if (origin) {
      const originHost = extractHostFromUrl(origin)
      if (!originHost || originHost !== host) {
        return {
          valid: false,
          reason: 'Érvénytelen Origin fejléc (CSRF védelem).',
        }
      }
    } else if (referer) {
      const refererHost = extractHostFromUrl(referer)
      if (!refererHost || refererHost !== host) {
        return {
          valid: false,
          reason: 'Érvénytelen Referer fejléc (CSRF védelem).',
        }
      }
    }
  }

  if (pathname === '/api/auth/login') {
    return { valid: true }
  }

  if (session?.csrfToken) {
    const headerToken = extractHeaderCaseInsensitive(
      headers,
      CSRF_HEADER_NAME,
    )?.trim()
    if (!headerToken || headerToken !== session.csrfToken) {
      return {
        valid: false,
        reason: 'Hiányzó vagy érvénytelen CSRF token (X-CSRF-Token).',
      }
    }
  }

  return { valid: true }
}
