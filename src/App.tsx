import { useEffect, useState } from 'react'
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
  myEntitlementText,
  teamAdminText,
  teamEntitlementText,
  roleLabel,
  themeText,
} from './i18n/hu'
import type { Employee, Role } from './types/model'

type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('leaveit-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* storage unavailable */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

type AdminSection = 'MY_REQUESTS' | 'REQUESTS' | 'ENTITLEMENTS' | 'TEAM_ENTITLEMENTS' | 'ENTITLEMENTS_ADMIN' | 'EMPLOYEES' | 'TEAMS'

export default function App() {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null)
  const [activeRole, setActiveRole] = useState<Role>('HR_ADMIN')
  const [section, setSection] = useState<AdminSection>('MY_REQUESTS')
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('leaveit-theme', theme) } catch { /* ignore */ }
  }, [theme])

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
  const isManager = activeRole === 'MANAGER'
  const visibleSection: AdminSection =
    ((section === 'TEAMS' || section === 'REQUESTS' || section === 'ENTITLEMENTS_ADMIN') && !isHrAdmin) ||
    (section === 'EMPLOYEES' && !canSeeEmployees) ||
    (section === 'TEAM_ENTITLEMENTS' && !isManager)
      ? 'MY_REQUESTS'
      : section

  const heading =
    visibleSection === 'TEAMS'
      ? teamAdminText
      : visibleSection === 'EMPLOYEES'
        ? employeeAdminText
        : visibleSection === 'TEAM_ENTITLEMENTS'
          ? teamEntitlementText
        : visibleSection === 'ENTITLEMENTS_ADMIN'
          ? entitlementAdminText
          : visibleSection === 'ENTITLEMENTS'
          ? myEntitlementText
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
            <span className="topbar-badge">{roleLabel[activeRole]}</span>
          </div>
        </div>

        <div className="topbar-right">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? themeText.toLight : themeText.toDark}
          </button>

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
          <button
            type="button"
            role="tab"
            aria-selected={visibleSection === 'ENTITLEMENTS'}
            className={`section-tab ${visibleSection === 'ENTITLEMENTS' ? 'section-tab-active' : ''}`}
            onClick={() => setSection('ENTITLEMENTS')}
          >
            {myEntitlementText.tabLabel}
          </button>
          {isManager && (
          <button
            type="button"
            role="tab"
            aria-selected={visibleSection === 'TEAM_ENTITLEMENTS'}
            className={`section-tab ${visibleSection === 'TEAM_ENTITLEMENTS' ? 'section-tab-active' : ''}`}
            onClick={() => setSection('TEAM_ENTITLEMENTS')}
          >
            {teamEntitlementText.tabLabel}
          </button>
          )}
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
          {isHrAdmin && (
          <button
            type="button"
            role="tab"
            aria-selected={visibleSection === 'ENTITLEMENTS_ADMIN'}
            className={`section-tab ${visibleSection === 'ENTITLEMENTS_ADMIN' ? 'section-tab-active' : ''}`}
            onClick={() => setSection('ENTITLEMENTS_ADMIN')}
          >
            {entitlementAdminText.tabLabel}
          </button>
          )}
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
        ) : visibleSection === 'ENTITLEMENTS_ADMIN' ? (
          <LeaveEntitlementAdminCrud
            activeRole={activeRole}
            onRequestRoleChange={setActiveRole}
          />
        ) : visibleSection === 'TEAM_ENTITLEMENTS' ? (
          <MyEntitlementsView
            key="team"
            view="TEAM"
            activeRole={activeRole}
            currentUserId={currentUser.id}
          />
        ) : visibleSection === 'ENTITLEMENTS' ? (
          <MyEntitlementsView
            key="own"
            activeRole={activeRole}
            currentUserId={currentUser.id}
          />
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
