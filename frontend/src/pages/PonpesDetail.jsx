import SourcedProfileContent from '../components/SourcedProfileContent'
import PublicProfileContent from '../components/PublicProfileContent'
import PonpesLocation from '../components/PonpesLocation'
import { DiscoveryActions } from '../components/DiscoveryActions'
import { Link, useParams } from 'react-router-dom'
import {
  OversightCard,
  PublicServices,
  documentStatuses,
} from '../components/Oversight'
import { ArrowRight, Check, ExternalLink, MapPin, Phone } from 'lucide-react'
import { useApi } from '../lib/hooks'
import { date, types } from '../lib/format'
import { QueryState } from '../components/UI'
import { PondokArt } from '../components/PonpesCard'
import ChatWidget from '../components/ChatWidget'
import { hasRegistrationSeats } from '../lib/services'
import '../styles/profile.css'

function Tag({ children, gold = false, plain = false }) {
  return (
    <span
      className={`prof-tag${gold ? ' prof-tag-gold' : ''}${plain ? ' prof-tag-plain' : ''}`}
    >
      {gold && <Check size={13} aria-hidden="true" />}
      {children}
    </span>
  )
}

function Masthead({ data, district, sourced }) {
  const record = data.pengawasan || {}
  return (
    <>
      <nav className="prof-crumbs" aria-label="Remah roti">
        <Link to="/">Beranda</Link>
        <span aria-hidden="true">/</span>
        <Link to="/pesantren">Pesantren</Link>
        <span aria-hidden="true">/</span>
        <span>{data.nama_ponpes}</span>
      </nav>
      <div className="prof-masthead">
        <div>
          <span className="prof-eyebrow">
            {(district || 'Lamongan') +
              ' · ' +
              (types[data.tipe_pesantren] || 'Direktori pesantren')}
          </span>
          <h1>{data.nama_ponpes}</h1>
          <p className="prof-addr">
            <MapPin size={17} aria-hidden="true" />
            <span>{data.alamat_lengkap || 'Alamat belum diverifikasi'}</span>
          </p>
          <div className="prof-tags">
            {data.profil_referensi ? (
              sourced ? (
                <Tag gold>Profil bersumber</Tag>
              ) : (
                <Tag>Profil rujukan</Tag>
              )
            ) : null}
            <Tag plain>
              Dokumen:&nbsp;
              {documentStatuses[record.status_dokumen] ||
                documentStatuses.belum_dikonfirmasi}
            </Tag>
            <Tag plain>
              Operasional:&nbsp;
              {record.status_operasional === 'beroperasi'
                ? 'Beroperasi'
                : record.status_operasional === 'tidak_beroperasi'
                  ? 'Tidak beroperasi'
                  : 'Belum dikonfirmasi'}
            </Tag>
            {data.profil_publik?.diperiksa_pada && (
              <Tag plain>
                Diperiksa {date(data.profil_publik.diperiksa_pada)}
              </Tag>
            )}
          </div>
        </div>
        <figure className="prof-plate">
          <PondokArt variant={data.id} />
        </figure>
      </div>
    </>
  )
}

function ProfileFacts({ data, district }) {
  return (
    <dl className="prof-facts">
      <div>
        <dt>Kecamatan</dt>
        <dd>{district || 'Belum tersedia'}</dd>
      </div>
      <div>
        <dt>Pengasuh</dt>
        <dd>{data.nama_pengasuh || 'Belum dicantumkan'}</dd>
      </div>
      <div>
        <dt>Nomor statistik</dt>
        <dd>{data.nspp || 'NSPP belum dicantumkan'}</dd>
      </div>
    </dl>
  )
}

function SectionNav({ data, hasOfferings }) {
  return (
    <nav className="prof-sections" aria-label="Bagian halaman">
      <ul>
        <li>
          <a href="#tentang">Tentang pesantren</a>
        </li>
        <li>
          <a href="#profil-pesantren">Profil pesantren</a>
        </li>
        {hasOfferings && (
          <li>
            <a href="#program">Program &amp; fasilitas</a>
          </li>
        )}
        <li>
          <a href="#pengawasan">Catatan pengawasan</a>
        </li>
        <li>
          <a href="#pendaftaran">Penerimaan &amp; kuota</a>
        </li>
        <li>
          <a href="#lokasi">Alamat &amp; lokasi</a>
        </li>
      </ul>
      <DiscoveryActions ponpes={data} />
    </nav>
  )
}

