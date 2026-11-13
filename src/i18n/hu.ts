/**
 * Hungarian UI strings. The whole user interface is Hungarian; code, docs and commits stay English.
 * Add every user-facing string here instead of hard-coding it in components.
 */
import type {
  DayPortion,
  EntitlementComponent,
  LeaveTypeCode,
  LegalEntityId,
  RequestStatus,
  Role,
  LeaveCategory,
} from '../types/model'

export const roleLabel: Record<Role, string> = {
  EMPLOYEE: 'Munkavállaló',
  MANAGER: 'Vezető',
  HR_ADMIN: 'HR adminisztrátor',
}

export const legalEntityLabel: Record<LegalEntityId, string> = {
  VIRGO_KFT: 'Virgo Kft.',
  VIRGO_ZRT: 'Virgo Zrt.',
}

export const leaveTypeLabel: Record<LeaveTypeCode, string> = {
  ANNUAL: 'Fizetett szabadság',
  SICK_LEAVE: 'Betegszabadság',
  UNPAID: 'Fizetés nélküli szabadság',
  OTHER: 'Egyéb (pl. temetési szabadság)',
  CHILD_SICK_LEAVE: 'Gyermekápolási szabadság',
}

/** What everyone except HR Admin sees instead of the exact leave type (D19). */
export const leaveCategoryLabel: Record<LeaveCategory, string> = {
  LEAVE: 'Szabadság',
  SICK: 'Beteg',
}

/** Payroll export column group headers (template row 1). */
export const payrollGroupLabel: Record<LeaveCategory, string> = {
  LEAVE: 'Szabadság',
  SICK: 'Betegszabadság/táppénz',
}

export const entitlementComponentLabel: Record<EntitlementComponent, string> = {
  BASE: 'Alapszabadság (BASE)',
  AGE_ADDITIONAL: 'Életkor alapú pótszabadság (AGE_ADDITIONAL)',
  CHILD_ADDITIONAL: 'Gyermek utáni pótszabadság (CHILD_ADDITIONAL)',
  AGE_ADDITIONAL_CARRYOVER:
    'Előző évi átvitt életkor alapú pótszabadság (AGE_ADDITIONAL_CARRYOVER)',
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
  conflict:
    'A kért időszak egyes napjain nem biztosított a helyettesítésed, ezért ezekre a napokra most nem kérhetsz tervezett szabadságot.',
  conflictDates: 'Érintett napok',
  suggestions: 'Javasolt időpontok',
  noSuggestion:
    'Nem találtunk megfelelő alternatív időpontot. Egyeztess a vezetőddel.',
  approvalBlocked:
    'A kérelem közben helyettesítési ütközésbe került, ezért nem hagyható jóvá.',
  actingFor: (managerName: string) =>
    `Helyettesítés: ${managerName} távollétében`,
  ownRequestNotAllowed: 'Saját kérelmedről helyettesként nem dönthetsz.',
} as const

export const employeeText = {
  includeInPayrollExport: 'Bérszámfejtésbe exportálandó',
  yes: 'Igen',
  no: 'Nem',
} as const

export const authText = {
  title: 'Bejelentkezés',
  subtitle:
    'Demó bejelentkezés a LeaveIt prototípusba. Minden szintetikus felhasználó érvényes jelszava: Password-123456',
  emailLabel: 'E-mail cím',
  emailPlaceholder: 'pl. piri.varga@virgo.example',
  username: 'Felhasználónév',
  password: 'Jelszó',
  passwordPlaceholder: 'Password-123456',
  submit: 'Belépés',
  quickFillLabel: 'Gyors demó kitöltés:',
  invalidCredentials: 'Hibás felhasználónév vagy jelszó.',
  noAccess:
    'Ehhez a fiókhoz nincs LeaveIt hozzáférés. Kérjük, fordulj a HR-hez.',
  signedInAs: 'Belépve:',
  signOut: 'Kijelentkezés',
} as const

