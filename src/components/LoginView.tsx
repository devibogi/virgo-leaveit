import { useState, type FormEvent } from 'react'
import { authApi, TeamApiError, type LoginResponse } from '../api'
import { DEMO_VALID_PASSWORD } from '../domain'
import { authText, roleLabel } from '../i18n/hu'
import type { Role } from '../types/model'

export interface LoginViewProps {
  onLoginSuccess: (session: LoginResponse) => void
}

const DEMO_ACCOUNTS: readonly {
  label: string
  email: string
  role: Role
}[] = [
  {
    label: 'Varga Piri',
    email: 'piri.varga@virgo.example',
    role: 'HR_ADMIN',
  },
  {
    label: 'Nagy Katalin',
    email: 'katalin.nagy@virgo.example',
    role: 'MANAGER',
  },
  {
    label: 'Kovács Péter',
    email: 'peter.kovacs@virgo.example',
    role: 'EMPLOYEE',
  },
  {
    label: 'Szabó Anna',
    email: 'anna.szabo@virgo.example',
    role: 'EMPLOYEE',
  },
]

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [email, setEmail] = useState<string>('piri.varga@virgo.example')
  const [password, setPassword] = useState<string>(DEMO_VALID_PASSWORD)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const session = await authApi.login({
        email: email.trim(),
        password,
      })
      onLoginSuccess(session)
    } catch (err) {
      if (err instanceof TeamApiError && err.status === 403) {
        setError(authText.noAccess)
      } else {
        setError(authText.invalidCredentials)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function fillDemoAccount(demoEmail: string) {
    setEmail(demoEmail)
    setPassword(DEMO_VALID_PASSWORD)
    setError(null)
  }

  return (
    <div className="login-page">
      <div className="card login-card">
        <div className="login-header">
          <div className="brand-mark">L</div>
          <p className="eyebrow">LEAVE IT TO US.</p>
          <h1 className="login-title">
            {authText.title}
            <span>.</span>
          </h1>
          <p className="card-subtitle">{authText.subtitle}</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="crud-form">
          <label className="form-field">
            <span>{authText.emailLabel}</span>
            <input
              type="email"
              placeholder={authText.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              required
            />
          </label>

          <label className="form-field">
            <span>{authText.password}</span>
            <input
              type="password"
              placeholder={authText.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
            />
          </label>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={submitting}
          >
            {authText.submit}
          </button>
        </form>

        <div className="demo-accounts-box">
          <div className="demo-accounts-title">{authText.quickFillLabel}</div>
          <div className="demo-accounts-grid">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                className="btn btn-secondary btn-sm demo-account-btn"
                onClick={() => fillDemoAccount(acc.email)}
              >
                <span>{acc.label}</span>
                <span className="badge">{roleLabel[acc.role]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
