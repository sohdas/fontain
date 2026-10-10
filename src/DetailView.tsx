import { useEffect, useMemo, useRef, useState } from 'react'
import { BASELINE_LINE, SIZE, emptyBitmap, type Bitmap } from './font'

type Tool = 'pencil' | 'line' | 'bezier'
type Cell = { r: number; c: number }
type Pt = { x: number; y: number } // grid units; x = column, y = row (cell centres are at +0.5)
interface Curve { pts: [Pt, Pt, Pt, Pt]; value: boolean; base: Bitmap }

const BRUSH_SIZES = [1, 2, 3, 4, 6, 8]
// Vertical stem guides (grid lines) marking where the left/right strokes of a glyph usually sit
const STEM_LINES = [Math.round(SIZE * 0.2), Math.round(SIZE * 0.8)]

/** Cells on the straight line between two cells (Bresenham). */
function lineCells(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = []
  let { r, c } = a
  const dr = Math.abs(b.r - r), dc = Math.abs(b.c - c)
  const sr = r < b.r ? 1 : -1, sc = c < b.c ? 1 : -1
  let err = dc - dr
  for (;;) {
    out.push({ r, c })
    if (r === b.r && c === b.c) break
    const e2 = 2 * err
    if (e2 > -dr) { err -= dr; c += sc }
    if (e2 < dc) { err += dc; r += sr }
  }
  return out
}

/** Returns a copy of `base` with a brush-sized stamp applied along the line a→b. */
function paintLine(base: Bitmap, a: Cell, b: Cell, brush: number, value: boolean): Bitmap {
  const next = base.map((row) => row.slice())
  const off = Math.floor((brush - 1) / 2)
  for (const { r, c } of lineCells(a, b)) {
    for (let i = 0; i < brush; i++) {
      for (let j = 0; j < brush; j++) {
        const rr = r - off + i, cc = c - off + j
        if (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) next[rr][cc] = value
      }
    }
  }
  return next
}

const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const HANDLE_RADIUS = 1.2 // how close (in cells) a click must be to grab a point

/** Draw a cubic Bezier onto a copy of curve.base, using the current brush. */
function renderCurve(curve: Curve, brush: number): Bitmap {
  const [p0, p1, p2, p3] = curve.pts
  const length = dist(p0, p1) + dist(p1, p2) + dist(p2, p3)
  const steps = Math.max(2, Math.ceil(length * 3))
  const toCell = (p: Pt): Cell => ({
    r: Math.max(0, Math.min(SIZE - 1, Math.floor(p.y))),
    c: Math.max(0, Math.min(SIZE - 1, Math.floor(p.x))),
  })
  let out = curve.base
  let prev = toCell(p0)
  out = paintLine(out, prev, prev, brush, curve.value)
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const a = lerp(lerp(p0, p1, t), lerp(p1, p2, t), t)
    const b = lerp(lerp(p1, p2, t), lerp(p2, p3, t), t)
    const cell = toCell(lerp(a, b, t))
    if (cell.r === prev.r && cell.c === prev.c) continue
    out = paintLine(out, prev, cell, brush, curve.value)
    prev = cell
  }
  return out
}

