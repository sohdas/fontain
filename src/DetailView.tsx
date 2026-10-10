import { useRef, useState } from 'react'
import { BASELINE_LINE, SIZE, emptyBitmap, type Bitmap } from './font'

type Tool = 'pencil' | 'line'
type Cell = { r: number; c: number }

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

export default function DetailView({
  letter, bitmap, onChange, onBack,
}: { letter: string; bitmap: Bitmap; onChange: (b: Bitmap) => void; onBack: () => void }) {
  const [tool, setTool] = useState<Tool>('pencil')
  const [brush, setBrush] = useState(1)
  const [showGuides, setShowGuides] = useState(true)
  const [preview, setPreview] = useState<Bitmap | null>(null)
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

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const cell = cellAt(e)
    // Starting on a black pixel erases; starting on an empty one draws
    const value = !current.current[cell.r][cell.c]
    drag.current = { start: cell, last: cell, value, base: current.current }
    const next = paintLine(current.current, cell, cell, brush, value)
    if (tool === 'pencil') onChange(next)
    else setPreview(next)
  }

  const onMove = (e: React.PointerEvent) => {
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
    const d = drag.current
    drag.current = null
    if (d && tool === 'line') onChange(paintLine(d.base, d.start, d.last, brush, d.value))
    setPreview(null)
  }

  const shown = preview ?? bitmap
  const btn = (active: boolean) =>
    `rounded border px-3 py-1 text-sm ${active ? 'border-black bg-black text-white' : 'border-neutral-300 hover:bg-neutral-100'}`

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 p-6">
      <div className="flex w-full items-center justify-between">
        <button onClick={onBack} className="rounded border border-neutral-300 px-3 py-1 hover:bg-neutral-100">
          ← Back
        </button>
        <h2 className="text-2xl font-bold">Glyph {letter}</h2>
        <button
          onClick={() => onChange(emptyBitmap())}
          className="rounded border border-neutral-300 px-3 py-1 hover:bg-neutral-100"
        >
          Clear
        </button>
      </div>

      <div className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-1" role="group" aria-label="Tool">
          <button className={btn(tool === 'pencil')} onClick={() => setTool('pencil')}>✏️ Pencil</button>
          <button className={btn(tool === 'line')} onClick={() => setTool('line')}>╱ Line</button>
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
        {tool === 'line' ? 'Drag to draw a straight line.' : 'Click or drag to draw.'} Starting on a black pixel erases.
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
      {showGuides && (
        <p className="text-xs text-green-600">Green: baseline (horizontal) and stem guides (vertical)</p>
      )}
    </div>
  )
}
