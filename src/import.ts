import opentype from 'opentype.js'
import { BASELINE_LINE, GLYPHS, SIZE, emptyBitmap, type Bitmap, type Glyphs } from './font'

type Pt = [number, number]

/** Flatten a glyph path (font units, y-down from baseline) into closed polygons. */
function flatten(commands: opentype.PathCommand[]): Pt[][] {
  const polys: Pt[][] = []
  let cur: Pt[] = []
  let x = 0, y = 0
  const STEPS = 10
  for (const cmd of commands) {
    if (cmd.type === 'M') {
      if (cur.length) polys.push(cur)
      cur = [[cmd.x, cmd.y]]
      x = cmd.x; y = cmd.y
    } else if (cmd.type === 'L') {
      cur.push([cmd.x, cmd.y]); x = cmd.x; y = cmd.y
    } else if (cmd.type === 'Q') {
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS, u = 1 - t
        cur.push([u * u * x + 2 * u * t * cmd.x1 + t * t * cmd.x, u * u * y + 2 * u * t * cmd.y1 + t * t * cmd.y])
      }
      x = cmd.x; y = cmd.y
    } else if (cmd.type === 'C') {
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS, u = 1 - t
        cur.push([
          u ** 3 * x + 3 * u * u * t * cmd.x1 + 3 * u * t * t * cmd.x2 + t ** 3 * cmd.x,
          u ** 3 * y + 3 * u * u * t * cmd.y1 + 3 * u * t * t * cmd.y2 + t ** 3 * cmd.y,
        ])
      }
      x = cmd.x; y = cmd.y
    } else if (cmd.type === 'Z') {
      if (cur.length) polys.push(cur)
      cur = []
    }
  }
  if (cur.length) polys.push(cur)
  return polys
}

/** Non-zero winding point-in-shape test. */
function inside(polys: Pt[][], px: number, py: number): boolean {
  let wind = 0
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const [x0, y0] = poly[i]
      const [x1, y1] = poly[(i + 1) % poly.length]
      if ((y0 <= py && y1 > py) || (y1 <= py && y0 > py)) {
        const xAt = x0 + ((py - y0) / (y1 - y0)) * (x1 - x0)
        if (xAt > px) wind += y1 > y0 ? 1 : -1
      }
    }
  }
  return wind !== 0
}

function rasterize(glyph: opentype.Glyph, upm: number, scale: number): Bitmap {
  const bitmap = emptyBitmap()
  const polys = flatten(glyph.getPath(0, 0, upm).commands) // 1 unit = 1 font unit
  if (!polys.length) return bitmap
  const advance = glyph.advanceWidth ?? upm
  const offX = (SIZE - advance * scale) / 2 // centre horizontally
  const SUB = 4
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      let hits = 0
      for (let i = 0; i < SUB; i++) {
        for (let j = 0; j < SUB; j++) {
          // grid coords -> font units
          const gx = c + (j + 0.5) / SUB, gy = r + (i + 0.5) / SUB
          if (inside(polys, (gx - offX) / scale, (gy - BASELINE_LINE) / scale)) hits++
        }
      }
      bitmap[r][c] = hits >= (SUB * SUB) / 2
    }
  }
  return bitmap
}

export interface ImportResult { glyphs: Glyphs; name: string; found: number }

/** Parse a .ttf/.otf/.woff file and convert its glyphs to 25x25 bitmaps. */
export function importFont(buf: ArrayBuffer): ImportResult {
  const head = new TextDecoder('latin1').decode(new Uint8Array(buf, 0, Math.min(4, buf.byteLength)))
  if (head === 'wOF2') throw new Error('WOFF2 files are not supported. Use .ttf, .otf or .woff.')
  let font: opentype.Font
  try {
    font = opentype.parse(buf)
  } catch (e) {
    throw new Error(`Could not read this font file: ${e instanceof Error ? e.message : e}`)
  }

  const upm = font.unitsPerEm
  const asc = font.ascender > 0 ? font.ascender : 0.8 * upm
  const desc = font.descender < 0 ? -font.descender : 0.2 * upm
  // Baseline sits on grid line 20: fit ascender above it and descender below it
  const scale = Math.min(BASELINE_LINE / asc, (SIZE - BASELINE_LINE) / desc)

  const glyphs: Glyphs = {}
  let found = 0
  for (const ch of GLYPHS) {
    const g = font.charToGlyph(ch)
    if (!g || g.index === 0) { glyphs[ch] = emptyBitmap(); continue }
    glyphs[ch] = rasterize(g, upm, scale)
    found++
  }
  // opentype.js nests names by platform: names.windows.fontFamily.en, etc.
  const names = font.names as unknown as Record<string, { fontFamily?: Record<string, string> }>
  let name = ''
  for (const platform of ['windows', 'unicode', 'macintosh']) {
    const fam = names[platform]?.fontFamily
    if (fam) { name = fam.en ?? Object.values(fam)[0] ?? ''; if (name) break }
  }
  return { glyphs, name, found }
}
