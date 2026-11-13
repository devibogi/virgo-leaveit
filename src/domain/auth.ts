import type { Employee, Role } from '../types/model.ts'

export const DEMO_VALID_PASSWORD = 'Password-123456'

export type AuthFailureReason = 'INVALID_CREDENTIALS' | 'NO_ACCESS'

export type AuthResult =
  | {
      ok: true
      employee: Employee
      defaultRole: Role
    }
  | {
      ok: false
      reason: AuthFailureReason
    }

export function resolveDefaultRole(roles: readonly Role[]): Role {
  if (roles.includes('HR_ADMIN')) return 'HR_ADMIN'
  if (roles.includes('MANAGER')) return 'MANAGER'
  return 'EMPLOYEE'
}

export function authenticateDemoUser(
  email: string,
  password: string,
  employees: readonly Employee[],
): AuthResult {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || password !== DEMO_VALID_PASSWORD) {
    return {
      ok: false,
      reason: 'INVALID_CREDENTIALS',
    }
  }

  const matched = employees.find(
    (emp) => emp.email.trim().toLowerCase() === normalizedEmail,
  )
  if (!matched) {
    return {
      ok: false,
      reason: 'INVALID_CREDENTIALS',
    }
  }

  if (!matched.roles || matched.roles.length === 0) {
    return {
      ok: false,
      reason: 'NO_ACCESS',
    }
  }

  return {
    ok: true,
    employee: matched,
    defaultRole: resolveDefaultRole(matched.roles),
  }
}
