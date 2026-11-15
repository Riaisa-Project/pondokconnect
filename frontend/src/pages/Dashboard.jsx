import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  ClipboardList,
  FileCheck2,
  MessageSquare,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useApi } from '../lib/hooks'
import { useAuth } from '../lib/auth'
import { actions, date, label, number } from '../lib/format'
import { QueryState, Badge } from '../components/UI'
import { documentStatuses, operationalStatuses } from '../components/Oversight'
import '../styles/dashboard.css'

const stages = Object.keys(actions)

function Distribution({ values = {}, labels }) {
  const rows = Object.entries(labels)
  const total = rows.reduce((sum, [key]) => sum + (values[key] || 0), 0)
  return (
    <div className="dash-distribution">
      {rows.map(([key, text]) => {
        const value = values[key] || 0
        const percent = total ? Math.round((value / total) * 100) : 0
        const unconfirmed = key === 'belum_dikonfirmasi'
        return (
          <div className="dash-distribution-row" key={key}>
            <div className="dash-distribution-label">
              <span>{text}</span>
              <strong className={value === 0 ? 'dash-zero' : ''}>
                {total
                  ? `${number(value)} / ${number(total)} · ${percent}%`
                  : '0 · belum ada data'}
              </strong>
            </div>
            {total > 0 && (
              <div
                className="dash-distribution-track"
                role="progressbar"
                aria-label={`${text} dari seluruh catatan`}
                aria-valuemin="0"
                aria-valuemax={total}
                aria-valuenow={value}
              >
                {value > 0 && (
                  <span
                    className={`dash-distribution-fill ${unconfirmed ? 'dash-fill-unconfirmed' : ''}`}
                    style={{ width: `${percent}%` }}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}
      {total === 0 && (
        <p className="dash-note">Belum ada data yang tercatat.</p>
      )}
    </div>
  )
}

function CaseComposition({ values = {} }) {
  const total = stages.reduce((sum, stage) => sum + (values[stage] || 0), 0)

  return (
    <div className="dash-chart-block">
      <p className="dash-axis-title">
        Jumlah kasus · total {number(total)} pengaduan
      </p>
      {total > 0 ? (
        <div className="dash-stage-rows">
          {stages.map((stage) => {
            const value = values[stage] || 0
            const percent = Math.round((value / total) * 100)
            return (
              <div className="dash-stage-row" key={stage}>
                <div className="dash-stage-label">
                  <span>{actions[stage]}</span>
                  <strong className={value === 0 ? 'dash-zero' : ''}>
                    {number(value)}
                  </strong>
                </div>
                <div
                  className="dash-stage-track"
                  role="progressbar"
                  aria-label={`${actions[stage]} dari seluruh pengaduan`}
                  aria-valuemin="0"
                  aria-valuemax={total}
                  aria-valuenow={value}
                >
                  {value > 0 && (
                    <svg
                      className="dash-stage-fill"
                      viewBox="0 0 100 8"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <rect x="0" y="0" width={percent} height="8" rx="4" />
                    </svg>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="dash-chart-empty">Belum ada pengaduan tercatat.</p>
      )}
      <table className="dash-sr-only">
        <caption>Jumlah pengaduan pada setiap tahap penanganan</caption>
        <thead>
          <tr>
            <th scope="col">Tahap penanganan</th>
            <th scope="col">Jumlah kasus</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((stage) => (
            <tr key={stage}>
              <th scope="row">{actions[stage]}</th>
              <td>{number(values[stage] || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MetricCard({ Icon, title, value, detail }) {
  return (
    <article className="dash-metric-card metric-card">
      <div className="dash-metric-top">
        <span>{title}</span>
        <span className="dash-metric-icon" aria-hidden="true">
          <Icon size={20} strokeWidth={1.7} />
        </span>
      </div>
      <strong className="dash-metric-value">{value}</strong>
      <p className="dash-metric-detail">{detail}</p>
    </article>
  )
}

function statusTone(status) {
  if (status === 'selesai') return 'dash-status-done'
  if (status === 'tidak_valid') return 'dash-status-invalid'
  if (status === 'masuk_antrian') return 'dash-status-new'
  return 'dash-status-progress'
}

function RecentCases({ query }) {
  return (
    <section
      className="dash-panel dash-cases"
      aria-labelledby="dash-cases-title"
    >
      <div className="dash-section-heading">
        <div>
          <span className="dash-eyebrow">AKSES SATGAS</span>
          <h2 id="dash-cases-title">Pengaduan terbaru</h2>
          <p>Identitas pelapor tidak ditampilkan pada ringkasan ini.</p>
        </div>
        <Link className="dash-text-link" to="/admin?tab=pengaduan">
          Buka semua pengaduan <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
      <QueryState query={query}>
        {(data) =>
          data.items?.length ? (
            <>
              <div
                className="dash-table-scroll"
                tabIndex="0"
                aria-label="Tabel pengaduan terbaru, dapat digulir mendatar"
              >
                <table className="dash-case-table">
                  <thead>
                    <tr>
                      <th scope="col">Nomor kasus</th>
                      <th scope="col">Pesantren</th>
                      <th scope="col">Kategori</th>
                      <th scope="col">Tanggal laporan</th>
                      <th scope="col">Tahap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) => (
                      <tr key={row.id}>
                        <td>#{number(row.id)}</td>
                        <td>
                          {row.nama_ponpes ||
                            `Pesantren #${number(row.ponpes_id)}`}
                        </td>
                        <td>{label(row.kategori_kasus)}</td>
                        <td>{date(row.created_at)}</td>
                        <td>
                          <span
                            className={`dash-status ${statusTone(row.status_tindakan)}`}
                          >
                            {label(row.status_tindakan)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="dash-table-caption">
                Menampilkan {number(data.items.length)} dari{' '}
                {number(data.total)} pengaduan.
              </p>
            </>
          ) : (
            <p className="dash-empty">Belum ada pengaduan yang tercatat.</p>
          )
        }
      </QueryState>
    </section>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const satgas = user.role === 'satgas_kemenag'
  const query = useApi('/admin/dashboard', null, { refetchInterval: 30000 })
  const cases = useApi(
    '/admin/pengaduan',
    satgas ? { offset: 0, limit: 6 } : null,
    { enabled: satgas },
  )

  return (
    <QueryState query={query}>
      {(data) => {
        const metrics = data.metrics || {}
        const profile = data.ponpes || {}
        const cards = satgas
          ? [
              {
                Icon: ShieldCheck,
                title: 'Pengaduan terbuka',
                value:
                  metrics.pengaduan_terbuka == null
                    ? '—'
                    : number(metrics.pengaduan_terbuka),
                detail: 'Kasus yang masih memerlukan tindak lanjut.',
              },
              {
                Icon: FileCheck2,
                title: 'Pesantren belum diperiksa',
                value:
                  metrics.pengawasan_belum_dikonfirmasi == null
                    ? '—'
                    : number(metrics.pengawasan_belum_dikonfirmasi),
                detail: 'Pesantren dengan data pengawasan belum dikonfirmasi.',
              },
              {
                Icon: Building2,
                title: 'Pesantren terdata',
                value:
                  metrics.ponpes_total == null
                    ? '—'
                    : number(metrics.ponpes_total),
                detail: 'Pesantren dalam direktori kabupaten.',
              },
            ]
          : [
              {
                Icon: ClipboardList,
                title: 'Pendaftaran masuk',
                value:
                  metrics.pendaftaran_total == null
                    ? '—'
                    : number(metrics.pendaftaran_total),
                detail: 'Jumlah pendaftaran untuk pesantren Anda.',
              },
              {
                Icon: Users,
                title: 'Santri diterima',
                value:
                  metrics.santri_diterima == null
                    ? '—'
                    : number(metrics.santri_diterima),
                detail: metrics.santri_diterima
                  ? 'Santri dengan hasil seleksi diterima.'
                  : 'Belum ada santri yang tercatat diterima.',
              },
              {
                Icon: Building2,
                title: 'Kursi tersedia',
                value:
                  typeof profile.sisa_kuota_putra === 'number' &&
                  typeof profile.sisa_kuota_putri === 'number'
                    ? number(
                        profile.sisa_kuota_putra + profile.sisa_kuota_putri,
                      )
                    : '—',
                detail: 'Sisa kuota putra dan putri.',
              },
              {
                Icon: MessageSquare,
                title: 'Pesan belum dibaca',
                value:
                  metrics.pesan_belum_dibaca == null
                    ? '—'
                    : number(metrics.pesan_belum_dibaca),
                detail: 'Pesan konsultasi warga yang belum dibaca.',
              },
            ]

        return (
          <div
            className={`dash-root ${satgas ? 'dash-satgas' : 'dash-ponpes'}`}
          >
            <section className="dash-welcome">
              <div>
                <span className="dash-eyebrow">
                  {satgas ? 'RUANG PENGAWASAN' : 'RUANG PENGELOLA'}
                </span>
                <h2>{satgas ? 'Ringkasan pengawasan' : 'Ringkasan layanan'}</h2>
                <p>
                  {satgas
                    ? 'Pantau penanganan pengaduan dan pemeriksaan pesantren di Kabupaten Lamongan.'
                    : profile.nama_ponpes ||
                      'Pantau layanan dan aktivitas pesantren Anda.'}
                </p>
              </div>
              <p className="dash-updated">
                Ringkasan diperbarui otomatis setiap 30 detik.
              </p>
            </section>

            {satgas && (
              <aside
                className="dash-privacy"
                aria-label="Peringatan kerahasiaan pengaduan"
              >
                <ShieldCheck size={21} aria-hidden="true" />
                <p>
                  <strong>Data pengaduan hanya untuk Satgas.</strong> Jangan
                  membagikan informasi kasus di luar petugas yang berwenang.
                </p>
              </aside>
            )}

            <section
              className={`dash-metrics ${satgas ? 'dash-metrics-three' : 'dash-metrics-ponpes'}`}
              aria-label="Indikator ringkasan"
            >
              {cards.map((card) => (
                <MetricCard key={card.title} {...card} />
              ))}
            </section>

            {satgas ? (
              <>
                <section
                  className="dash-panel dash-composition"
                  aria-labelledby="dash-composition-title"
                >
                  <div className="dash-section-heading">
                    <div>
                      <span className="dash-eyebrow">STATUS PENANGANAN</span>
                      <h2 id="dash-composition-title">Komposisi pengaduan</h2>
                      <p>
                        Jumlah kasus pada setiap tahap yang tercatat saat ini.
                      </p>
                    </div>
                    <Link
                      className="dash-icon-link"
                      to="/admin?tab=pengaduan"
                      aria-label="Buka pengaduan"
                    >
                      <ArrowRight size={19} aria-hidden="true" />
                    </Link>
                  </div>
                  <CaseComposition values={data.pengaduan || {}} />
                </section>
                <RecentCases query={cases} />
                <div className="dash-ponpes-panels dash-oversight-panels">
                  <section
                    className="dash-panel"
                    aria-labelledby="dash-documents-title"
                  >
                    <span className="dash-eyebrow">PEMERIKSAAN DOKUMEN</span>
                    <h2 id="dash-documents-title">Status dokumen</h2>
                    <Distribution
                      values={data.status_dokumen}
                      labels={documentStatuses}
                    />
                  </section>
                  <section
                    className="dash-panel"
                    aria-labelledby="dash-operation-title"
                  >
                    <span className="dash-eyebrow">PEMERIKSAAN LAPANGAN</span>
                    <h2 id="dash-operation-title">Status operasional</h2>
                    <Distribution
                      values={data.status_operasional}
                      labels={operationalStatuses}
                    />
                  </section>
                </div>
                <section
                  className="dash-actions"
                  aria-labelledby="dash-satgas-actions-title"
                >
                  <span className="dash-eyebrow">TINDAK LANJUT</span>
                  <h2 id="dash-satgas-actions-title" className="dash-sr-only">
                    Tindakan Satgas
                  </h2>
                  <Link to="/admin?tab=pengaduan">
                    <ShieldCheck size={21} aria-hidden="true" />
                    <span>
                      <strong>Tinjau pengaduan</strong>
                      <small>
                        {metrics.pengaduan_terbuka == null
                          ? 'Jumlah kasus terbuka belum tersedia.'
                          : `${number(metrics.pengaduan_terbuka)} kasus terbuka menunggu tindak lanjut.`}
                      </small>
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                  <Link to="/admin?tab=pesantren">
                    <FileCheck2 size={21} aria-hidden="true" />
                    <span>
                      <strong>Catat pengawasan</strong>
                      <small>
                        Periksa dokumen, sumber, dan status operasional.
                      </small>
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                  <Link to="/admin?tab=tambah">
                    <Building2 size={21} aria-hidden="true" />
                    <span>
                      <strong>Catat profil pesantren</strong>
                      <small>Buat profil dan akses pengelola pesantren.</small>
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                </section>
              </>
            ) : (
              <>
                <div className="dash-ponpes-panels">
                  <section
                    className="dash-panel"
                    aria-labelledby="dash-selection-title"
                  >
                    <div className="dash-section-heading">
                      <div>
                        <span className="dash-eyebrow">PENERIMAAN SANTRI</span>
                        <h2 id="dash-selection-title">Ringkasan seleksi</h2>
                      </div>
                      <Link
                        className="dash-icon-link"
                        to="/admin?tab=pendaftaran"
                        aria-label="Lihat pendaftaran"
                      >
                        <ArrowRight size={19} aria-hidden="true" />
                      </Link>
                    </div>
                    <Distribution
                      values={data.seleksi}
                      labels={{
                        menunggu_verifikasi: 'Menunggu verifikasi',
                        lolos_berkas: 'Lolos berkas',
                        diterima: 'Diterima',
                        ditolak: 'Ditolak',
                      }}
                    />
                  </section>
                  <section
                    className="dash-panel"
                    aria-labelledby="dash-service-title"
                  >
                    <span className="dash-eyebrow">LAYANAN PESANTREN</span>
                    <h2 id="dash-service-title">Kesiapan pengurus</h2>
                    <div className="dash-service-status">
                      <Badge>
                        {profile.pendaftaran_tersedia
                          ? 'Pendaftaran tersedia'
                          : 'Pendaftaran belum tersedia'}
                      </Badge>
                      <p>
                        {profile.konsultasi_tersedia
                          ? 'Konsultasi tersedia.'
                          : 'Konsultasi belum tersedia.'}
                      </p>
                      <p>
                        Pendaftaran:{' '}
                        {profile.pendaftaran_dibuka
                          ? 'sedang dibuka oleh pengurus.'
                          : 'sedang ditutup oleh pengurus.'}
                      </p>
                      <p className="dash-note">
                        Atur pendaftaran dan konsultasi secara terpisah melalui
                        Profil & kuota.
                      </p>
                      <p>
                        Operasional:{' '}
                        {operationalStatuses[
                          profile.pengawasan?.status_operasional
                        ] || operationalStatuses.belum_dikonfirmasi}
                      </p>
                    </div>
                  </section>
                </div>
                <section
                  className="dash-actions"
                  aria-labelledby="dash-actions-title"
                >
                  <span className="dash-eyebrow">TINDAK LANJUT</span>
                  <h2 id="dash-actions-title" className="dash-sr-only">
                    Tindakan pengelola
                  </h2>
                  <Link to="/admin?tab=pendaftaran">
                    <ClipboardList size={21} aria-hidden="true" />
                    <span>
                      <strong>Seleksi santri</strong>
                      <small>Kelola pendaftaran yang masuk.</small>
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                  <Link to="/admin?tab=chat">
                    <MessageSquare size={21} aria-hidden="true" />
                    <span>
                      <strong>Jawab konsultasi</strong>
                      <small>Pesan warga melalui kanal konsultasi.</small>
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                  <Link to="/admin?tab=profil">
                    <FileCheck2 size={21} aria-hidden="true" />
                    <span>
                      <strong>Profil & layanan</strong>
                      <small>
                        Lengkapi profil, kuota, dan pengaturan layanan.
                      </small>
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                </section>
              </>
            )}
          </div>
        )
      }}
    </QueryState>
  )
}
