import { DEMO_LEAVE_REQUESTS } from '../data/demoLeaveRequests.ts'
import {
  createLeaveRequest,
  mapLeaveRequestToRow,
  mapRowToLeaveRequest,
  revokeLeaveRequestByHr,
  type CreateLeaveRequestInput,
  type LeaveRequest,
  type LeaveRequestRow,
  type LeaveTypeCode,
  type LegalEntityId,
  type RequestStatus,
} from '../domain/leaveRequest.ts'
import type { SqlExecutor } from './teamRepository.ts'

export interface LeaveRequestFilter {
  employeeId?: string
  legalEntityId?: LegalEntityId
  status?: RequestStatus
  leaveTypeCode?: LeaveTypeCode
}

export interface LeaveRequestRepository {
  findAll(filter?: LeaveRequestFilter): Promise<LeaveRequest[]>
  findById(id: string): Promise<LeaveRequest | null>
  create(input: CreateLeaveRequestInput): Promise<LeaveRequest>
  update(
    id: string,
    update: Omit<CreateLeaveRequestInput, 'id'>,
  ): Promise<LeaveRequest | null>
  revoke(
    id: string,
    hrActorId: string,
    reason: string,
  ): Promise<LeaveRequest | null>
  /** Persists an already-decided request (status + approval) produced by decideLeaveRequest. */
  saveDecision(decided: LeaveRequest): Promise<LeaveRequest | null>
}

export const SYNTHETIC_SEED_REQUESTS: readonly LeaveRequest[] = [
  {
    id: 'req-0001',
    employeeId: 'emp-peter',
    legalEntityId: 'VIRGO_KFT',
    approverId: 'emp-katalin',
    leaveTypeCode: 'ANNUAL',
    startDate: '2026-06-15',
    endDate: '2026-06-19',
    dayPortion: 'FULL',
    status: 'APPROVED',
    employeeComment: 'Családi nyaralás',
    submittedAt: '2026-06-01T08:30:00Z',
    approval: {
      decision: 'APPROVED',
      decidedBy: 'emp-katalin',
      onBehalfOf: null,
      decidedAt: '2026-06-02T10:15:00Z',
      comment: 'Jóváhagyva',
    },
    cancellation: null,
  },
  {
    id: 'req-0002',
    employeeId: 'emp-anna',
    legalEntityId: 'VIRGO_ZRT',
    approverId: 'emp-katalin',
    leaveTypeCode: 'ANNUAL',
    startDate: '2026-07-03',
    endDate: '2026-07-03',
    dayPortion: 'AM',
    status: 'PENDING',
    employeeComment: 'Hivatali ügyintézés délelőtt',
    submittedAt: '2026-06-25T14:00:00Z',
    approval: null,
    cancellation: null,
  },
  {
    id: 'req-0003',
    employeeId: 'emp-katalin',
    legalEntityId: 'VIRGO_KFT',
    approverId: 'emp-piri',
    leaveTypeCode: 'ANNUAL',
    startDate: '2026-05-04',
    endDate: '2026-05-05',
    dayPortion: 'FULL',
    status: 'REVOKED',
    employeeComment: 'Költözés',
    submittedAt: '2026-04-20T09:00:00Z',
    approval: {
      decision: 'APPROVED',
      decidedBy: 'emp-piri',
      onBehalfOf: null,
      decidedAt: '2026-04-21T11:00:00Z',
      comment: 'Rendben',
    },
    cancellation: {
      kind: 'REVOKED',
      cancelledBy: 'emp-piri',
      cancelledAt: '2026-04-28T16:00:00Z',
      reason: 'Időpont módosulás miatt HR által visszavonva',
    },
  },
  ...DEMO_LEAVE_REQUESTS,
]

export class InMemoryLeaveRequestRepository implements LeaveRequestRepository {
  private readonly store = new Map<string, LeaveRequestRow>()

