import type { LegalEntity, LegalEntityId } from '../types/model.ts'

export type { LegalEntity, LegalEntityId }

/**
 * Fixed enum of supported legal entities (Virgo Kft. and Virgo Zrt.).
 */
export const LegalEntityEnum = {
  VIRGO_KFT: 'VIRGO_KFT',
  VIRGO_ZRT: 'VIRGO_ZRT',
} as const satisfies Record<LegalEntityId, LegalEntityId>

export const LEGAL_ENTITY_IDS: readonly LegalEntityId[] = [
  LegalEntityEnum.VIRGO_KFT,
  LegalEntityEnum.VIRGO_ZRT,
] as const

export const LEGAL_ENTITIES: readonly LegalEntity[] = [
  { id: LegalEntityEnum.VIRGO_KFT, name: 'Virgo Kft.' },
  { id: LegalEntityEnum.VIRGO_ZRT, name: 'Virgo Zrt.' },
] as const

export function isLegalEntityId(value: unknown): value is LegalEntityId {
  return (
    value === LegalEntityEnum.VIRGO_KFT || value === LegalEntityEnum.VIRGO_ZRT
  )
}

export function getLegalEntity(id: LegalEntityId): LegalEntity {
  const found = LEGAL_ENTITIES.find((entity) => entity.id === id)
  if (!found) {
    throw new Error(`Ismeretlen jogi személy (LegalEntityId): ${String(id)}`)
  }
  return found
}
