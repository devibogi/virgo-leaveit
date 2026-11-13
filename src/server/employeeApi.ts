import {
  canManageEmployees,
  validateEmployee,
  wouldCreateManagementCycle,
  type CreateEmployeeInput,
  type LegalEntityId,
  type Role,
} from '../domain/employee.ts'
import {
  DuplicateEmployeeError,
  InMemoryEmployeeRepository,
  type EmployeeRepository,
} from './employeeRepository.ts'
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

/** Personal fields (birth date, tax id) are HR-only and stripped for managers. */
function toManagerView(employee: CreateEmployeeInput) {
  const { birthDate: _b, taxId: _t, ...rest } = employee
  void _b
  void _t
  return rest
}

function parseEmployeePayload(
  id: string,
  payload: Record<string, unknown>,
): CreateEmployeeInput {
  const rawManager = payload.managerId
  const managerId =
    typeof rawManager === 'string' && rawManager.trim().length > 0
      ? rawManager
      : null

  const rawEnd = payload.employmentEnd
  const employmentEnd =
    typeof rawEnd === 'string' && rawEnd.trim().length > 0 ? rawEnd : null

  const roles = Array.isArray(payload.roles)
    ? (payload.roles.filter((r) => typeof r === 'string') as Role[])
    : []

  const deputyIds = Array.isArray(payload.deputyIds)
    ? payload.deputyIds.filter((d): d is string => typeof d === 'string')
    : []

  const includeInPayrollExport =
    typeof payload.includeInPayrollExport === 'boolean'
      ? payload.includeInPayrollExport
      : true

  return {
    id,
    displayName:
      typeof payload.displayName === 'string' ? payload.displayName : '',
    email: typeof payload.email === 'string' ? payload.email : '',
    legalEntityId: (typeof payload.legalEntityId === 'string'
      ? payload.legalEntityId
      : '') as LegalEntityId,
    managerId,
    roles,
    birthDate: typeof payload.birthDate === 'string' ? payload.birthDate : '',
    employmentStart:
      typeof payload.employmentStart === 'string'
        ? payload.employmentStart
        : '',
    employmentEnd,
    includeInPayrollExport,
    deputyIds,
  }
}

export function createEmployeeApiHandler(
  repository: EmployeeRepository = new InMemoryEmployeeRepository(),
) {
  return async function handleEmployeeApiRequest(
    req: ApiRequest,
  ): Promise<ApiResponse | null> {
    const { pathname, query } = parseUrlPathAndQuery(req.url)
    const method = req.method.toUpperCase()

    const isCollection = pathname === '/api/employees'
    const itemMatch = /^\/api\/employees\/([^/]+)$/.exec(pathname)

    if (!isCollection && !itemMatch) {
      return null
    }

    const actorRole = extractActorRole(req.headers)
    // Managers: read-only list of their direct reports, without personal fields.
    // Demo-only: role/id come from client headers, not a verified session.
    if (actorRole === 'MANAGER' && isCollection && method === 'GET') {
      const actorId = extractActorId(req.headers)
      if (!actorId) {
        return {
          status: 403,
          body: {
            error: 'Forbidden',
            details: ['A bejelentkezett felhasználó azonosítója szükséges.'],
          },
        }
      }
      const team = await repository.findAll({ managerId: actorId })
      return { status: 200, body: team.map(toManagerView) }
    }

    if (!actorRole || !canManageEmployees(actorRole)) {
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
        const legalEntityId =
          query.legalEntityId === 'VIRGO_KFT' ||
          query.legalEntityId === 'VIRGO_ZRT'
            ? query.legalEntityId
            : undefined
        const managerId = query.managerId || undefined
        const employees = await repository.findAll({
          legalEntityId,
          managerId,
        })
        return {
          status: 200,
          body: employees,
        }
      }

      if (method === 'POST') {
        const payload = (req.body ?? {}) as Record<string, unknown>
        const candidateId = typeof payload.id === 'string' ? payload.id : ''
        const candidate = parseEmployeePayload(candidateId, payload)

        const validation = validateEmployee(candidate)
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
          if (err instanceof DuplicateEmployeeError) {
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

    if (itemMatch) {
      const id = decodeURIComponent(itemMatch[1])

      if (method === 'GET') {
        const employee = await repository.findById(id)
        if (!employee) {
          return {
            status: 404,
            body: {
              error: 'Not found',
              details: [`A(z) '${id}' munkavállaló nem található.`],
            },
          }
        }
        return {
          status: 200,
          body: employee,
        }
      }

      if (method === 'PUT') {
        const payload = (req.body ?? {}) as Record<string, unknown>
        const candidate = parseEmployeePayload(id, payload)

        const validation = validateEmployee(candidate)
        if (!validation.valid) {
          return {
            status: 400,
            body: {
              error: 'Validation failed',
              details: validation.errors,
            },
          }
        }

        const allEmployees = await repository.findAll()
        if (wouldCreateManagementCycle(allEmployees, id, candidate.managerId)) {
          return {
            status: 400,
            body: {
              error: 'Validation failed',
              details: [
                'A vezető-hozzárendelés körkörös vezetési láncot hozna létre.',
              ],
            },
          }
        }

        const updated = await repository.update(id, candidate)
        if (!updated) {
          return {
            status: 404,
            body: {
              error: 'Not found',
              details: [`A(z) '${id}' munkavállaló nem található.`],
            },
          }
        }
        return {
          status: 200,
          body: updated,
        }
      }

      if (method === 'DELETE') {
        const deleted = await repository.delete(id)
        if (!deleted) {
          return {
            status: 404,
            body: {
              error: 'Not found',
              details: [`A(z) '${id}' munkavállaló nem található.`],
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
