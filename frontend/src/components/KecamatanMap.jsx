import { useEffect, useMemo } from 'react'
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from 'react-leaflet'
import { KECAMATAN_POINTS } from '../lib/kecamatanPoints'
import 'leaflet/dist/leaflet.css'

function Fit({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length) map.fitBounds(points, { padding: [8, 12] })
  }, [map, points])
  return null
}

const bin = (count) => (count >= 4 ? 2 : count >= 2 ? 1 : 0)
const RADIUS = [6.5, 8.5, 11]
const FILL = ['#6f9a6d', '#4f7a52', '#c9a227']

export default function KecamatanMap({ districts = [], selected, onChoose }) {
  const points = useMemo(
    () =>
      districts.map((d) => KECAMATAN_POINTS[d.nama_kecamatan]).filter(Boolean),
    [districts],
  )
  const ranked = [...districts].sort(
    (a, b) =>
      (b.jumlah_ponpes || 0) - (a.jumlah_ponpes || 0) ||
      a.nama_kecamatan.localeCompare(b.nama_kecamatan, 'id'),
  )
  return (
    <div className="kecamatan-map">
      <div className="kecamatan-canvas">
        <MapContainer
          center={[-7.12, 112.32]}
          zoom={10}
          minZoom={9}
          maxBounds={[
            [-7.8, 111.6],
            [-6.5, 112.9],
          ]}
          scrollWheelZoom={false}
          zoomControl={false}
          className="kecamatan-map-canvas"
          aria-label="Peta sebaran pesantren di kecamatan Kabupaten Lamongan"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Fit points={points} />
          <ZoomControl position="topright" />
          {districts.map((d) => {
            const point = KECAMATAN_POINTS[d.nama_kecamatan]
            if (!point) return null
            const active = d.kecamatan_id === selected
            const count = d.jumlah_ponpes ?? 0
            const level = bin(count)
            return (
              <CircleMarker
                key={d.kecamatan_id}
                center={point}
                radius={RADIUS[level]}
                pathOptions={{
                  color: active ? '#f7f2e0' : '#24422f',
                  weight: active ? 3 : 1.4,
                  fillColor: FILL[level],
                  fillOpacity: active ? 1 : count ? 0.9 : 0.45,
                }}
                eventHandlers={{ click: () => onChoose?.(d.kecamatan_id) }}
              >
                {count >= 4 ? (
                  <Tooltip
                    direction="center"
                    permanent
                    className="kecamatan-count"
                    opacity={1}
                  >
                    {count}
                  </Tooltip>
                ) : (
                  <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                    <strong>{d.nama_kecamatan}</strong> · {count} pesantren
                  </Tooltip>
                )}
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>
      <aside className="kecamatan-side">
        <div className="kecamatan-legend" aria-hidden="true">
          <span>
            <em>Jumlah pesantren · {districts.length} kecamatan · gulir</em>
            {['1', '2–3', '4+'].map((label, i) => (
              <span key={label} style={{ marginLeft: i ? 9 : 0 }}>
                <i
                  style={{
                    width: RADIUS[i] * 2,
                    height: RADIUS[i] * 2,
                    background: FILL[i],
                  }}
                />
                {label}
              </span>
            ))}
          </span>
        </div>
        <ol className="kecamatan-list">
          {ranked.map((d) => {
            const count = d.jumlah_ponpes || 0
            const active = d.kecamatan_id === selected
            return (
              <li key={d.kecamatan_id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChoose?.(d.kecamatan_id)}
                >
                  <span className="kecamatan-name">{d.nama_kecamatan}</span>
                  <span className="kecamatan-value">{count}</span>
                </button>
              </li>
            )
          })}
        </ol>
        <p className="kecamatan-note">
          Titik = pusat kecamatan, bukan batas resmi.
        </p>
      </aside>
    </div>
  )
}
