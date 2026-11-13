import { useEffect, useMemo, useState } from 'react'
import { createEmployeeApiClient, TeamApiError } from '../api'
import type { Employee, Role } from '../domain'
import { myTeamEmployeesText, roleLabel } from '../i18n/hu'

export interface MyTeamEmployeesViewProps {
  activeRole: Role
  currentUserId: string
}

/** Manager: read-only list of direct reports (no birth date / tax id / legal entity). */
export function MyTeamEmployeesView({ activeRole, currentUserId }: MyTeamEmployeesViewProps) {
  const apiClient = useMemo(
    () =>
      createEmployeeApiClient({
        getActorRole: () => activeRole,
        getActorId: () => currentUserId,
      }),
    [activeRole, currentUserId],
  )
  const [members, setMembers] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    apiClient
      .listEmployees()
      .then((rows) => {
        if (!cancelled) setMembers(rows)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(
          err instanceof TeamApiError
            ? `${err.message}: ${err.details.join(' ')}`
            : myTeamEmployeesText.loadError,
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [apiClient])

  return (
    <section className="admin-container">
      <div className="card">
        <h2 className="card-title">{myTeamEmployeesText.title}</h2>
        <p className="card-subtitle">{myTeamEmployeesText.subtitle}</p>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        {loading ? (
          <div className="empty-state">{myTeamEmployeesText.loading}</div>
        ) : members.length === 0 ? (
          <div className="empty-state">{myTeamEmployeesText.empty}</div>
        ) : (
          <div className="table-wrapper">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>{myTeamEmployeesText.colName}</th>
                  <th>{myTeamEmployeesText.colRoles}</th>
                  <th>{myTeamEmployeesText.colStart}</th>
                  <th>{myTeamEmployeesText.colDeputies}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((emp) => (
                  <tr key={emp.id}>
                    <td>
                      <div>
                        <strong>{emp.displayName}</strong>
                      </div>
                      <div className="sub-cell">{emp.email}</div>
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
                    <td className="sub-cell">{emp.employmentStart}</td>
                    <td>
                      {(emp as { deputyNames?: string[] }).deputyNames?.join(', ') || '—'}
                    </td>
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
