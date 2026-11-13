import { openApiDocument } from '../api/openapi.ts'
import { canManageTeams, validateTeam, type Role } from '../domain/team.ts'
import type { SessionContext } from './sessionRepository.ts'
import {
  DuplicateTeamError,
  InMemoryTeamRepository,
  type TeamRepository,
} from './teamRepository.ts'

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
) {
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
    const teamManagerMatch = /^\/api\/teams\/([^/]+)$/.exec(pathname)

    if (!isTeamsCollection && !teamManagerMatch) {
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
        const payload = (req.body ?? {}) as Record<string, unknown>
        const candidate = {
          managerId:
            typeof payload.managerId === 'string' ? payload.managerId : '',
          name: typeof payload.name === 'string' ? payload.name : '',
        }

        const validation = validateTeam(candidate)
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

    if (teamManagerMatch) {
      const managerId = decodeURIComponent(teamManagerMatch[1])

      if (method === 'GET') {
        const team = await repository.findByManagerId(managerId)
        if (!team) {
          return {
            status: 404,
            body: {
              error: 'Not found',
              details: [`A(z) '${managerId}' vezetőhöz nem található csapat.`],
            },
          }
        }
        return {
          status: 200,
          body: team,
        }
      }

      if (method === 'PUT') {
        const payload = (req.body ?? {}) as Record<string, unknown>
        const candidate = {
          managerId,
          name: typeof payload.name === 'string' ? payload.name : '',
        }

        const validation = validateTeam(candidate)
        if (!validation.valid) {
          return {
            status: 400,
            body: {
              error: 'Validation failed',
              details: validation.errors,
            },
          }
        }

        const updated = await repository.update(managerId, {
          name: candidate.name,
        })

        if (!updated) {
          return {
            status: 404,
            body: {
              error: 'Not found',
              details: [`A(z) '${managerId}' vezetőhöz nem található csapat.`],
            },
          }
        }

        return {
          status: 200,
          body: updated,
        }
      }

      if (method === 'DELETE') {
        const deleted = await repository.delete(managerId)
        if (!deleted) {
          return {
            status: 404,
            body: {
              error: 'Not found',
              details: [`A(z) '${managerId}' vezetőhöz nem található csapat.`],
            },
          }
        }
        return {
          status: 204,
        }
      }
    }

    return null
  }
}
