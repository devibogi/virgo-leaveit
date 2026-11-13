import type { Employee, Role } from '../types/model.ts'
import { attachCsrfHeader, setCsrfToken } from './csrf.ts'
import { TeamApiError, type ErrorResponse } from './teams.ts'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  employee: Employee
  defaultRole: Role
  activeRole?: Role
  csrfToken?: string
}

export interface AuthApiClientOptions {
  baseUrl?: string
  fetchFn?: typeof fetch
}

export function createAuthApiClient(options: AuthApiClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? '/api').replace(/\/$/, '')
  const fetchImpl = options.fetchFn ?? fetch

  async function parseJsonOrThrow<T>(
    response: Response,
    fallbackMsg: string,
  ): Promise<T> {
    if (!response.ok) {
      let errorPayload: ErrorResponse = {
        error: `HTTP ${response.status}`,
        details: [response.statusText || fallbackMsg],
      }
      try {
        errorPayload = (await response.json()) as ErrorResponse
      } catch {
        // Fallback if response is not JSON
      }
      throw new TeamApiError(response.status, errorPayload)
    }
    return (await response.json()) as T
  }

  return {
    async login(body: LoginRequest): Promise<LoginResponse> {
      const response = await fetchImpl(`${baseUrl}/auth/login`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      })

      const result = await parseJsonOrThrow<LoginResponse>(
        response,
        'Login failed',
      )
      setCsrfToken(result.csrfToken)
      return result
    },

    async getSession(): Promise<LoginResponse | null> {
      const response = await fetchImpl(`${baseUrl}/auth/session`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
        },
      })
      if (response.status === 401) {
        setCsrfToken(null)
        return null
      }
      const result = await parseJsonOrThrow<LoginResponse>(
        response,
        'Session check failed',
      )
      setCsrfToken(result.csrfToken)
      return result
    },

    async switchRole(role: Role): Promise<LoginResponse> {
      const response = await fetchImpl(`${baseUrl}/auth/role`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: attachCsrfHeader({
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }),
        body: JSON.stringify({ role }),
      })

      const result = await parseJsonOrThrow<LoginResponse>(
        response,
        'Role switch failed',
      )
      setCsrfToken(result.csrfToken)
      return result
    },

    async logout(): Promise<void> {
      const response = await fetchImpl(`${baseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: attachCsrfHeader({
          Accept: 'application/json',
        }),
      })
      if (!response.ok && response.status !== 204) {
        await parseJsonOrThrow<unknown>(response, 'Logout failed')
      }
      setCsrfToken(null)
    },
  }
}

export const authApi = createAuthApiClient()