export const teamAdminText = {
  tabLabel: 'Csapatok (Teams)',
  eyebrow: 'HR ADMINISZTRÁCIÓ · CSAPATOK',
  pageTitle: 'Csapatok kezelése',
  pageIntro:
    'A DATA_MODEL.md alapján minden csapathoz egy közvetlen vezető (managerId kulcs) és egy megjelenítési név tartozik. A csapattagság származtatott (azon munkavállalók, akiknek a managerId mezője az adott vezető).',
  demoRoleLabel: 'Demó szerepkör-választó (csak prototípus):',
  accessDeniedTitle: 'Hozzáférés megtagadva (403)',
  accessDeniedBody:
    'Ez a felület kizárólag HR adminisztrátor (HR_ADMIN) jogosultsággal érhető el. A jelenlegi szerepköröddel az adminisztráció nem engedélyezett.',
  switchToHrAdmin: 'Váltás HR adminisztrátor (HR_ADMIN) szerepkörre',
  createTitle: 'Új csapat létrehozása',
  createSubtitle:
    'Rendelj megjelenítési nevet egy közvetlen vezetőhöz (managerId). Vezetőnként pontosan egy csapat létezhet.',
  managerIdLabel: 'Vezető azonosító (managerId — kulcs)',
  managerIdPlaceholder: 'pl. emp-katalin',
  teamNameLabel: 'Csapat megjelenítési neve',
  teamNamePlaceholder: 'pl. Fejlesztési csapat',
  createButton: '+ Csapat hozzáadása',
  listTitle: 'Csapatok (Teams)',
  totalCount: (count: number) => `Összesen: ${count} csapat`,
  filterPlaceholder: 'Szűrés managerId alapján...',
  refreshButton: 'Frissítés',
  loading: 'Csapatok betöltése...',
  empty: 'Nincs megjeleníthető csapat a megadott feltételekkel.',
  colManagerId: 'Manager ID (kulcs)',
  colName: 'Csapat megjelenítési neve',
  colActions: 'Műveletek',
  editButton: 'Szerkesztés',
  deleteButton: 'Törlés',
  saveButton: 'Mentés',
  cancelButton: 'Mégse',
  loadError: 'Nem sikerült betölteni a csapatokat.',
  createError: 'Hiba történt a csapat létrehozásakor.',
  updateError: 'Hiba történt a csapat módosításakor.',
  deleteError: 'Hiba történt a csapat törlésekor.',
} as const

export const employeeAdminText = {
  tabLabel: 'Munkavállalók (Employees)',
  eyebrow: 'HR ADMINISZTRÁCIÓ · MUNKAVÁLLALÓK',
  pageTitle: 'Munkavállalók kezelése',
  pageIntro:
    'Munkavállalói törzsadatok, jogi személy (Virgo Kft. / Virgo Zrt.), közvetlen vezető (managerId), szerepkörök, bérszámfejtési export és helyettesek (deputyIds) kezelése.',
  createTitle: 'Új munkavállaló felvitele',
  editTitle: (id: string) => `Munkavállaló szerkesztése: ${id}`,
  createSubtitle:
    'Minden munkavállaló rendelkezik az EMPLOYEE szerepkörrel. A helyettesek (deputyIds) vesszővel elválasztva adhatók meg.',
  idLabel: 'Azonosító (id)',
  idPlaceholder: 'pl. emp-uj',
  displayNameLabel: 'Teljes név (displayName)',
  displayNamePlaceholder: 'pl. Tóth Gábor',
  emailLabel: 'Szintetikus e-mail cím',
  emailPlaceholder: 'pl. gabor.toth@virgo.example',
  legalEntityLabel: 'Jogi személy (legalEntityId)',
  managerIdLabel: 'Közvetlen vezető (managerId, üres ha felsővezető)',
  managerIdPlaceholder: 'pl. emp-katalin',
  rolesLabel: 'Szerepkörök (EMPLOYEE kötelező)',
  birthDateLabel: 'Születési dátum (YYYY-MM-DD)',
  employmentStartLabel: 'Belépés dátuma (YYYY-MM-DD)',
  employmentEndLabel: 'Kilépés dátuma (opcionális, YYYY-MM-DD)',
  deputyIdsLabel: 'Helyettesek (deputyIds, vesszővel elválasztva)',
  deputyIdsPlaceholder: 'pl. emp-anna, emp-peter',
  createButton: '+ Munkavállaló hozzáadása',
  saveButton: 'Módosítások mentése',
  cancelButton: 'Mégse',
  listTitle: 'Munkavállalók (Employees)',
  totalCount: (count: number) => `Összesen: ${count} munkavállaló`,
  allEntitiesFilter: 'Mindkét cég (Kft. + Zrt.)',
  filterManagerPlaceholder: 'Szűrés managerId alapján...',
  refreshButton: 'Frissítés',
  loading: 'Munkavállalók betöltése...',
  empty: 'Nincs megjeleníthető munkavállaló a megadott szűrőkkel.',
  colId: 'ID',
  colNameAndEmail: 'Név és e-mail',
  colEntity: 'Cég',
  colManager: 'Vezető',
  colRoles: 'Szerepkörök',
  colDates: 'Belépés / Szül.',
  colDeputies: 'Helyettesek',
  colActions: 'Műveletek',
  noManager: '— (Felsővezető)',
  noDeputies: '—',
  editButton: 'Szerkesztés',
  deleteButton: 'Törlés',
  loadError: 'Nem sikerült betölteni a munkavállalókat.',
  saveError: 'Hiba történt a munkavállaló mentésekor.',
  deleteError: 'Hiba történt a munkavállaló törlésekor.',
} as const

