import { Link } from 'react-router-dom'
import {
  Building2,
  Users,
  ClipboardList,
  ShieldCheck,
  MessageSquare,
  ArrowUpRight,
  FileCheck2,
  Clock3,
  CheckCircle2,
} from 'lucide-react'
import { useApi } from '../lib/hooks'
import { useAuth } from '../lib/auth'
import { number, selection, actions } from '../lib/format'
import { QueryState, Badge } from '../components/UI'
import { documentStatuses, operationalStatuses } from '../components/Oversight'
function Distribution({ values = {}, labels }) {
  const total = Object.values(values).reduce((a, b) => a + b, 0)
  return (
    <div className="distribution">
      {Object.entries(labels).map(([key, text]) => (
        <div key={key}>
          <div>
            <span>{text}</span>
            <strong>{number(values[key] || 0)}</strong>
          </div>
          <progress
            value={values[key] || 0}
            max={Math.max(total, 1)}
            aria-label={text}
          />
        </div>
      ))}
      {total === 0 && <p className="note">Belum ada data yang tercatat.</p>}
    </div>
  )
}
export default function Dashboard() {
  const query = useApi('/admin/dashboard', null, { refetchInterval: 30000 }),
    { user } = useAuth(),
    satgas = user.role === 'satgas_kemenag'
  return (
    <QueryState query={query}>
      {(data) => {
        const m = data.metrics,
          p = data.ponpes
        const cards = satgas
          ? [
              [
                ShieldCheck,
                m.pengaduan_terbuka,
                'Pengaduan terbuka',
                'Prioritas tindak lanjut Satgas',
              ],
              [
                ClipboardList,
                m.pengaduan_total,
                'Seluruh pengaduan',
                'Akses terbatas untuk Satgas',
              ],
              [
                Building2,
                m.ponpes_total,
                'Profil pesantren',
                'Seluruh profil dalam direktori',
              ],
              [
                FileCheck2,
                m.pengawasan_belum_dikonfirmasi,
                'Pengawasan belum dikonfirmasi',
                'Memerlukan pemeriksaan sumber',
              ],
            ]
          : [
              [
                ClipboardList,
                m.pendaftaran_total,
                'Pendaftaran masuk',
                'Pesantren Anda',
              ],
              [
                Users,
                m.santri_diterima,
                'Santri diterima',
                'Hasil seleksi tercatat',
              ],
              [
                FileCheck2,
                p.sisa_kuota_putra + p.sisa_kuota_putri,
                'Kursi tersedia',
                p.pendaftaran_dibuka
                  ? 'Pendaftaran dibuka oleh pengurus'
                  : 'Pendaftaran sedang ditutup',
              ],
              [
                MessageSquare,
                m.pesan_belum_dibaca,
                'Pesan belum dibaca',
                'Konsultasi warga',
              ],
            ]
        return (
          <div className="dashboard-overview">
            <div className="dashboard-welcome">
              <div>
                <span className="eyebrow">SELAMAT DATANG KEMBALI</span>
                <h2>
                  {satgas ? (
                    <>
                      Pengawasan baik,
                      <br />
                      <em>dimulai dari kepedulian.</em>
                    </>
                  ) : (
                    <>
                      Pelayanan baik,
                      <br />
                      <em>dimulai dari sini.</em>
                    </>
                  )}
                </h2>
                <p>
                  {satgas
                    ? 'Prioritaskan pengaduan dan tindak lanjut, lalu lengkapi catatan pemeriksaan pesantren.'
                    : p.nama_ponpes}
                </p>
              </div>
              <div className="dashboard-date">
                <Clock3 size={20} />
                <strong>
                  {new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date())}
                </strong>
                <small>Ringkasan diperbarui setiap 30 detik</small>
              </div>
            </div>
            <div className="metric-grid">
              {cards.map(([Icon, value, title, note]) => (
                <div className="metric-card" key={title}>
                  <div className="metric-card-top">
                    <span>{title}</span>
                    <Icon size={21} />
                  </div>
                  <strong>
                    {value == null ? 'Belum tersedia' : number(value)}
                  </strong>
                  <small>{note}</small>
                </div>
              ))}
            </div>
            <div className="dashboard-panels">
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      {satgas ? 'PERLINDUNGAN SANTRI' : 'PENERIMAAN SANTRI'}
                    </span>
                    <h2>
                      {satgas ? 'Tindak lanjut pengaduan' : 'Ringkasan seleksi'}
                    </h2>
                  </div>
                  <Link
                    to={`/admin?tab=${satgas ? 'pengaduan' : 'pendaftaran'}`}
                    className="icon-button"
                    aria-label={
                      satgas ? 'Lihat pengaduan' : 'Lihat pendaftaran'
                    }
                  >
                    <ArrowUpRight size={21} />
                  </Link>
                </div>
                <Distribution
                  values={satgas ? data.pengaduan : data.seleksi}
                  labels={satgas ? actions : selection}
                />
              </section>
              <section className="panel">
                <span className="eyebrow">
                  {satgas ? 'PEMERIKSAAN DOKUMEN' : 'LAYANAN PESANTREN'}
                </span>
                <h2>{satgas ? 'Status dokumen' : 'Kesiapan pengurus'}</h2>
                {satgas ? (
                  <Distribution
                    values={data.status_dokumen}
                    labels={documentStatuses}
                  />
                ) : (
                  <>
                    <Badge>
                      {p.pendaftaran_tersedia
                        ? 'Pendaftaran tersedia'
                        : 'Pendaftaran belum tersedia'}
                    </Badge>
                    <p>
                      {p.konsultasi_tersedia
                        ? 'Konsultasi tersedia.'
                        : 'Konsultasi belum tersedia.'}
                    </p>
                    <p className="note">
                      Atur pendaftaran dan konsultasi secara terpisah melalui
                      Profil & kuota.
                    </p>
                    <p>
                      Operasional:{' '}
                      {operationalStatuses[p.pengawasan?.status_operasional] ||
                        operationalStatuses.belum_dikonfirmasi}
                    </p>
                  </>
                )}
              </section>
              {satgas && (
                <section className="panel">
                  <span className="eyebrow">PEMERIKSAAN LAPANGAN</span>
                  <h2>Status operasional</h2>
                  <Distribution
                    values={data.status_operasional}
                    labels={operationalStatuses}
                  />
                </section>
              )}
            </div>
            <section className="dashboard-actions">
              <span className="eyebrow">TINDAK LANJUT</span>
              {(satgas
                ? [
                    [
                      ShieldCheck,
                      'Tinjau pengaduan',
                      `${m.pengaduan_terbuka} kasus masih dalam penanganan`,
                      'pengaduan',
                    ],
                    [
                      FileCheck2,
                      'Catat pengawasan',
                      'Periksa dokumen, sumber, dan operasional',
                      'pesantren',
                    ],
                    [
                      Building2,
                      'Catat profil pesantren',
                      'Buat profil dan akses untuk pengurus',
                      'tambah',
                    ],
                  ]
                : [
                    [
                      ClipboardList,
                      'Seleksi santri',
                      `${data.seleksi?.menunggu_verifikasi || 0} pendaftaran menunggu verifikasi`,
                      'pendaftaran',
                    ],
                    [
                      MessageSquare,
                      'Jawab konsultasi',
                      `${m.pesan_belum_dibaca} pesan belum dibaca`,
                      'chat',
                    ],
                    [
                      Building2,
                      'Profil & layanan',
                      'Lengkapi profil, kuota, dan pengaturan layanan',
                      'profil',
                    ],
                  ]
              ).map(([Icon, title, note, tab]) => (
                <Link key={tab} to={`/admin?tab=${tab}`}>
                  <Icon size={22} />
                  <div>
                    <strong>{title}</strong>
                    <small>{note}</small>
                  </div>
                  <ArrowUpRight size={19} />
                </Link>
              ))}
            </section>
            <p className="note">
              <CheckCircle2 size={15} />
              Ringkasan berasal dari data yang tercatat dalam portal
              {data.demo ? ' pada lingkungan demo akademik.' : '.'}
            </p>
          </div>
        )
      }}
    </QueryState>
  )
}
