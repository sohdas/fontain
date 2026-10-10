import { useEffect, useState } from 'react'
import { GLYPHS, emptyBitmap, SIZE, type Glyphs } from './font'
import GridView from './GridView'
import DetailView from './DetailView'

const KEY = 'fontain-glyphs'

function load(): Glyphs {
  const base = Object.fromEntries(GLYPHS.map((l) => [l, emptyBitmap()])) as Glyphs
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Glyphs
    for (const l of GLYPHS) {
      const b = saved[l]
      if (Array.isArray(b) && b.length === SIZE && b.every((r) => Array.isArray(r) && r.length === SIZE)) base[l] = b
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
