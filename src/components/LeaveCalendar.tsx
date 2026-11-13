import { useMemo, useState, type ReactNode } from 'react'
import { buildMonthCalendar, LEAVE_TYPE_CODES, type LeaveRequest } from '../domain'
import { calendarText, dayPortionLabel, leaveTypeLabel, statusLabel } from '../i18n/hu'

export interface LeaveCalendarProps {
  requests: readonly LeaveRequest[]
  /** Show the employee on each entry (HR all-requests page). */
  showEmployee?: boolean
  /** Extra header controls (e.g. "+ Új kérelem"). */
  actions?: ReactNode
}

/** Month view: holidays/rest days, weekends and leave per type (exact type: own page or HR Admin only). */
export function LeaveCalendar({ requests, showEmployee = false, actions }: LeaveCalendarProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const weeks = useMemo(() => buildMonthCalendar(year, month, requests), [year, month, requests])
  const todayIso = today.toISOString().slice(0, 10)

  function shift(delta: number) {
    const m = month + delta
    setYear(year + Math.floor((m - 1) / 12))
    setMonth(((m - 1 + 120) % 12) + 1)
  }

  return (
    <div className="card leave-calendar">
      <div className="card-header-row">
        <div>
          <h2 className="card-title">{calendarText.title}</h2>
          <p className="card-subtitle">{calendarText.subtitle}</p>
        </div>
        <div className="filter-bar">
          {actions}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => shift(-1)} aria-label={calendarText.prev}>‹</button>
          <strong className="cal-month">{year}. {calendarText.months[month - 1]}</strong>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => shift(1)} aria-label={calendarText.next}>›</button>
        </div>
      </div>

      <div className="cal-legend">
        <span className="cal-chip cal-holiday">{calendarText.holiday}</span>
        <span className="cal-chip cal-restday">{calendarText.restDay}</span>
        <span className="cal-chip cal-workday">{calendarText.workingSaturday}</span>
        {LEAVE_TYPE_CODES.map((code) => (
          <span key={code} className={`cal-chip cal-type-${code}`}>{leaveTypeLabel[code]}</span>
        ))}
        <span className="cal-chip cal-pending">{statusLabel.PENDING}</span>
      </div>

      <div className="cal-grid" role="grid">
        {calendarText.weekdays.map((d) => (
          <div key={d} className="cal-head" role="columnheader">{d}</div>
        ))}
        {weeks.flat().map((cell) => {
          const kind = cell.override?.kind
          const cls = [
            'cal-cell',
            !cell.inMonth && 'cal-out',
            cell.weekday >= 6 && !cell.isWorkingDay && 'cal-weekend',
            kind === 'PUBLIC_HOLIDAY' && 'cal-holiday',
            kind === 'REST_DAY' && 'cal-restday',
            kind === 'WORKING_DAY' && 'cal-workday',
            cell.date === todayIso && 'cal-today',
          ].filter(Boolean).join(' ')
          return (
            <div key={cell.date} className={cls} role="gridcell">
              <div className="cal-day">{Number(cell.date.slice(8))}</div>
              {cell.override && <div className="cal-note">{cell.override.label}</div>}
              {cell.entries.map((e) => (
                <div
                  key={e.requestId}
                  className={`cal-entry cal-type-${e.leaveTypeCode} ${e.status === 'PENDING' ? 'cal-pending' : ''}`}
                  title={`${leaveTypeLabel[e.leaveTypeCode]} · ${dayPortionLabel[e.portion]} · ${statusLabel[e.status]}`}
                >
                  {showEmployee ? e.employeeId : leaveTypeLabel[e.leaveTypeCode]}
                  {e.portion !== 'FULL' && ` (${e.portion === 'AM' ? 'de.' : 'du.'})`}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
