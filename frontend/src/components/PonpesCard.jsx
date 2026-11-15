import { ArrowRight, BadgeCheck, MapPin, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { types } from '../lib/format'
import { hasRegistrationSeats } from '../lib/services'
import { documentStatuses } from './Oversight'
import { DiscoveryActions } from './DiscoveryActions'
import PonpesLocation from './PonpesLocation'

export function PondokArt({ variant = 0 }) {
  return (
    <div className={`pondok-art art-${variant % 4}`} aria-hidden="true">
      <img
        src={`/illustrations/campus-${variant % 4}.png`}
        alt=""
        loading="lazy"
        width="800"
        height="500"
      />
      <span className="art-caption">ILUSTRASI PESANTREN</span>
    </div>
  )
}
export default function PonpesCard({ ponpes, district }) {
  return (
    <article className="ponpes-card home-card">
      <Link to={`/pesantren/${ponpes.slug}`} tabIndex={-1} aria-hidden="true">
        <PondokArt variant={ponpes.id} />
      </Link>
      <DiscoveryActions ponpes={ponpes} compact />
      <div className="ponpes-card-body">
        <div className="card-meta home-card-meta">
          <span className="home-card-type">
            {types[ponpes.tipe_pesantren] || 'Data lembaga'}
          </span>
          <div className="home-card-badges">
            {ponpes.profil_referensi && (
              <span className="home-badge home-badge-source">
                <BadgeCheck size={13} aria-hidden="true" />
                {ponpes.referensi ? 'Profil bersumber' : 'Profil rujukan'}
              </span>
            )}
            <span className="home-badge home-badge-pending">
              {documentStatuses[ponpes.pengawasan?.status_dokumen] ||
                documentStatuses.belum_dikonfirmasi}
            </span>
          </div>
        </div>
        <h3 className="home-card-title">
          <Link to={`/pesantren/${ponpes.slug}`}>{ponpes.nama_ponpes}</Link>
        </h3>
        <Link
          to={`/status-pesantren/${ponpes.slug}`}
          className="text-link home-card-status"
        >
          Cek status pesantren
        </Link>
        <p className="muted icon-text home-card-place">
          <MapPin size={14} aria-hidden="true" />
          {district || 'Lamongan'}, Jawa Timur
        </p>
        <PonpesLocation ponpes={ponpes} compact />
        <div className="card-bottom home-card-bottom">
          <span>
            <Users size={15} aria-hidden="true" />
            {hasRegistrationSeats(ponpes)
              ? `${ponpes.sisa_kuota_putra + ponpes.sisa_kuota_putri} kuota tersedia`
              : ponpes.pendaftaran_tersedia
                ? 'Kuota penuh'
                : 'Pendaftaran belum tersedia'}
          </span>
          <Link
            to={`/pesantren/${ponpes.slug}`}
            aria-label={`Lihat ${ponpes.nama_ponpes}`}
            className="home-card-link"
          >
            Lihat profil
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  )
}
