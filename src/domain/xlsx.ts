/**
 * Minimal dependency-free .xlsx writer (one sheet, inline strings, numbers, merged cells).
 * Output is an uncompressed (STORE) ZIP container, which Excel / Numbers / LibreOffice open.
 */

export type XlsxBorder = 'thin' | 'medium'

export interface XlsxStyle {
  font?: { name?: string; size?: number; bold?: boolean; color?: string }
  /** Solid fill, RGB hex like "C0C0C0". */
  fill?: string
  border?: { left?: XlsxBorder; right?: XlsxBorder; top?: XlsxBorder; bottom?: XlsxBorder }
  align?: { h?: 'left' | 'center' | 'right' | 'justify'; v?: 'top' | 'center' | 'bottom'; wrap?: boolean }
  /** Built-in number format id (1 = "0"). */
  numFmtId?: number
}

export type XlsxValue = string | number | null | undefined
export type XlsxCell = XlsxValue | { v: XlsxValue; s?: XlsxStyle }

export interface XlsxSheet {
  name: string
  rows: readonly (readonly XlsxCell[])[]
  /** Row heights in points, by row index. */
  rowHeights?: readonly (number | undefined)[]
  /** Freeze panes: number of top rows / left columns kept visible. */
  freeze?: { rows: number; cols: number }
  /** A1-style ranges, e.g. "C1:L1". */
  merges?: readonly string[]
  /** Column widths in characters, by column index. */
  colWidths?: readonly number[]
}

const enc = new TextEncoder()
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function columnName(index: number): string {
  let n = index + 1
  let name = ''
  while (n > 0) {
    const r = (n - 1) % 26
    name = String.fromCharCode(65 + r) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

class StyleTable {
  fonts = ['<font><sz val="11"/><name val="Calibri"/></font>']
  fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>']
  borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>']
  xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>']
  private idx(list: string[], xml: string) {
    const i = list.indexOf(xml)
    if (i >= 0) return i
    list.push(xml)
    return list.length - 1
  }
  add(st: XlsxStyle): number {
    const f = st.font ?? {}
    const fontId = this.idx(
      this.fonts,
      `<font>${f.bold ? '<b/>' : ''}<sz val="${f.size ?? 11}"/>${f.color ? `<color rgb="FF${f.color}"/>` : ''}<name val="${esc(f.name ?? 'Calibri')}"/></font>`,
    )
    const fillId = st.fill
      ? this.idx(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${st.fill}"/><bgColor indexed="64"/></patternFill></fill>`)
      : 0
    const b = st.border ?? {}
    const side = (n: string, v?: XlsxBorder) => (v ? `<${n} style="${v}"><color indexed="64"/></${n}>` : `<${n}/>`)
    const borderId = this.idx(
      this.borders,
      `<border>${side('left', b.left)}${side('right', b.right)}${side('top', b.top)}${side('bottom', b.bottom)}<diagonal/></border>`,
    )
    const a = st.align
    const align = a
      ? `<alignment${a.h ? ` horizontal="${a.h}"` : ''}${a.v ? ` vertical="${a.v}"` : ''}${a.wrap ? ' wrapText="1"' : ''}/>`
      : ''
    const numFmtId = st.numFmtId ?? 0
    return this.idx(
      this.xfs,
      `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"` +
        `${numFmtId ? ' applyNumberFormat="1"' : ''} applyFont="1" applyFill="1" applyBorder="1"${align ? ` applyAlignment="1">${align}</xf>` : '/>'}`,
    )
  }
  xml(): string {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts>` +
      `<fills count="${this.fills.length}">${this.fills.join('')}</fills>` +
      `<borders count="${this.borders.length}">${this.borders.join('')}</borders>` +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>'
    )
  }
}

function sheetXml(sheet: XlsxSheet, styles: StyleTable): string {
  const cols = sheet.colWidths?.length
    ? `<cols>${sheet.colWidths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('')}</cols>`
    : ''
  const rows = sheet.rows
    .map((row, r) => {
      const cells = row
        .map((cell, c) => {
          const ref = `${columnName(c)}${r + 1}`
          const { v, s } = cell !== null && typeof cell === 'object' ? cell : { v: cell, s: undefined }
          const sAttr = s ? ` s="${styles.add(s)}"` : ''
          if (typeof v === 'number') return `<c r="${ref}"${sAttr}><v>${v}</v></c>`
          if (v === null || v === undefined || v === '') return sAttr ? `<c r="${ref}"${sAttr}/>` : ''
          return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`
        })
        .join('')
      const h = sheet.rowHeights?.[r]
      return `<row r="${r + 1}"${h ? ` ht="${h}" customHeight="1"` : ''}>${cells}</row>`
    })
    .join('')
  const fz = sheet.freeze
  const views =
    fz && (fz.rows || fz.cols)
      ? `<sheetViews><sheetView workbookViewId="0"><pane${fz.cols ? ` xSplit="${fz.cols}"` : ''}${fz.rows ? ` ySplit="${fz.rows}"` : ''}` +
        ` topLeftCell="${columnName(fz.cols)}${fz.rows + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>`
      : ''
  const merges = sheet.merges?.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
    : ''
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `${views}${cols}<sheetData>${rows}</sheetData>${merges}</worksheet>`
  )
}

/** Excel sheet names: max 31 chars, none of []:*?/\ */
const sheetName = (s: string) => s.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet1'

export function buildXlsx(sheet: XlsxSheet): Uint8Array {
  const styles = new StyleTable()
  const sheetBody = sheetXml(sheet, styles)
  const files: [string, string][] = [
    [
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '</Types>',
    ],
    [
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ],
    [
      'xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets><sheet name="${esc(sheetName(sheet.name))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>',
    ],
    ['xl/worksheets/sheet1.xml', sheetBody],
    ['xl/styles.xml', styles.xml()],
  ]
  return zipStore(files.map(([name, text]) => [name, enc.encode(text)]))
}

// ---- ZIP (STORE, no compression) ----

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function zipStore(entries: [string, Uint8Array][]): Uint8Array {
  const DOS_DATE = (2026 - 1980) << 9 | 1 << 5 | 1 // fixed date → deterministic output
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const [name, data] of entries) {
    const nameBytes = enc.encode(name)
    const crc = crc32(data)
    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true) // UTF-8 names
    lv.setUint16(8, 0, true) // STORE
    lv.setUint16(10, 0, true)
    lv.setUint16(12, DOS_DATE, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)
    locals.push(local)

    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, DOS_DATE, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    centrals.push(central)
    offset += local.length
  }
  const centralSize = centrals.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  const out = new Uint8Array(offset + centralSize + 22)
  let p = 0
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, p)
    p += part.length
  }
  return out
}
