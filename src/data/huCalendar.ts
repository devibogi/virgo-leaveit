import type { CalendarDataset } from '../types/model.ts'

/**
 * Hungarian working-day calendar (synthetic prototype data).
 * NOT HR-reviewed (reviewedByHr: false): public holidays per Labour Code §102;
 * 2026 transferred days are a best-effort transcription and must be verified
 * against the official decree before production use (Q12).
 */
export const HU_CALENDAR_2026_2027: CalendarDataset = {
  version: 'hu-working-days-2026-2027.v1',
  country: 'HU',
  years: [2026, 2027],
  source: 'Mt. 102. § public holidays + 2026 transfer decree (unverified)',
  reviewedByHr: false,
  overrides: [
    // 2026
    { date: '2026-01-01', kind: 'PUBLIC_HOLIDAY', label: 'Újév' },
    { date: '2026-01-02', kind: 'REST_DAY', label: 'Áthelyezett pihenőnap' },
    { date: '2026-01-10', kind: 'WORKING_DAY', label: 'Áthelyezett munkanap' },
    { date: '2026-03-15', kind: 'PUBLIC_HOLIDAY', label: 'Nemzeti ünnep' },
    { date: '2026-04-03', kind: 'PUBLIC_HOLIDAY', label: 'Nagypéntek' },
    { date: '2026-04-05', kind: 'PUBLIC_HOLIDAY', label: 'Húsvét' },
    { date: '2026-04-06', kind: 'PUBLIC_HOLIDAY', label: 'Húsvéthétfő' },
    { date: '2026-05-01', kind: 'PUBLIC_HOLIDAY', label: 'A munka ünnepe' },
    { date: '2026-05-24', kind: 'PUBLIC_HOLIDAY', label: 'Pünkösd' },
    { date: '2026-05-25', kind: 'PUBLIC_HOLIDAY', label: 'Pünkösdhétfő' },
    { date: '2026-08-08', kind: 'WORKING_DAY', label: 'Áthelyezett munkanap' },
    { date: '2026-08-20', kind: 'PUBLIC_HOLIDAY', label: 'Államalapítás ünnepe' },
    { date: '2026-08-21', kind: 'REST_DAY', label: 'Áthelyezett pihenőnap' },
    { date: '2026-10-23', kind: 'PUBLIC_HOLIDAY', label: 'Nemzeti ünnep' },
    { date: '2026-11-01', kind: 'PUBLIC_HOLIDAY', label: 'Mindenszentek' },
    { date: '2026-12-24', kind: 'PUBLIC_HOLIDAY', label: 'Szenteste' },
    { date: '2026-12-25', kind: 'PUBLIC_HOLIDAY', label: 'Karácsony' },
    { date: '2026-12-26', kind: 'PUBLIC_HOLIDAY', label: 'Karácsony' },
    // 2027 (transfers not yet published)
    { date: '2027-01-01', kind: 'PUBLIC_HOLIDAY', label: 'Újév' },
    { date: '2027-03-15', kind: 'PUBLIC_HOLIDAY', label: 'Nemzeti ünnep' },
    { date: '2027-03-26', kind: 'PUBLIC_HOLIDAY', label: 'Nagypéntek' },
    { date: '2027-03-28', kind: 'PUBLIC_HOLIDAY', label: 'Húsvét' },
    { date: '2027-03-29', kind: 'PUBLIC_HOLIDAY', label: 'Húsvéthétfő' },
    { date: '2027-05-01', kind: 'PUBLIC_HOLIDAY', label: 'A munka ünnepe' },
    { date: '2027-05-16', kind: 'PUBLIC_HOLIDAY', label: 'Pünkösd' },
    { date: '2027-05-17', kind: 'PUBLIC_HOLIDAY', label: 'Pünkösdhétfő' },
    { date: '2027-08-20', kind: 'PUBLIC_HOLIDAY', label: 'Államalapítás ünnepe' },
    { date: '2027-10-23', kind: 'PUBLIC_HOLIDAY', label: 'Nemzeti ünnep' },
    { date: '2027-11-01', kind: 'PUBLIC_HOLIDAY', label: 'Mindenszentek' },
    { date: '2027-12-24', kind: 'PUBLIC_HOLIDAY', label: 'Szenteste' },
    { date: '2027-12-25', kind: 'PUBLIC_HOLIDAY', label: 'Karácsony' },
    { date: '2027-12-26', kind: 'PUBLIC_HOLIDAY', label: 'Karácsony' },
  ],
}