export const entitlementAdminText = {
  tabLabel: 'Szabadságkeretek (Entitlements)',
  eyebrow: 'HR ADMINISZTRÁCIÓ · SZABADSÁGKERETEK',
  pageTitle: 'Szabadságkeretek (LeaveEntitlement) kezelése',
  pageIntro:
    'Munkavállalónkénti, évenkénti és komponensenkénti szabadságkeretek. Effektív keret = overrideDays ?? calculatedDays. A felhasznált (usedQ1–Q4, usedYear) mezők redundáns gyorsítótárak, amelyeket a recomputeEntitlementUsage() számol újra.',
  createTitle: 'Új szabadságkeret felvitele',
  editTitle: (id: string) => `Szabadságkeret szerkesztése: ${id}`,
  createSubtitle:
    'Kézi HR korrekció (overrideDays) megadása esetén az indoklás (overrideReason) kitöltése kötelező.',
  idLabel: 'Azonosító (id)',
  idPlaceholder: 'pl. ent-peter-2026-child',
  employeeIdLabel: 'Munkavállaló azonosító (employeeId)',
  employeeIdPlaceholder: 'pl. emp-peter',
  yearLabel: 'Év (year)',
  componentLabel: 'Komponens (component)',
  fullYearDaysLabel: 'Teljes éves napok (fullYearDays, opcionális)',
  calculatedDaysLabel: 'Számított napok (calculatedDays, opcionális)',
  overrideDaysLabel: 'HR kézi korrekció (overrideDays, opcionális)',
  overrideReasonLabel: 'HR korrekció indoklása (overrideReason)',
  overrideReasonPlaceholder: 'pl. Éves gyermeknyilatkozat alapján',
  payrollRefLabel: 'Bérszámfejtési referencia (payrollReferenceDays)',
  updatedByLabel: 'Módosító HR Admin (updatedBy)',
  createButton: '+ Szabadságkeret hozzáadása',
  saveButton: 'Módosítások mentése',
  cancelButton: 'Mégse',
  listTitle: 'Szabadságkeretek (LeaveEntitlement)',
  totalCount: (count: number) => `Összesen: ${count} keretsor`,
  filterEmployeePlaceholder: 'Szűrés employeeId alapján...',
  allComponentsFilter: 'Minden komponens',
  refreshButton: 'Frissítés',
  loading: 'Szabadságkeretek betöltése...',
  empty: 'Nincs megjeleníthető szabadságkeret a megadott szűrőkkel.',
  colEmployeeYear: 'Munkavállaló / Év',
  colComponent: 'Komponens',
  colEffective: 'Effektív (Számított / HR)',
  colPayrollRef: 'Bér ref.',
  colUsageCache: 'Felhasznált cache (Q1–Q4 = Év)',
  colReason: 'Indoklás / Módosítva',
  colActions: 'Műveletek',
  editButton: 'Szerkesztés',
  deleteButton: 'Törlés',
  loadError: 'Nem sikerült betölteni a szabadságkereteket.',
  saveError: 'Hiba történt a szabadságkeret mentésekor.',
  deleteError: 'Hiba történt a szabadságkeret törlésekor.',
} as const

