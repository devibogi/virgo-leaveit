import { buildPayrollCsv, payrollExportFileName } from '../domain/payrollExport.ts'
import { LEGAL_ENTITIES } from '../domain/legalEntity.ts'
import type { LegalEntityId } from '../types/model.ts'
import type { EmployeeRepository } from './employeeRepository.ts'
import type { LeaveRequestRepository } from './leaveRequestRepository.ts'
import { verifyCsrfProtection } from './security.ts'
import type { ApiRequest, ApiResponse } from './teamApi.ts'

const forbidden = (detail: string): ApiResponse => ({
  status: 403,
  body: { error: 'Forbidden', details: [detail] },
})

/** GET /api/exports/payroll?year=2026&month=11&legalEntityId=VIRGO_KFT → CSV (HR_ADMIN only). */
export function createPayrollExportApiHandler(
  employeeRepository: EmployeeRepository,
  requestRepository: LeaveRequestRepository,
) {
  return async function handlePayrollExportApiRequest(req: ApiRequest): Promise<ApiResponse | null> {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname !== '/api/exports/payroll') return null
    const method = req.method.toUpperCase()

    if (req.session?.activeRole !== 'HR_ADMIN') {
      return forbidden('Csak HR adminisztrátor (HR_ADMIN) jogosultsággal érhető el ez a művelet.')
    }
    const csrf = verifyCsrfProtection({ method, pathname: url.pathname, headers: req.headers, session: req.session })
    if (!csrf.valid) return forbidden(csrf.reason)
    if (method !== 'GET') return { status: 405, body: { error: 'Method not allowed', details: [] } }

    const year = Number(url.searchParams.get('year'))
    const month = Number(url.searchParams.get('month'))
    const legalEntityId = url.searchParams.get('legalEntityId') as LegalEntityId
    const errors: string[] = []
    if (!Number.isInteger(year) || year < 2000 || year > 2100) errors.push('Érvénytelen év.')
    if (!Number.isInteger(month) || month < 1 || month > 12) errors.push('Érvénytelen hónap.')
    if (!LEGAL_ENTITIES.some((e) => e.id === legalEntityId)) errors.push('Érvénytelen jogi személy.')
    if (errors.length) return { status: 400, body: { error: 'Validation failed', details: errors } }

    const [employees, requests] = await Promise.all([
      employeeRepository.findAll(),
      requestRepository.findAll({ legalEntityId, status: 'APPROVED' }),
    ])
    return {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${payrollExportFileName(legalEntityId, year, month)}"`,
      },
      body: buildPayrollCsv(employees, requests, legalEntityId, year, month),
    }
  }
}
