import {
  buildLeaveRequestFromDraft,
  canManageLeaveRequests,
  isLeaveTypeCode,
  isLegalEntityId,
  isRequestStatus,
  validateLeaveRequest,
  type DayPortion,
  type LeaveRequestDraft,
  type LeaveTypeCode,
  type Role,
} from '../domain/index.ts'
import {
  InMemoryEmployeeRepository,
  type EmployeeRepository,
} from './employeeRepository.ts'
import {
  DuplicateLeaveRequestError,
  InMemoryLeaveRequestRepository,
  type LeaveRequestRepository,
} from './leaveRequestRepository.ts'
import type { ApiRequest, ApiResponse } from './teamApi.ts'

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

function extractActorRole(
  headers?: Record<string, string | undefined>,
): Role | null {
  if (!headers) return null
  const raw = headers['x-actor-role'] ?? headers['X-Actor-Role'] ?? undefined
  if (raw === 'EMPLOYEE' || raw === 'MANAGER' || raw === 'HR_ADMIN') {
    return raw
  }
  return null
}

function extractActorId(
  headers?: Record<string, string | undefined>,
): string | null {
  const raw = headers?.['x-actor-id'] ?? headers?.['X-Actor-Id']
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

/**
 * Reads only the user-editable fields. id, legalEntityId, approverId and status
 * sent by a client are ignored (D21): they are generated / derived server-side.
 */
function parseLeaveRequestDraft(
  payload: Record<string, unknown>,
): LeaveRequestDraft {
  return {
    employeeId:
      typeof payload.employeeId === 'string' ? payload.employeeId.trim() : '',
    leaveTypeCode: (typeof payload.leaveTypeCode === 'string'
      ? payload.leaveTypeCode
      : '') as LeaveTypeCode,
    startDate: typeof payload.startDate === 'string' ? payload.startDate : '',
    endDate: typeof payload.endDate === 'string' ? payload.endDate : '',
    dayPortion: (typeof payload.dayPortion === 'string'
      ? payload.dayPortion
      : 'FULL') as DayPortion,
    employeeComment:
      typeof payload.employeeComment === 'string'
        ? payload.employeeComment
        : null,
  }
}

export function createLeaveRequestApiHandler(
  repository: LeaveRequestRepository = new InMemoryLeaveRequestRepository(),
  employeeRepository: EmployeeRepository = new InMemoryEmployeeRepository(),
) {
  async function buildFromPayload(payload: Record<string, unknown>, id?: string) {
    const draft = parseLeaveRequestDraft(payload)
    const employee = draft.employeeId
      ? await employeeRepository.findById(draft.employeeId)
      : null
    const employees = await employeeRepository.findAll()
    return buildLeaveRequestFromDraft(draft, employee, employees, id)
  }

  return async function handleLeaveRequestApiRequest(
    req: ApiRequest,
  ): Promise<ApiResponse | null> {
    const { pathname, query } = parseUrlPathAndQuery(req.url)
    const method = req.method.toUpperCase()

    const isCollection = pathname === '/api/requests'
    const revokeMatch = /^\/api\/requests\/([^/]+)\/revoke$/.exec(pathname)
    const itemMatch = /^\/api\/requests\/([^/]+)$/.exec(pathname)

    if (!isCollection && !revokeMatch && !itemMatch) {
      return null
    }

    const actorRole = extractActorRole(req.headers)
    const actorId = extractActorId(req.headers)
    // Every role may submit a new request; non-HR actors only for themselves.
    // Demo-only: role/id come from client headers, not a verified session.
    const isCreate = isCollection && method === 'POST'
    const isSelfServiceCreate =
      isCreate && !!actorRole && !canManageLeaveRequests(actorRole)
    // Every role may list its own requests; non-HR actors are forced to themselves.
    const isList = isCollection && method === 'GET'
    const isSelfServiceList =
      isList && !!actorRole && !canManageLeaveRequests(actorRole)
    if ((isSelfServiceCreate || isSelfServiceList) && !actorId) {
      return {
        status: 403,
        body: {
          error: 'Forbidden',
          details: ['A művelethez a bejelentkezett felhasználó azonosítója szükséges.'],
        },
      }
    }
    if (!actorRole || (!isCreate && !isList && !canManageLeaveRequests(actorRole))) {
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

    if (isCollection) {
      if (method === 'GET') {
        const employeeId = isSelfServiceList
          ? (actorId ?? undefined)
          : query.employeeId || undefined
        const legalEntityId = isLegalEntityId(query.legalEntityId)
          ? query.legalEntityId
          : undefined
        const status = isRequestStatus(query.status) ? query.status : undefined
        const leaveTypeCode = isLeaveTypeCode(query.leaveTypeCode)
          ? query.leaveTypeCode
          : undefined

        const items = await repository.findAll({
          employeeId,
          legalEntityId,
          status,
          leaveTypeCode,
        })
        return {
          status: 200,
          body: items,
        }
      }

      if (method === 'POST') {
        const body = (req.body ?? {}) as Record<string, unknown>
        const payload = isSelfServiceCreate ? { ...body, employeeId: actorId } : body
        const built = await buildFromPayload(payload)
        if (!built.input) {
          return {
            status: 400,
            body: {
              error: 'Validation failed',
              details: built.errors,
            },
          }
        }

        try {
          const created = await repository.create(built.input)
          return {
            status: 201,
            body: created,
          }
        } catch (err) {
          if (err instanceof DuplicateLeaveRequestError) {
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

    if (revokeMatch && method === 'POST') {
      const id = decodeURIComponent(revokeMatch[1])
      const payload = (req.body ?? {}) as Record<string, unknown>
      const reason = typeof payload.reason === 'string' ? payload.reason : ''
      const hrActorId =
        typeof payload.actorId === 'string' && payload.actorId.trim()
          ? payload.actorId
          : 'emp-piri'

      if (!reason.trim()) {
        return {
          status: 400,
          body: {
            error: 'Validation failed',
            details: [
              'HR általi visszavonás (REVOKED) esetén az indoklás megadása kötelező.',
            ],
          },
        }
      }

      const revoked = await repository.revoke(id, hrActorId, reason)
      if (!revoked) {
        return {
          status: 404,
          body: {
            error: 'Not found',
            details: [`A(z) '${id}' szabadságkérelem nem található.`],
          },
        }
      }
      return {
        status: 200,
        body: revoked,
      }
    }

    if (itemMatch) {
      const id = decodeURIComponent(itemMatch[1])

      if (method === 'GET') {
        const item = await repository.findById(id)
        if (!item) {
          return {
            status: 404,
            body: {
              error: 'Not found',
              details: [`A(z) '${id}' szabadságkérelem nem található.`],
            },
          }
        }
        return {
          status: 200,
          body: item,
        }
      }

      // Leave requests are never modified in place (HR Admin included): cancel/revoke and resubmit.
      if (method === 'PUT') {
        return {
          status: 405,
          body: {
            error: 'Method not allowed',
            details: ['A szabadságkérelem nem módosítható; vonja vissza, és nyújtson be újat.'],
          },
        }
      }
    }

    return null
  }
}
