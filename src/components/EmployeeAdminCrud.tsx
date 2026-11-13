import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createEmployeeApiClient,
  TeamApiError,
  type EmployeeApiClientOptions,
} from '../api'
import {
  canManageEmployees,
  LEGAL_ENTITIES,
  LegalEntityEnum,
  validateEmployee,
  type Employee,
  type LegalEntityId,
  type Role,
} from '../domain'
import {
  employeeAdminText,
  formatDate,
  legalEntityLabel,
  roleLabel,
  teamAdminText,
} from '../i18n/hu'

export interface EmployeeAdminCrudProps {
  activeRole: Role
  onRequestRoleChange?: (role: Role) => void
  apiClientOptions?: EmployeeApiClientOptions
}

export function EmployeeAdminCrud({
  activeRole,
  onRequestRoleChange,
  apiClientOptions,
}: EmployeeAdminCrudProps) {
  const isAuthorized = canManageEmployees(activeRole)

  const apiClient = useMemo(
    () =>
      createEmployeeApiClient({
        ...apiClientOptions,
        getActorRole: () => activeRole,
      }),
    [activeRole, apiClientOptions],
  )

  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [entityFilter, setEntityFilter] = useState<'' | LegalEntityId>('')
  const [managerFilter, setManagerFilter] = useState<string>('')

  // Form state (used for both Create and Edit)
  const [editingId, setEditingId] = useState<string | null>(null)
  // The create form is hidden by default; opened by the "new" button or by editing.
  const [formOpen, setFormOpen] = useState<boolean>(false)
  const showForm = formOpen || editingId !== null
  const [empId, setEmpId] = useState<string>('')
  const [displayName, setDisplayName] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [legalEntityId, setLegalEntityId] = useState<LegalEntityId>(
    LegalEntityEnum.VIRGO_KFT,
  )
  const [managerId, setManagerId] = useState<string>('')
  const [hasManagerRole, setHasManagerRole] = useState<boolean>(false)
  const [hasHrAdminRole, setHasHrAdminRole] = useState<boolean>(false)
  const [birthDate, setBirthDate] = useState<string>('1990-01-15')
  const [employmentStart, setEmploymentStart] = useState<string>('2024-01-01')
  const [employmentEnd, setEmploymentEnd] = useState<string>('')
  const [includeInPayrollExport, setIncludeInPayrollExport] =
    useState<boolean>(true)
  const [deputiesInput, setDeputiesInput] = useState<string>('')
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState<boolean>(false)

  const loadEmployees = useCallback(
    async (entity: '' | LegalEntityId, mgr: string) => {
      if (!isAuthorized) {
        setEmployees([])
        return
      }
      setLoading(true)
      setError(null)
      try {
        const data = await apiClient.listEmployees({
          legalEntityId: entity || undefined,
          managerId: mgr.trim() || undefined,
        })
        setEmployees(data)
      } catch (err) {
        if (err instanceof TeamApiError) {
          setError(`${err.message}: ${err.details.join(' ')}`)
        } else {
          setError(employeeAdminText.loadError)
        }
      } finally {
        setLoading(false)
      }
    },
    [apiClient, isAuthorized],
  )

  useEffect(() => {
    void loadEmployees(entityFilter, managerFilter)
  }, [loadEmployees, entityFilter, managerFilter])

  function resetForm() {
    setEditingId(null)
    setFormOpen(false)
    setEmpId('')
    setDisplayName('')
    setEmail('')
    setLegalEntityId(LegalEntityEnum.VIRGO_KFT)
    setManagerId('')
    setHasManagerRole(false)
    setHasHrAdminRole(false)
    setBirthDate('1990-01-15')
    setEmploymentStart('2024-01-01')
    setEmploymentEnd('')
    setIncludeInPayrollExport(true)
    setDeputiesInput('')
    setFormErrors([])
  }

  function startEditing(emp: Employee) {
    setEditingId(emp.id)
    setEmpId(emp.id)
    setDisplayName(emp.displayName)
    setEmail(emp.email)
    setLegalEntityId(emp.legalEntityId)
    setManagerId(emp.managerId ?? '')
    setHasManagerRole(emp.roles.includes('MANAGER'))
    setHasHrAdminRole(emp.roles.includes('HR_ADMIN'))
    setBirthDate(emp.birthDate)
    setEmploymentStart(emp.employmentStart)
    setEmploymentEnd(emp.employmentEnd ?? '')
    setIncludeInPayrollExport(emp.includeInPayrollExport)
    setDeputiesInput(emp.deputyIds.join(', '))
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

    const roles: Role[] = ['EMPLOYEE']
    if (hasManagerRole) roles.push('MANAGER')
    if (hasHrAdminRole) roles.push('HR_ADMIN')

    const deputyIds = deputiesInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    const targetId = editingId ?? empId.trim()
    const payload = {
      id: targetId,
      displayName: displayName.trim(),
      email: email.trim(),
      legalEntityId,
      managerId: managerId.trim() ? managerId.trim() : null,
      roles,
      birthDate: birthDate.trim(),
      employmentStart: employmentStart.trim(),
      employmentEnd: employmentEnd.trim() ? employmentEnd.trim() : null,
      includeInPayrollExport,
      deputyIds,
    }

    const validation = validateEmployee(payload)
    if (!validation.valid) {
      setFormErrors(validation.errors)
      return
    }

    setSubmitting(true)
    try {
      if (editingId) {
        await apiClient.updateEmployee(editingId, payload)
      } else {
        await apiClient.createEmployee(payload)
      }
      resetForm()
      await loadEmployees(entityFilter, managerFilter)
    } catch (err) {
      if (err instanceof TeamApiError) {
        setFormErrors(err.details.length > 0 ? err.details : [err.message])
      } else {
        setFormErrors([employeeAdminText.saveError])
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setSubmitting(true)
    setError(null)
    try {
      await apiClient.deleteEmployee(id)
      if (editingId === id) {
        resetForm()
      }
      await loadEmployees(entityFilter, managerFilter)
    } catch (err) {
      if (err instanceof TeamApiError) {
        setError(`${err.message}: ${err.details.join(' ')}`)
      } else {
        setError(employeeAdminText.deleteError)
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
              ? employeeAdminText.editTitle(editingId)
              : employeeAdminText.createTitle}
          </h2>
          <p className="card-subtitle">{employeeAdminText.createSubtitle}</p>

          <form onSubmit={(e) => void handleSubmit(e)} className="crud-form">
            <label className="form-field">
              <span>{employeeAdminText.idLabel}</span>
              <input
                type="text"
                placeholder={employeeAdminText.idPlaceholder}
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                disabled={submitting || editingId !== null}
              />
            </label>

            <label className="form-field">
              <span>{employeeAdminText.displayNameLabel}</span>
              <input
                type="text"
                placeholder={employeeAdminText.displayNamePlaceholder}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={submitting}
              />
            </label>

            <label className="form-field">
              <span>{employeeAdminText.emailLabel}</span>
              <input
                type="email"
                placeholder={employeeAdminText.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </label>

            <label className="form-field">
              <span>{employeeAdminText.legalEntityLabel}</span>
              <select
                value={legalEntityId}
                onChange={(e) =>
                  setLegalEntityId(e.target.value as LegalEntityId)
                }
                disabled={submitting}
              >
                {LEGAL_ENTITIES.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>{employeeAdminText.managerIdLabel}</span>
              <input
                type="text"
                placeholder={employeeAdminText.managerIdPlaceholder}
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                disabled={submitting}
              />
            </label>

            <div className="form-field">
              <span>{employeeAdminText.rolesLabel}</span>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input type="checkbox" checked disabled />
                  <span>{roleLabel.EMPLOYEE} (EMPLOYEE)</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={hasManagerRole}
                    onChange={(e) => setHasManagerRole(e.target.checked)}
                    disabled={submitting}
                  />
                  <span>{roleLabel.MANAGER} (MANAGER)</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={hasHrAdminRole}
                    onChange={(e) => setHasHrAdminRole(e.target.checked)}
                    disabled={submitting}
                  />
                  <span>{roleLabel.HR_ADMIN} (HR_ADMIN)</span>
                </label>
              </div>
            </div>

            <div className="form-row-2">
              <label className="form-field">
                <span>{employeeAdminText.birthDateLabel}</span>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  disabled={submitting}
                />
              </label>

              <label className="form-field">
                <span>{employeeAdminText.employmentStartLabel}</span>
                <input
                  type="date"
                  value={employmentStart}
                  onChange={(e) => setEmploymentStart(e.target.value)}
                  disabled={submitting}
                />
              </label>
            </div>

            <label className="form-field">
              <span>{employeeAdminText.employmentEndLabel}</span>
              <input
                type="date"
                value={employmentEnd}
                onChange={(e) => setEmploymentEnd(e.target.value)}
                disabled={submitting}
              />
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={includeInPayrollExport}
                onChange={(e) => setIncludeInPayrollExport(e.target.checked)}
                disabled={submitting}
              />
              <span>Bérszámfejtésbe exportálandó</span>
            </label>

            <label className="form-field">
              <span>{employeeAdminText.deputyIdsLabel}</span>
              <input
                type="text"
                placeholder={employeeAdminText.deputyIdsPlaceholder}
                value={deputiesInput}
                onChange={(e) => setDeputiesInput(e.target.value)}
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
                  ? employeeAdminText.saveButton
                  : employeeAdminText.createButton}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
                disabled={submitting}
              >
                {employeeAdminText.cancelButton}
              </button>
            </div>
          </form>
        </div>
        )}

        {/* Employee Table Card */}
        <div className="card">
          <div className="card-header-row">
            <div>
              <h2 className="card-title">{employeeAdminText.listTitle}</h2>
              <p className="card-subtitle">
                <strong>
                  {employeeAdminText.totalCount(employees.length)}
                </strong>
              </p>
            </div>

            <div className="filter-bar">
              {!showForm && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setFormOpen(true)}
                >
                  {employeeAdminText.newButton}
                </button>
              )}
              <select
                value={entityFilter}
                onChange={(e) =>
                  setEntityFilter(e.target.value as '' | LegalEntityId)
                }
                aria-label={employeeAdminText.legalEntityLabel}
              >
                <option value="">{employeeAdminText.allEntitiesFilter}</option>
                {LEGAL_ENTITIES.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>

              <input
                type="search"
                placeholder={employeeAdminText.filterManagerPlaceholder}
                value={managerFilter}
                onChange={(e) => setManagerFilter(e.target.value)}
                aria-label={employeeAdminText.filterManagerPlaceholder}
              />

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void loadEmployees(entityFilter, managerFilter)}
                disabled={loading}
              >
                {employeeAdminText.refreshButton}
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="empty-state">{employeeAdminText.loading}</div>
          ) : employees.length === 0 ? (
            <div className="empty-state">{employeeAdminText.empty}</div>
          ) : (
            <div className="table-wrapper">
              <table className="crud-table">
                <thead>
                  <tr>
                    <th>{employeeAdminText.colId}</th>
                    <th>{employeeAdminText.colNameAndEmail}</th>
                    <th>{employeeAdminText.colEntity}</th>
                    <th>{employeeAdminText.colManager}</th>
                    <th>{employeeAdminText.colRoles}</th>
                    <th>{employeeAdminText.colDates}</th>
                    <th>{employeeAdminText.colDeputies}</th>
                    <th className="actions-col">
                      {employeeAdminText.colActions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id}>
                      <td className="mono-cell">{emp.id}</td>
                      <td>
                        <div>
                          <strong>{emp.displayName}</strong>
                        </div>
                        <div className="sub-cell">{emp.email}</div>
                      </td>
                      <td>
                        <span className="badge badge-entity">
                          {legalEntityLabel[emp.legalEntityId]}
                        </span>
                      </td>
                      <td className="mono-cell">
                        {emp.managerId ?? (
                          <span className="muted-text">
                            {employeeAdminText.noManager}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="badge-list">
                          {emp.roles.map((r) => (
                            <span key={r} className="badge">
                              {roleLabel[r]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="sub-cell">
                        <div>{formatDate(emp.employmentStart)}</div>
                        <div>Szül.: {formatDate(emp.birthDate)}</div>
                      </td>
                      <td className="mono-cell">
                        {emp.deputyIds.length > 0
                          ? emp.deputyIds.join(', ')
                          : employeeAdminText.noDeputies}
                      </td>
                      <td className="actions-cell">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => startEditing(emp)}
                          disabled={submitting}
                        >
                          {employeeAdminText.editButton}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => void handleDelete(emp.id)}
                          disabled={submitting}
                        >
                          {employeeAdminText.deleteButton}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
