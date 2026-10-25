import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowUpRight } from 'lucide-react'
import { date } from '../lib/format'
import { hasRegistrationSeats } from '../lib/services'
import { Badge, LinkButton } from './UI'
import { Seal3D } from './Scene'

export const documentStatuses = {
  belum_dikonfirmasi: 'Belum dikonfirmasi',
  terdaftar: 'Terdaftar berdasarkan dokumen',
}
export const operationalStatuses = {
  belum_dikonfirmasi: 'Belum dikonfirmasi',
  beroperasi: 'Beroperasi',
  tidak_beroperasi: 'Tidak beroperasi',
}
export function Source({ value }) {
  return /^https?:\/\//i.test(value || '') ? (
    <a href={value} target="_blank" rel="noopener noreferrer">
      {value}
    </a>
  ) : (
    value || 'Belum dicantumkan'
  )
}
export function OversightRecord({ data }) {
  const record = data.pengawasan || {}
  return (
    <div className="oversight-record stack">
      <p className="note">
        Catatan pemeriksaan dokumen dan kondisi operasional oleh pengawas
        daerah. Status mengikuti sumber dan tanggal pemeriksaan; informasi yang
        belum tersedia tetap belum dikonfirmasi.
      </p>
      <section className="panel">
        <h2>Status dokumen</h2>
        <Badge>
          {documentStatuses[record.status_dokumen] ||
            documentStatuses.belum_dikonfirmasi}
        </Badge>
        <dl className="info-grid">
          <div>
            <dt>Nomor statistik pada dokumen</dt>
            <dd>{record.nomor_statistik || 'Belum dicantumkan'}</dd>
          </div>
          <div>
            <dt>Nomor dokumen</dt>
            <dd>{record.nomor_dokumen || 'Belum dicantumkan'}</dd>
          </div>
          <div>
            <dt>Penerbit dokumen</dt>
            <dd>{record.penerbit_dokumen || 'Belum dicantumkan'}</dd>
          </div>
          <div>
            <dt>Tanggal dokumen</dt>
            <dd>{date(record.tanggal_dokumen)}</dd>
          </div>
          <div>
            <dt>Sumber dokumen</dt>
            <dd>
              <Source value={record.sumber_dokumen} />
            </dd>
          </div>
          <div>
            <dt>Diperiksa pada</dt>
            <dd>{date(record.tanggal_pemeriksaan_dokumen)}</dd>
          </div>
        </dl>
        {record.catatan_dokumen && (
          <p className="case-description">{record.catatan_dokumen}</p>
        )}
        <p className="note">
          Pencatatan dokumen merupakan hasil pemeriksaan, bukan penerbitan atau
          pengesahan izin oleh aplikasi.
        </p>
      </section>
      <section className="panel">
        <h2>Status operasional</h2>
        <Badge>
          {operationalStatuses[record.status_operasional] ||
            operationalStatuses.belum_dikonfirmasi}
        </Badge>
        <dl className="info-grid">
          <div>
            <dt>Sumber pemeriksaan</dt>
            <dd>
              <Source value={record.sumber_operasional} />
            </dd>
          </div>
          <div>
            <dt>Diperiksa pada</dt>
            <dd>{date(record.tanggal_pemeriksaan_operasional)}</dd>
          </div>
        </dl>
        {record.catatan_operasional && (
          <p className="case-description">{record.catatan_operasional}</p>
        )}
      </section>
    </div>
  )
}
export function OversightCard({ data }) {
  const record = data.pengawasan || {},
    path = `/status-pesantren/${data.slug}`
  return (
    <section className="permit-card oversight-card">
      <Seal3D />
      <span className="eyebrow">CATATAN PENGAWASAN</span>
      <h3>Kenali status dan sumbernya.</h3>
      <dl className="reference-fact-list">
        <div>
          <dt>Dokumen</dt>
          <dd>
            {documentStatuses[record.status_dokumen] ||
              documentStatuses.belum_dikonfirmasi}
          </dd>
        </div>
        <div>
          <dt>Operasional</dt>
          <dd>
            {operationalStatuses[record.status_operasional] ||
              operationalStatuses.belum_dikonfirmasi}
          </dd>
        </div>
      </dl>
      <div className="qr-box">
        <QRCodeSVG
          value={`${window.location.origin}${path}`}
          size={90}
          level="M"
          title="QR status pesantren"
        />
        <div>
          <strong>Pindai catatan pemeriksaan</strong>
          <Link to={path}>
            Lihat catatan pengawasan <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </section>
  )
}
export function PublicServices({ data }) {
  return (
    <section className="panel" id="pendaftaran">
      <span className="eyebrow">LAYANAN PESANTREN</span>
      <h2>Penerimaan & konsultasi</h2>
      <p>
        {data.pendaftaran_tersedia
          ? 'Pengurus membuka pendaftaran santri melalui portal.'
          : 'Pengajuan pendaftaran baru belum tersedia melalui portal.'}
      </p>
      {data.pendaftaran_dibuka && (
        <div className="capacity-cards">
          {[
            ['Putra', data.sisa_kuota_putra, data.kuota_putra],
            ['Putri', data.sisa_kuota_putri, data.kuota_putri],
          ].map(([title, remaining, total]) => (
            <div key={title}>
              <span>{title}</span>
              <strong>
                {remaining ?? '—'}
                <small> / {total ?? '—'}</small>
              </strong>
              <small>Kursi tersedia</small>
            </div>
          ))}
        </div>
      )}
      {data.pendaftaran_tersedia && !hasRegistrationSeats(data) && (
        <Badge>Kuota penuh</Badge>
      )}
      {hasRegistrationSeats(data) && (
        <LinkButton to={`/daftar?ponpes=${data.id}`}>
          Daftar ke pesantren ini <ArrowUpRight size={17} />
        </LinkButton>
      )}
      <p className="note">
        {data.konsultasi_tersedia
          ? 'Konsultasi dengan pengurus tersedia melalui tombol Tanya pengurus.'
          : 'Konsultasi baru melalui portal belum tersedia.'}{' '}
        Riwayat layanan dan kanal pelaporan tetap dapat diakses.
      </p>
    </section>
  )
}