  constructor(initialRequests: readonly LeaveRequest[] = SYNTHETIC_SEED_REQUESTS) {
    for (const req of initialRequests) {
      const row = mapLeaveRequestToRow(req)
      this.store.set(row.id, row)
    }
  }

  async findAll(filter?: LeaveRequestFilter): Promise<LeaveRequest[]> {
    let rows = Array.from(this.store.values())
    if (filter?.employeeId) {
      rows = rows.filter((r) =>
        r.employee_id.toLowerCase().includes(filter.employeeId!.toLowerCase()),
      )
    }
    if (filter?.legalEntityId) {
      rows = rows.filter((r) => r.legal_entity_id === filter.legalEntityId)
    }
    if (filter?.status) {
      rows = rows.filter((r) => r.status === filter.status)
    }
    if (filter?.leaveTypeCode) {
      rows = rows.filter((r) => r.leave_type_code === filter.leaveTypeCode)
    }
    return rows.map(mapRowToLeaveRequest)
  }

  async findById(id: string): Promise<LeaveRequest | null> {
    const row = this.store.get(id)
    return row ? mapRowToLeaveRequest(row) : null
  }

  async create(input: CreateLeaveRequestInput): Promise<LeaveRequest> {
    const validated = createLeaveRequest(input)
    if (this.store.has(validated.id)) {
      throw new DuplicateLeaveRequestError(validated.id)
    }
    const row = mapLeaveRequestToRow(validated)
    this.store.set(row.id, row)
    return mapRowToLeaveRequest(row)
  }

  async update(
    id: string,
    update: Omit<CreateLeaveRequestInput, 'id'>,
  ): Promise<LeaveRequest | null> {
    if (!this.store.has(id)) {
      return null
    }
    const validated = createLeaveRequest({
      ...update,
      id,
    })
    const row = mapLeaveRequestToRow(validated)
    this.store.set(id, row)
    return mapRowToLeaveRequest(row)
  }

  async revoke(
    id: string,
    hrActorId: string,
    reason: string,
  ): Promise<LeaveRequest | null> {
    const existing = await this.findById(id)
    if (!existing) {
      return null
    }
    const revoked = revokeLeaveRequestByHr(existing, hrActorId, reason)
    const row = mapLeaveRequestToRow(revoked)
    this.store.set(id, row)
    return mapRowToLeaveRequest(row)
  }

  async saveDecision(decided: LeaveRequest): Promise<LeaveRequest | null> {
    if (!this.store.has(decided.id)) return null
    const row = mapLeaveRequestToRow(decided)
    this.store.set(decided.id, row)
    return mapRowToLeaveRequest(row)
  }
}

export class MariaDbLeaveRequestRepository implements LeaveRequestRepository {
  private readonly db: SqlExecutor

  constructor(db: SqlExecutor) {
    this.db = db
  }

  async findAll(filter?: LeaveRequestFilter): Promise<LeaveRequest[]> {
    const clauses: string[] = []
    const params: unknown[] = []

    if (filter?.employeeId) {
      clauses.push('employee_id = ?')
      params.push(filter.employeeId)
    }
    if (filter?.legalEntityId) {
      clauses.push('legal_entity_id = ?')
      params.push(filter.legalEntityId)
    }
    if (filter?.status) {
      clauses.push('status = ?')
      params.push(filter.status)
    }
    if (filter?.leaveTypeCode) {
      clauses.push('leave_type_code = ?')
      params.push(filter.leaveTypeCode)
    }

    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : ''
    const rows = await this.db.query<LeaveRequestRow>(
      `SELECT id, employee_id, legal_entity_id, approver_id, leave_type_code, start_date, end_date, day_portion, status, employee_comment, submitted_at, decision, decided_by, on_behalf_of, decided_at, decision_comment, cancellation_kind, cancelled_by, cancelled_at, cancellation_reason FROM leave_request${where} ORDER BY start_date DESC`,
      params,
    )
    return rows.map(mapRowToLeaveRequest)
  }

