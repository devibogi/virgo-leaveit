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

describe('xlsx styles', () => {
  it('writes styles.xml and dedupes identical styles', () => {
    const s = { font: { name: 'Arial', size: 8 }, border: { left: 'medium' as const } }
    const text = new TextDecoder().decode(
      buildXlsx({ name: 'S', rows: [[{ v: 'a', s }, { v: 1, s }, { v: 'b', s: { fill: 'C0C0C0' } }]], freeze: { rows: 3, cols: 2 } }),
    )
    expect(text).toContain('xl/styles.xml')
    expect(text).toContain('<c r="A1" s="1" t="inlineStr">')
    expect(text).toContain('<c r="B1" s="1"><v>1</v></c>')
    expect(text).toContain('<c r="C1" s="2"')
    expect(text).toContain('<fgColor rgb="FFC0C0C0"/>')
    expect(text).toContain('topLeftCell="C4"')
  })
})
