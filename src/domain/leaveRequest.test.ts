import { describe, expect, it } from 'vitest'
import {
  canManageLeaveRequests,
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
})
