import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Building2,
  ChevronDown,
  FileCheck2,
  GitCompareArrows,
  HeartHandshake,
  MapPin,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useApi, useFeatures } from '../lib/hooks'
import { number } from '../lib/format'
import Explorer from '../components/Explorer'
import { Alert, LinkButton, QueryState } from '../components/UI'
import PonpesCard from '../components/PonpesCard'
import '../styles/home.css'
const questions = [
  [
    'Bagaimana memilih pesantren yang sesuai?',
    'Jelajahi direktori, baca program dan fasilitas, lalu gunakan Bandingkan untuk melihat maksimal tiga pesantren berdampingan. Hubungi pengurus melalui konsultasi sebelum menentukan pilihan.',
  ],
  [
    'Apa yang terjadi setelah saya mendaftar?',
    'Anda menerima nomor registrasi dan dapat mengunduh bukti PDF. Simpan nomor tersebut untuk memeriksa status verifikasi dan hasil seleksi di halaman Lacak Layanan.',
  ],
  [
    'Apakah identitas laporan rahasia disimpan?',
    'Mode rahasia tidak meminta atau menyimpan nama dan kontak pada kolom identitas. Hindari menuliskan identitas dalam uraian atau lampiran. Isi laporan dan bukti hanya dapat diakses Satgas.',
  ],
  [
    'Apakah data pesantren di sini resmi?',
    'Nama dan alamat pada profil bersumber merujuk situs lembaga atau pemerintah, disertai tahun sumber bila tersedia. Catatan pengawasan mencantumkan status dokumen dan kondisi operasional beserta sumber serta tanggal pemeriksaan. Layanan pendaftaran dan konsultasi mengikuti pengaturan pengurus.',
  ],
]
const steps = [
  [
    BookOpen,
    '01',
    'Temukan tempat bertumbuh',
    'Kenali program, fasilitas, dan kuota. Simpan pilihan, lalu bandingkan pesantren dengan lebih mudah.',
    '/pesantren',
    'Jelajahi pesantren',
  ],
  [
    FileCheck2,
    '02',
    'Mulai perjalanan belajar',
    'Kirim pendaftaran, unduh bukti, dan ikuti setiap tahap seleksi tanpa kehilangan informasi.',
    '/daftar',
    'Daftar sebagai santri',
  ],
  [
    HeartHandshake,
    '03',
    'Bersuara dengan lebih aman',
    'Sampaikan kejadian kepada Satgas melalui kanal dengan pilihan identitas rahasia.',
    '/lapor',
    'Kenali Lapor Aman',
  ],
]
export default function Home() {
  const features = useFeatures()
  const stats = useApi('/stats/ringkasan'),
    directory = useApi('/ponpes/', { limit: 3 }),
    navigate = useNavigate()
  const demo = features.data?.demo
  return (
    <div className="home-page">
      <section className="hero showcase-hero home-hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="hero-eyebrow">
              <span className="live-dot" aria-hidden="true" /> EKOSISTEM
              PESANTREN LAMONGAN
            </span>
            <h1>
              Tempat bertumbuh.
              <br />
              Masa depan
              <br />
              dimulai <em>di sini.</em>
            </h1>
            <p>
              Temukan pesantren yang tepat. Mulai perjalanan belajar, terhubung
              dengan pengurus, dan akses layanan santri dalam satu ruang.
            </p>
            <form
              className="hero-search home-search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault()
                navigate(
                  `/pesantren?q=${encodeURIComponent(new FormData(e.currentTarget).get('q').trim())}`,
                )
              }}
            >
              <label className="home-sr-only" htmlFor="home-cari">
                Cari nama pesantren
              </label>
              <Search size={21} aria-hidden="true" />
              <input
                id="home-cari"
                name="q"
                type="search"
                placeholder="Cari nama pesantren…"
                maxLength={150}
              />
              <button type="submit" aria-label="Cari pesantren">
                <ArrowRight size={21} aria-hidden="true" />
              </button>
            </form>
            <div className="hero-trust">
              <span>
                <BadgeCheck size={17} aria-hidden="true" />
                Periksa status &amp; sumber
              </span>
              <span>
                <GitCompareArrows size={17} aria-hidden="true" />
                Bandingkan pilihan
              </span>
            </div>
            <div className="hero-footnote">
              <span className="hero-line" aria-hidden="true" />
              Tradisi yang mengakar. Kesempatan yang terbuka.
            </div>
          </div>
          <div className="hero-visual home-explorer">
            <Explorer districts={stats.data?.per_kecamatan || []} />
          </div>
        </div>
        <div className="container stats-strip home-stats">
          {[
            [Building2, stats.data?.total_ponpes, 'Profil pesantren'],
            [MapPin, stats.data?.total_kecamatan, 'Kecamatan terjangkau'],
            [Users, stats.data?.total_santri_diterima, 'Santri diterima'],
          ].map(([Icon, value, text]) => {
            const empty = value === 0
            return (
              <div className="stat home-stat" key={text}>
                <span className="home-stat-icon">
                  <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <div className="home-stat-body">
                  <span className="home-stat-value">
                    <strong className={empty ? 'home-stat-dash' : undefined}>
                      {empty || value === undefined ? '—' : number(value)}
                    </strong>
                  </span>
                  <span className="home-stat-label">
                    {text}
                    {empty && (
                      <span className="home-stat-hint"> · belum ada data</span>
                    )}
                  </span>
                </div>
              </div>
            )
          })}
          <div className="stat-note home-stat-note">
            <span className="home-note-label">
              <BadgeCheck size={14} aria-hidden="true" />
              Cakupan data
            </span>
            <p>
              Setiap catatan pengawasan mencantumkan sumber dan tanggal
              pemeriksaan. Portal ini tidak menerbitkan izin.
            </p>
            <small>
              {demo
                ? 'Demo akademik · informasi simulasi'
                : 'Data tercatat di dalam portal'}
            </small>
          </div>
        </div>
        {stats.isError && (
          <div className="container">
            <Alert error={stats.error} />
          </div>
        )}
      </section>
      <section className="section container home-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LAYANAN YANG LEBIH DEKAT</span>
            <h2>
              Setiap langkah,
              <br />
              <em>terhubung dengan baik.</em>
            </h2>
          </div>
          <p>
            Dari menemukan tempat belajar sampai menjaga
            <br className="desktop-break" />
            kenyamanan santri. Semuanya dimulai di sini.
          </p>
        </div>
        <div className="service-grid home-steps">
          {steps.map(([Icon, n, title, desc, to, cta]) => (
            <Link className="service-card home-step" to={to} key={n}>
              <div className="service-card-top home-step-top">
                <span className="service-icon home-step-icon">
                  <Icon size={26} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <span className="home-step-number" aria-hidden="true">
                  {n}
                </span>
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
              <span className="text-link home-step-link">
                {cta}
                <ArrowRight size={18} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="directory-feature section home-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">KENALI PILIHAN ANDA</span>
              <h2>
                Lingkungan yang tepat.
                <br />
                <em>Ruang untuk berkembang.</em>
              </h2>
            </div>
            <LinkButton to="/pesantren" variant="secondary">
              Lihat semua pesantren <ArrowRight size={17} aria-hidden="true" />
            </LinkButton>
          </div>
          <QueryState query={directory}>
            {(data) => (
              <div className="ponpes-grid home-directory">
                {data.items.map((p) => (
                  <PonpesCard
                    key={p.id}
                    ponpes={p}
                    district={
                      stats.data?.per_kecamatan.find(
                        (d) => d.kecamatan_id === p.kecamatan_id,
                      )?.nama_kecamatan
                    }
                  />
                ))}
              </div>
            )}
          </QueryState>
          <p className="note directory-note home-directory-note">
            <BadgeCheck size={15} aria-hidden="true" />
            Kuota mengikuti pendaftaran di dalam portal. Status dokumen dan
            operasional disertai sumber pemeriksaan.
          </p>
        </div>
      </section>
      <section className="section container home-protection">
        <div className="protection-banner">
          <div className="protection-copy">
            <span className="eyebrow">
              <ShieldCheck size={17} aria-hidden="true" /> PERLINDUNGAN SANTRI
            </span>
            <h2>
              Suara Anda berarti.
              <br />
              <em>Keamanan Anda utama.</em>
            </h2>
            <p>
              Isi laporan tidak dibuka oleh pengurus pesantren. Mode rahasia
              tidak meminta nama maupun kontak, dan statusnya tetap bisa Anda
              pantau.
            </p>
            <ul className="protection-promises">
              <li>
                <BadgeCheck size={16} aria-hidden="true" /> Tanpa nama
              </li>
              <li>
                <BadgeCheck size={16} aria-hidden="true" /> Hanya Satgas
              </li>
              <li>
                <BadgeCheck size={16} aria-hidden="true" /> Status terlacak
              </li>
            </ul>
            <div className="protection-actions">
              <LinkButton to="/lapor" variant="gold">
                Buka Lapor Aman <ArrowRight size={18} aria-hidden="true" />
              </LinkButton>
              <Link className="text-link" to="/privasi">
                Cara kerja Lapor Aman{' '}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="protection-flow">
            <span className="protection-flow-title">Setelah Anda mengirim</span>
            <ol>
              <li>
                <span className="step-index" aria-hidden="true">
                  1
                </span>
                <div>
                  <strong>Masuk antrian</strong>
                  <p>
                    Laporan tersimpan dengan kode tiket. Hanya Satgas yang dapat
                    membukanya.
                  </p>
                </div>
              </li>
              <li>
                <span className="step-index" aria-hidden="true">
                  2
                </span>
                <div>
                  <strong>Penyelidikan Satgas</strong>
                  <p>Setiap perubahan status laporan tercatat dan terlacak.</p>
                </div>
              </li>
              <li>
                <span className="step-index" aria-hidden="true">
                  3
                </span>
                <div>
                  <strong>Pendampingan</strong>
                  <p>
                    Berlanjut ke pendampingan, proses hukum, atau selesai —
                    pantau lewat kode tiket.
                  </p>
                </div>
              </li>
            </ol>
            <span className="protection-badge">
              <span className="live-dot" aria-hidden="true" /> Mode rahasia
              tersedia
            </span>
          </div>
        </div>
      </section>
      <section className="section container faq-section home-section home-faq">
        <div>
          <span className="eyebrow">SEBELUM MEMULAI</span>
          <h2>
            Jawaban untuk
            <br />
            <em>langkah pertama Anda.</em>
          </h2>
          <p>
            Kenali cara kerja layanan dan buat keputusan dengan informasi yang
            cukup.
          </p>
          <Link to="/lacak" className="text-link">
            Sudah mengirim? Lacak layanan{' '}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="faq-list home-faq-list">
          {questions.map(([q, a], i) => (
            <details key={q}>
              <summary>
                <span className="faq-number">0{i + 1}</span>
                <strong>{q}</strong>
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="container closing-section home-section home-closing">
        <div>
          <span className="eyebrow">
            SATU PILIHAN BISA MEMBUKA BANYAK JALAN
          </span>
          <h2>
            Perjalanan baik dimulai
            <br />
            dari <em>pilihan yang tepat.</em>
          </h2>
        </div>
        <LinkButton to="/pesantren">
          Temukan pesantren Anda <ArrowRight size={18} aria-hidden="true" />
        </LinkButton>
      </section>
    </div>
  )
}
