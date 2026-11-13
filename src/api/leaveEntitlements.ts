import type { EntitlementBalanceSummary } from '../domain/leaveEntitlement.ts'
import type {
  CreateLeaveEntitlementInput,
  EntitlementComponent,
  LeaveEntitlement,
  Role,
} from '../domain/leaveEntitlement.ts'
import { TeamApiError, type ErrorResponse } from './teams.ts'

export type CreateLeaveEntitlementRequest = CreateLeaveEntitlementInput
export type UpdateLeaveEntitlementRequest = Omit<
  CreateLeaveEntitlementInput,
  'id'
>

export interface ListLeaveEntitlementsQuery {
  employeeId?: string
  year?: number
  component?: EntitlementComponent
}

export interface LeaveEntitlementApiClientOptions {
  baseUrl?: string
  fetchFn?: typeof fetch
  getActorRole?: () => Role
  /** Demo-only: id of the signed-in user, sent as X-Actor-Id. */
  getActorId?: () => string
}

export interface TeamMemberBalance extends EntitlementBalanceSummary {
  displayName: string
}

export function createLeaveEntitlementApiClient(
  options: LeaveEntitlementApiClientOptions = {},
) {
  const baseUrl = (options.baseUrl ?? '/api').replace(/\/$/, '')
  const fetchImpl = options.fetchFn ?? fetch
  const getRole = options.getActorRole ?? (() => 'HR_ADMIN' as Role)

  function buildHeaders(includeJsonContentType = false): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Actor-Role': getRole(),
    }
    const actorId = options.getActorId?.()
    if (actorId) {
      headers['X-Actor-Id'] = actorId
    }
    if (includeJsonContentType) {
      headers['Content-Type'] = 'application/json'
    }
    return headers
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
    async listEntitlements(
      query?: ListLeaveEntitlementsQuery,
    ): Promise<LeaveEntitlement[]> {
      const search = new URLSearchParams()
      if (query?.employeeId) {
        search.set('employeeId', query.employeeId)
      }
      if (query?.year !== undefined) {
        search.set('year', String(query.year))
      }
      if (query?.component) {
        search.set('component', query.component)
      }
      const qs = search.toString()
      const url = `${baseUrl}/entitlements${qs ? `?${qs}` : ''}`
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: buildHeaders(false),
      })
      return parseResponse<LeaveEntitlement[]>(response)
    },

    /** Manager: direct reports' yearly balance, numbers only. */
    async listTeamSummary(year: number): Promise<TeamMemberBalance[]> {
      const response = await fetchImpl(
        `${baseUrl}/entitlements/team-summary?year=${year}`,
        { method: 'GET', headers: buildHeaders(false) },
      )
      return parseResponse<TeamMemberBalance[]>(response)
    },

    async getEntitlementById(id: string): Promise<LeaveEntitlement> {
      const response = await fetchImpl(
        `${baseUrl}/entitlements/${encodeURIComponent(id)}`,
        {
          method: 'GET',
          headers: buildHeaders(false),
        },
      )
      return parseResponse<LeaveEntitlement>(response)
    },

    async createEntitlement(
      body: CreateLeaveEntitlementRequest,
    ): Promise<LeaveEntitlement> {
      const response = await fetchImpl(`${baseUrl}/entitlements`, {
        method: 'POST',
        headers: buildHeaders(true),
        body: JSON.stringify(body),
      })
      return parseResponse<LeaveEntitlement>(response)
    },

    async updateEntitlement(
      id: string,
      body: UpdateLeaveEntitlementRequest,
    ): Promise<LeaveEntitlement> {
      const response = await fetchImpl(
        `${baseUrl}/entitlements/${encodeURIComponent(id)}`,
        {
          method: 'PUT',
          headers: buildHeaders(true),
          body: JSON.stringify(body),
        },
      )
      return parseResponse<LeaveEntitlement>(response)
    },

    async deleteEntitlement(id: string): Promise<void> {
      const response = await fetchImpl(
        `${baseUrl}/entitlements/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: buildHeaders(false),
        },
      )
      return parseResponse<void>(response)
    },
  }
}

export const leaveEntitlementApi = createLeaveEntitlementApiClient()
