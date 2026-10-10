import opentype from 'opentype.js'
import { Font as FEFont } from 'fonteditor-core'

export const SIZE = 32
export const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
// Printable ASCII punctuation (space excluded: it's always a blank glyph)
export const PUNCTUATION = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'.split('')
export const NUMBERS = '0123456789'.split('')
export const GLYPHS = [...LETTERS, ...NUMBERS, ...PUNCTUATION]

// PostScript-style glyph names, so exported fonts stay well-formed
const PS_NAMES: Record<string, string> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
  '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
  '!': 'exclam', '"': 'quotedbl', '#': 'numbersign', '$': 'dollar', '%': 'percent',
  '&': 'ampersand', "'": 'quotesingle', '(': 'parenleft', ')': 'parenright',
  '*': 'asterisk', '+': 'plus', ',': 'comma', '-': 'hyphen', '.': 'period', '/': 'slash',
  ':': 'colon', ';': 'semicolon', '<': 'less', '=': 'equal', '>': 'greater',
  '?': 'question', '@': 'at', '[': 'bracketleft', '\\': 'backslash', ']': 'bracketright',
  '^': 'asciicircum', '_': 'underscore', '`': 'grave', '{': 'braceleft', '|': 'bar',
  '}': 'braceright', '~': 'asciitilde',
}

export type Bitmap = boolean[][] // [row][col], row 0 = top
export type Glyphs = Record<string, Bitmap>
export type Format = 'ttf' | 'otf' | 'woff'

export const emptyBitmap = (): Bitmap =>
  Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false))

export const isEmpty = (b: Bitmap) => b.every((r) => r.every((v) => !v))

// Font units: UPM is chosen so every pixel is a whole number of units (1024 / 32 = 32)
export const UPM = 1024
export const BASELINE_LINE = 26 // grid line (0-SIZE) where the baseline sits; rows below are the descender
export const PX = UPM / SIZE
export const ASCENDER = BASELINE_LINE * PX // 832
export const DESCENDER = -(SIZE - BASELINE_LINE) * PX // -192

function glyphPath(bitmap: Bitmap): opentype.Path {
  const path = new opentype.Path()
  bitmap.forEach((row, r) => {
    let c = 0
    while (c < SIZE) {
      if (!row[c]) { c++; continue }
      const start = c
      while (c < SIZE && row[c]) c++
      const x0 = start * PX, x1 = c * PX
      const top = ASCENDER - r * PX, bottom = top - PX
      // counter-clockwise (y-up) for CFF outlines
      path.moveTo(x0, bottom)
      path.lineTo(x1, bottom)
      path.lineTo(x1, top)
      path.lineTo(x0, top)
      path.close()
    }
  })
  return path
}

export function buildFont(glyphs: Glyphs, name: string): opentype.Font {
  const list = [new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: UPM, path: new opentype.Path() }),
    new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: UPM, path: new opentype.Path() })]
  for (const ch of GLYPHS) {
    const path = glyphPath(glyphs[ch] ?? emptyBitmap())
    const psName = PS_NAMES[ch] ?? ch
    list.push(new opentype.Glyph({ name: psName, unicode: ch.charCodeAt(0), advanceWidth: UPM, path }))
  }
  // lowercase letters reuse the uppercase drawing
  for (const l of LETTERS) {
    const lower = l.toLowerCase()
    list.push(new opentype.Glyph({
      name: lower, unicode: lower.charCodeAt(0), advanceWidth: UPM, path: glyphPath(glyphs[l] ?? emptyBitmap()),
    }))
  }
  return new opentype.Font({
    familyName: name, styleName: 'Regular', unitsPerEm: UPM,
    ascender: ASCENDER, descender: DESCENDER, glyphs: list,
  })
}

export function exportFont(glyphs: Glyphs, format: Format, name = 'Fontain'): ArrayBuffer {
  const otf = buildFont(glyphs, name).toArrayBuffer()
  if (format === 'otf') return otf
  const f = FEFont.create(otf, { type: 'otf' })
  const out = f.write({ type: format, toBuffer: true }) as ArrayBuffer | Uint8Array
  if (out instanceof ArrayBuffer) return out
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer
}

export function download(buf: ArrayBuffer, filename: string) {
  const url = URL.createObjectURL(new Blob([buf]))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
