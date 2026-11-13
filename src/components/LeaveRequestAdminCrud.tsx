import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createLeaveRequestApiClient,
  TeamApiError,
  type LeaveRequestApiClientOptions,
  type LeaveRequestListItem,
} from '../api'
import { EmployeeSelect, useEmployeeDirectory } from './employeeDirectory'
import {
  canManageLeaveRequests,
  DAY_PORTIONS,
  isCancellableByEmployee,
  localIsoDate,
  requestedWorkingDays,
  DayPortionEnum,
  LEAVE_TYPE_CODES,
  LeaveTypeCodeEnum,
  LEGAL_ENTITIES,
  REQUEST_STATUSES,
  type DayPortion,
  type LeaveRequest,
  type LeaveTypeCode,
  type LegalEntityId,
  type RequestStatus,
  type Role,
} from '../domain'
import {
  dayPortionLabel,
  formatDate,
  leaveRequestAdminText,
  requestedDaysLabel,
  leaveTypeLabel,
  legalEntityLabel,
  myLeaveRequestText,
  roleLabel,
  statusLabel,
} from '../i18n/hu'
import { LeaveCalendar } from './LeaveCalendar'

export interface LeaveRequestAdminCrudProps {
  activeRole: Role
  onRequestRoleChange?: (role: Role) => void
  apiClientOptions?: LeaveRequestApiClientOptions
  /** Signed-in user; new requests are filed for them (D21: employeeId is automatic). */
  currentUserId: string
  /**
   * MINE: own requests page (every role) — submit form + own read-only list.
   * ALL: HR Admin page for every employee's requests (filter / edit / revoke).
   */
  mode?: 'MINE' | 'ALL'
}

