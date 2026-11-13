import { buildPayrollCsv, buildPayrollXlsx, payrollExportFileName } from '../domain/payrollExport.ts'
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

/**
 * GET /api/exports/payroll?year=2026&month=11&legalEntityId=VIRGO_KFT[&format=xlsx|csv] (HR_ADMIN only).
 * Default .xlsx (§6a). CSV gets a UTF-8 BOM so Excel shows Hungarian accents correctly.
 */
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
    const format = url.searchParams.get('format') ?? 'xlsx'
    const errors: string[] = []
    if (format !== 'xlsx' && format !== 'csv') errors.push('Érvénytelen formátum (xlsx vagy csv).')
    if (!Number.isInteger(year) || year < 2000 || year > 2100) errors.push('Érvénytelen év.')
    if (!Number.isInteger(month) || month < 1 || month > 12) errors.push('Érvénytelen hónap.')
    if (!LEGAL_ENTITIES.some((e) => e.id === legalEntityId)) errors.push('Érvénytelen jogi személy.')
    if (errors.length) return { status: 400, body: { error: 'Validation failed', details: errors } }

    const [employees, requests] = await Promise.all([
      employeeRepository.findAll(),
      requestRepository.findAll({ legalEntityId, status: 'APPROVED' }),
    ])
    const fileName = payrollExportFileName(legalEntityId, year, month, format as 'xlsx' | 'csv')
    if (format === 'csv') {
      return {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
        body: '\uFEFF' + buildPayrollCsv(employees, requests, legalEntityId, year, month),
      }
    }
    return {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
      body: buildPayrollXlsx(employees, requests, legalEntityId, year, month),
    }
  }
}
