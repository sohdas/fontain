import { useRef, useState } from 'react'
import { SIZE, emptyBitmap, type Bitmap } from './font'

export default function DetailView({
  letter, bitmap, onChange, onBack,
}: { letter: string; bitmap: Bitmap; onChange: (b: Bitmap) => void; onBack: () => void }) {
  const [paint, setPaint] = useState<boolean | null>(null)
  const current = useRef(bitmap)
  current.current = bitmap

  const set = (r: number, c: number, v: boolean) => {
    if (current.current[r][c] === v) return
    const next = current.current.map((row) => row.slice())
    next[r][c] = v
    current.current = next
    onChange(next)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 p-6" onPointerUp={() => setPaint(null)}>
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
      <p className="text-sm text-neutral-500">Click or drag to draw. Click a black pixel to erase.</p>
      <div
        className="grid w-full max-w-[550px] touch-none select-none border border-neutral-400"
        style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}
        onPointerLeave={() => setPaint(null)}
        onPointerMove={(e) => {
          if (paint === null) return
          const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
          const r = el?.dataset.r, c = el?.dataset.c
          if (r !== undefined && c !== undefined) set(+r, +c, paint)
        }}
      >
        {bitmap.map((row, r) =>
          row.map((on, c) => (
            <div
              key={`${r}-${c}`}
              data-r={r}
              data-c={c}
              onPointerDown={(e) => {
                e.preventDefault()
                ;(e.currentTarget.parentElement as HTMLElement).releasePointerCapture?.(e.pointerId)
                const v = !on
                setPaint(v)
                set(r, c, v)
              }}
              className={`aspect-square border border-neutral-200 ${on ? 'bg-black' : 'bg-white'}`}
            />
          )),
        )}
      </div>
    </div>
  )
}