function Aside({ data, district, sourced }) {
  return (
    <aside className="prof-aside" aria-label="Ringkasan pesantren">
      <div id="pengawasan">
        <OversightCard data={data} />
      </div>
      <section className="prof-card">
        <h3>Ringkasan cepat</h3>
        <dl className="prof-kv">
          <div>
            <dt>Kecamatan</dt>
            <dd>{district || 'Belum tersedia'}</dd>
          </div>
          <div>
            <dt>Jenjang</dt>
            <dd>{types[data.tipe_pesantren] || 'Belum dicantumkan'}</dd>
          </div>
          <div>
            <dt>NSPP</dt>
            <dd>{data.nspp || 'Belum dicantumkan'}</dd>
          </div>
          <div>
            <dt>
              <Phone size={12} aria-hidden="true" /> Sekretariat
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
      </section>
      <section className="prof-card">
        <h3>Bagikan atau bandingkan</h3>
        <p>
          Bandingkan maksimal tiga pesantren berdampingan untuk melihat jenjang
          pendidikan, kuota, dan alamat.
        </p>
        <Link
          className="prof-link-button"
          to={`/bandingkan?pilihan=${data.slug}`}
        >
          Buka perbandingan <ArrowRight size={15} />
        </Link>
      </section>
    </aside>
  )
}

function Profile({ data }) {
  const districts = useApi('/kecamatan/')
  const district = districts.data?.find(
    (d) => d.id === data.kecamatan_id,
  )?.nama_kecamatan
  const sourced = Boolean(data.referensi || data.profil_referensi)
  const hasOfferings =
    data.program_unggulan?.length > 0 || data.fasilitas?.length > 0
  return (
    <div
      className={`prof-page${data.profil_referensi ? ' reference-profile' : ''}`}
    >
      <Masthead data={data} district={district} sourced={sourced} />
      <SectionNav data={data} hasOfferings={hasOfferings} />
      <div className="prof-layout">
        <main className="prof-main" id="konten">
          <section id="tentang">
            <span className="prof-eyebrow">Mengenal lebih dekat</span>
            <h2>Mengenal pesantren</h2>
            <p
              className={`${data.deskripsi ? 'prof-lead' : 'prof-intro'} profile-description`}
            >
              {data.deskripsi || 'Pengantar pesantren belum tersedia.'}
            </p>
            <ProfileFacts data={data} district={district} />
            {data.referensi && (
              <p className="prof-cite">
                <a
                  href={data.referensi.sumber_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Sumber profil <ExternalLink size={12} />
                </a>
                <span>
                  Diperiksa {date(data.referensi.diperiksa_pada)}
                  {data.referensi.tahun_sumber
                    ? ` · tahun rujukan ${data.referensi.tahun_sumber}`
                    : ''}
                </span>
              </p>
            )}
            {data.demo && (
              <p className="prof-notice">
                Informasi profil, pengasuh, kuota, dan kontak pada lingkungan
                ini merupakan data simulasi.
              </p>
            )}
          </section>
          <SourcedProfileContent data={data} />
          {hasOfferings && <PublicProfileContent data={data} offeringsOnly />}
          <section id="pendaftaran">
            <PublicServices data={data} />
          </section>
          <section id="lokasi" aria-label="Alamat dan lokasi">
            <span className="prof-eyebrow">Rencanakan kunjungan</span>
            <h2>Alamat &amp; lokasi</h2>
            <PonpesLocation ponpes={data} showCoordinates />
            {data.profil_referensi && !data.lokasi?.pin_tersedia && (
              <p className="prof-notice">
                Alamat mengikuti sumber tertulis. Titik koordinat belum
                dicocokkan, sehingga profil ini belum dipasang sebagai pin.
              </p>
            )}
          </section>
        </main>
        <Aside data={data} district={district} sourced={sourced} />
      </div>
      <ChatWidget ponpes={data} />
    </div>
  )
}

export default function PonpesDetail() {
  const { slug } = useParams()
  const query = useApi(`/ponpes/${encodeURIComponent(slug)}`, null, {
    refetchInterval: 30000,
  })
  return (
    <div className="container prof-container">
      <QueryState query={query}>{(data) => <Profile data={data} />}</QueryState>
    </div>
  )
}
