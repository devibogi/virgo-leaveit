import { authenticateDemoUser } from '../domain/auth.ts'
import {
  InMemoryEmployeeRepository,
  type EmployeeRepository,
} from './employeeRepository.ts'
import type { ApiRequest, ApiResponse } from './teamApi.ts'

export function createAuthApiHandler(
  employeeRepository: EmployeeRepository = new InMemoryEmployeeRepository(),
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

      return {
        status: 200,
        body: {
          employee: result.employee,
          defaultRole: result.defaultRole,
        },
      }
    }

    return null
  }
}
