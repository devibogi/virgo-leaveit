let currentCsrfToken: string | null = null

export function setCsrfToken(token: string | null | undefined): void {
  currentCsrfToken = token && token.trim().length > 0 ? token.trim() : null
}

export function getCsrfToken(): string | null {
  if (currentCsrfToken) {
    return currentCsrfToken
  }
  const doc = (globalThis as unknown as { document?: { cookie?: string } })
    .document
  const rawCookie = doc?.cookie
  if (!rawCookie) return null

  for (const part of rawCookie.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const name = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (name === 'leaveit_csrf' && val.length > 0) {
      return decodeURIComponent(val)
    }
  }
  return null
}

export function attachCsrfHeader(
  headers: Record<string, string>,
): Record<string, string> {
  const token = getCsrfToken()
  if (token) {
    headers['X-CSRF-Token'] = token
  }
  return headers
}
