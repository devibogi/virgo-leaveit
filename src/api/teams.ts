import type { Team } from '../domain/team.ts'
import { attachCsrfHeader } from './csrf.ts'

export interface CreateTeamRequest {
  id?: string
  managerId: string
  /** Required team deputy; must differ from managerId. */
  deputyId: string
  name: string
}

export interface UpdateTeamRequest {
  name: string
  /** Optional: reassign the team to another manager. */
  managerId?: string
  /** Optional: change the team deputy. */
  deputyId?: string
}

export interface ErrorResponse {
  error: string
  details: string[]
}

export interface ListTeamsQuery {
  managerId?: string
}

export interface TeamApiClientOptions {
  baseUrl?: string
  fetchFn?: typeof fetch
}

export class TeamApiError extends Error {
  readonly status: number
  readonly details: string[]

  constructor(status: number, errorResponse: ErrorResponse) {
    super(errorResponse.error)
    this.name = 'TeamApiError'
    this.status = status
    this.details = errorResponse.details
  }
}

export function createTeamApiClient(options: TeamApiClientOptions = {}) {
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
        // Fallback to status text if response is not JSON
      }
      throw new TeamApiError(response.status, errorPayload)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return (await response.json()) as T
  }

  return {
    async listTeams(query?: ListTeamsQuery): Promise<Team[]> {
      const search = new URLSearchParams()
      if (query?.managerId) {
        search.set('managerId', query.managerId)
      }
      const queryString = search.toString()
      const url = `${baseUrl}/teams${queryString ? `?${queryString}` : ''}`
      const response = await fetchImpl(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: buildHeaders(false),
      })
      return parseResponse<Team[]>(response)
    },

    async getTeamById(id: string): Promise<Team> {
      const response = await fetchImpl(
        `${baseUrl}/teams/${encodeURIComponent(id)}`,
        {
          method: 'GET',
          credentials: 'same-origin',
          headers: buildHeaders(false),
        },
      )
      return parseResponse<Team>(response)
    },

    async createTeam(body: CreateTeamRequest): Promise<Team> {
      const response = await fetchImpl(`${baseUrl}/teams`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: buildHeaders(true),
        body: JSON.stringify(body),
      })
      return parseResponse<Team>(response)
    },

    async updateTeam(
      id: string,
      body: UpdateTeamRequest,
    ): Promise<Team> {
      const response = await fetchImpl(
        `${baseUrl}/teams/${encodeURIComponent(id)}`,
        {
          method: 'PUT',
          credentials: 'same-origin',
          headers: buildHeaders(true),
          body: JSON.stringify(body),
        },
      )
      return parseResponse<Team>(response)
    },

    async deleteTeam(id: string): Promise<void> {
      const response = await fetchImpl(
        `${baseUrl}/teams/${encodeURIComponent(id)}`,
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

export const teamApi = createTeamApiClient()
