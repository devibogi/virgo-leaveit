import { describe, expect, it } from 'vitest'
import { buildXlsx, columnName, crc32 } from './xlsx.ts'

describe('xlsx writer', () => {
  it('names columns A..Z, AA', () => {
    expect([0, 1, 25, 26, 27].map(columnName)).toEqual(['A', 'B', 'Z', 'AA', 'AB'])
  })
  it('crc32 matches the reference value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
  it('builds a zip with sheet xml, escaped strings, numbers and merges', () => {
    const bytes = buildXlsx({ name: 'Virgo/Zrt', rows: [['Szabadság & <x>', 3]], merges: ['A1:B1'] })
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK')
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('xl/worksheets/sheet1.xml')
    expect(text).toContain('Szabadság &amp; &lt;x&gt;')
    expect(text).toContain('<c r="B1"><v>3</v></c>')
    expect(text).toContain('<mergeCell ref="A1:B1"/>')
    expect(text).toContain('name="Virgo Zrt"')
  })
})
