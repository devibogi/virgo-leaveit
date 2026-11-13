import {
  canManageEntitlements,
  isEntitlementComponent,
  summarizeEntitlementBalance,
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
import {
  InMemoryEmployeeRepository,
  type EmployeeRepository,
} from './employeeRepository.ts'
import type { ApiRequest, ApiResponse } from './teamApi.ts'
import { withPastUsage } from '../domain/entitlementUsage.ts'
import type { LeaveEntitlement } from '../types/model.ts'
import type { LeaveRequestRepository } from './leaveRequestRepository.ts'

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

const FORBIDDEN_HR_ONLY: ApiResponse = {
  status: 403,
  body: {
    error: 'Forbidden',
    details: [
      'Csak HR adminisztrátor (HR_ADMIN) jogosultsággal érhető el ez a művelet.',
    ],
  },
}

const FORBIDDEN_NO_ACTOR: ApiResponse = {
  status: 403,
  body: {
    error: 'Forbidden',
    details: ['A bejelentkezett felhasználó azonosítója szükséges.'],
  },
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
  employeeRepository: EmployeeRepository = new InMemoryEmployeeRepository(),
  requestRepository?: LeaveRequestRepository,
  today: () => string = () => new Date().toISOString().slice(0, 10),
) {
  /** Used days = approved leave on working days up to today (past leave counts as used). */
  async function withUsage<T extends LeaveEntitlement>(items: T[]): Promise<T[]> {
    if (!requestRepository) return items
    return withPastUsage(items, await requestRepository.findAll(), today())
  }

  return async function handleLeaveEntitlementApiRequest(
    req: ApiRequest,
  ): Promise<ApiResponse | null> {
    const { pathname, query } = parseUrlPathAndQuery(req.url)
    const method = req.method.toUpperCase()

    const isCollection = pathname === '/api/entitlements'
    const isTeamSummary = pathname === '/api/entitlements/team-summary'
    const itemMatch = isTeamSummary
      ? null
      : /^\/api\/entitlements\/([^/]+)$/.exec(pathname)

    if (!isCollection && !isTeamSummary && !itemMatch) {
      return null
    }

    const actorRole = extractActorRole(req)
    const actorId = extractActorId(req)
    if (!actorRole) {
      return FORBIDDEN_HR_ONLY
    }
    const year =
      query.year && !Number.isNaN(Number(query.year))
        ? Number(query.year)
        : undefined

    // Manager: direct reports' balances as numbers only (no component, no leave type).
    if (isTeamSummary && method === 'GET') {
      if (actorRole !== 'MANAGER' && actorRole !== 'HR_ADMIN') {
        return FORBIDDEN_HR_ONLY
      }
      if (!actorId) return FORBIDDEN_NO_ACTOR
      const summaryYear = year ?? new Date().getFullYear()
      const team = (await employeeRepository.findAll()).filter(
        (e) => e.managerId === actorId,
      )
      const entitlements = await withUsage(await repository.findAll({ year: summaryYear }))
      return {
        status: 200,
        body: team.map((member) => ({
          ...summarizeEntitlementBalance(entitlements, member.id, summaryYear),
          displayName: member.displayName,
        })),
      }
    }

    // Every role may read their own entitlements; everything else is HR only.
    if (!canManageEntitlements(actorRole)) {
      if (!(isCollection && method === 'GET')) {
        return FORBIDDEN_HR_ONLY
      }
      if (!actorId) return FORBIDDEN_NO_ACTOR
      const items = await withUsage(await repository.findAll({ employeeId: actorId, year }))
      return { status: 200, body: items }
    }

    if (isCollection) {
      if (method === 'GET') {
        const employeeId = query.employeeId || undefined
        const component = isEntitlementComponent(query.component)
          ? query.component
          : undefined

        const items = await withUsage(
          await repository.findAll({ employeeId, year, component }),
        )
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
