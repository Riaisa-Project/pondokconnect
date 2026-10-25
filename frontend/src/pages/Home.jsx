import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Building2,
  FileCheck2,
  HeartHandshake,
  MapPin,
  Search,
  ShieldCheck,
  Users,
  GitCompareArrows,
  ChevronDown,
} from 'lucide-react'
import { useApi, useFeatures } from '../lib/hooks'
import { number } from '../lib/format'
import Explorer from '../components/Explorer'
import { Vault3D } from '../components/Scene'
import { Alert, LinkButton, QueryState } from '../components/UI'
import PonpesCard from '../components/PonpesCard'
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
export default function Home() {
  const features = useFeatures()
  const stats = useApi('/stats/ringkasan'),
    directory = useApi('/ponpes/', { limit: 3 }),
    navigate = useNavigate()
  return (
    <>
      <section className="hero showcase-hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="hero-eyebrow">
              <span className="live-dot" /> EKOSISTEM PESANTREN LAMONGAN
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
              className="hero-search"
              onSubmit={(e) => {
                e.preventDefault()
                navigate(
                  `/pesantren?q=${encodeURIComponent(new FormData(e.currentTarget).get('q').trim())}`,
                )
              }}
            >
              <Search size={21} />
              <input
                aria-label="Cari nama pesantren"
                name="q"
                placeholder="Cari pesantren impian Anda…"
                maxLength={150}
              />
              <button aria-label="Cari pesantren">
                <ArrowRight size={21} />
              </button>
            </form>
            <div className="hero-trust">
              <span>
                <BadgeCheck size={17} />
                Periksa status & sumber
              </span>
              <span>
                <GitCompareArrows size={17} />
                Bandingkan pilihan
              </span>
            </div>
            <div className="hero-footnote">
              <span className="hero-line" />
              Tradisi yang mengakar. Kesempatan yang terbuka.
            </div>
          </div>
          <div className="hero-visual">
            <Explorer districts={stats.data?.per_kecamatan || []} />
          </div>
        </div>
        <div className="container stats-strip">
          {[
            [Building2, stats.data?.total_ponpes, 'Profil pesantren'],
            [MapPin, stats.data?.total_kecamatan, 'Kecamatan terhubung'],
            [Users, stats.data?.total_santri_diterima, 'Santri diterima'],
          ].map(([Icon, value, text]) => (
            <div className="stat" key={text}>
              <div className="stat-icon">
                <Icon size={23} strokeWidth={1.5} />
              </div>
              <strong>{value === undefined ? '—' : number(value)}</strong>
              <span>{text}</span>
            </div>
          ))}
          <div className="stat-note">
            <span className="live-dot" />
            {stats.isError
              ? 'Data belum tersedia'
              : 'Terhubung dengan layanan Anda'}
            <small>
              {features.data?.demo
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
      <section className="section container">
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
        <div className="service-grid">
          {[
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
          ].map(([Icon, n, title, desc, to, cta]) => (
            <Link className="service-card" to={to} key={n}>
              <div className="service-card-top">
                <span className="service-icon">
                  <Icon size={27} strokeWidth={1.5} />
                </span>
                <span>{n}</span>
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
              <span className="text-link">
                {cta}
                <ArrowUpRight size={18} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="directory-feature section">
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
              Lihat semua pesantren <ArrowUpRight size={17} />
            </LinkButton>
          </div>
          <QueryState query={directory}>
            {(data) => (
              <div className="ponpes-grid">
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
          <p className="note directory-note">
            <BadgeCheck size={15} />
            Kuota mengikuti pendaftaran dalam portal.{' '}
            {features.data?.demo
              ? 'Profil demo adalah simulasi.'
              : 'Status dokumen dan operasional disertai sumber pemeriksaan.'}
          </p>
        </div>
      </section>
      <section className="section container">
        <div className="protection-banner">
          <div className="protection-copy">
            <span className="eyebrow">
              <ShieldCheck size={17} /> PERLINDUNGAN SANTRI
            </span>
            <h2>
              Suara Anda berarti.
              <br />
              <em>Keamanan Anda utama.</em>
            </h2>
            <p>
              Ruang belajar yang nyaman dimulai dari kepedulian. Sampaikan
              laporan melalui kanal terbatas untuk Satgas, dengan pilihan mode
              rahasia.
            </p>
            <LinkButton to="/lapor" variant="gold">
              Buka Lapor Aman <ArrowUpRight size={18} />
            </LinkButton>
            <small>
              Akses pengurus pesantren tidak mencakup isi pengaduan.
            </small>
          </div>
          <div className="protection-visual">
            <Vault3D locked />
            <span className="vault-status">
              <span className="live-dot" />
              MODE RAHASIA TERSEDIA
            </span>
          </div>
        </div>
      </section>
      <section className="section container faq-section">
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
            Sudah mengirim? Lacak layanan <ArrowRight size={17} />
          </Link>
        </div>
        <div className="faq-list">
          {questions.map(([q, a], i) => (
            <details key={q}>
              <summary>
                <span className="faq-number">0{i + 1}</span>
                <strong>{q}</strong>
                <ChevronDown size={18} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="container closing-section">
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
          Temukan pesantren Anda <ArrowUpRight size={18} />
        </LinkButton>
      </section>
    </>
  )
}
