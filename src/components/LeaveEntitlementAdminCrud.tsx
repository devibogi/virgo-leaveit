import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createLeaveEntitlementApiClient,
  TeamApiError,
  type LeaveEntitlementApiClientOptions,
} from '../api'
import {
  canManageEntitlements,
  ENTITLEMENT_COMPONENTS,
  EntitlementComponentEnum,
  getEffectiveEntitlementDays,
  validateLeaveEntitlement,
  type EntitlementComponent,
  type LeaveEntitlement,
  type Role,
} from '../domain'
import {
  entitlementAdminText,
  entitlementComponentLabel,
  roleLabel,
  teamAdminText,
} from '../i18n/hu'
import { EmployeeSelect, useEmployeeDirectory } from './employeeDirectory'

export interface LeaveEntitlementAdminCrudProps {
  activeRole: Role
  onRequestRoleChange?: (role: Role) => void
  apiClientOptions?: LeaveEntitlementApiClientOptions
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : Number.NaN
}

export function LeaveEntitlementAdminCrud({
  activeRole,
  onRequestRoleChange,
  apiClientOptions,
}: LeaveEntitlementAdminCrudProps) {
  const isAuthorized = canManageEntitlements(activeRole)
  const directory = useEmployeeDirectory(activeRole, isAuthorized)

  const apiClient = useMemo(
    () =>
      createLeaveEntitlementApiClient({
        ...apiClientOptions,
      }),
    [apiClientOptions],
  )

  const [items, setItems] = useState<LeaveEntitlement[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState<string>('')
  const [componentFilter, setComponentFilter] = useState<
    '' | EntitlementComponent
  >('')

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  // The create form is hidden by default; opened by the "new" button or by editing.
  const [formOpen, setFormOpen] = useState<boolean>(false)
  const showForm = formOpen || editingId !== null
  const [entId, setEntId] = useState<string>('')
  const [employeeId, setEmployeeId] = useState<string>('emp-peter')
  const [year, setYear] = useState<string>('2026')
  const [component, setComponent] = useState<EntitlementComponent>(
    EntitlementComponentEnum.BASE,
  )
  const [fullYearDays, setFullYearDays] = useState<string>('20')
  const [calculatedDays, setCalculatedDays] = useState<string>('20')
  const [overrideDays, setOverrideDays] = useState<string>('')
  const [overrideReason, setOverrideReason] = useState<string>('')
  const [payrollRefDays, setPayrollRefDays] = useState<string>('20')
  const [updatedBy, setUpdatedBy] = useState<string>('emp-piri')
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState<boolean>(false)

  const loadEntitlements = useCallback(
    async (empFilter: string, compFilter: '' | EntitlementComponent) => {
      if (!isAuthorized) {
        setItems([])
        return
      }
      setLoading(true)
      setError(null)
      try {
        const data = await apiClient.listEntitlements({
          employeeId: empFilter.trim() || undefined,
          component: compFilter || undefined,
        })
        setItems(data)
      } catch (err) {
        if (err instanceof TeamApiError) {
          setError(`${err.message}: ${err.details.join(' ')}`)
        } else {
          setError(entitlementAdminText.loadError)
        }
      } finally {
        setLoading(false)
      }
    },
    [apiClient, isAuthorized],
  )

  useEffect(() => {
    void loadEntitlements(employeeFilter, componentFilter)
  }, [loadEntitlements, employeeFilter, componentFilter])

  function resetForm() {
    setEditingId(null)
    setFormOpen(false)
    setEntId('')
    setEmployeeId('emp-peter')
    setYear('2026')
    setComponent(EntitlementComponentEnum.BASE)
    setFullYearDays('20')
    setCalculatedDays('20')
    setOverrideDays('')
    setOverrideReason('')
    setPayrollRefDays('20')
    setUpdatedBy('emp-piri')
    setFormErrors([])
  }

  function startEditing(item: LeaveEntitlement) {
    setEditingId(item.id)
    setEntId(item.id)
    setEmployeeId(item.employeeId)
    setYear(String(item.year))
    setComponent(item.component)
    setFullYearDays(item.fullYearDays !== null ? String(item.fullYearDays) : '')
    setCalculatedDays(
      item.calculatedDays !== null ? String(item.calculatedDays) : '',
    )
    setOverrideDays(item.overrideDays !== null ? String(item.overrideDays) : '')
    setOverrideReason(item.overrideReason ?? '')
    setPayrollRefDays(
      item.payrollReferenceDays !== null
        ? String(item.payrollReferenceDays)
        : '',
    )
    setUpdatedBy(item.updatedBy)
    setFormErrors([])
  }

  if (!isAuthorized) {
    return (
      <section className="admin-container">
        <div className="card access-denied-card" role="alert">
          <div className="access-denied-badge">403 · HR_ADMIN</div>
          <h2 className="card-title">{teamAdminText.accessDeniedTitle}</h2>
          <p className="card-subtitle">
            {teamAdminText.accessDeniedBody} (Jelenlegi szerepkör:{' '}
            <strong>
              {roleLabel[activeRole]} [{activeRole}]
            </strong>
            )
          </p>
          {onRequestRoleChange && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onRequestRoleChange('HR_ADMIN')}
            >
              {teamAdminText.switchToHrAdmin}
            </button>
          )}
        </div>
      </section>
    )
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormErrors([])

    const targetId =
      editingId ??
      (entId.trim() || `ent-${employeeId}-${year}-${component}`.toLowerCase())
    const payload = {
      id: targetId,
      employeeId: employeeId.trim(),
      year: Number(year),
      component,
      fullYearDays: parseOptionalNumber(fullYearDays),
      calculatedDays: parseOptionalNumber(calculatedDays),
      overrideDays: parseOptionalNumber(overrideDays),
      overrideReason: overrideReason.trim() || null,
      payrollReferenceDays: parseOptionalNumber(payrollRefDays),
      updatedBy: updatedBy.trim() || 'emp-piri',
    }

    const validation = validateLeaveEntitlement(payload)
    if (!validation.valid) {
      setFormErrors(validation.errors)
      return
    }

    setSubmitting(true)
    try {
      if (editingId) {
        await apiClient.updateEntitlement(editingId, payload)
      } else {
        await apiClient.createEntitlement(payload)
      }
      resetForm()
      await loadEntitlements(employeeFilter, componentFilter)
    } catch (err) {
      if (err instanceof TeamApiError) {
        setFormErrors(err.details.length > 0 ? err.details : [err.message])
      } else {
        setFormErrors([entitlementAdminText.saveError])
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setSubmitting(true)
    setError(null)
    try {
      await apiClient.deleteEntitlement(id)
      if (editingId === id) {
        resetForm()
      }
      await loadEntitlements(employeeFilter, componentFilter)
    } catch (err) {
      if (err instanceof TeamApiError) {
        setError(`${err.message}: ${err.details.join(' ')}`)
      } else {
        setError(entitlementAdminText.deleteError)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="admin-container">
      <div className={`admin-grid ${showForm ? '' : 'admin-grid-single'}`}>
        {/* Create / Edit Form Card: hidden until "new" or edit */}
        {showForm && (
        <div className="card">
          <h2 className="card-title">
            {editingId
              ? entitlementAdminText.editTitle(directory.nameOf(employeeId))
              : entitlementAdminText.createTitle}
          </h2>
          <p className="card-subtitle">{entitlementAdminText.createSubtitle}</p>

          <form onSubmit={(e) => void handleSubmit(e)} className="crud-form">

            <div className="form-row-2">
              <label className="form-field">
                <span>{entitlementAdminText.employeeIdLabel}</span>
                <EmployeeSelect
                  employees={directory.employees}
                  value={employeeId}
                  onChange={setEmployeeId}
                  emptyLabel="—"
                  disabled={submitting}
                />
              </label>

              <label className="form-field">
                <span>{entitlementAdminText.yearLabel}</span>
                <input
                  type="text"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  disabled={submitting}
                />
              </label>
            </div>

            <label className="form-field">
              <span>{entitlementAdminText.componentLabel}</span>
              <select
                value={component}
                onChange={(e) =>
                  setComponent(e.target.value as EntitlementComponent)
                }
                disabled={submitting}
              >
                {ENTITLEMENT_COMPONENTS.map((comp) => (
                  <option key={comp} value={comp}>
                    {entitlementComponentLabel[comp]}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-row-2">
              <label className="form-field">
                <span>{entitlementAdminText.fullYearDaysLabel}</span>
                <input
                  type="text"
                  placeholder="pl. 20"
                  value={fullYearDays}
                  onChange={(e) => setFullYearDays(e.target.value)}
                  disabled={submitting}
                />
              </label>

              <label className="form-field">
                <span>{entitlementAdminText.calculatedDaysLabel}</span>
                <input
                  type="text"
                  placeholder="pl. 20"
                  value={calculatedDays}
                  onChange={(e) => setCalculatedDays(e.target.value)}
                  disabled={submitting}
                />
              </label>
            </div>

            <div className="form-row-2">
              <label className="form-field">
                <span>{entitlementAdminText.overrideDaysLabel}</span>
                <input
                  type="text"
                  placeholder="pl. 4"
                  value={overrideDays}
                  onChange={(e) => setOverrideDays(e.target.value)}
                  disabled={submitting}
                />
              </label>

              <label className="form-field">
                <span>{entitlementAdminText.payrollRefLabel}</span>
                <input
                  type="text"
                  placeholder="pl. 20"
                  value={payrollRefDays}
                  onChange={(e) => setPayrollRefDays(e.target.value)}
                  disabled={submitting}
                />
              </label>
            </div>

            <label className="form-field">
              <span>{entitlementAdminText.overrideReasonLabel}</span>
              <input
                type="text"
                placeholder={entitlementAdminText.overrideReasonPlaceholder}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                disabled={submitting}
              />
            </label>

            <label className="form-field">
              <span>{entitlementAdminText.updatedByLabel}</span>
              <EmployeeSelect
                employees={directory.employees}
                value={updatedBy}
                onChange={setUpdatedBy}
                emptyLabel="—"
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
                  ? entitlementAdminText.saveButton
                  : entitlementAdminText.createButton}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
                disabled={submitting}
              >
                {entitlementAdminText.cancelButton}
              </button>
            </div>
          </form>
        </div>
        )}

        {/* Table Card */}
        <div className="card">
          <div className="card-header-row">
            <div>
              <h2 className="card-title">{entitlementAdminText.listTitle}</h2>
              <p className="card-subtitle">
                <strong>{entitlementAdminText.totalCount(items.length)}</strong>
              </p>
            </div>

            <div className="filter-bar">
              {!showForm && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setFormOpen(true)}
                >
                  {entitlementAdminText.newButton}
                </button>
              )}
              <select
                value={componentFilter}
                onChange={(e) =>
                  setComponentFilter(
                    e.target.value as '' | EntitlementComponent,
                  )
                }
                aria-label={entitlementAdminText.componentLabel}
              >
                <option value="">
                  {entitlementAdminText.allComponentsFilter}
                </option>
                {ENTITLEMENT_COMPONENTS.map((comp) => (
                  <option key={comp} value={comp}>
                    {entitlementComponentLabel[comp]}
                  </option>
                ))}
              </select>

              <EmployeeSelect
                employees={directory.employees}
                value={employeeFilter}
                onChange={setEmployeeFilter}
                emptyLabel={entitlementAdminText.filterEmployeePlaceholder}
                ariaLabel={entitlementAdminText.filterEmployeePlaceholder}
              />

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  void loadEntitlements(employeeFilter, componentFilter)
                }
                disabled={loading}
              >
                {entitlementAdminText.refreshButton}
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="empty-state">{entitlementAdminText.loading}</div>
          ) : items.length === 0 ? (
            <div className="empty-state">{entitlementAdminText.empty}</div>
          ) : (
            <div className="table-wrapper">
              <table className="crud-table">
                <thead>
                  <tr>
                    <th>{entitlementAdminText.colEmployeeYear}</th>
                    <th>{entitlementAdminText.colComponent}</th>
                    <th>{entitlementAdminText.colEffective}</th>
                    <th>{entitlementAdminText.colPayrollRef}</th>
                    <th>{entitlementAdminText.colUsageCache}</th>
                    <th>{entitlementAdminText.colReason}</th>
                    <th className="actions-col">
                      {entitlementAdminText.colActions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const effective = getEffectiveEntitlementDays(item)
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="mono-cell">
                            <strong>{directory.nameOf(item.employeeId)}</strong> · {item.year}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-entity">
                            {entitlementComponentLabel[item.component]}
                          </span>
                        </td>
                        <td>
                          <strong>{effective} nap</strong>
                          <div className="sub-cell">
                            Számított: {item.calculatedDays ?? '—'} · HR:{' '}
                            {item.overrideDays ?? '—'}
                          </div>
                        </td>
                        <td>{item.payrollReferenceDays ?? '—'}</td>
                        <td className="mono-cell">
                          {item.usedQ1} / {item.usedQ2} / {item.usedQ3} /{' '}
                          {item.usedQ4} = <strong>{item.usedYear}</strong>
                        </td>
                        <td className="sub-cell">
                          <div>{item.overrideReason ?? '—'}</div>
                          <div>({directory.nameOf(item.updatedBy)})</div>
                        </td>
                        <td className="actions-cell">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => startEditing(item)}
                            disabled={submitting}
                          >
                            {entitlementAdminText.editButton}
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => void handleDelete(item.id)}
                            disabled={submitting}
                          >
                            {entitlementAdminText.deleteButton}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
