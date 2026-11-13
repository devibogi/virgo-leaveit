import { useEffect, useMemo, useState } from 'react'
import { createEmployeeApiClient } from '../api'
import type { Employee, Role } from '../domain'

/** HR Admin only: loads all employees so the UI can show names instead of IDs. */
export function useEmployeeDirectory(activeRole: Role, enabled = true) {
  const [employees, setEmployees] = useState<Employee[]>([])
  useEffect(() => {
    if (!enabled || activeRole !== 'HR_ADMIN') return
    const client = createEmployeeApiClient()
    client.listEmployees().then(setEmployees, () => setEmployees([]))
  }, [activeRole, enabled])
  return useMemo(() => {
    const byId = new Map(employees.map((e) => [e.id, e.displayName]))
    return { employees, nameOf: (id: string | null | undefined) => (id ? byId.get(id) ?? '—' : '—') }
  }, [employees])
}

export interface EmployeeSelectProps {
  employees: readonly Employee[]
  value: string
  onChange: (id: string) => void
  emptyLabel: string
  disabled?: boolean
  ariaLabel?: string
  exclude?: string
}

/** Pick an employee by name; the ID is the value but never shown. */
export function EmployeeSelect({ employees, value, onChange, emptyLabel, disabled, ariaLabel, exclude }: EmployeeSelectProps) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={ariaLabel}>
      <option value="">{emptyLabel}</option>
      {[...employees]
        .filter((e) => e.id !== exclude)
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'hu'))
        .map((e) => (
          <option key={e.id} value={e.id}>{e.displayName}</option>
        ))}
    </select>
  )
}
