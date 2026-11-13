import type { Employee, Role } from '../types/model.ts'
import { TeamApiError, type ErrorResponse } from './teams.ts'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  employee: Employee
  defaultRole: Role
  activeRole?: Role
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

      return parseJsonOrThrow<LoginResponse>(response, 'Login failed')
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
        return null
      }
      return parseJsonOrThrow<LoginResponse>(response, 'Session check failed')
    },

    async switchRole(role: Role): Promise<LoginResponse> {
      const response = await fetchImpl(`${baseUrl}/auth/role`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ role }),
      })

      return parseJsonOrThrow<LoginResponse>(response, 'Role switch failed')
    },

    async logout(): Promise<void> {
      const response = await fetchImpl(`${baseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
        },
      })
      if (!response.ok && response.status !== 204) {
        await parseJsonOrThrow<unknown>(response, 'Logout failed')
      }
    },
  }
}

export const authApi = createAuthApiClient()
