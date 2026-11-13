import { useState } from 'react'
import type { LoginResponse } from './api'
import { EmployeeAdminCrud } from './components/EmployeeAdminCrud'
import { LeaveEntitlementAdminCrud } from './components/LeaveEntitlementAdminCrud'
import { LeaveRequestAdminCrud } from './components/LeaveRequestAdminCrud'
import { LoginView } from './components/LoginView'
import { TeamAdminCrud } from './components/TeamAdminCrud'
import {
  authText,
  employeeAdminText,
  entitlementAdminText,
  leaveRequestAdminText,
  roleLabel,
  teamAdminText,
  viewLabel,
} from './i18n/hu'
import type { Employee, Role } from './types/model'

const ALL_ROLES: readonly Role[] = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN']
type AdminSection = 'REQUESTS' | 'ENTITLEMENTS' | 'EMPLOYEES' | 'TEAMS'

export default function App() {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null)
  const [activeRole, setActiveRole] = useState<Role>('HR_ADMIN')
  const [section, setSection] = useState<AdminSection>('REQUESTS')

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

  const heading =
    section === 'TEAMS'
      ? teamAdminText
      : section === 'EMPLOYEES'
        ? employeeAdminText
        : section === 'ENTITLEMENTS'
          ? entitlementAdminText
          : leaveRequestAdminText

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
            aria-selected={section === 'REQUESTS'}
            className={`section-tab ${section === 'REQUESTS' ? 'section-tab-active' : ''}`}
            onClick={() => setSection('REQUESTS')}
          >
            {leaveRequestAdminText.tabLabel}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === 'ENTITLEMENTS'}
            className={`section-tab ${section === 'ENTITLEMENTS' ? 'section-tab-active' : ''}`}
            onClick={() => setSection('ENTITLEMENTS')}
          >
            {entitlementAdminText.tabLabel}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === 'EMPLOYEES'}
            className={`section-tab ${section === 'EMPLOYEES' ? 'section-tab-active' : ''}`}
            onClick={() => setSection('EMPLOYEES')}
          >
            {employeeAdminText.tabLabel}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === 'TEAMS'}
            className={`section-tab ${section === 'TEAMS' ? 'section-tab-active' : ''}`}
            onClick={() => setSection('TEAMS')}
          >
            {teamAdminText.tabLabel}
          </button>
        </div>

        <div className="page-heading">
          <p className="eyebrow">{heading.eyebrow}</p>
          <h1>
            {heading.pageTitle}
            <span>.</span>
          </h1>
          <p className="intro">{heading.pageIntro}</p>
        </div>

        {section === 'TEAMS' ? (
          <TeamAdminCrud
            activeRole={activeRole}
            onRequestRoleChange={setActiveRole}
          />
        ) : section === 'EMPLOYEES' ? (
          <EmployeeAdminCrud
            activeRole={activeRole}
            onRequestRoleChange={setActiveRole}
          />
        ) : section === 'ENTITLEMENTS' ? (
          <LeaveEntitlementAdminCrud
            activeRole={activeRole}
            onRequestRoleChange={setActiveRole}
          />
        ) : (
          <LeaveRequestAdminCrud
            activeRole={activeRole}
            onRequestRoleChange={setActiveRole}
          />
        )}
      </main>
    </div>
  )
}
