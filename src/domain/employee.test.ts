import { describe, expect, it } from 'vitest'
import {
  canManageEmployees,
  wouldCreateManagementCycle,
  createEmployee,
  mapEmployeeToRow,
  mapRowToEmployee,
  validateEmployee,
  type Employee,
} from './employee.ts'

describe('Employee entity (shared DATA_MODEL contract)', () => {
  it('creates a valid Employee entity and normalizes fields', () => {
    const emp = createEmployee({
      id: ' emp-peter ',
      displayName: ' Kovács Péter ',
      email: ' peter.kovacs@virgo.example ',
      legalEntityId: 'VIRGO_KFT',
      managerId: ' emp-katalin ',
      roles: ['EMPLOYEE'],
      birthDate: '1992-04-15',
      taxId: '8400000099',
      employmentStart: '2023-01-10',
      employmentEnd: null,
      deputyIds: [' emp-anna ', 'emp-anna'],
    })

    expect(emp).toEqual<Employee>({
      id: 'emp-peter',
      displayName: 'Kovács Péter',
      email: 'peter.kovacs@virgo.example',
      legalEntityId: 'VIRGO_KFT',
      managerId: 'emp-katalin',
      roles: ['EMPLOYEE'],
      birthDate: '1992-04-15',
      taxId: '8400000099',
      employmentStart: '2023-01-10',
      employmentEnd: null,
      includeInPayrollExport: true,
      deputyIds: ['emp-anna'],
      teamId: null,
    })
  })

  it('rejects self-manager, self-deputy, missing EMPLOYEE role and invalid dates', () => {
    const validation = validateEmployee({
      id: 'emp-peter',
      displayName: 'Kovács Péter',
      email: 'invalid-email',
      legalEntityId: 'VIRGO_KFT',
      managerId: 'emp-peter',
      roles: ['MANAGER'],
      birthDate: '1992/04/15',
      taxId: '8400000099',
      employmentStart: '2025-05-01',
      employmentEnd: '2025-01-01',
      deputyIds: ['emp-peter'],
    })

    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('Érvényes e-mail cím megadása kötelező.')
    expect(validation.errors).toContain(
      'A munkavállaló nem lehet saját maga közvetlen vezetője.',
    )
    expect(validation.errors).toContain(
      'A szerepköröknek (roles) tartalmazniuk kell az EMPLOYEE szerepkört.',
    )
    expect(validation.errors).toContain(
      'A születési dátum (YYYY-MM-DD) kötelező.',
    )
    expect(validation.errors).toContain(
      'A kilépés dátuma nem lehet korábbi a belépés dátumánál.',
    )
    expect(validation.errors).toContain(
      'A helyettesek listája (deputyIds) nem tartalmazhatja magát a munkavállalót.',
    )
  })

  it('maps between MariaDB row (EmployeeRow) and Employee domain entity', () => {
    const employee = createEmployee({
      id: 'emp-katalin',
      displayName: 'Nagy Katalin',
      email: 'katalin.nagy@virgo.example',
      legalEntityId: 'VIRGO_ZRT',
      managerId: null,
      roles: ['EMPLOYEE', 'MANAGER'],
      birthDate: '1985-08-20',
      taxId: '8400000099',
      employmentStart: '2020-03-01',
      employmentEnd: null,
      includeInPayrollExport: false,
      deputyIds: ['emp-piri'],
    })

    const row = mapEmployeeToRow(employee)
    expect(row.legal_entity_id).toBe('VIRGO_ZRT')
    expect(row.include_in_payroll_export).toBe(0)
    expect(row.roles_json).toBe('["EMPLOYEE","MANAGER"]')

    const mappedBack = mapRowToEmployee(row)
    expect(mappedBack).toEqual(employee)
  })

  it('allows only HR_ADMIN role to manage employees', () => {
    expect(canManageEmployees('HR_ADMIN')).toBe(true)
    expect(canManageEmployees(['EMPLOYEE', 'HR_ADMIN'])).toBe(true)
    expect(canManageEmployees('MANAGER')).toBe(false)
    expect(canManageEmployees('EMPLOYEE')).toBe(false)
  })
})

describe('wouldCreateManagementCycle (team change by HR)', () => {
  const people = [
    { id: 'ceo', managerId: null },
    { id: 'mgr', managerId: 'ceo' },
    { id: 'dev', managerId: 'mgr' },
  ]
  it('allows moving to a team outside the own subtree', () => {
    expect(wouldCreateManagementCycle(people, 'dev', 'ceo')).toBe(false)
    expect(wouldCreateManagementCycle(people, 'mgr', null)).toBe(false)
  })
  it('blocks self and moving under an own (indirect) report', () => {
    expect(wouldCreateManagementCycle(people, 'mgr', 'mgr')).toBe(true)
    expect(wouldCreateManagementCycle(people, 'mgr', 'dev')).toBe(true)
    expect(wouldCreateManagementCycle(people, 'ceo', 'dev')).toBe(true)
  })
  it('terminates on a pre-existing unrelated cycle', () => {
    const loop = [...people, { id: 'a', managerId: 'b' }, { id: 'b', managerId: 'a' }]
    expect(wouldCreateManagementCycle(loop, 'dev', 'a')).toBe(false)
  })
})
