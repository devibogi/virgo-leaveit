import type { Employee, Role } from '../types/model.ts'
import { TeamApiError, type ErrorResponse } from './teams.ts'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  employee: Employee
  defaultRole: Role
}

export interface AuthApiClientOptions {
  baseUrl?: string
  fetchFn?: typeof fetch
}

export function createAuthApiClient(options: AuthApiClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? '/api').replace(/\/$/, '')
  const fetchImpl = options.fetchFn ?? fetch

  return {
    async login(body: LoginRequest): Promise<LoginResponse> {
      const response = await fetchImpl(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        let errorPayload: ErrorResponse = {
          error: `HTTP ${response.status}`,
          details: [response.statusText || 'Login failed'],
        }
        try {
          errorPayload = (await response.json()) as ErrorResponse
        } catch {
          // Fallback if response is not JSON
        }
        throw new TeamApiError(response.status, errorPayload)
      }

      return (await response.json()) as LoginResponse
    },
  }
}

export const authApi = createAuthApiClient()
