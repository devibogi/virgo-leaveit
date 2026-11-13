import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createLeaveRequestApiClient,
  TeamApiError,
  type LeaveRequestApiClientOptions,
} from '../api'
import {
  canManageLeaveRequests,
  DAY_PORTIONS,
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
  leaveTypeLabel,
  legalEntityLabel,
  roleLabel,
  statusLabel,
} from '../i18n/hu'

export interface LeaveRequestAdminCrudProps {
  activeRole: Role
  onRequestRoleChange?: (role: Role) => void
  apiClientOptions?: LeaveRequestApiClientOptions
  /** Signed-in user; new requests are filed for them (D21: employeeId is automatic). */
  currentUserId: string
}

export function LeaveRequestAdminCrud({
  activeRole,
  apiClientOptions,
  currentUserId,
}: LeaveRequestAdminCrudProps) {
  const isAuthorized = canManageLeaveRequests(activeRole)

  const apiClient = useMemo(
    () =>
      createLeaveRequestApiClient({
        ...apiClientOptions,
        getActorRole: () => activeRole,
        getActorId: () => currentUserId,
      }),
    [activeRole, apiClientOptions, currentUserId],
  )

  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState<string>('')
  const [entityFilter, setEntityFilter] = useState<'' | LegalEntityId>('')
  const [statusFilter, setStatusFilter] = useState<'' | RequestStatus>('')

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [leaveTypeCode, setLeaveTypeCode] = useState<LeaveTypeCode>(
    LeaveTypeCodeEnum.ANNUAL,
  )
  const [startDate, setStartDate] = useState<string>('2026-08-03')
  const [endDate, setEndDate] = useState<string>('2026-08-07')
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
          employeeId: emp.trim() || undefined,
          legalEntityId: entity || undefined,
          status: st || undefined,
        })
        setRequests(data)
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
    [apiClient, isAuthorized],
  )

  useEffect(() => {
    void loadRequests(employeeFilter, entityFilter, statusFilter)
  }, [loadRequests, employeeFilter, entityFilter, statusFilter])

  function resetForm() {
    setEditingId(null)
    setLeaveTypeCode(LeaveTypeCodeEnum.ANNUAL)
    setStartDate('2026-08-03')
    setEndDate('2026-08-07')
    setDayPortion(DayPortionEnum.FULL)
    setEmployeeComment('')
    setFormErrors([])
  }

  function startEditing(item: LeaveRequest) {
    setEditingId(item.id)
    setLeaveTypeCode(item.leaveTypeCode)
    setStartDate(item.startDate)
    setEndDate(item.endDate)
    setDayPortion(item.dayPortion)
    setEmployeeComment(item.employeeComment ?? '')
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
      if (editingId) {
        await apiClient.updateRequest(editingId, draft)
      } else {
        await apiClient.createRequest({ ...draft, employeeId: currentUserId })
      }
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

  return (
    <section className="admin-container">
      <div className="admin-grid">
        {/* Form Card */}
        <div className="card">
          <h2 className="card-title">
            {editingId
              ? leaveRequestAdminText.editTitle()
              : leaveRequestAdminText.createTitle}
          </h2>
          <p className="card-subtitle">
            {leaveRequestAdminText.createSubtitle}
          </p>

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
                      {leaveTypeLabel[code]} ({code})
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
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={submitting}
                />
              </label>

              <label className="form-field">
                <span>{leaveRequestAdminText.endDateLabel}</span>
                <input
                  type="date"
                  value={endDate}
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
                {editingId
                  ? leaveRequestAdminText.saveButton
                  : leaveRequestAdminText.createButton}
              </button>
              {editingId && (
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

        {/* Table Card: HR admin only (list / edit / revoke) */}
        {isAuthorized ? (
        <div className="card">
          <div className="card-header-row">
            <div>
              <h2 className="card-title">{leaveRequestAdminText.listTitle}</h2>
              <p className="card-subtitle">
                <strong>
                  {leaveRequestAdminText.totalCount(requests.length)}
                </strong>
              </p>
            </div>

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

              <input
                type="search"
                placeholder={leaveRequestAdminText.filterEmployeePlaceholder}
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                aria-label={leaveRequestAdminText.filterEmployeePlaceholder}
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
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="empty-state">{leaveRequestAdminText.loading}</div>
          ) : requests.length === 0 ? (
            <div className="empty-state">{leaveRequestAdminText.empty}</div>
          ) : (
            <div className="table-wrapper">
              <table className="crud-table">
                <thead>
                  <tr>
                    <th>{leaveRequestAdminText.colIdAndEmployee}</th>
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
                      <td>
                        <div className="mono-cell">
                          <strong>{item.employeeId}</strong>
                        </div>
                        <div className="sub-cell">
                          {item.id} · {legalEntityLabel[item.legalEntityId]}
                        </div>
                      </td>
                      <td>
                        <div>
                          <strong>{leaveTypeLabel[item.leaveTypeCode]}</strong>
                        </div>
                        <div className="sub-cell">
                          {dayPortionLabel[item.dayPortion]} ({item.dayPortion})
                        </div>
                      </td>
                      <td className="sub-cell">
                        <div>{formatDate(item.startDate)}</div>
                        <div>– {formatDate(item.endDate)}</div>
                      </td>
                      <td className="mono-cell">{item.approverId}</td>
                      <td>
                        <span className="badge badge-entity">
                          {statusLabel[item.status]} ({item.status})
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
                      <td className="actions-cell">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => startEditing(item)}
                          disabled={submitting}
                        >
                          {leaveRequestAdminText.editButton}
                        </button>
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
