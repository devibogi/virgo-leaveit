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
import { sanitizePayloadForXss, verifyCsrfProtection } from './security.ts'
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

function extractActorRole(req: ApiRequest): Role | null {
  return req.session?.activeRole ?? null
}

function extractActorId(req: ApiRequest): string | null {
  const id = req.session?.employeeId
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

/** Personal fields (birth date, tax id, employment start) and legal entity are HR-only and stripped for managers. */
function toManagerView(employee: CreateEmployeeInput, nameOf: (id: string) => string) {
  // GDPR (product-owner request 2026-11-13): no birth date, tax id, entity or employment start for managers.
  const { birthDate: _b, taxId: _t, legalEntityId: _l, employmentStart: _s, ...rest } = employee
  void _s
  void _b
  void _t
  void _l
  return { ...rest, deputyNames: (employee.deputyIds ?? []).map(nameOf) }
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
    taxId: typeof payload.taxId === 'string' ? payload.taxId.trim() : '',
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

    const actorRole = extractActorRole(req)
    // Managers: read-only list of their direct reports, without personal fields.
    if (actorRole === 'MANAGER' && isCollection && method === 'GET') {
      const actorId = extractActorId(req)
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
      const names = new Map((await repository.findAll()).map((e) => [e.id, e.displayName]))
      const nameOf = (id: string) => names.get(id) ?? '—'
      return { status: 200, body: team.map((e) => toManagerView(e, nameOf)) }
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
        const payload = (sanitizedBody ?? {}) as Record<string, unknown>
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
        const payload = (sanitizedBody ?? {}) as Record<string, unknown>
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
