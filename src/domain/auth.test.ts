import { describe, expect, it } from 'vitest'
import {
  authenticateDemoUser,
  DEMO_VALID_PASSWORD,
  resolveDefaultRole,
} from './auth.ts'
import type { Employee } from '../types/model.ts'

const SAMPLE_EMPLOYEES: readonly Employee[] = [
  {
    id: 'emp-piri',
    displayName: 'Varga Piri',
    email: 'piri.varga@virgo.example',
    legalEntityId: 'VIRGO_KFT',
    managerId: null,
    roles: ['EMPLOYEE', 'HR_ADMIN'],
    birthDate: '1984-03-12',
    employmentStart: '2019-02-01',
    employmentEnd: null,
    includeInPayrollExport: true,
    deputyIds: [],
  },
  {
    id: 'emp-katalin',
    displayName: 'Nagy Katalin',
    email: 'katalin.nagy@virgo.example',
    legalEntityId: 'VIRGO_KFT',
    managerId: 'emp-piri',
    roles: ['EMPLOYEE', 'MANAGER'],
    birthDate: '1986-07-22',
    employmentStart: '2020-05-15',
    employmentEnd: null,
    includeInPayrollExport: true,
    deputyIds: ['emp-piri'],
  },
]

describe('Symbolic demo authentication (Password-123456)', () => {
  it('authenticates valid email with Password-123456 and selects highest defaultRole', () => {
    const res = authenticateDemoUser(
      ' PIRI.VARGA@virgo.example ',
      DEMO_VALID_PASSWORD,
      SAMPLE_EMPLOYEES,
    )

    expect(res).toEqual({
      ok: true,
      employee: SAMPLE_EMPLOYEES[0],
      defaultRole: 'HR_ADMIN',
    })
  })

  it('rejects wrong password or unknown email', () => {
    expect(
      authenticateDemoUser(
        'piri.varga@virgo.example',
        'wrong-pass',
        SAMPLE_EMPLOYEES,
      ),
    ).toEqual({
      ok: false,
      reason: 'INVALID_CREDENTIALS',
    })

    expect(
      authenticateDemoUser(
        'unknown@virgo.example',
        DEMO_VALID_PASSWORD,
        SAMPLE_EMPLOYEES,
      ),
    ).toEqual({
      ok: false,
      reason: 'INVALID_CREDENTIALS',
    })
  })

  it('resolves default role priority HR_ADMIN > MANAGER > EMPLOYEE', () => {
    expect(resolveDefaultRole(['EMPLOYEE', 'HR_ADMIN'])).toBe('HR_ADMIN')
    expect(resolveDefaultRole(['EMPLOYEE', 'MANAGER'])).toBe('MANAGER')
    expect(resolveDefaultRole(['EMPLOYEE'])).toBe('EMPLOYEE')
  })
})
