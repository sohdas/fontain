import { useEffect, useState } from 'react'
import { ASCENDER, GLYPHS, PX, SIZE, UPM, emptyBitmap, type Bitmap, type Glyphs } from './font'
import GridView from './GridView'
import DetailView from './DetailView'

const KEY = 'fontain-glyphs'

/** Resample a drawing from the old 25x25 grid (1000 upm, 40 units/pixel, baseline at row 20) to the current grid. */
function migrate25(old: Bitmap): Bitmap {
  const next = emptyBitmap()
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      // centre of this cell in the old 1000-unit coordinate system
      const x = ((c + 0.5) / SIZE) * 1000
      const y = ((ASCENDER - (r + 0.5) * PX) / UPM) * 1000
      const oc = Math.floor(x / 40), or = Math.floor((800 - y) / 40)
      if (oc >= 0 && oc < 25 && or >= 0 && or < 25) next[r][c] = !!old[or]?.[oc]
    }
  }
  return next
}

function load(): Glyphs {
  const base = Object.fromEntries(GLYPHS.map((l) => [l, emptyBitmap()])) as Glyphs
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Glyphs
    for (const l of GLYPHS) {
      const b = saved[l]
      const isGrid = (n: number) => Array.isArray(b) && b.length === n && b.every((r) => Array.isArray(r) && r.length === n)
      if (isGrid(SIZE)) base[l] = b
      else if (isGrid(25)) base[l] = migrate25(b) // drawings saved before the 32x32 switch
    }
  } catch { /* ignore */ }
  return base
}

export default function App() {
  const [glyphs, setGlyphs] = useState<Glyphs>(load)
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => localStorage.setItem(KEY, JSON.stringify(glyphs)), [glyphs])

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {active ? (
        <DetailView
          letter={active}
          bitmap={glyphs[active]}
          onChange={(b) => setGlyphs((g) => ({ ...g, [active]: b }))}
          onBack={() => setActive(null)}
        />
      ) : (
        <GridView glyphs={glyphs} onOpen={setActive} onImport={setGlyphs} />
      )}
    </div>
  )
}
