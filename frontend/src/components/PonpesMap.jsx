import { useEffect, useMemo } from 'react'
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import { Link } from 'react-router-dom'
import PonpesLocation from './PonpesLocation'
import { hasMapPoint } from '../lib/location'
import 'leaflet/dist/leaflet.css'

function Fit({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length)
      map.fitBounds(
        points.map((p) => [p.lat, p.lng]),
        { padding: [40, 40], maxZoom: 12 },
      )
  }, [map, points])
  return null
}
export default function PonpesMap({ items }) {
  const groups = useMemo(() => {
    const points = new Map()
    for (const item of items.filter(hasMapPoint)) {
      const key = `${item.latitude},${item.longitude}`
      if (!points.has(key))
        points.set(key, {
          lat: Number(item.latitude),
          lng: Number(item.longitude),
          items: [],
        })
      points.get(key).items.push(item)
    }
    return [...points.values()]
  }, [items])
  return (
    <div className="leaflet-wrap">
      <MapContainer
        center={[-7.1193, 112.415]}
        zoom={10}
        scrollWheelZoom={false}
        aria-label="Peta lokasi pesantren"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Fit points={groups} />
        {groups.map((point) => (
          <CircleMarker
            key={`${point.lat},${point.lng}`}
            center={[point.lat, point.lng]}
            radius={12}
            pathOptions={{
              color: '#fff',
              weight: 3,
              fillColor: '#246a4d',
              fillOpacity: 1,
            }}
          >
            <Popup>
              <div className="map-popup">
                {point.items.map((item) => (
                  <div key={item.id} className="map-popup-item">
                    <Link to={`/pesantren/${item.slug}`}>
                      {item.nama_ponpes} ↗
                    </Link>
                    <PonpesLocation ponpes={item} compact showCoordinates />
                  </div>
                ))}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <small>
        {groups.reduce((total, point) => total + point.items.length, 0)} dari{' '}
        {items.length} hasil pada halaman ini memiliki titik rujukan kompleks
        pendidikan. Titik bersumber dari data Kemendikdasmen, bukan penanda
        gerbang masuk.
      </small>
      {items.some((item) => !hasMapPoint(item)) && (
        <div className="unmapped-locations">
          <h3>Lokasi yang belum memiliki titik rujukan</h3>
          <p>
            Alamat yang belum dicocokkan tidak dipasang sebagai pin lokasi
            nyata.
          </p>
          {items
            .filter((item) => !hasMapPoint(item))
            .map((item) => (
              <article key={item.id}>
                <Link to={`/pesantren/${item.slug}`}>{item.nama_ponpes}</Link>
                <PonpesLocation ponpes={item} compact />
              </article>
            ))}
        </div>
      )}
    </div>
  )
}
