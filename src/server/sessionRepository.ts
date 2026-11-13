import type { Role } from '../types/model.ts'
import { generateCsrfToken } from './security.ts'
import type { SqlExecutor } from './teamRepository.ts'

export const SESSION_COOKIE_NAME = 'leaveit_session'
export const DEFAULT_SESSION_TTL_SECONDS = 24 * 60 * 60 // 24 hours

export interface Session {
  id: string
  employeeId: string
  activeRole: Role
  csrfToken: string
  createdAt: string
  expiresAt: string
}

export interface SessionContext {
  sessionId: string
  employeeId: string
  activeRole: Role
  csrfToken?: string
}

export interface SessionRow {
  id: string
  employee_id: string
  active_role: Role
  csrf_token?: string
  created_at: string
  expires_at: string
}

export interface SessionRepository {
  findById(id: string): Promise<Session | null>
  create(employeeId: string, activeRole: Role): Promise<Session>
  updateRole(id: string, activeRole: Role): Promise<Session | null>
  delete(id: string): Promise<boolean>
}

function generateSessionId(): string {
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

function isExpired(expiresAt: string): boolean {
  const expMs = Date.parse(expiresAt)
  if (Number.isNaN(expMs)) return false
  return expMs <= Date.now()
}

export function extractSessionIdFromHeaders(
  headers?: Record<string, string | undefined>,
): string | null {
  if (!headers) return null
  const rawCookie = headers.cookie ?? headers.Cookie ?? ''
  if (!rawCookie) return null

  for (const part of rawCookie.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const name = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (name === SESSION_COOKIE_NAME && val.length > 0) {
      return decodeURIComponent(val)
    }
  }
  return null
}

export function buildSetSessionCookie(
  sessionId: string,
  maxAgeSeconds = DEFAULT_SESSION_TTL_SECONDS,
): string {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`
}

export function buildClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
}

function mapRowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    employeeId: row.employee_id,
    activeRole: row.active_role,
    csrfToken: row.csrf_token || '',
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly store = new Map<string, Session>()

  async findById(id: string): Promise<Session | null> {
    const session = this.store.get(id)
    if (!session) return null
    if (isExpired(session.expiresAt)) {
      this.store.delete(id)
      return null
    }
    return session
  }

  async create(employeeId: string, activeRole: Role): Promise<Session> {
    const now = new Date()
    const expires = new Date(now.getTime() + DEFAULT_SESSION_TTL_SECONDS * 1000)
    const session: Session = {
      id: generateSessionId(),
      employeeId,
      activeRole,
      csrfToken: generateCsrfToken(),
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    }
    this.store.set(session.id, session)
    return session
  }

  async updateRole(id: string, activeRole: Role): Promise<Session | null> {
    const existing = await this.findById(id)
    if (!existing) return null
    const updated: Session = {
      ...existing,
      activeRole,
    }
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id)
  }
}

export class MariaDbSessionRepository implements SessionRepository {
  private readonly db: SqlExecutor

  constructor(db: SqlExecutor) {
    this.db = db
  }

  async findById(id: string): Promise<Session | null> {
    const rows = await this.db.query<SessionRow>(
      'SELECT id, employee_id, active_role, csrf_token, created_at, expires_at FROM sessions WHERE id = ? LIMIT 1',
      [id],
    )
    const row = rows[0]
    if (!row) return null
    const session = mapRowToSession(row)
    if (isExpired(session.expiresAt)) {
      await this.delete(id)
      return null
    }
    return session
  }

  async create(employeeId: string, activeRole: Role): Promise<Session> {
    const now = new Date()
    const expires = new Date(now.getTime() + DEFAULT_SESSION_TTL_SECONDS * 1000)
    const session: Session = {
      id: generateSessionId(),
      employeeId,
      activeRole,
      csrfToken: generateCsrfToken(),
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    }
    await this.db.execute(
      'INSERT INTO sessions (id, employee_id, active_role, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        session.id,
        session.employeeId,
        session.activeRole,
        session.csrfToken,
        session.createdAt,
        session.expiresAt,
      ],
    )
    return session
  }

  async updateRole(id: string, activeRole: Role): Promise<Session | null> {
    const existing = await this.findById(id)
    if (!existing) return null
    const result = await this.db.execute(
      'UPDATE sessions SET active_role = ? WHERE id = ?',
      [activeRole, id],
    )
    if (result.affectedRows === 0) return null
    return {
      ...existing,
      activeRole,
    }
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.execute('DELETE FROM sessions WHERE id = ?', [
      id,
    ])
    return result.affectedRows > 0
  }
}
