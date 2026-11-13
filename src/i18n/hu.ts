/**
 * Hungarian UI strings. The whole user interface is Hungarian; code, docs and commits stay English.
 * Add every user-facing string here instead of hard-coding it in components.
 */
import type { LeaveTypeCode, RequestStatus, Role, DayPortion } from '../types/model'

export const roleLabel: Record<Role, string> = {
  EMPLOYEE: 'Munkavállaló',
  MANAGER: 'Vezető',
  HR_ADMIN: 'HR adminisztrátor',
}

export const leaveTypeLabel: Record<LeaveTypeCode, string> = {
  ANNUAL: 'Szabadság',
  SICK_LEAVE: 'Betegszabadság',
  SICK_PAY: 'Táppénz',
  PATERNITY: 'Apai szabadság',
  EXTRAORDINARY: 'Rendkívüli szabadság',
  UNPAID: 'Fizetés nélküli szabadság',
}

export const statusLabel: Record<RequestStatus, string> = {
  PENDING: 'Jóváhagyásra vár',
  APPROVED: 'Jóváhagyva',
  REJECTED: 'Elutasítva',
  CANCELLED: 'Visszavonva',
  REVOKED: 'HR által visszavonva',
}

export const dayPortionLabel: Record<DayPortion, string> = {
  FULL: 'Egész nap',
  AM: 'Délelőtt',
  PM: 'Délután',
}

export const viewLabel = {
  myLeave: 'Saját szabadságaim',
  myTeam: 'Csapatom',
  deputyFor: 'Helyettesítés',
  hrOverview: 'HR áttekintés',
} as const

export const deputyText = {
  conflict: 'A kért időszak egyes napjain nem biztosított a helyettesítésed, ezért ezekre a napokra most nem kérhetsz tervezett szabadságot.',
  conflictDates: 'Érintett napok',
  suggestions: 'Javasolt időpontok',
  noSuggestion: 'Nem találtunk megfelelő alternatív időpontot. Egyeztess a vezetőddel.',
  approvalBlocked: 'A kérelem közben helyettesítési ütközésbe került, ezért nem hagyható jóvá.',
  actingFor: (managerName: string) => `Helyettesítés: ${managerName} távollétében`,
  ownRequestNotAllowed: 'Saját kérelmedről helyettesként nem dönthetsz.',
} as const

export const employeeText = {
  includeInPayrollExport: 'Bérszámfejtésbe exportálandó',
  yes: 'Igen',
  no: 'Nem',
} as const

/** Hungarian date format, e.g. "2026. 11. 13.". */
export const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split('-')
  return `${y}. ${m}. ${d}.`
}
