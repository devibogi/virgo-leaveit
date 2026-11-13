import { useEffect, useMemo, useState } from 'react'
import {
  createLeaveEntitlementApiClient,
  TeamApiError,
  type LeaveEntitlementApiClientOptions,
} from '../api'
import type { TeamMemberBalance } from '../api/leaveEntitlements'
import {
  getEffectiveEntitlementDays,
  summarizeEntitlementBalance,
  type LeaveEntitlement,
  type Role,
} from '../domain'
import { entitlementComponentLabel, myEntitlementText } from '../i18n/hu'

export interface MyEntitlementsViewProps {
  activeRole: Role
  currentUserId: string
  year?: number
  apiClientOptions?: LeaveEntitlementApiClientOptions
}

/** Read-only: own entitlements for every role (HR Admin included); team balances (numbers only) for managers. */
export function MyEntitlementsView({
  activeRole,
  currentUserId,
  year = new Date().getFullYear(),
  apiClientOptions,
}: MyEntitlementsViewProps) {
  const apiClient = useMemo(
    () =>
      createLeaveEntitlementApiClient({
        ...apiClientOptions,
        getActorRole: () => activeRole,
        getActorId: () => currentUserId,
      }),
    [activeRole, currentUserId, apiClientOptions],
  )
  const isManager = activeRole === 'MANAGER'

  const [own, setOwn] = useState<LeaveEntitlement[]>([])
  const [team, setTeam] = useState<TeamMemberBalance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      apiClient.listEntitlements({ employeeId: currentUserId, year }),
      isManager ? apiClient.listTeamSummary(year) : Promise.resolve([]),
    ])
      .then(([ownRows, teamRows]) => {
        if (cancelled) return
        setOwn(ownRows)
        setTeam(teamRows)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(
          err instanceof TeamApiError
            ? `${err.message}: ${err.details.join(' ')}`
            : myEntitlementText.loadError,
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [apiClient, currentUserId, isManager, year])

  const ownTotal = summarizeEntitlementBalance(own, currentUserId, year)

  return (
    <section className="admin-container">
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <div className="card">
        <h2 className="card-title">{myEntitlementText.ownTitle(year)}</h2>
        <p className="card-subtitle">
          <strong>
            {myEntitlementText.summaryLine(
              ownTotal.totalDays,
              ownTotal.usedDays,
              ownTotal.remainingDays,
            )}
          </strong>
        </p>
        {loading ? (
          <div className="empty-state">{myEntitlementText.loading}</div>
        ) : own.length === 0 ? (
          <div className="empty-state">{myEntitlementText.empty}</div>
        ) : (
          <div className="table-wrapper">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>{myEntitlementText.componentCol}</th>
                  <th>{myEntitlementText.totalCol}</th>
                  <th>{myEntitlementText.usedCol}</th>
                  <th>{myEntitlementText.remainingCol}</th>
                </tr>
              </thead>
              <tbody>
                {own.map((e) => {
                  const total = getEffectiveEntitlementDays(e)
                  return (
                    <tr key={e.id}>
                      <td>{entitlementComponentLabel[e.component]}</td>
                      <td>{total}</td>
                      <td>{e.usedYear}</td>
                      <td>{total - e.usedYear}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isManager && (
        <div className="card">
          <h2 className="card-title">{myEntitlementText.teamTitle(year)}</h2>
          <p className="card-subtitle">{myEntitlementText.teamSubtitle}</p>
          {loading ? (
            <div className="empty-state">{myEntitlementText.loading}</div>
          ) : team.length === 0 ? (
            <div className="empty-state">{myEntitlementText.teamEmpty}</div>
          ) : (
            <div className="table-wrapper">
              <table className="crud-table">
                <thead>
                  <tr>
                    <th>{myEntitlementText.memberCol}</th>
                    <th>{myEntitlementText.totalCol}</th>
                    <th>{myEntitlementText.usedCol}</th>
                    <th>{myEntitlementText.remainingCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((m) => (
                    <tr key={m.employeeId}>
                      <td>{m.displayName}</td>
                      <td>{m.totalDays}</td>
                      <td>{m.usedDays}</td>
                      <td>{m.remainingDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
