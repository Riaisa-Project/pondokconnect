import { ArrowUpRight, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { types } from '../lib/format'
import { hasRegistrationSeats } from '../lib/services'
import { Badge } from './UI'
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
    <article className="ponpes-card">
      <Link to={`/pesantren/${ponpes.slug}`} tabIndex={-1} aria-hidden="true">
        <PondokArt variant={ponpes.id} />
      </Link>
      <DiscoveryActions ponpes={ponpes} compact />
      <div className="ponpes-card-body">
        <div className="card-meta">
          <span>{types[ponpes.tipe_pesantren] || 'Data lembaga'}</span>
          {ponpes.profil_referensi && (
            <Badge>
              {ponpes.referensi ? 'Profil bersumber' : 'Profil rujukan'}
            </Badge>
          )}
          <Badge>
            {documentStatuses[ponpes.pengawasan?.status_dokumen] ||
              documentStatuses.belum_dikonfirmasi}
          </Badge>
        </div>
        <h3>
          <Link to={`/pesantren/${ponpes.slug}`}>{ponpes.nama_ponpes}</Link>
        </h3>
        <Link to={`/status-pesantren/${ponpes.slug}`} className="text-link">
          Cek status pesantren
        </Link>
        <p className="muted icon-text">{district || 'Lamongan'}, Jawa Timur</p>
        <PonpesLocation ponpes={ponpes} compact />
        <div className="card-bottom">
          <span>
            <Users size={15} />
            {hasRegistrationSeats(ponpes)
              ? `${ponpes.sisa_kuota_putra + ponpes.sisa_kuota_putri} kuota tersedia`
              : ponpes.pendaftaran_tersedia
                ? 'Kuota penuh'
                : 'Pendaftaran belum tersedia'}
          </span>
          <Link
            to={`/pesantren/${ponpes.slug}`}
            aria-label={`Lihat ${ponpes.nama_ponpes}`}
            className="card-arrow"
          >
            <ArrowUpRight size={20} />
          </Link>
        </div>
      </div>
    </article>
  )
}
