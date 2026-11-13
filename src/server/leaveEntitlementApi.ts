import {
  canManageEntitlements,
  isEntitlementComponent,
  validateLeaveEntitlement,
  type CreateLeaveEntitlementInput,
  type EntitlementComponent,
  type Role,
} from '../domain/leaveEntitlement.ts'
import {
  DuplicateEntitlementError,
  InMemoryLeaveEntitlementRepository,
  type LeaveEntitlementRepository,
} from './leaveEntitlementRepository.ts'
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

function toOptionalNullableNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const n = Number(val)
  return Number.isFinite(n) ? n : Number.NaN
}

function parseEntitlementPayload(
  id: string,
  payload: Record<string, unknown>,
): CreateLeaveEntitlementInput {
  return {
    id,
    employeeId:
      typeof payload.employeeId === 'string' ? payload.employeeId : '',
    year: typeof payload.year === 'number' ? payload.year : Number(payload.year),
    component: (typeof payload.component === 'string'
      ? payload.component
      : '') as EntitlementComponent,
    fullYearDays: toOptionalNullableNumber(payload.fullYearDays),
    calculatedDays: toOptionalNullableNumber(payload.calculatedDays),
    overrideDays: toOptionalNullableNumber(payload.overrideDays),
    overrideReason:
      typeof payload.overrideReason === 'string'
        ? payload.overrideReason
        : null,
    payrollReferenceDays: toOptionalNullableNumber(
      payload.payrollReferenceDays,
    ),
    updatedBy:
      typeof payload.updatedBy === 'string' && payload.updatedBy.trim()
        ? payload.updatedBy
        : 'emp-piri',
  }
}

export function createLeaveEntitlementApiHandler(
  repository: LeaveEntitlementRepository = new InMemoryLeaveEntitlementRepository(),
) {
  return async function handleLeaveEntitlementApiRequest(
    req: ApiRequest,
  ): Promise<ApiResponse | null> {
    const { pathname, query } = parseUrlPathAndQuery(req.url)
    const method = req.method.toUpperCase()

    const isCollection = pathname === '/api/entitlements'
    const itemMatch = /^\/api\/entitlements\/([^/]+)$/.exec(pathname)

    if (!isCollection && !itemMatch) {
      return null
    }

    const actorRole = extractActorRole(req.headers)
    if (!actorRole || !canManageEntitlements(actorRole)) {
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
        const employeeId = query.employeeId || undefined
        const year =
          query.year && !Number.isNaN(Number(query.year))
            ? Number(query.year)
            : undefined
        const component = isEntitlementComponent(query.component)
          ? query.component
          : undefined

        const items = await repository.findAll({
          employeeId,
          year,
          component,
        })
        return {
          status: 200,
          body: items,
        }
      }

      if (method === 'POST') {
        const payload = (req.body ?? {}) as Record<string, unknown>
        const candidateId = typeof payload.id === 'string' ? payload.id : ''
        const candidate = parseEntitlementPayload(candidateId, payload)

        const validation = validateLeaveEntitlement(candidate)
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
          if (err instanceof DuplicateEntitlementError) {
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
        const item = await repository.findById(id)
        if (!item) {
          return {
            status: 404,
            body: {
              error: 'Not found',
              details: [`A(z) '${id}' jogosultság nem található.`],
            },
          }
        }
        return {
          status: 200,
          body: item,
        }
      }

      if (method === 'PUT') {
        const payload = (req.body ?? {}) as Record<string, unknown>
        const candidate = parseEntitlementPayload(id, payload)

        const validation = validateLeaveEntitlement(candidate)
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
          const updated = await repository.update(id, candidate)
          if (!updated) {
            return {
              status: 404,
              body: {
                error: 'Not found',
                details: [`A(z) '${id}' jogosultság nem található.`],
              },
            }
          }
          return {
            status: 200,
            body: updated,
          }
        } catch (err) {
          if (err instanceof DuplicateEntitlementError) {
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

      if (method === 'DELETE') {
        const deleted = await repository.delete(id)
        if (!deleted) {
          return {
            status: 404,
            body: {
              error: 'Not found',
              details: [`A(z) '${id}' jogosultság nem található.`],
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
