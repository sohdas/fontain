import { SIZE, type Bitmap } from './font'

export default function GlyphPreview({ bitmap }: { bitmap: Bitmap }) {
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" shapeRendering="crispEdges">
      {bitmap.flatMap((row, r) =>
        row.map((on, c) => (on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} /> : null)),
      )}
    </svg>
  )
}