  async findById(id: string): Promise<LeaveRequest | null> {
    const rows = await this.db.query<LeaveRequestRow>(
      'SELECT id, employee_id, legal_entity_id, approver_id, leave_type_code, start_date, end_date, day_portion, status, employee_comment, submitted_at, decision, decided_by, on_behalf_of, decided_at, decision_comment, cancellation_kind, cancelled_by, cancelled_at, cancellation_reason FROM leave_request WHERE id = ? LIMIT 1',
      [id],
    )
    return rows[0] ? mapRowToLeaveRequest(rows[0]) : null
  }

  async create(input: CreateLeaveRequestInput): Promise<LeaveRequest> {
    const validated = createLeaveRequest(input)
    const existing = await this.findById(validated.id)
    if (existing) {
      throw new DuplicateLeaveRequestError(validated.id)
    }
    const row = mapLeaveRequestToRow(validated)
    await this.db.execute(
      `INSERT INTO leave_request (
        id, employee_id, legal_entity_id, approver_id, leave_type_code,
        start_date, end_date, day_portion, status, employee_comment, submitted_at,
        decision, decided_by, on_behalf_of, decided_at, decision_comment,
        cancellation_kind, cancelled_by, cancelled_at, cancellation_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.employee_id,
        row.legal_entity_id,
        row.approver_id,
        row.leave_type_code,
        row.start_date,
        row.end_date,
        row.day_portion,
        row.status,
        row.employee_comment,
        row.submitted_at,
        row.decision,
        row.decided_by,
        row.on_behalf_of,
        row.decided_at,
        row.decision_comment,
        row.cancellation_kind,
        row.cancelled_by,
        row.cancelled_at,
        row.cancellation_reason,
      ],
    )
    return validated
  }

  async update(
    id: string,
    update: Omit<CreateLeaveRequestInput, 'id'>,
  ): Promise<LeaveRequest | null> {
    const validated = createLeaveRequest({
      ...update,
      id,
    })
    const row = mapLeaveRequestToRow(validated)
    const result = await this.db.execute(
      `UPDATE leave_request SET
        employee_id = ?, legal_entity_id = ?, approver_id = ?, leave_type_code = ?,
        start_date = ?, end_date = ?, day_portion = ?, status = ?, employee_comment = ?,
        decision = ?, decided_by = ?, on_behalf_of = ?, decided_at = ?, decision_comment = ?,
        cancellation_kind = ?, cancelled_by = ?, cancelled_at = ?, cancellation_reason = ?
      WHERE id = ?`,
      [
        row.employee_id,
        row.legal_entity_id,
        row.approver_id,
        row.leave_type_code,
        row.start_date,
        row.end_date,
        row.day_portion,
        row.status,
        row.employee_comment,
        row.decision,
        row.decided_by,
        row.on_behalf_of,
        row.decided_at,
        row.decision_comment,
        row.cancellation_kind,
        row.cancelled_by,
        row.cancelled_at,
        row.cancellation_reason,
        row.id,
      ],
    )
    if (result.affectedRows === 0) {
      return null
    }
    return validated
  }

  /**
   * Per CLAUDE.md and DATA_MODEL.md: never hard-delete leave requests;
   * preserve revoked/cancelled requests in history.
   */
  async revoke(
    id: string,
    hrActorId: string,
    reason: string,
  ): Promise<LeaveRequest | null> {
    const existing = await this.findById(id)
    if (!existing) {
      return null
    }
    const revoked = revokeLeaveRequestByHr(existing, hrActorId, reason)
    return this.update(id, revoked)
  }

  async saveDecision(decided: LeaveRequest): Promise<LeaveRequest | null> {
    return this.update(decided.id, decided)
  }
}

export class DuplicateLeaveRequestError extends Error {
  readonly requestId: string

  constructor(requestId: string) {
    super(`A(z) '${requestId}' azonosítójú szabadságkérelem már létezik.`)
    this.name = 'DuplicateLeaveRequestError'
    this.requestId = requestId
  }
}
