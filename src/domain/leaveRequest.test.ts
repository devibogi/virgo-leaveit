import { describe, expect, it } from 'vitest'
import type { Employee } from '../types/model.ts'
import {
  buildLeaveRequestFromDraft,
  canManageLeaveRequests,
  generateRequestId,
  resolveApproverId,
  createLeaveRequest,
  mapLeaveRequestToRow,
  mapRowToLeaveRequest,
  revokeLeaveRequestByHr,
  validateLeaveRequest,
} from './leaveRequest.ts'

describe('LeaveRequest entity & validation (shared DATA_MODEL contract)', () => {
  it('creates a valid LeaveRequest and maps to/from MariaDB row', () => {
    const req = createLeaveRequest({
      id: ' req-0001 ',
      employeeId: ' emp-peter ',
      legalEntityId: 'VIRGO_KFT',
      approverId: ' emp-katalin ',
      leaveTypeCode: 'ANNUAL',
      startDate: '2026-07-06',
      endDate: '2026-07-10',
      dayPortion: 'FULL',
      employeeComment: ' Nyári szabadság ',
      submittedAt: '2026-06-15T10:00:00Z',
    })

    expect(req.id).toBe('req-0001')
    expect(req.status).toBe('PENDING')
    expect(req.employeeComment).toBe('Nyári szabadság')

    const row = mapLeaveRequestToRow(req)
    expect(row.employee_id).toBe('emp-peter')
    expect(mapRowToLeaveRequest(row)).toEqual(req)
  })

  it('enforces date order, half-day rules and no self-approval', () => {
    const invalidHalfDay = validateLeaveRequest({
      id: 'req-2',
      employeeId: 'emp-peter',
      legalEntityId: 'VIRGO_KFT',
      approverId: 'emp-peter',
      leaveTypeCode: 'SICK_LEAVE',
      startDate: '2026-05-10',
      endDate: '2026-05-12',
      dayPortion: 'AM',
    })

    expect(invalidHalfDay.valid).toBe(false)
    expect(invalidHalfDay.errors).toContain(
      'A munkavállaló nem hagyhatja jóvá saját kérelmét.',
    )
    expect(invalidHalfDay.errors).toContain(
      'Félnapos (AM/PM) kérelem esetén a kezdő és záró dátumnak meg kell egyeznie.',
    )
    expect(invalidHalfDay.errors).toContain(
      'A(z) Betegszabadság (SICK_LEAVE) típusnál félnapos kérelem nem engedélyezett.',
    )
  })

  it('preserves history when revoked by HR Admin and requires a reason', () => {
    const req = createLeaveRequest({
      id: 'req-0002',
      employeeId: 'emp-peter',
      legalEntityId: 'VIRGO_KFT',
      approverId: 'emp-katalin',
      leaveTypeCode: 'ANNUAL',
      startDate: '2026-08-03',
      endDate: '2026-08-03',
      dayPortion: 'AM',
      status: 'APPROVED',
      approval: {
        decision: 'APPROVED',
        decidedBy: 'emp-katalin',
        onBehalfOf: null,
        decidedAt: '2026-07-20T09:00:00Z',
        comment: 'Rendben',
      },
    })

    expect(() => revokeLeaveRequestByHr(req, 'emp-piri', '   ')).toThrow(
      'HR általi visszavonás (REVOKED) esetén az indoklás megadása kötelező.',
    )

    const revoked = revokeLeaveRequestByHr(
      req,
      'emp-piri',
      'Projekt átütemezés miatt',
      '2026-07-25T11:00:00Z',
    )
    expect(revoked.status).toBe('REVOKED')
    expect(revoked.cancellation).toEqual({
      kind: 'REVOKED',
      cancelledBy: 'emp-piri',
      cancelledAt: '2026-07-25T11:00:00Z',
      reason: 'Projekt átütemezés miatt',
    })
  })

  it('allows only HR_ADMIN role to manage requests in the admin CRUD', () => {
    expect(canManageLeaveRequests('HR_ADMIN')).toBe(true)
    expect(canManageLeaveRequests('MANAGER')).toBe(false)
    expect(canManageLeaveRequests('EMPLOYEE')).toBe(false)
  })

  describe('server-side derivation of hidden fields (D21)', () => {
    const base = {
      displayName: 'X',
      email: 'x@virgo.example',
      birthDate: '1990-01-01',
      employmentStart: '2020-01-01',
      employmentEnd: null,
      includeInPayrollExport: true,
      deputyIds: [],
      taxId: '8000000009',
    }
    const hr: Employee = { ...base, id: 'emp-hr', legalEntityId: 'VIRGO_KFT', managerId: null, roles: ['EMPLOYEE', 'HR_ADMIN'] }
    const mgr: Employee = { ...base, id: 'emp-mgr', legalEntityId: 'VIRGO_KFT', managerId: 'emp-hr', roles: ['EMPLOYEE', 'MANAGER'] }
    const emp: Employee = { ...base, id: 'emp-e', legalEntityId: 'VIRGO_ZRT', managerId: 'emp-mgr', roles: ['EMPLOYEE'] }
    const all = [hr, mgr, emp]
    const draft = { employeeId: 'emp-e', leaveTypeCode: 'ANNUAL' as const, startDate: '2026-08-10', endDate: '2026-08-11', dayPortion: 'FULL' as const }

    it('generates unique request ids', () => {
      const a = generateRequestId()
      expect(a).toMatch(/^req-/)
      expect(generateRequestId()).not.toBe(a)
    })

    it('uses the line manager as approver, HR Admin for UNPAID', () => {
      expect(resolveApproverId(emp, 'ANNUAL', all)).toBe('emp-mgr')
      expect(resolveApproverId(emp, 'SICK_LEAVE', all)).toBe('emp-mgr')
      expect(resolveApproverId(emp, 'UNPAID', all)).toBe('emp-hr')
      expect(resolveApproverId(hr, 'UNPAID', all)).toBeNull()
      expect(resolveApproverId(hr, 'ANNUAL', all)).toBeNull()
    })

    it('builds a PENDING request with entity from the employee', () => {
      const result = buildLeaveRequestFromDraft(draft, emp, all, 'req-x')
      expect(result.errors).toEqual([])
      expect(result.input).toMatchObject({
        id: 'req-x',
        employeeId: 'emp-e',
        legalEntityId: 'VIRGO_ZRT',
        approverId: 'emp-mgr',
        status: 'PENDING',
      })
    })

    it('fails for unknown employee or missing approver', () => {
      expect(buildLeaveRequestFromDraft(draft, null, all).input).toBeNull()
      const noApprover = buildLeaveRequestFromDraft({ ...draft, employeeId: 'emp-hr' }, hr, all)
      expect(noApprover.input).toBeNull()
      expect(noApprover.errors[0]).toContain('jóváhagyó')
    })
  })
})
