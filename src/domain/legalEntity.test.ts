import { describe, expect, it } from 'vitest'
import {
  getLegalEntity,
  isLegalEntityId,
  LEGAL_ENTITIES,
  LEGAL_ENTITY_IDS,
  LegalEntityEnum,
} from './legalEntity.ts'

describe('LegalEntity enum & helpers', () => {
  it('exposes VIRGO_KFT and VIRGO_ZRT enum values', () => {
    expect(LegalEntityEnum.VIRGO_KFT).toBe('VIRGO_KFT')
    expect(LegalEntityEnum.VIRGO_ZRT).toBe('VIRGO_ZRT')
    expect(LEGAL_ENTITY_IDS).toEqual(['VIRGO_KFT', 'VIRGO_ZRT'])
    expect(LEGAL_ENTITIES).toEqual([
      { id: 'VIRGO_KFT', name: 'Virgo Kft.' },
      { id: 'VIRGO_ZRT', name: 'Virgo Zrt.' },
    ])
  })

  it('validates legalEntityId values with type guard', () => {
    expect(isLegalEntityId('VIRGO_KFT')).toBe(true)
    expect(isLegalEntityId('VIRGO_ZRT')).toBe(true)
    expect(isLegalEntityId('OTHER')).toBe(false)
    expect(isLegalEntityId(null)).toBe(false)
  })

  it('returns LegalEntity descriptor by id', () => {
    expect(getLegalEntity(LegalEntityEnum.VIRGO_KFT)).toEqual({
      id: 'VIRGO_KFT',
      name: 'Virgo Kft.',
    })
    expect(getLegalEntity(LegalEntityEnum.VIRGO_ZRT)).toEqual({
      id: 'VIRGO_ZRT',
      name: 'Virgo Zrt.',
    })
  })
})