export default function DetailView({
  letter, bitmap, onChange, onBack,
}: { letter: string; bitmap: Bitmap; onChange: (b: Bitmap) => void; onBack: () => void }) {
  const [tool, setTool] = useState<Tool>('pencil')
  const [brush, setBrush] = useState(1)
  const [showGuides, setShowGuides] = useState(true)
  const [preview, setPreview] = useState<Bitmap | null>(null)
  const [curve, setCurveState] = useState<Curve | null>(null)
  const curveRef = useRef<Curve | null>(null)
  const bezierDrag = useRef<'new' | number | null>(null)
  const setCurve = (c: Curve | null) => { curveRef.current = c; setCurveState(c) }
  const gridRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ start: Cell; last: Cell; value: boolean; base: Bitmap } | null>(null)
  const current = useRef(bitmap)
  current.current = bitmap

  const cellAt = (e: React.PointerEvent): Cell => {
    const rect = gridRef.current!.getBoundingClientRect()
    const clamp = (n: number) => Math.max(0, Math.min(SIZE - 1, n))
    return {
      c: clamp(Math.floor(((e.clientX - rect.left) / rect.width) * SIZE)),
      r: clamp(Math.floor(((e.clientY - rect.top) / rect.height) * SIZE)),
    }
  }

  const pointAt = (e: React.PointerEvent): Pt => {
    const c = cellAt(e)
    return { x: c.c + 0.5, y: c.r + 0.5 } // snap to cell centres
  }

  /** Paint the pending curve into the glyph. Returns the resulting bitmap. */
  const commitCurve = (): Bitmap => {
    const cv = curveRef.current
    if (!cv) return current.current
    const bmp = renderCurve(cv, brush)
    current.current = bmp
    onChange(bmp)
    setCurve(null)
    return bmp
  }

  const changeTool = (t: Tool) => { commitCurve(); setTool(t) }
  const goBack = () => { commitCurve(); onBack() }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!curveRef.current) return
      if (e.key === 'Enter') commitCurve()
      else if (e.key === 'Escape') setCurve(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onBezierDown = (e: React.PointerEvent) => {
    const p = pointAt(e)
    const cv = curveRef.current
    if (cv) {
      const idx = cv.pts.findIndex((q) => dist(q, p) <= HANDLE_RADIUS)
      if (idx >= 0) { bezierDrag.current = idx; return }
    }
    const base = cv ? commitCurve() : current.current // clicking away applies the pending curve
    const value = !base[Math.floor(p.y)][Math.floor(p.x)]
    setCurve({ pts: [p, p, p, p], value, base })
    bezierDrag.current = 'new'
  }

  const onBezierMove = (e: React.PointerEvent) => {
    const cv = curveRef.current
    const mode = bezierDrag.current
    if (!cv || mode === null) return
    const p = pointAt(e)
    const pts = [...cv.pts] as Curve['pts']
    if (mode === 'new') {
      pts[3] = p
      pts[1] = lerp(pts[0], p, 1 / 3)
      pts[2] = lerp(pts[0], p, 2 / 3)
    } else {
      pts[mode] = p
    }
    setCurve({ ...cv, pts })
  }

  const onBezierUp = () => {
    const cv = curveRef.current
    if (bezierDrag.current === 'new' && cv && dist(cv.pts[0], cv.pts[3]) < 0.5) setCurve(null) // plain click: no curve
    bezierDrag.current = null
  }

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    if (tool === 'bezier') return onBezierDown(e)
    const cell = cellAt(e)
    // Starting on a black pixel erases; starting on an empty one draws
    const value = !current.current[cell.r][cell.c]
    drag.current = { start: cell, last: cell, value, base: current.current }
    const next = paintLine(current.current, cell, cell, brush, value)
    if (tool === 'pencil') onChange(next)
    else setPreview(next)
  }

  const onMove = (e: React.PointerEvent) => {
    if (tool === 'bezier') return onBezierMove(e)
    const d = drag.current
    if (!d) return
    const cell = cellAt(e)
    if (cell.r === d.last.r && cell.c === d.last.c) return
    if (tool === 'pencil') {
      onChange(paintLine(current.current, d.last, cell, brush, d.value))
      d.last = cell
    } else {
      d.last = cell
      setPreview(paintLine(d.base, d.start, cell, brush, d.value))
    }
  }

  const onUp = () => {
    if (tool === 'bezier') return onBezierUp()
    const d = drag.current
    drag.current = null
    if (d && tool === 'line') onChange(paintLine(d.base, d.start, d.last, brush, d.value))
    setPreview(null)
  }

  const curveBitmap = useMemo(() => (curve ? renderCurve(curve, brush) : null), [curve, brush])
  const shown = curveBitmap ?? preview ?? bitmap
  const btn = (active: boolean) =>
    `rounded border px-3 py-1 text-sm ${active ? 'border-black bg-black text-white' : 'border-neutral-300 hover:bg-neutral-100'}`

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 p-6">
      <div className="flex w-full items-center justify-between">
        <button onClick={goBack} className="rounded border border-neutral-300 px-3 py-1 hover:bg-neutral-100">
          ← Back
        </button>
        <h2 className="text-2xl font-bold">Glyph {letter}</h2>
        <button
          onClick={() => { setCurve(null); onChange(emptyBitmap()) }}
          className="rounded border border-neutral-300 px-3 py-1 hover:bg-neutral-100"
        >
          Clear
        </button>
      </div>

      <div className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-1" role="group" aria-label="Tool">
          <button className={btn(tool === 'pencil')} onClick={() => changeTool('pencil')}>✏️ Pencil</button>
          <button className={btn(tool === 'line')} onClick={() => changeTool('line')}>╱ Line</button>
          <button className={btn(tool === 'bezier')} onClick={() => changeTool('bezier')}>∿ Curve</button>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Brush size">
          <span className="mr-1 text-sm text-neutral-500">Brush</span>
          {BRUSH_SIZES.map((n) => (
            <button key={n} className={btn(brush === n) + ' w-8 px-0 text-center'} onClick={() => setBrush(n)}>{n}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} />
          Guides
        </label>
      </div>
      <p className="text-sm text-neutral-500">
        {tool === 'bezier'
          ? 'Drag to place a curve, then drag its four points to shape it. Enter applies, Esc cancels.'
          : tool === 'line' ? 'Drag to draw a straight line.' : 'Click or drag to draw.'}{' '}
        Starting on a black pixel erases.
      </p>

      <div className="relative w-full max-w-[550px] border border-neutral-400">
        <div
          ref={gridRef}
          className="grid touch-none select-none"
          style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {shown.map((row, r) =>
            row.map((on, c) => (
              <div key={`${r}-${c}`} className={`aspect-square border border-neutral-200 ${on ? 'bg-black' : 'bg-white'}`} />
            )),
          )}
        </div>
        {curve && (
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            {([[0, 1], [3, 2]] as const).map(([a, b]) => (
              <line key={a} x1={curve.pts[a].x} y1={curve.pts[a].y} x2={curve.pts[b].x} y2={curve.pts[b].y}
                stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
            ))}
            {curve.pts.map((q, i) => (
              <circle key={i} cx={q.x} cy={q.y} r={0.55}
                fill={i === 0 || i === 3 ? '#3b82f6' : 'white'} stroke="#3b82f6" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
        )}
        {showGuides && (
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            {STEM_LINES.map((x) => (
              <line key={x} x1={x} x2={x} y1={0} y2={SIZE} stroke="#86efac" strokeOpacity={0.8} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            ))}
            <line x1={0} x2={SIZE} y1={BASELINE_LINE} y2={BASELINE_LINE} stroke="#4ade80" strokeOpacity={0.9} strokeWidth={3} vectorEffect="non-scaling-stroke" />
          </svg>
        )}
      </div>
      {curve && (
        <div className="flex gap-2">
          <button onClick={commitCurve} className="rounded bg-black px-3 py-1 text-sm text-white hover:bg-neutral-700">Apply curve</button>
          <button onClick={() => setCurve(null)} className="rounded border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100">Cancel</button>
        </div>
      )}
      {showGuides && (
        <p className="text-xs text-green-600">Green: baseline (horizontal) and stem guides (vertical)</p>
      )}
    </div>
  )
}
