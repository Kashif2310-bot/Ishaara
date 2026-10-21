import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import type { Brief } from '../../brief/types'

/** The spot, 500 m / 1 km / 2 km rings, and every mapped competitor with its distance. */
export function BriefMap({ brief }: { brief: Brief }) {
  const p = brief.place
  if (!p) return null
  return (
    <div className="relative h-[340px] overflow-hidden rounded-[1.5rem] ring-1 ring-forest/10">
      <MapContainer center={[p.lat, p.lng]} zoom={14} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {[2000, 1000, 500].map((r) => (
          <Circle key={r} center={[p.lat, p.lng]} radius={r} pathOptions={{ color: '#111111', weight: 1, dashArray: '4 4', fillColor: '#111111', fillOpacity: r === 500 ? 0.08 : 0.03 }} />
        ))}
        {brief.competitors.map((c, i) => (
          <CircleMarker key={`${c.lat}-${c.lng}-${i}`} center={[c.lat, c.lng]} radius={6} pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#dc2626', fillOpacity: 0.9 }}>
            <Tooltip>{`${c.name || `Unnamed ${c.kind.replace(/_/g, ' ')}`} · ${c.distanceM.toLocaleString('en-IN')} m`}</Tooltip>
          </CircleMarker>
        ))}
        <CircleMarker center={[p.lat, p.lng]} radius={9} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#111111', fillOpacity: 1 }}>
          <Tooltip permanent direction="top" offset={[0, -10]}>
            Your spot
          </Tooltip>
        </CircleMarker>
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-xl bg-white/90 px-3 py-2 text-[11px] text-ink/70 shadow backdrop-blur">
        <span className="mr-3 inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-600" /> similar businesses ({brief.competitors.length})</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-dashed border-ink" /> 500 m · 1 km · 2 km</span>
      </div>
    </div>
  )
}
