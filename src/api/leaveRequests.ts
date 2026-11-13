import type {
  LeaveRequest,
  LeaveRequestDraft,
  LeaveTypeCode,
  LegalEntityId,
  RequestStatus,
} from '../domain/leaveRequest.ts'
import { attachCsrfHeader } from './csrf.ts'
import { TeamApiError, type ErrorResponse } from './teams.ts'

/** id, legalEntityId, approverId and status are generated/derived by the server (D21). */
/** List rows carry display-only names (read-only, not part of the domain record). */
export type LeaveRequestListItem = LeaveRequest & {
  employeeName?: string | null
  approverName?: string | null
}

export type CreateLeaveRequestPayload = LeaveRequestDraft
/** The request owner (employeeId) cannot change on edit. */
export type UpdateLeaveRequestPayload = Omit<LeaveRequestDraft, 'employeeId'>

export interface ListLeaveRequestsQuery {
  employeeId?: string
  legalEntityId?: LegalEntityId
  status?: RequestStatus
  leaveTypeCode?: LeaveTypeCode
}

export interface LeaveRequestApiClientOptions {
  baseUrl?: string
  fetchFn?: typeof fetch
}

export function createLeaveRequestApiClient(
  options: LeaveRequestApiClientOptions = {},
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
    async listRequests(query?: ListLeaveRequestsQuery): Promise<LeaveRequestListItem[]> {
      const search = new URLSearchParams()
      if (query?.employeeId) {
        search.set('employeeId', query.employeeId)
      }
      if (query?.legalEntityId) {
        search.set('legalEntityId', query.legalEntityId)
      }
      if (query?.status) {
        search.set('status', query.status)
      }
      if (query?.leaveTypeCode) {
        search.set('leaveTypeCode', query.leaveTypeCode)
      }
      const qs = search.toString()
      const url = `${baseUrl}/requests${qs ? `?${qs}` : ''}`
      const response = await fetchImpl(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: buildHeaders(false),
      })
      return parseResponse<LeaveRequest[]>(response)
    },

    async getRequestById(id: string): Promise<LeaveRequest> {
      const response = await fetchImpl(
        `${baseUrl}/requests/${encodeURIComponent(id)}`,
        {
          method: 'GET',
          credentials: 'same-origin',
          headers: buildHeaders(false),
        },
      )
      return parseResponse<LeaveRequest>(response)
    },

    async createRequest(body: CreateLeaveRequestPayload): Promise<LeaveRequest> {
      const response = await fetchImpl(`${baseUrl}/requests`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: buildHeaders(true),
        body: JSON.stringify(body),
      })
      return parseResponse<LeaveRequest>(response)
    },

    async updateRequest(
      id: string,
      body: UpdateLeaveRequestPayload,
    ): Promise<LeaveRequest> {
      const response = await fetchImpl(
        `${baseUrl}/requests/${encodeURIComponent(id)}`,
        {
          method: 'PUT',
          credentials: 'same-origin',
          headers: buildHeaders(true),
          body: JSON.stringify(body),
        },
      )
      return parseResponse<LeaveRequest>(response)
    },

    async revokeRequest(
      id: string,
      input: { reason: string; actorId?: string },
    ): Promise<LeaveRequest> {
      const response = await fetchImpl(
        `${baseUrl}/requests/${encodeURIComponent(id)}/revoke`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: buildHeaders(true),
          body: JSON.stringify(input),
        },
      )
      return parseResponse<LeaveRequest>(response)
    },
  }
}

export const leaveRequestApi = createLeaveRequestApiClient()