export const leaveRequestAdminText = {
  tabLabel: 'Szabadságkérelmek (Requests)',
  eyebrow: 'HR ADMINISZTRÁCIÓ · SZABADSÁGKÉRELMEK',
  pageTitle: 'Szabadságkérelmek (LeaveRequest) kezelése',
  pageIntro:
    'Kérelmek áttekintése, rögzítése, státuszkezelése és HR általi visszavonása (REVOKED). A visszavont és elutasított kérelmek nem törlődnek véglegesen, a történetben megmaradnak.',
  createTitle: 'Új szabadságkérelem rögzítése',
  editTitle: () => 'Kérelem szerkesztése',
  createSubtitle:
    'Félnapos (AM/PM) kérelem esetén a kezdő és záró dátumnak meg kell egyeznie, és csak félnapot engedélyező szabadságtípus választható.',
  idLabel: 'Kérelem azonosító (id)',
  idPlaceholder: 'pl. req-0004',
  employeeIdLabel: 'Munkavállaló (employeeId)',
  employeeIdPlaceholder: 'pl. emp-peter',
  legalEntityLabel: 'Jogi személy pillanatkép (legalEntityId)',
  approverIdLabel: 'Jóváhagyó vezető (approverId)',
  approverIdPlaceholder: 'pl. emp-katalin',
  leaveTypeLabel: 'Szabadságtípus (leaveTypeCode)',
  startDateLabel: 'Kezdő dátum (startDate)',
  endDateLabel: 'Záró dátum (endDate)',
  dayPortionLabel: 'Napszak (dayPortion)',
  statusLabel: 'Státusz (status)',
  employeeCommentLabel: 'Munkavállalói megjegyzés (employeeComment)',
  employeeCommentPlaceholder: 'Opcionális megjegyzés...',
  revokeReasonLabel: 'HR visszavonás indoklása (kötelező REVOKED státuszhoz)',
  revokeReasonPlaceholder: 'pl. Munkavállalói kérésre HR által sztornózva',
  createButton: '+ Kérelem rögzítése',
  saveButton: 'Módosítások mentése',
  cancelButton: 'Mégse',
  listTitle: 'Szabadságkérelmek (LeaveRequest)',
  totalCount: (count: number) => `Összesen: ${count} kérelem`,
  allStatusesFilter: 'Minden státusz',
  allEntitiesFilter: 'Mindkét cég (Kft. + Zrt.)',
  filterEmployeePlaceholder: 'Szűrés employeeId alapján...',
  refreshButton: 'Frissítés',
  loading: 'Szabadságkérelmek betöltése...',
  empty: 'Nincs megjeleníthető szabadságkérelem a megadott szűrőkkel.',
  colIdAndEmployee: 'Kérelem / Munkavállaló',
  colTypeAndPortion: 'Típus / Napszak',
  colDates: 'Időszak',
  colApprover: 'Jóváhagyó',
  colStatus: 'Státusz',
  colDetails: 'Megjegyzés / Visszavonás oka',
  colActions: 'Műveletek',
  editButton: 'Szerkesztés',
  revokeButton: 'HR visszavonás (REVOKED)',
  loadError: 'Nem sikerült betölteni a szabadságkérelmeket.',
  saveError: 'Hiba történt a szabadságkérelem mentésekor.',
  revokeError: 'Hiba történt a szabadságkérelem visszavonásakor.',
} as const

/** Hungarian date format, e.g. "2026. 11. 13.". */
export const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split('-')
  return `${y}. ${m}. ${d}.`
}
