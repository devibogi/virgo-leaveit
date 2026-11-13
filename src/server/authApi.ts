import {
  authenticateDemoUser,
  resolveDefaultRole,
} from '../domain/auth.ts'
import type { Role } from '../types/model.ts'
import {
  InMemoryEmployeeRepository,
  type EmployeeRepository,
} from './employeeRepository.ts'
import {
  buildClearSessionCookie,
  buildSetSessionCookie,
  extractSessionIdFromHeaders,
  InMemorySessionRepository,
  type SessionRepository,
} from './sessionRepository.ts'
import type { ApiRequest, ApiResponse } from './teamApi.ts'

const VALID_ROLES: readonly Role[] = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN']

function isValidRole(value: unknown): value is Role {
  return typeof value === 'string' && (VALID_ROLES as readonly string[]).includes(value)
}

export function createAuthApiHandler(
  employeeRepository: EmployeeRepository = new InMemoryEmployeeRepository(),
  sessionRepository: SessionRepository = new InMemorySessionRepository(),
) {
  return async function handleAuthApiRequest(
    req: ApiRequest,
  ): Promise<ApiResponse | null> {
    const withoutOrigin = req.url.replace(/^https?:\/\/[^/]+/, '')
    const [pathname = '/'] = withoutOrigin.split('?')
    const method = req.method.toUpperCase()

    if (pathname === '/api/auth/login' && method === 'POST') {
      const payload = (req.body ?? {}) as Record<string, unknown>
      const email = typeof payload.email === 'string' ? payload.email : ''
      const password =
        typeof payload.password === 'string' ? payload.password : ''

      const employees = await employeeRepository.findAll()
      const result = authenticateDemoUser(email, password, employees)

      if (!result.ok) {
        if (result.reason === 'NO_ACCESS') {
          return {
            status: 403,
            body: {
              error: 'No access',
              details: ['NO_ACCESS'],
            },
          }
        }
        return {
          status: 401,
          body: {
            error: 'Invalid credentials',
            details: ['INVALID_CREDENTIALS'],
          },
        }
      }

      const session = await sessionRepository.create(
        result.employee.id,
        result.defaultRole,
      )

      return {
        status: 200,
        headers: {
          'Set-Cookie': buildSetSessionCookie(session.id),
        },
        body: {
          employee: result.employee,
          defaultRole: result.defaultRole,
          activeRole: session.activeRole,
        },
      }
    }

    if (pathname === '/api/auth/session' && method === 'GET') {
      const sessionId =
        req.session?.sessionId ?? extractSessionIdFromHeaders(req.headers)
      if (!sessionId) {
        return {
          status: 401,
          body: {
            error: 'Unauthorized',
            details: ['Nincs aktív munkamenet.'],
          },
        }
      }

      const session = await sessionRepository.findById(sessionId)
      if (!session) {
        return {
          status: 401,
          headers: {
            'Set-Cookie': buildClearSessionCookie(),
          },
          body: {
            error: 'Unauthorized',
            details: ['A munkamenet lejárt vagy érvénytelen.'],
          },
        }
      }

      const employee = await employeeRepository.findById(session.employeeId)
      if (!employee) {
        await sessionRepository.delete(session.id)
        return {
          status: 401,
          headers: {
            'Set-Cookie': buildClearSessionCookie(),
          },
          body: {
            error: 'Unauthorized',
            details: ['A munkavállaló nem található.'],
          },
        }
      }

      const activeRole = employee.roles.includes(session.activeRole)
        ? session.activeRole
        : resolveDefaultRole(employee.roles)
      if (activeRole !== session.activeRole) {
        await sessionRepository.updateRole(session.id, activeRole)
      }

      return {
        status: 200,
        body: {
          employee,
          defaultRole: activeRole,
          activeRole,
        },
      }
    }

    if (pathname === '/api/auth/role' && method === 'POST') {
      const sessionId =
        req.session?.sessionId ?? extractSessionIdFromHeaders(req.headers)
      if (!sessionId) {
        return {
          status: 401,
          body: {
            error: 'Unauthorized',
            details: ['Nincs aktív munkamenet.'],
          },
        }
      }

      const session = await sessionRepository.findById(sessionId)
      if (!session) {
        return {
          status: 401,
          headers: {
            'Set-Cookie': buildClearSessionCookie(),
          },
          body: {
            error: 'Unauthorized',
            details: ['A munkamenet lejárt vagy érvénytelen.'],
          },
        }
      }

      const employee = await employeeRepository.findById(session.employeeId)
      if (!employee) {
        await sessionRepository.delete(session.id)
        return {
          status: 401,
          headers: {
            'Set-Cookie': buildClearSessionCookie(),
          },
          body: {
            error: 'Unauthorized',
            details: ['A munkavállaló nem található.'],
          },
        }
      }

      const payload = (req.body ?? {}) as Record<string, unknown>
      const requestedRole = payload.role
      if (!isValidRole(requestedRole)) {
        return {
          status: 400,
          body: {
            error: 'Validation failed',
            details: ['Érvénytelen szerepkör (role).'],
          },
        }
      }

      if (!employee.roles.includes(requestedRole)) {
        return {
          status: 403,
          body: {
            error: 'Forbidden',
            details: [
              'Csak a munkavállaló saját szerepkörei (employee.roles) között lehet váltani.',
            ],
          },
        }
      }

      await sessionRepository.updateRole(session.id, requestedRole)

      return {
        status: 200,
        body: {
          employee,
          defaultRole: requestedRole,
          activeRole: requestedRole,
        },
      }
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      const sessionId =
        req.session?.sessionId ?? extractSessionIdFromHeaders(req.headers)
      if (sessionId) {
        await sessionRepository.delete(sessionId)
      }
      return {
        status: 204,
        headers: {
          'Set-Cookie': buildClearSessionCookie(),
        },
      }
    }

    return null
  }
}