export function LeaveRequestAdminCrud({
  activeRole,
  apiClientOptions,
  currentUserId,
  mode = 'ALL',
}: LeaveRequestAdminCrudProps) {
  const isMine = mode === 'MINE'
  const isAuthorized = isMine || canManageLeaveRequests(activeRole)
  const directory = useEmployeeDirectory(activeRole, !isMine)
  const [showForm, setShowForm] = useState(false)

  const apiClient = useMemo(
    () =>
      createLeaveRequestApiClient({
        ...apiClientOptions,
      }),
    [apiClientOptions],
  )

  const [requests, setRequests] = useState<LeaveRequestListItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState<string>('')
  const [entityFilter, setEntityFilter] = useState<'' | LegalEntityId>('')
  const [statusFilter, setStatusFilter] = useState<'' | RequestStatus>('')

  // Form state
  const [leaveTypeCode, setLeaveTypeCode] = useState<LeaveTypeCode>(
    LeaveTypeCodeEnum.ANNUAL,
  )
  const [startDate, setStartDate] = useState<string>(() => localIsoDate())
  const [endDate, setEndDate] = useState<string>(() => localIsoDate())
  const [dayPortion, setDayPortion] = useState<DayPortion>(DayPortionEnum.FULL)
  const [employeeComment, setEmployeeComment] = useState<string>('')
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState<boolean>(false)

  const loadRequests = useCallback(
    async (
      emp: string,
      entity: '' | LegalEntityId,
      st: '' | RequestStatus,
    ) => {
      if (!isAuthorized) {
        setRequests([])
        return
      }
      setLoading(true)
      setError(null)
      try {
        const data = await apiClient.listRequests({
          employeeId: isMine ? currentUserId : emp.trim() || undefined,
          legalEntityId: entity || undefined,
          status: st || undefined,
        })
        setRequests(
          [...data].sort(
            (a, b) =>
              a.startDate.localeCompare(b.startDate) ||
              a.endDate.localeCompare(b.endDate),
          ),
        )
      } catch (err) {
        if (err instanceof TeamApiError) {
          setError(`${err.message}: ${err.details.join(' ')}`)
        } else {
          setError(leaveRequestAdminText.loadError)
        }
      } finally {
        setLoading(false)
      }
    },
    [apiClient, isAuthorized, isMine, currentUserId],
  )

  useEffect(() => {
    void loadRequests(employeeFilter, entityFilter, statusFilter)
  }, [loadRequests, employeeFilter, entityFilter, statusFilter])

  const formOpen = isMine && showForm
  useEffect(() => {
    if (!formOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resetForm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [formOpen])

  function resetForm() {
    setShowForm(false)
    setLeaveTypeCode(LeaveTypeCodeEnum.ANNUAL)
    setStartDate(localIsoDate())
    setEndDate(localIsoDate())
    setDayPortion(DayPortionEnum.FULL)
    setEmployeeComment('')
    setFormErrors([])
  }




  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormErrors([])

    // id, status, legalEntityId and approverId are generated/derived server-side (D21).
    const draft = {
      leaveTypeCode,
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      dayPortion,
      employeeComment: employeeComment.trim() || null,
    }
    if (!draft.startDate || !draft.endDate) {
      setFormErrors(['A kezdő és záró dátum megadása kötelező.'])
      return
    }

    setSubmitting(true)
    try {
      await apiClient.createRequest({ ...draft, employeeId: currentUserId })
      resetForm()
      await loadRequests(employeeFilter, entityFilter, statusFilter)
    } catch (err) {
      if (err instanceof TeamApiError) {
        setFormErrors(err.details.length > 0 ? err.details : [err.message])
      } else {
        setFormErrors([leaveRequestAdminText.saveError])
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(id: string) {
    if (!window.confirm(myLeaveRequestText.cancelConfirm)) return
    setSubmitting(true)
    setError(null)
    try {
      await apiClient.cancelRequest(id)
      await loadRequests(employeeFilter, entityFilter, statusFilter)
    } catch (err) {
      if (err instanceof TeamApiError) {
        setError(`${err.message}: ${err.details.join(' ')}`)
      } else {
        setError(myLeaveRequestText.cancelError)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevoke(id: string) {
    // Reason is mandatory for REVOKED (BUSINESS_RULES); asked per revoke, not a form field.
    const reason = window.prompt(leaveRequestAdminText.revokeReasonPrompt)?.trim()
    if (!reason) return
    setSubmitting(true)
    setError(null)
    try {
      await apiClient.revokeRequest(id, {
        reason,
        actorId: 'emp-piri',
      })
      await loadRequests(employeeFilter, entityFilter, statusFilter)
    } catch (err) {
      if (err instanceof TeamApiError) {
        setError(`${err.message}: ${err.details.join(' ')}`)
      } else {
        setError(leaveRequestAdminText.revokeError)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const myPending = isMine ? requests.filter((r) => r.status === 'PENDING') : []
  const pendingBox =
    myPending.length > 0 ? (
      <div className="alert alert-info pending-box" role="status">
        <strong>{myLeaveRequestText.pendingTitle} ({myPending.length})</strong>
        <ul>
          {myPending.map((r) => (
            <li key={r.id}>
              {leaveTypeLabel[r.leaveTypeCode]}: {formatDate(r.startDate)}
              {r.endDate !== r.startDate ? ` – ${formatDate(r.endDate)}` : ''}
              {r.dayPortion !== 'FULL' ? ` (${dayPortionLabel[r.dayPortion]})` : ''}
            </li>
          ))}
        </ul>
        <small>{myLeaveRequestText.pendingHint}</small>
      </div>
    ) : null

  return (
    <section className="admin-container">
      <div className="admin-grid admin-grid-single">
        {/* Form modal: own page after "+ Új kérelem"; HR all-requests page only while editing */}
        {formOpen && (
        <div className="modal-backdrop" onClick={() => !submitting && resetForm()}>
        <div
          className="card modal-card"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="card-title">
            {leaveRequestAdminText.createTitle}
          </h2>
          <p className="card-subtitle">
            {leaveRequestAdminText.createSubtitle}
          </p>

          {pendingBox}

          <form onSubmit={(e) => void handleSubmit(e)} className="crud-form">
            <label className="form-field">
                <span>{leaveRequestAdminText.leaveTypeLabel}</span>
                <select
                  value={leaveTypeCode}
                  onChange={(e) =>
                    setLeaveTypeCode(e.target.value as LeaveTypeCode)
                  }
                  disabled={submitting}
                >
                  {LEAVE_TYPE_CODES.map((code) => (
                    <option key={code} value={code}>
                      {leaveTypeLabel[code]}
                    </option>
                  ))}
                </select>
              </label>

            <div className="form-row-2">
              <label className="form-field">
                <span>{leaveRequestAdminText.startDateLabel}</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const next = e.target.value
                    setStartDate(next)
                    // End date may never be earlier than the first day.
                    if (next && endDate < next) setEndDate(next)
                  }}
                  disabled={submitting}
                />
              </label>

              <label className="form-field">
                <span>{leaveRequestAdminText.endDateLabel}</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={submitting}
                />
              </label>
            </div>

            <div className="form-row-2">
              <label className="form-field">
                <span>{leaveRequestAdminText.dayPortionLabel}</span>
                <select
                  value={dayPortion}
                  onChange={(e) => setDayPortion(e.target.value as DayPortion)}
                  disabled={submitting}
                >
                  {DAY_PORTIONS.map((portion) => (
                    <option key={portion} value={portion}>
                      {dayPortionLabel[portion]} ({portion})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="form-field">
              <span>{leaveRequestAdminText.employeeCommentLabel}</span>
              <input
                type="text"
                placeholder={leaveRequestAdminText.employeeCommentPlaceholder}
                value={employeeComment}
                onChange={(e) => setEmployeeComment(e.target.value)}
                disabled={submitting}
              />
            </label>

            {formErrors.length > 0 && (
              <div className="alert alert-error" role="alert">
                {formErrors.map((msg, idx) => (
                  <div key={idx}>{msg}</div>
                ))}
              </div>
            )}

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {leaveRequestAdminText.createButton}
              </button>
              {showForm && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetForm}
                  disabled={submitting}
                >
                  {leaveRequestAdminText.cancelButton}
                </button>
              )}
            </div>
          </form>
        </div>
        </div>
        )}

        {!formOpen && pendingBox}

        {isAuthorized && !error && (
          <LeaveCalendar
            requests={requests}
            showEmployee={!isMine}
            nameOf={(id) => requests.find((r) => r.employeeId === id)?.employeeName ?? '—'}
            actions={
              isMine && !showForm ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
                  {myLeaveRequestText.newButton}
                </button>
              ) : null
            }
          />
        )}

        {/* Table Card: HR admin only (list / edit / revoke) */}
        {isAuthorized ? (
        <div className="card">
          <div className="card-header-row">
            <div>
              <h2 className="card-title">
                {isMine ? myLeaveRequestText.listTitle : leaveRequestAdminText.listTitle}
              </h2>
              <p className="card-subtitle">
                <strong>
                  {leaveRequestAdminText.totalCount(requests.length)}
                </strong>
              </p>
            </div>

            {!isMine && (
            <div className="filter-bar">
              <select
                value={entityFilter}
                onChange={(e) =>
                  setEntityFilter(e.target.value as '' | LegalEntityId)
                }
                aria-label={leaveRequestAdminText.legalEntityLabel}
              >
                <option value="">
                  {leaveRequestAdminText.allEntitiesFilter}
                </option>
                {LEGAL_ENTITIES.map((le) => (
                  <option key={le.id} value={le.id}>
                    {le.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as '' | RequestStatus)
                }
                aria-label={leaveRequestAdminText.statusLabel}
              >
                <option value="">
                  {leaveRequestAdminText.allStatusesFilter}
                </option>
                {REQUEST_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {statusLabel[st]}
                  </option>
                ))}
              </select>

              <EmployeeSelect
                employees={directory.employees}
                value={employeeFilter}
                onChange={setEmployeeFilter}
                emptyLabel={leaveRequestAdminText.filterEmployeePlaceholder}
                ariaLabel={leaveRequestAdminText.filterEmployeePlaceholder}
              />

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  void loadRequests(employeeFilter, entityFilter, statusFilter)
                }
                disabled={loading}
              >
                {leaveRequestAdminText.refreshButton}
              </button>
            </div>
            )}
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="empty-state">{leaveRequestAdminText.loading}</div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              {isMine ? myLeaveRequestText.empty : leaveRequestAdminText.empty}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="crud-table">
                <thead>
                  <tr>
                    {!isMine && <th>{leaveRequestAdminText.colIdAndEmployee}</th>}
                    <th>{leaveRequestAdminText.colTypeAndPortion}</th>
                    <th>{leaveRequestAdminText.colDates}</th>
                    <th>{leaveRequestAdminText.colApprover}</th>
                    <th>{leaveRequestAdminText.colStatus}</th>
                    <th>{leaveRequestAdminText.colDetails}</th>
                    <th className="actions-col">
                      {leaveRequestAdminText.colActions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((item) => (
                    <tr key={item.id}>
                      {!isMine && (
                      <td>
                        <div>
                          <strong>{item.employeeName ?? '—'}</strong>
                        </div>
                        <div className="sub-cell">
                          {legalEntityLabel[item.legalEntityId]}
                        </div>
                      </td>
                      )}
                      <td>
                        <div>
                          <strong>{leaveTypeLabel[item.leaveTypeCode]}</strong>
                        </div>
                        <div className="sub-cell">
                          {dayPortionLabel[item.dayPortion]}
                        </div>
                      </td>
                      <td className="sub-cell">
                        <div>{formatDate(item.startDate)}</div>
                        <div>– {formatDate(item.endDate)}</div>
                        <div>
                          <strong>
                            {requestedDaysLabel(
                              requestedWorkingDays(item.startDate, item.endDate, item.dayPortion),
                            )}
                          </strong>
                        </div>
                      </td>
                      <td>{item.approverName ?? '—'}</td>
                      <td>
                        <span className="badge badge-entity">
                          {statusLabel[item.status]}
                        </span>
                      </td>
                      <td className="sub-cell">
                        <div>{item.employeeComment ?? '—'}</div>
                        {item.cancellation?.reason && (
                          <div>
                            <strong>Visszavonás:</strong>{' '}
                            {item.cancellation.reason}
                          </div>
                        )}
                      </td>
                      {isMine && (
                      <td className="actions-cell">
                        {isCancellableByEmployee(item, localIsoDate()) && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => void handleCancel(item.id)}
                            disabled={submitting}
                          >
                            {myLeaveRequestText.cancelButton}
                          </button>
                        )}
                      </td>
                      )}
                      {!isMine && (
                      <td className="actions-cell">
                        {item.status !== 'REVOKED' && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => void handleRevoke(item.id)}
                            disabled={submitting}
                          >
                            {leaveRequestAdminText.revokeButton}
                          </button>
                        )}
                      </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        ) : (
          <div className="card">
            <p className="card-subtitle">{leaveRequestAdminText.selfServiceNote}</p>
          </div>
        )}
      </div>
    </section>
  )
}
