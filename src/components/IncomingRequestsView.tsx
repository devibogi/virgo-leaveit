import { useCallback, useEffect, useMemo, useState } from 'react'
import { createLeaveRequestApiClient, TeamApiError, type LeaveRequestListItem } from '../api'
import { getLeaveType, type Role } from '../domain'
import {
  dayPortionLabel,
  formatDate,
  incomingRequestsText as t,
  leaveCategoryLabel,
  leaveTypeLabel,
  statusLabel,
} from '../i18n/hu'

export interface IncomingRequestsViewProps {
  activeRole: Role
  currentUserId: string
}

const period = (r: LeaveRequestListItem) =>
  r.startDate === r.endDate
    ? formatDate(r.startDate)
    : `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`

/** Approver inbox: pending requests where the signed-in user is approverId, plus decided history. */
export function IncomingRequestsView({ activeRole, currentUserId }: IncomingRequestsViewProps) {
  const api = useMemo(() => createLeaveRequestApiClient(), [])
  const [rows, setRows] = useState<LeaveRequestListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await api.listRequests({ scope: 'incoming' }))
    } catch (err) {
      setError(err instanceof TeamApiError ? `${err.message}: ${err.details.join(' ')}` : t.loadError)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load, activeRole, currentUserId])

  async function decide(id: string, decision: 'APPROVED' | 'REJECTED') {
    let comment: string | null = null
    if (decision === 'REJECTED') {
      const answer = window.prompt(t.rejectReasonPrompt)
      if (answer === null) return
      comment = answer.trim() || null
    }
    setBusyId(id)
    setError(null)
    try {
      await api.decideRequest(id, { decision, comment })
      await load()
    } catch (err) {
      setError(err instanceof TeamApiError ? err.details.join(' ') : t.decideError)
    } finally {
      setBusyId(null)
    }
  }

  const pending = rows
    .filter((r) => r.status === 'PENDING')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  const history = rows
    .filter((r) => r.status !== 'PENDING')
    .sort((a, b) => (b.approval?.decidedAt ?? b.submittedAt).localeCompare(a.approval?.decidedAt ?? a.submittedAt))

  const typeCell = (r: LeaveRequestListItem) => (
    <td>
      {/* Managers see only the category (Szabadság/Beteg), never the exact type; HR sees the type. */}
      <div>
        {activeRole === 'HR_ADMIN'
          ? leaveTypeLabel[r.leaveTypeCode]
          : leaveCategoryLabel[getLeaveType(r.leaveTypeCode).category]}
      </div>
      <div className="sub-cell">{dayPortionLabel[r.dayPortion]}</div>
    </td>
  )

  return (
    <section className="admin-container">
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <div className="card">
        <h2 className="card-title">
          {t.pendingTitle} ({pending.length})
        </h2>
        {loading && rows.length === 0 ? (
          <div className="empty-state">{t.loading}</div>
        ) : pending.length === 0 ? (
          <div className="empty-state">{t.emptyPending}</div>
        ) : (
          <div className="table-wrapper">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>{t.colEmployee}</th>
                  <th>{t.colType}</th>
                  <th>{t.colDates}</th>
                  <th>{t.colComment}</th>
                  <th>{t.colSubmitted}</th>
                  <th>{t.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.employeeName ?? '—'}</strong>
                    </td>
                    {typeCell(r)}
                    <td>{period(r)}</td>
                    <td>{r.employeeComment || '—'}</td>
                    <td>{formatDate(r.submittedAt.slice(0, 10))}</td>
                    <td>
                      <div className="actions-cell">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busyId === r.id}
                          onClick={() => void decide(r.id, 'APPROVED')}
                        >
                          {t.approveButton}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={busyId === r.id}
                          onClick={() => void decide(r.id, 'REJECTED')}
                        >
                          {t.rejectButton}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">{t.historyTitle}</h2>
        {history.length === 0 ? (
          <div className="empty-state">{t.emptyHistory}</div>
        ) : (
          <div className="table-wrapper">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>{t.colEmployee}</th>
                  <th>{t.colType}</th>
                  <th>{t.colDates}</th>
                  <th>{t.colStatus}</th>
                  <th>{t.colComment}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id}>
                    <td>{r.employeeName ?? '—'}</td>
                    {typeCell(r)}
                    <td>{period(r)}</td>
                    <td>
                      <span className="badge">{statusLabel[r.status]}</span>
                    </td>
                    <td>{r.approval?.comment || r.cancellation?.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
