import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createTeamApiClient,
  TeamApiError,
  type TeamApiClientOptions,
} from '../api'
import { canManageTeams, validateTeam, type Role, type Team } from '../domain'
import { roleLabel, teamAdminText } from '../i18n/hu'

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

  return (
    <section className="admin-container">
      <div className="admin-grid">
        {/* Create Card */}
        <div className="card">
          <h2 className="card-title">{teamAdminText.createTitle}</h2>
          <p className="card-subtitle">{teamAdminText.createSubtitle}</p>

          <form onSubmit={(e) => void handleCreate(e)} className="crud-form">
            <label className="form-field">
              <span>{teamAdminText.managerIdLabel}</span>
              <input
                type="text"
                placeholder={teamAdminText.managerIdPlaceholder}
                value={newManagerId}
                onChange={(e) => setNewManagerId(e.target.value)}
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
          </form>
        </div>

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
              <input
                type="search"
                placeholder={teamAdminText.filterPlaceholder}
                value={managerFilter}
                onChange={(e) => setManagerFilter(e.target.value)}
                aria-label={teamAdminText.filterPlaceholder}
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
                    <th className="actions-col">{teamAdminText.colActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => {
                    const isEditing = editingManagerId === team.managerId
                    return (
                      <tr key={team.managerId}>
                        <td className="mono-cell">
                          <span className="badge">{team.managerId}</span>
                        </td>
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
    </section>
  )
}
