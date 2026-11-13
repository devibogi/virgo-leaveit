import { useState } from 'react'
import { LEGAL_ENTITIES } from '../domain/legalEntity.ts'
import { payrollExportText as t } from '../i18n/hu.ts'
import type { LegalEntityId } from '../types/model.ts'

export function PayrollExportView() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [legalEntityId, setLegalEntityId] = useState<LegalEntityId>(LEGAL_ENTITIES[0].id)
  const href = `/api/exports/payroll?year=${year}&month=${month}&legalEntityId=${legalEntityId}`

  return (
    <div className="card">
      <h2 className="card-title">{t.cardTitle}</h2>
      <p className="card-subtitle">{t.cardSubtitle}</p>
      <div className="crud-form">
        <label className="form-field">
          <span>{t.yearLabel}</span>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>{t.monthLabel}</span>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {t.months.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>{t.legalEntityLabel}</span>
          <select value={legalEntityId} onChange={(e) => setLegalEntityId(e.target.value as LegalEntityId)}>
            {LEGAL_ENTITIES.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </label>
        <a className="btn btn-primary" href={href} download>
          {t.download}
        </a>
      </div>
      <p className="card-subtitle">{t.assumptionsNote}</p>
    </div>
  )
}
