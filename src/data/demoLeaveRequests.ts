import type { LeaveRequest } from '../domain/index.ts'

/** Synthetic demo requests (Nov 2026 – Jan 2027) so the calendar shows every type/status. */
type Row = [
  employeeId: string,
  leaveTypeCode: LeaveRequest['leaveTypeCode'],
  startDate: string,
  endDate: string,
  dayPortion: LeaveRequest['dayPortion'],
  status: LeaveRequest['status'],
  comment: string | null,
]

const EMP: Record<string, { entity: LeaveRequest['legalEntityId']; approver: string }> = {
  'emp-piri': { entity: 'VIRGO_KFT', approver: 'emp-katalin' },
  'emp-katalin': { entity: 'VIRGO_KFT', approver: 'emp-piri' },
  'emp-peter': { entity: 'VIRGO_KFT', approver: 'emp-katalin' },
  'emp-anna': { entity: 'VIRGO_ZRT', approver: 'emp-katalin' },
}

const ROWS: Row[] = [
  // November 2026
  ['emp-peter', 'ANNUAL', '2026-11-02', '2026-11-06', 'FULL', 'APPROVED', 'Őszi pihenés'],
  ['emp-anna', 'SICK_LEAVE', '2026-11-03', '2026-11-05', 'FULL', 'APPROVED', null],
  ['emp-katalin', 'ANNUAL', '2026-11-09', '2026-11-09', 'AM', 'APPROVED', 'Orvosi időpont'],
  ['emp-katalin', 'ANNUAL', '2026-11-11', '2026-11-11', 'PM', 'APPROVED', null],
  ['emp-anna', 'CHILD_SICK_LEAVE', '2026-11-10', '2026-11-12', 'FULL', 'APPROVED', 'Beteg gyermek'],
  ['emp-piri', 'FUNERAL', '2026-11-16', '2026-11-17', 'FULL', 'APPROVED', 'Családi gyászeset'],
  ['emp-peter', 'ANNUAL', '2026-11-18', '2026-11-18', 'FULL', 'APPROVED', 'Költözés'],
  ['emp-anna', 'ANNUAL', '2026-11-19', '2026-11-20', 'FULL', 'PENDING', 'Hosszú hétvége'],
  ['emp-peter', 'UNPAID', '2026-11-23', '2026-11-25', 'FULL', 'PENDING', 'Magánügy'],
  ['emp-katalin', 'ANNUAL', '2026-11-26', '2026-11-27', 'FULL', 'REJECTED', 'Projektzárás miatt elutasítva'],
  ['emp-anna', 'ANNUAL', '2026-11-30', '2026-11-30', 'PM', 'CANCELLED', null],
  // December 2026
  ['emp-piri', 'ANNUAL', '2026-12-01', '2026-12-04', 'FULL', 'APPROVED', null],
  ['emp-peter', 'SICK_LEAVE', '2026-12-07', '2026-12-09', 'FULL', 'APPROVED', null],
  ['emp-anna', 'UNPAID', '2026-12-10', '2026-12-11', 'FULL', 'APPROVED', 'Utazás'],
  ['emp-katalin', 'ANNUAL', '2026-12-14', '2026-12-14', 'AM', 'PENDING', 'Hivatali ügyintézés'],
  ['emp-peter', 'ANNUAL', '2026-12-17', '2026-12-17', 'AM', 'PENDING', null],
  ['emp-anna', 'ANNUAL', '2026-12-21', '2026-12-23', 'FULL', 'APPROVED', 'Karácsony előtt'],
  ['emp-katalin', 'ANNUAL', '2026-12-21', '2026-12-31', 'FULL', 'APPROVED', 'Téli szabadság'],
  ['emp-peter', 'ANNUAL', '2026-12-28', '2026-12-31', 'FULL', 'PENDING', 'Két ünnep között'],
  ['emp-piri', 'CHILD_SICK_LEAVE', '2026-12-15', '2026-12-16', 'FULL', 'APPROVED', null],
  // January 2027
  ['emp-anna', 'FUNERAL', '2027-01-05', '2027-01-06', 'FULL', 'PENDING', null],
  ['emp-peter', 'ANNUAL', '2027-01-11', '2027-01-15', 'FULL', 'APPROVED', 'Síelés'],
  ['emp-piri', 'SICK_LEAVE', '2027-01-18', '2027-01-20', 'FULL', 'APPROVED', null],
  ['emp-katalin', 'UNPAID', '2027-01-25', '2027-01-26', 'FULL', 'PENDING', null],
  ['emp-anna', 'ANNUAL', '2027-01-27', '2027-01-27', 'PM', 'APPROVED', null],
]

export const DEMO_LEAVE_REQUESTS: readonly LeaveRequest[] = ROWS.map(
  ([employeeId, leaveTypeCode, startDate, endDate, dayPortion, status, comment], i) => {
    const { entity, approver } = EMP[employeeId]
    // UNPAID is decided by HR Admin (emp-piri); never by the requester.
    const approverId =
      leaveTypeCode === 'UNPAID' && employeeId !== 'emp-piri' ? 'emp-piri' : approver
    const decidedAt = `${startDate.slice(0, 8)}01T09:00:00Z`
    const decided = status === 'APPROVED' || status === 'REJECTED' || status === 'CANCELLED'
    return {
      id: `req-${String(100 + i).padStart(4, '0')}`,
      employeeId,
      legalEntityId: entity,
      approverId,
      leaveTypeCode,
      startDate,
      endDate,
      dayPortion,
      status,
      employeeComment: comment,
      submittedAt: `${startDate.slice(0, 8)}01T08:00:00Z`,
      approval: decided
        ? {
            decision: status === 'REJECTED' ? 'REJECTED' : 'APPROVED',
            decidedBy: approverId,
            onBehalfOf: null,
            decidedAt,
            comment: status === 'REJECTED' ? 'Projektzárás' : 'Jóváhagyva',
          }
        : null,
      cancellation:
        status === 'CANCELLED'
          ? { kind: 'CANCELLED', cancelledBy: employeeId, cancelledAt: decidedAt, reason: 'Mégsem kell' }
          : null,
    } as LeaveRequest
  },
)
