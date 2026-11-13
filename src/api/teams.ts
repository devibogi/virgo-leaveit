import type { Role, Team } from '../domain/team.ts'

export interface CreateTeamRequest {
  managerId: string
  name: string
}

export interface UpdateTeamRequest {
  name: string
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
  getActorRole?: () => Role
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
  const getRole = options.getActorRole ?? (() => 'HR_ADMIN' as Role)

  function buildHeaders(includeJsonContentType = false): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Actor-Role': getRole(),
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
        headers: buildHeaders(false),
      })
      return parseResponse<Team[]>(response)
    },

    async getTeamByManagerId(managerId: string): Promise<Team> {
      const response = await fetchImpl(
        `${baseUrl}/teams/${encodeURIComponent(managerId)}`,
        {
          method: 'GET',
          headers: buildHeaders(false),
        },
      )
      return parseResponse<Team>(response)
    },

    async createTeam(body: CreateTeamRequest): Promise<Team> {
      const response = await fetchImpl(`${baseUrl}/teams`, {
        method: 'POST',
        headers: buildHeaders(true),
        body: JSON.stringify(body),
      })
      return parseResponse<Team>(response)
    },

    async updateTeam(
      managerId: string,
      body: UpdateTeamRequest,
    ): Promise<Team> {
      const response = await fetchImpl(
        `${baseUrl}/teams/${encodeURIComponent(managerId)}`,
        {
          method: 'PUT',
          headers: buildHeaders(true),
          body: JSON.stringify(body),
        },
      )
      return parseResponse<Team>(response)
    },

    async deleteTeam(managerId: string): Promise<void> {
      const response = await fetchImpl(
        `${baseUrl}/teams/${encodeURIComponent(managerId)}`,
        {
          method: 'DELETE',
          headers: buildHeaders(false),
        },
      )
      return parseResponse<void>(response)
    },
  }
}

export const teamApi = createTeamApiClient()
