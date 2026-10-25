import { ExternalLink, BookOpen, MapPin, Info } from 'lucide-react'
import { useApi } from '../lib/hooks'
import { date, types } from '../lib/format'
import { Badge } from './UI'
import { OversightCard, PublicServices } from './Oversight'
import ChatWidget from './ChatWidget'
import { PondokArt } from './PonpesCard'
import { DiscoveryActions } from './DiscoveryActions'
import PonpesLocation from './PonpesLocation'
import SourcedProfileContent from './SourcedProfileContent'
import PublicProfileContent from './PublicProfileContent'

export default function ReferenceProfile({ data }) {
  const districts = useApi('/kecamatan/')
  const district = districts.data?.find(
    (d) => d.id === data.kecamatan_id,
  )?.nama_kecamatan
  const source = data.referensi
  const hasOfferings =
    data.program_unggulan?.length > 0 || data.fasilitas?.length > 0
  return (
    <div className="reference-profile">
      <div className="detail-art">
        <PondokArt variant={data.id} />
        <div className="detail-overlay">
          <span className="eyebrow">
            {district || 'LAMONGAN'} · DIREKTORI PESANTREN
          </span>
          <h1>{data.nama_ponpes}</h1>
          <p>
            <MapPin size={16} />
            {data.alamat_lengkap}
          </p>
        </div>
      </div>
      <div className="profile-navigation">
        <a href="#tentang">Tentang pesantren</a>
        <a href="#profil-pesantren">Profil lengkap</a>
        {hasOfferings && <a href="#program">Program & fasilitas</a>}
        <a href="#lokasi">Alamat & lokasi</a>
        <a href="#pendaftaran">Informasi penerimaan</a>
        <DiscoveryActions ponpes={data} />
      </div>
      <div className="detail-grid">
        <div className="stack">
          <section className="panel reference-story" id="tentang">
            <div className="section-heading">
              <h2>Mengenal pesantren</h2>
              <Badge>{source ? 'Profil bersumber' : 'Profil rujukan'}</Badge>
            </div>
            <p className="profile-description">
              {data.deskripsi || 'Pengantar pesantren belum tersedia.'}
            </p>
            {source && (
              <div className="reference-provenance">
                <a
                  className="location-directions"
                  href={source.sumber_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Sumber profil <ExternalLink size={14} />
                </a>
                <p>
                  {source.tahun_sumber
                    ? `Tahun sumber: ${source.tahun_sumber}. `
                    : ''}
                  Sumber diperiksa {date(source.diperiksa_pada)}.
                </p>
                {!source.deskripsi_bersumber && (
                  <small>
                    Ringkasan portal telah diperbarui terpisah dari sumber nama
                    dan alamat.
                  </small>
                )}
                {source.tahun_sumber && (
                  <small>
                    Rujukan ini mencatat nama dan lokasi pada tahun sumber.
                    Informasi terbaru perlu dikonfirmasi ke lembaga.
                  </small>
                )}
              </div>
            )}
          </section>
          <SourcedProfileContent data={data} />
          {hasOfferings && <PublicProfileContent data={data} offeringsOnly />}
          <section
            className="panel location-panel"
            id="lokasi"
            aria-label="Alamat dan lokasi"
          >
            <span className="eyebrow">RENCANAKAN KUNJUNGAN</span>
            <h2>Alamat & lokasi</h2>
            <PonpesLocation ponpes={data} showCoordinates />
            {!data.lokasi?.pin_tersedia && (
              <p className="location-point-note">
                Alamat mengikuti sumber tertulis. Titik koordinat belum
                dicocokkan, sehingga profil ini belum dipasang sebagai pin.
              </p>
            )}
          </section>
          <PublicServices data={data} />
        </div>
        <aside className="stack">
          <OversightCard data={data} />
          <section className="panel reference-facts">
            <span className="eyebrow">
              <BookOpen size={15} /> INFORMASI LEMBAGA
            </span>
            <h2>Kenali sumber datanya.</h2>
            <dl className="reference-fact-list">
              <div>
                <dt>Pengasuh</dt>
                <dd>{data.nama_pengasuh || 'Belum dicantumkan'}</dd>
              </div>
              <div>
                <dt>Tipe pesantren</dt>
                <dd>{types[data.tipe_pesantren] || 'Belum dicantumkan'}</dd>
              </div>
              <div>
                <dt>Nomor statistik</dt>
                <dd>{data.nspp || 'NSPP belum dicantumkan'}</dd>
              </div>

              <div>
                <dt>Kontak sekretariat</dt>
                <dd>{data.kontak_sekretariat || 'Belum dicantumkan'}</dd>
              </div>
            </dl>
            <p className="reference-note">
              <Info size={16} />
              Tautan sumber membantu menelusuri informasi lembaga. Catatan
              pengawasan dan ketersediaan layanan ditampilkan tersendiri.
            </p>
          </section>
        </aside>
      </div>
      <ChatWidget ponpes={data} />
    </div>
  )
}
