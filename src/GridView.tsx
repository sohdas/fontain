import { useState } from 'react'
import { LETTERS, NUMBERS, PUNCTUATION, exportFont, download, isEmpty, type Format, type Glyphs } from './font'
import { ValidationError, validateExport } from './validate'
import GlyphPreview from './GlyphPreview'

function Tile({ ch, glyphs, onOpen }: { ch: string; glyphs: Glyphs; onOpen: (c: string) => void }) {
  return (
    <button
      onClick={() => onOpen(ch)}
      className="group relative aspect-square rounded border border-neutral-300 bg-white p-2 hover:border-black"
    >
      <span className="absolute left-1 top-0.5 text-xs text-neutral-400">{ch}</span>
      {isEmpty(glyphs[ch]) ? (
        <span className="flex h-full items-center justify-center text-4xl text-neutral-200">{ch}</span>
      ) : (
        <GlyphPreview bitmap={glyphs[ch]} />
      )}
    </button>
  )
}

export default function GridView({ glyphs, onOpen }: { glyphs: Glyphs; onOpen: (c: string) => void }) {
  const [name, setName] = useState('MyFont')
  const [problems, setProblems] = useState<string[]>([])

  const doExport = async (fmt: Format) => {
    setProblems([])
    try {
      const { buf, name: family } = await validateExport(glyphs, name, fmt, (n) => exportFont(glyphs, fmt, n))
      download(buf, `${family.replace(/\s+/g, '-')}.${fmt}`)
    } catch (e) {
      setProblems(e instanceof ValidationError ? e.problems : [e instanceof Error ? e.message : String(e)])
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Fontain</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Font name"
            className="rounded border border-neutral-300 px-2 py-1"
          />
          {(['ttf', 'otf', 'woff'] as Format[]).map((f) => (
            <button
              key={f}
              onClick={() => doExport(f)}
              className="rounded bg-black px-3 py-1 text-sm font-medium text-white hover:bg-neutral-700"
            >
              Export .{f}
            </button>
          ))}
        </div>
      </header>
      {problems.length > 0 && (
        <div role="alert" className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-semibold">Export blocked:</p>
          <ul className="list-disc pl-5">
            {problems.slice(0, 8).map((p, i) => <li key={i}>{p}</li>)}
            {problems.length > 8 && <li>…and {problems.length - 8} more</li>}
          </ul>
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Letters</h2>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 md:grid-cols-7">
        {LETTERS.map((l) => <Tile key={l} ch={l} glyphs={glyphs} onOpen={onOpen} />)}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">Numbers</h2>
      <div className="grid grid-cols-5 gap-4 sm:grid-cols-10">
        {NUMBERS.map((n) => <Tile key={n} ch={n} glyphs={glyphs} onOpen={onOpen} />)}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">Punctuation</h2>
      <div className="grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8">
        {PUNCTUATION.map((p) => <Tile key={p} ch={p} glyphs={glyphs} onOpen={onOpen} />)}
      </div>
    </div>
  )
}
