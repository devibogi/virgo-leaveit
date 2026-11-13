import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createEmployeeApiClient,
  createTeamApiClient,
  TeamApiError,
  type TeamApiClientOptions,
} from '../api'
import {
  canManageTeams,
  validateTeam,
  wouldCreateManagementCycle,
  type Employee,
  type Role,
  type Team,
} from '../domain'
import { roleLabel, teamAdminText } from '../i18n/hu'
import { EmployeeSelect } from './employeeDirectory'

export interface TeamAdminCrudProps {
  activeRole: Role
  onRequestRoleChange?: (role: Role) => void
  apiClientOptions?: TeamApiClientOptions
}

export function TeamAdminCrud({
  activeRole,
  onRequestRoleChange,
  apiClientOptions,
}: TeamAdminCrudProps) {
  const isAuthorized = canManageTeams(activeRole)

  const apiClient = useMemo(
    () =>
      createTeamApiClient({
        ...apiClientOptions,
        getActorRole: () => activeRole,
      }),
    [activeRole, apiClientOptions],
  )
  const employeeClient = useMemo(
    () =>
      createEmployeeApiClient({
        fetchFn: apiClientOptions?.fetchFn,
        baseUrl: apiClientOptions?.baseUrl,
        getActorRole: () => activeRole,
      }),
    [activeRole, apiClientOptions],
  )

  // Team membership (team = direct manager): HR can move anyone to another team.
  const [employees, setEmployees] = useState<Employee[]>([])
  const [membershipLoading, setMembershipLoading] = useState<boolean>(false)
  const [membershipMessage, setMembershipMessage] = useState<string | null>(null)
  const [membershipError, setMembershipError] = useState<string | null>(null)

  // Create form is hidden until "+ Új csapat" is clicked.
  const [formOpen, setFormOpen] = useState<boolean>(false)

  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [managerFilter, setManagerFilter] = useState<string>('')

  // Create form state (Team: managerId key + name)
  const [newManagerId, setNewManagerId] = useState<string>('')
  const [newName, setNewName] = useState<string>('')
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState<boolean>(false)

  // Edit state (keyed by managerId; only name is editable since managerId is PK)
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null)
  const [editName, setEditName] = useState<string>('')
  const [editErrors, setEditErrors] = useState<string[]>([])

  const loadTeams = useCallback(
    async (filterValue: string) => {
      if (!isAuthorized) {
        setTeams([])
        return
      }
      setLoading(true)
      setError(null)
      try {
        const trimmedFilter = filterValue.trim()
        const data = await apiClient.listTeams(
          trimmedFilter ? { managerId: trimmedFilter } : undefined,
        )
        setTeams(data)
      } catch (err) {
        if (err instanceof TeamApiError) {
          setError(`${err.message}: ${err.details.join(' ')}`)
        } else {
          setError(teamAdminText.loadError)
        }
      } finally {
        setLoading(false)
      }
    },
    [apiClient, isAuthorized],
  )

  useEffect(() => {
    void loadTeams(managerFilter)
  }, [loadTeams, managerFilter])

  const loadEmployees = useCallback(async () => {
    if (!isAuthorized) {
      setEmployees([])
      return
    }
    setMembershipLoading(true)
    try {
      setEmployees(await employeeClient.listEmployees())
    } catch (err) {
      setMembershipError(
        err instanceof TeamApiError
          ? `${err.message}: ${err.details.join(' ')}`
          : teamAdminText.loadError,
      )
    } finally {
      setMembershipLoading(false)
    }
  }, [employeeClient, isAuthorized])

  useEffect(() => {
    void loadEmployees()
  }, [loadEmployees])

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

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormErrors([])

    const validation = validateTeam({
      managerId: newManagerId,
      name: newName,
    })

    if (!validation.valid) {
      setFormErrors(validation.errors)
      return
    }

    setSubmitting(true)
    try {
      await apiClient.createTeam({
        managerId: newManagerId.trim(),
        name: newName.trim(),
      })
      setNewManagerId('')
      setNewName('')
      setFormOpen(false)
      await loadTeams(managerFilter)
    } catch (err) {
      if (err instanceof TeamApiError) {
        setFormErrors(err.details.length > 0 ? err.details : [err.message])
      } else {
        setFormErrors([teamAdminText.createError])
      }
    } finally {
      setSubmitting(false)
    }
  }

  function startEditing(team: Team) {
    setEditingManagerId(team.managerId)
    setEditName(team.name)
    setEditErrors([])
  }

  function cancelEditing() {
    setEditingManagerId(null)
    setEditName('')
    setEditErrors([])
  }

  async function handleUpdate(managerId: string) {
    setEditErrors([])
    const validation = validateTeam({
      managerId,
      name: editName,
    })

    if (!validation.valid) {
      setEditErrors(validation.errors)
      return
    }

    setSubmitting(true)
    try {
      await apiClient.updateTeam(managerId, {
        name: editName.trim(),
      })
      cancelEditing()
      await loadTeams(managerFilter)
    } catch (err) {
      if (err instanceof TeamApiError) {
        setEditErrors(err.details.length > 0 ? err.details : [err.message])
      } else {
        setEditErrors([teamAdminText.updateError])
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(managerId: string) {
    setSubmitting(true)
    setError(null)
    try {
      await apiClient.deleteTeam(managerId)
      if (editingManagerId === managerId) {
        cancelEditing()
      }
      await loadTeams(managerFilter)
    } catch (err) {
      if (err instanceof TeamApiError) {
        setError(`${err.message}: ${err.details.join(' ')}`)
      } else {
        setError(teamAdminText.deleteError)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleTeamChange(emp: Employee, newManagerId: string) {
    setMembershipMessage(null)
    setMembershipError(null)
    const managerId = newManagerId || null
    if (wouldCreateManagementCycle(employees, emp.id, managerId)) {
      setMembershipError(
        'A vezető-hozzárendelés körkörös vezetési láncot hozna létre.',
      )
      return
    }
    setSubmitting(true)
    try {
      const { id: _id, ...rest } = emp
      void _id
      const updated = await employeeClient.updateEmployee(emp.id, {
        ...rest,
        managerId,
      })
      setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
      setMembershipMessage(teamAdminText.membershipSaved(emp.displayName))
    } catch (err) {
      setMembershipError(
        err instanceof TeamApiError
          ? err.details.join(' ') || err.message
          : teamAdminText.membershipError,
      )
    } finally {
      setSubmitting(false)
    }
  }

  function closeCreateForm() {
    setFormOpen(false)
    setNewManagerId('')
    setNewName('')
    setFormErrors([])
  }

  const teamNameByManager = new Map(teams.map((t) => [t.managerId, t.name]))
  const employeeName = new Map(employees.map((e) => [e.id, e.displayName]))
  const employeesById = new Map(employees.map((e) => [e.id, e]))

  return (
    <section className="admin-container">
      <div className={`admin-grid ${formOpen ? '' : 'admin-grid-single'}`}>
        {/* Create Card: hidden until "+ Új csapat" */}
        {formOpen && (
        <div className="card">
          <h2 className="card-title">{teamAdminText.createTitle}</h2>
          <p className="card-subtitle">{teamAdminText.createSubtitle}</p>

          <form onSubmit={(e) => void handleCreate(e)} className="crud-form">
            <label className="form-field">
              <span>{teamAdminText.managerIdLabel}</span>
              <EmployeeSelect
                employees={employees}
                value={newManagerId}
                onChange={setNewManagerId}
                emptyLabel={teamAdminText.managerIdPlaceholder}
                disabled={submitting}
              />
            </label>

            <label className="form-field">
              <span>{teamAdminText.teamNameLabel}</span>
              <input
                type="text"
                placeholder={teamAdminText.teamNamePlaceholder}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
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

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {teamAdminText.createButton}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeCreateForm}
              disabled={submitting}
            >
              {teamAdminText.cancelButton}
            </button>
          </form>
        </div>
        )}

        {/* List & Edit Card */}
        <div className="card">
          <div className="card-header-row">
            <div>
              <h2 className="card-title">{teamAdminText.listTitle}</h2>
              <p className="card-subtitle">
                <strong>{teamAdminText.totalCount(teams.length)}</strong>
              </p>
            </div>

            <div className="filter-bar">
              {!formOpen && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setFormOpen(true)}
                >
                  {teamAdminText.newButton}
                </button>
              )}
              <EmployeeSelect
                employees={employees.filter((e) => e.roles.includes('MANAGER'))}
                value={managerFilter}
                onChange={setManagerFilter}
                emptyLabel={teamAdminText.filterPlaceholder}
                ariaLabel={teamAdminText.filterPlaceholder}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void loadTeams(managerFilter)}
                disabled={loading}
              >
                {teamAdminText.refreshButton}
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {editErrors.length > 0 && (
            <div className="alert alert-error" role="alert">
              {editErrors.map((msg, idx) => (
                <div key={idx}>{msg}</div>
              ))}
            </div>
          )}

          {loading ? (
            <div className="empty-state">{teamAdminText.loading}</div>
          ) : teams.length === 0 ? (
            <div className="empty-state">{teamAdminText.empty}</div>
          ) : (
            <div className="table-wrapper">
              <table className="crud-table">
                <thead>
                  <tr>
                    <th>{teamAdminText.colManagerId}</th>
                    <th>{teamAdminText.colName}</th>
                    <th>{teamAdminText.colDeputies}</th>
                    <th className="actions-col">{teamAdminText.colActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => {
                    const isEditing = editingManagerId === team.managerId
                    return (
                      <tr key={team.managerId}>
                        <td>{employeeName.get(team.managerId) ?? '—'}</td>
                        <td>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              aria-label={teamAdminText.teamNameLabel}
                            />
                          ) : (
                            <strong>{team.name}</strong>
                          )}
                        </td>
                        <td>
                          {/* Deputies of the team's manager (act for them on their leave days) */}
                          {(employeesById.get(team.managerId)?.deputyIds ?? []).length === 0
                            ? '—'
                            : employeesById
                                .get(team.managerId)!
                                .deputyIds.map((d) => employeeName.get(d) ?? '—')
                                .join(', ')}
                        </td>
                        <td className="actions-cell">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() =>
                                  void handleUpdate(team.managerId)
                                }
                                disabled={submitting}
                              >
                                {teamAdminText.saveButton}
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={cancelEditing}
                                disabled={submitting}
                              >
                                {teamAdminText.cancelButton}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => startEditing(team)}
                                disabled={submitting}
                              >
                                {teamAdminText.editButton}
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() =>
                                  void handleDelete(team.managerId)
                                }
                                disabled={submitting}
                              >
                                {teamAdminText.deleteButton}
                              </button>
                            </>
                          )}
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

      {/* Team membership card */}
      <div className="card">
        <div className="card-header-row">
          <div>
            <h2 className="card-title">{teamAdminText.membershipTitle}</h2>
            <p className="card-subtitle">{teamAdminText.membershipSubtitle}</p>
          </div>
        </div>

        {membershipError && (
          <div className="alert alert-error" role="alert">
            {membershipError}
          </div>
        )}
        {membershipMessage && (
          <div className="alert alert-success" role="status">
            {membershipMessage}
          </div>
        )}

        {membershipLoading ? (
          <div className="empty-state">{teamAdminText.membershipLoading}</div>
        ) : (
          <div className="table-wrapper">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>{teamAdminText.membershipColEmployee}</th>
                  <th>{teamAdminText.membershipColTeam}</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const current = emp.managerId ?? ''
                  // Options: every team except the employee's own; keep the current
                  // manager selectable even if no Team record exists for them.
                  const options = teams.filter((t) => t.managerId !== emp.id)
                  const hasCurrent =
                    current === '' || options.some((t) => t.managerId === current)
                  return (
                    <tr key={emp.id}>
                      <td>
                        <strong>{emp.displayName}</strong>
                      </td>
                      <td>
                        <select
                          value={current}
                          onChange={(e) => void handleTeamChange(emp, e.target.value)}
                          disabled={submitting}
                          aria-label={`${teamAdminText.membershipColTeam}: ${emp.displayName}`}
                        >
                          <option value="">{teamAdminText.membershipNoTeam}</option>
                          {!hasCurrent && (
                            <option value={current}>
                              {employeeName.get(current) ?? '—'}
                            </option>
                          )}
                          {options.map((t) => (
                            <option key={t.managerId} value={t.managerId}>
                              {teamNameByManager.get(t.managerId)} —{' '}
                              {employeeName.get(t.managerId) ?? '—'}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
