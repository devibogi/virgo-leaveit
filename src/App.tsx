import { useState } from 'react'
import type { LoginResponse } from './api'
import { EmployeeAdminCrud } from './components/EmployeeAdminCrud'
import { LeaveEntitlementAdminCrud } from './components/LeaveEntitlementAdminCrud'
import { LeaveRequestAdminCrud } from './components/LeaveRequestAdminCrud'
import { LoginView } from './components/LoginView'
import { MyEntitlementsView } from './components/MyEntitlementsView'
import { MyTeamEmployeesView } from './components/MyTeamEmployeesView'
import { TeamAdminCrud } from './components/TeamAdminCrud'
import {
  authText,
  employeeAdminText,
  entitlementAdminText,
  leaveRequestAdminText,
  myLeaveRequestText,
  roleLabel,
  teamAdminText,
  viewLabel,
} from './i18n/hu'
import type { Employee, Role } from './types/model'

const ALL_ROLES: readonly Role[] = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN']
type AdminSection = 'MY_REQUESTS' | 'REQUESTS' | 'ENTITLEMENTS' | 'EMPLOYEES' | 'TEAMS'

export default function App() {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null)
  const [activeRole, setActiveRole] = useState<Role>('HR_ADMIN')
  const [section, setSection] = useState<AdminSection>('MY_REQUESTS')

  function handleLoginSuccess(session: LoginResponse) {
    setCurrentUser(session.employee)
    setActiveRole(session.defaultRole)
  }

  function handleSignOut() {
    setCurrentUser(null)
  }

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />
  }

  // Teams (and their tab) are visible to HR admin only.
  const isHrAdmin = activeRole === 'HR_ADMIN'
  // Employees page: HR Admin manages everyone; managers see their direct reports read-only.
  const canSeeEmployees = activeRole !== 'EMPLOYEE'
  const visibleSection: AdminSection =
    ((section === 'TEAMS' || section === 'REQUESTS') && !isHrAdmin) ||
    (section === 'EMPLOYEES' && !canSeeEmployees)
      ? 'MY_REQUESTS'
      : section

  const heading =
    visibleSection === 'TEAMS'
      ? teamAdminText
      : visibleSection === 'EMPLOYEES'
        ? employeeAdminText
        : visibleSection === 'ENTITLEMENTS'
          ? entitlementAdminText
          : visibleSection === 'REQUESTS'
            ? leaveRequestAdminText
            : myLeaveRequestText

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-mark brand-mark-sm">L</div>
          <div>
            <span className="topbar-title">
              LeaveIt<span>.</span>
            </span>
            <span className="topbar-badge">{viewLabel.hrOverview}</span>
          </div>
        </div>

        <div className="topbar-right">
          <div
            className="role-switcher"
            role="group"
            aria-label={teamAdminText.demoRoleLabel}
          >
            <span className="role-switcher-label">
              {teamAdminText.demoRoleLabel}
            </span>
            <div className="role-pills">
              {ALL_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`role-pill ${activeRole === role ? 'role-pill-active' : ''}`}
                  onClick={() => setActiveRole(role)}
                >
                  {roleLabel[role]} ({role})
                </button>
              ))}
            </div>
          </div>

          <div className="user-session-bar">
            <span className="user-session-info">
              {authText.signedInAs}{' '}
              <strong>{currentUser.displayName}</strong> ({currentUser.email})
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleSignOut}
            >
              {authText.signOut}
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="section-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={visibleSection === 'MY_REQUESTS'}
            className={`section-tab ${visibleSection === 'MY_REQUESTS' ? 'section-tab-active' : ''}`}
            onClick={() => setSection('MY_REQUESTS')}
          >
            {myLeaveRequestText.tabLabel}
          </button>
          {isHrAdmin && (
          <button
            type="button"
            role="tab"
            aria-selected={visibleSection === 'REQUESTS'}
            className={`section-tab ${visibleSection === 'REQUESTS' ? 'section-tab-active' : ''}`}
            onClick={() => setSection('REQUESTS')}
          >
            {leaveRequestAdminText.tabLabel}
          </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={visibleSection === 'ENTITLEMENTS'}
            className={`section-tab ${visibleSection === 'ENTITLEMENTS' ? 'section-tab-active' : ''}`}
            onClick={() => setSection('ENTITLEMENTS')}
          >
            {entitlementAdminText.tabLabel}
          </button>
          {canSeeEmployees && (
          <button
            type="button"
            role="tab"
            aria-selected={visibleSection === 'EMPLOYEES'}
            className={`section-tab ${visibleSection === 'EMPLOYEES' ? 'section-tab-active' : ''}`}
            onClick={() => setSection('EMPLOYEES')}
          >
            {employeeAdminText.tabLabel}
          </button>
          )}
          {isHrAdmin && (
          <button
            type="button"
            role="tab"
            aria-selected={visibleSection === 'TEAMS'}
            className={`section-tab ${visibleSection === 'TEAMS' ? 'section-tab-active' : ''}`}
            onClick={() => setSection('TEAMS')}
          >
            {teamAdminText.tabLabel}
          </button>
          )}
        </div>

        <div className="page-heading">
          <p className="eyebrow">{heading.eyebrow}</p>
          <h1>
            {heading.pageTitle}
            <span>.</span>
          </h1>
          <p className="intro">{heading.pageIntro}</p>
        </div>

        {visibleSection === 'TEAMS' ? (
          <TeamAdminCrud
            activeRole={activeRole}
            onRequestRoleChange={setActiveRole}
          />
        ) : visibleSection === 'EMPLOYEES' ? (
          isHrAdmin ? (
            <EmployeeAdminCrud
              activeRole={activeRole}
              onRequestRoleChange={setActiveRole}
            />
          ) : (
            <MyTeamEmployeesView
              activeRole={activeRole}
              currentUserId={currentUser.id}
            />
          )
        ) : visibleSection === 'ENTITLEMENTS' ? (
          isHrAdmin ? (
            <>
              <MyEntitlementsView
                activeRole={activeRole}
                currentUserId={currentUser.id}
              />
              <LeaveEntitlementAdminCrud
                activeRole={activeRole}
                onRequestRoleChange={setActiveRole}
              />
            </>
          ) : (
            <MyEntitlementsView
              activeRole={activeRole}
              currentUserId={currentUser.id}
            />
          )
        ) : (
          <LeaveRequestAdminCrud
            key={visibleSection}
            mode={visibleSection === 'REQUESTS' ? 'ALL' : 'MINE'}
            activeRole={activeRole}
            onRequestRoleChange={setActiveRole}
            currentUserId={currentUser.id}
          />
        )}
      </main>
    </div>
  )
}
