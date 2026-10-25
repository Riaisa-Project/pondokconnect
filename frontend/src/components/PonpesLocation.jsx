import { MapPin, Navigation, ExternalLink } from 'lucide-react'
import { directionsUrl } from '../lib/location'

export default function PonpesLocation({
  ponpes,
  compact = false,
  showCoordinates = false,
}) {
  const location = ponpes.lokasi,
    directions = directionsUrl(ponpes)
  const hasAddress =
    ponpes.alamat_lengkap &&
    !ponpes.alamat_lengkap.startsWith('Alamat simulasi')
  return (
    <div className={`ponpes-location ${compact ? 'location-compact' : ''}`}>
      <p className="location-address">
        <MapPin size={15} aria-hidden="true" />
        <span>
          {hasAddress ? ponpes.alamat_lengkap : 'Alamat belum diverifikasi'}
        </span>
      </p>
      {location?.alamat_bersumber ? (
        <>
          <div className="location-meta">
            <a
              href={location.sumber_alamat_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Sumber alamat <ExternalLink size={11} />
            </a>
            {!compact && location.diperiksa_pada && (
              <small>
                Dicocokkan{' '}
                {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(
                  new Date(`${location.diperiksa_pada}T00:00:00`),
                )}
              </small>
            )}
          </div>
          <a
            className="location-directions"
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Petunjuk arah ke ${ponpes.nama_ponpes}`}
          >
            <Navigation size={14} /> Petunjuk arah <ExternalLink size={12} />
          </a>
        </>
      ) : (
        <small className="location-unverified">
          {hasAddress
            ? 'Alamat dari pengurus; sumber belum dicocokkan.'
            : 'Lokasi nyata belum dapat dipastikan. Hubungi pengurus untuk konfirmasi.'}
        </small>
      )}
      {showCoordinates && location?.pin_tersedia && (
        <p className="location-point-note">
          Titik kompleks pendidikan: {location.referensi_titik}. Bukan penanda
          gerbang masuk.{' '}
          <a
            href={location.sumber_koordinat_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Sumber titik <ExternalLink size={11} />
          </a>
        </p>
      )}
    </div>
  )
}
