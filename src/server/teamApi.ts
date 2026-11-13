import { openApiDocument } from '../api/openapi.ts'
import { canManageTeams, validateTeam, type Role } from '../domain/team.ts'
import { sanitizePayloadForXss, verifyCsrfProtection } from './security.ts'
import type { SessionContext } from './sessionRepository.ts'
import {
  DuplicateTeamError,
  InMemoryTeamRepository,
  type TeamRepository,
} from './teamRepository.ts'
import type { EmployeeRepository } from './employeeRepository.ts'

export interface ApiRequest {
  method: string
  url: string
  headers?: Record<string, string | undefined>
  body?: unknown
  session?: SessionContext | null
}

export interface ApiResponse {
  status: number
  headers?: Record<string, string>
  body?: unknown
}

function parseUrlPathAndQuery(rawUrl: string): {
  pathname: string
  query: Record<string, string>
} {
  const withoutOrigin = rawUrl.replace(/^https?:\/\/[^/]+/, '')
  const [pathnamePart, queryPart = ''] = withoutOrigin.split('?')
  const query: Record<string, string> = {}

  for (const pair of queryPart.split('&')) {
    if (!pair) continue
    const [rawKey, rawVal = ''] = pair.split('=')
    query[decodeURIComponent(rawKey)] = decodeURIComponent(rawVal)
  }

  return {
    pathname: pathnamePart || '/',
    query,
  }
}

function extractActorRole(req: ApiRequest): Role | null {
  return req.session?.activeRole ?? null
}

export function createTeamApiHandler(
  repository: TeamRepository = new InMemoryTeamRepository(),
  employeeRepository?: EmployeeRepository,
) {
  async function lookupManager(managerId: string) {
    if (!employeeRepository || !managerId.trim()) return undefined
    return employeeRepository.findById(managerId.trim())
  }

  return async function handleTeamApiRequest(
    req: ApiRequest,
  ): Promise<ApiResponse | null> {
    const { pathname, query } = parseUrlPathAndQuery(req.url)
    const method = req.method.toUpperCase()

    if (pathname === '/api/openapi.json' && method === 'GET') {
      return {
        status: 200,
        body: openApiDocument,
      }
    }

    const isTeamsCollection = pathname === '/api/teams'
    const teamItemMatch = /^\/api\/teams\/([^/]+)$/.exec(pathname)

    if (!isTeamsCollection && !teamItemMatch) {
      return null
    }

    // Backend authorization check: only HR_ADMIN in the server session may access Team CRUD endpoints
    const actorRole = extractActorRole(req)
    if (!actorRole || !canManageTeams(actorRole)) {
      return {
        status: 403,
        body: {
          error: 'Forbidden',
          details: [
            'Csak HR adminisztrátor (HR_ADMIN) jogosultsággal érhető el ez a művelet.',
          ],
        },
      }
    }

    const csrfCheck = verifyCsrfProtection({
      method,
      pathname,
      headers: req.headers,
      session: req.session,
    })
    if (!csrfCheck.valid) {
      return {
        status: 403,
        body: {
          error: 'Forbidden',
          details: [csrfCheck.reason],
        },
      }
    }

    const sanitizedBody = sanitizePayloadForXss(req.body)

    if (isTeamsCollection) {
      if (method === 'GET') {
        const managerId = query.managerId || undefined
        const teams = await repository.findAll(
          managerId ? { managerId } : undefined,
        )
        return {
          status: 200,
          body: teams,
        }
      }

      if (method === 'POST') {
        const payload = (sanitizedBody ?? {}) as Record<string, unknown>
        const candidate = {
          id: typeof payload.id === 'string' && payload.id.trim() ? payload.id : undefined,
          managerId:
            typeof payload.managerId === 'string' ? payload.managerId : '',
          deputyId: typeof payload.deputyId === 'string' ? payload.deputyId : '',
          name: typeof payload.name === 'string' ? payload.name : '',
        }

        const validation = validateTeam(candidate, await lookupManager(candidate.managerId))
        if (!validation.valid) {
          return {
            status: 400,
            body: {
              error: 'Validation failed',
              details: validation.errors,
            },
          }
        }

        try {
          const created = await repository.create(candidate)
          return {
            status: 201,
            body: created,
          }
        } catch (err) {
          if (err instanceof DuplicateTeamError) {
            return {
              status: 409,
              body: {
                error: 'Conflict',
                details: [err.message],
              },
            }
          }
          throw err
        }
      }
    }

    if (teamItemMatch) {
      const id = decodeURIComponent(teamItemMatch[1])
      const notFound = {
        status: 404,
        body: {
          error: 'Not found',
          details: [`A(z) '${id}' csapat nem található.`],
        },
      }

      if (method === 'GET') {
        const team = await repository.findById(id)
        return team ? { status: 200, body: team } : notFound
      }

      if (method === 'PUT') {
        const existing = await repository.findById(id)
        if (!existing) return notFound
        const payload = (sanitizedBody ?? {}) as Record<string, unknown>
        const candidate = {
          id,
          managerId:
            typeof payload.managerId === 'string' && payload.managerId.trim()
              ? payload.managerId
              : existing.managerId,
          deputyId:
            typeof payload.deputyId === 'string' && payload.deputyId.trim()
              ? payload.deputyId
              : existing.deputyId,
          name: typeof payload.name === 'string' ? payload.name : '',
        }

        const validation = validateTeam(candidate, await lookupManager(candidate.managerId))
        if (!validation.valid) {
          return {
            status: 400,
            body: {
              error: 'Validation failed',
              details: validation.errors,
            },
          }
        }

        const updated = await repository.update(id, {
          name: candidate.name,
          managerId: candidate.managerId,
          deputyId: candidate.deputyId,
        })
        return updated ? { status: 200, body: updated } : notFound
      }

      if (method === 'DELETE') {
        const deleted = await repository.delete(id)
        return deleted ? { status: 204 } : notFound
      }
    }

    return null
  }
}
