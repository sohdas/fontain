import { useMemo } from 'react'
import { SIZE, type Bitmap } from './font'

/** One <path> per glyph (horizontal runs) instead of one element per pixel. */
export default function GlyphPreview({ bitmap }: { bitmap: Bitmap }) {
  const d = useMemo(() => {
    const parts: string[] = []
    bitmap.forEach((row, r) => {
      let c = 0
      while (c < SIZE) {
        if (!row[c]) { c++; continue }
        const start = c
        while (c < SIZE && row[c]) c++
        parts.push(`M${start} ${r}h${c - start}v1h${start - c}z`)
      }
    })
    return parts.join('')
  }, [bitmap])
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" shapeRendering="crispEdges">
      <path d={d} />
    </svg>
  )
}
