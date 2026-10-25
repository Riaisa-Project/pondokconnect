import PublicProfileContent from '../components/PublicProfileContent'
import SourcedProfileContent from '../components/SourcedProfileContent'
import ReferenceProfile from '../components/ReferenceProfile'
import PonpesLocation from '../components/PonpesLocation'
import { DiscoveryActions } from '../components/DiscoveryActions'
import { Link, useParams } from 'react-router-dom'
import {
  OversightCard,
  PublicServices,
  documentStatuses,
} from '../components/Oversight'
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  MapPin,
  Phone,
  UserRound,
} from 'lucide-react'
import { useApi } from '../lib/hooks'
import { types } from '../lib/format'
import { Badge, QueryState } from '../components/UI'
import { PondokArt } from '../components/PonpesCard'
import ChatWidget from '../components/ChatWidget'

function ServiceProfile({ data }) {
  const districts = useApi('/kecamatan/')
  const district = districts.data?.find(
    (d) => d.id === data.kecamatan_id,
  )?.nama_kecamatan
  return (
    <>
      <div className="detail-art">
        <PondokArt variant={data.id} />
        <div className="detail-overlay">
          <span className="eyebrow">
            {district || 'LAMONGAN'} · {types[data.tipe_pesantren]}
          </span>
          <h1>{data.nama_ponpes}</h1>
          <p>
            <MapPin size={16} />
            {data.lokasi?.alamat_bersumber
              ? data.alamat_lengkap
              : district || 'Lamongan'}
          </p>
        </div>
      </div>
      <div className="profile-navigation">
        <a href="#tentang">Tentang pesantren</a>
        <a href="#profil-pesantren">Profil lengkap</a>
        <a href="#lokasi">Alamat & lokasi</a>
        <a href="#program">Program & fasilitas</a>
        <a href="#pendaftaran">Pendaftaran</a>
        <DiscoveryActions ponpes={data} />
      </div>
      <div className="detail-grid">
        <div className="stack">
          <section className="panel">
            <div className="section-heading">
              <h2>Mengenal pesantren</h2>
              <Badge>
                {documentStatuses[data.pengawasan?.status_dokumen] ||
                  documentStatuses.belum_dikonfirmasi}
              </Badge>
            </div>
            <dl className="info-grid">
              <div>
                <dt>
                  <UserRound size={16} />
                  Pengasuh
                </dt>
                <dd>{data.nama_pengasuh || 'Belum dicantumkan'}</dd>
              </div>
              <div>
                <dt>
                  <BookOpen size={16} />
                  Tipe pesantren
                </dt>
                <dd>{types[data.tipe_pesantren] || 'Belum dicantumkan'}</dd>
              </div>
              <div>
                <dt>
                  <BadgeCheck size={16} />
                  NSPP
                </dt>
                <dd className="mono">{data.nspp || 'Belum dicantumkan'}</dd>
              </div>
              <div>
                <dt>
                  <Phone size={16} />
                  Sekretariat
                </dt>
                <dd>
                  {data.kontak_sekretariat ? (
                    <a
                      href={`tel:${data.kontak_sekretariat.replace(/[^+0-9]/g, '')}`}
                    >
                      {data.kontak_sekretariat}
                    </a>
                  ) : (
                    'Belum tersedia'
                  )}
                </dd>
              </div>
            </dl>
            {data.demo && (
              <p className="note">
                Informasi profil, pengasuh, kuota, dan kontak pada lingkungan
                ini merupakan data simulasi.
              </p>
            )}
          </section>
          <SourcedProfileContent data={data} />
          <section
            className="panel location-panel"
            id="lokasi"
            aria-label="Alamat dan lokasi"
          >
            <span className="eyebrow">RENCANAKAN KUNJUNGAN</span>
            <h2>Alamat & lokasi</h2>
            <PonpesLocation ponpes={data} showCoordinates />
          </section>
          <PublicProfileContent data={data} />
          <PublicServices data={data} />
        </div>
        <aside className="stack">
          <OversightCard data={data} />
        </aside>
      </div>
      <ChatWidget ponpes={data} />
    </>
  )
}
export default function PonpesDetail() {
  const { slug } = useParams()
  const query = useApi(`/ponpes/${encodeURIComponent(slug)}`, null, {
    refetchInterval: 30000,
  })
  return (
    <div className="container section">
      <Link to="/pesantren" className="back-link">
        <ArrowLeft size={15} />
        Kembali ke direktori
      </Link>
      <QueryState query={query}>
        {(data) => (
          <>
            {data.profil_referensi ? (
              <ReferenceProfile data={data} />
            ) : (
              <ServiceProfile data={data} />
            )}
          </>
        )}
      </QueryState>
    </div>
  )
}
