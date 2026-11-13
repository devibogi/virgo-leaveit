import type {
  CreateEmployeeInput,
  Employee,
  LegalEntityId,
} from '../domain/employee.ts'
import { attachCsrfHeader } from './csrf.ts'
import { TeamApiError, type ErrorResponse } from './teams.ts'

export type CreateEmployeeRequest = CreateEmployeeInput
export type UpdateEmployeeRequest = Omit<CreateEmployeeInput, 'id'>

export interface ListEmployeesQuery {
  legalEntityId?: LegalEntityId
  managerId?: string
}

export interface EmployeeApiClientOptions {
  baseUrl?: string
  fetchFn?: typeof fetch
}

export function createEmployeeApiClient(
  options: EmployeeApiClientOptions = {},
) {
  const baseUrl = (options.baseUrl ?? '/api').replace(/\/$/, '')
  const fetchImpl = options.fetchFn ?? fetch

  function buildHeaders(includeJsonContentType = false): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }
    if (includeJsonContentType) {
      headers['Content-Type'] = 'application/json'
    }
    return attachCsrfHeader(headers)
  }

  async function parseResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorPayload: ErrorResponse = {
        error: `HTTP ${response.status}`,
        details: [response.statusText || 'Request failed'],
      }
      try {
        errorPayload = (await response.json()) as ErrorResponse
      } catch {
        // Fallback if body is not JSON
      }
      throw new TeamApiError(response.status, errorPayload)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return (await response.json()) as T
  }

  return {
    async listEmployees(query?: ListEmployeesQuery): Promise<Employee[]> {
      const search = new URLSearchParams()
      if (query?.legalEntityId) {
        search.set('legalEntityId', query.legalEntityId)
      }
      if (query?.managerId) {
        search.set('managerId', query.managerId)
      }
      const qs = search.toString()
      const url = `${baseUrl}/employees${qs ? `?${qs}` : ''}`
      const response = await fetchImpl(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: buildHeaders(false),
      })
      return parseResponse<Employee[]>(response)
    },

    async getEmployeeById(id: string): Promise<Employee> {
      const response = await fetchImpl(
        `${baseUrl}/employees/${encodeURIComponent(id)}`,
        {
          method: 'GET',
          credentials: 'same-origin',
          headers: buildHeaders(false),
        },
      )
      return parseResponse<Employee>(response)
    },

    async createEmployee(body: CreateEmployeeRequest): Promise<Employee> {
      const response = await fetchImpl(`${baseUrl}/employees`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: buildHeaders(true),
        body: JSON.stringify(body),
      })
      return parseResponse<Employee>(response)
    },

    async updateEmployee(
      id: string,
      body: UpdateEmployeeRequest,
    ): Promise<Employee> {
      const response = await fetchImpl(
        `${baseUrl}/employees/${encodeURIComponent(id)}`,
        {
          method: 'PUT',
          credentials: 'same-origin',
          headers: buildHeaders(true),
          body: JSON.stringify(body),
        },
      )
      return parseResponse<Employee>(response)
    },

    async deleteEmployee(id: string): Promise<void> {
      const response = await fetchImpl(
        `${baseUrl}/employees/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: buildHeaders(false),
        },
      )
      return parseResponse<void>(response)
    },
  }
}

export const employeeApi = createEmployeeApiClient()
