import { useState } from 'react'
import {
  Download,
  FileSearch,
  Search,
  ShieldCheck,
  Users,
  CalendarDays,
  Upload,
} from 'lucide-react'
import { download, get } from '../lib/api'
import { psbTrackDetail, psbDaftarUlang } from '../lib/psb'
import { date } from '../lib/format'
import {
  Alert,
  Badge,
  Button,
  Field,
  PageHeading,
  StatusStep,
} from '../components/UI'

export default function Tracking() {
  const [type, setType] = useState('pendaftaran')
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      if (type === 'pendaftaran') {
        setResult(await psbTrackDetail(code.trim()))
      } else {
        setResult(await get(`/${type}/lacak/${encodeURIComponent(code.trim())}`))
      }
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  async function pdf() {
    setBusy(true)
    setError(null)
    try {
      await download(
        `/pendaftaran/kartu/${result.nomor_registrasi}`,
        `${result.nomor_registrasi}.pdf`,
      )
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  async function daftarUlang() {
    setBusy(true)
    setError(null)
    try {
      await psbDaftarUlang(result.nomor_registrasi, {
        pernyataan: true,
      })
      setResult({ ...result, has_bukti_bayar: false })
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  async function uploadBukti(file) {
    setBusy(true)
    setError(null)
    try {
      const attachment = await window.api.attachment(file)
      await psbDaftarUlang(result.nomor_registrasi, {
        bukti_bayar: attachment,
        pernyataan: true,
      })
      setResult({ ...result, has_bukti_bayar: true })
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="container section narrow">
      <PageHeading
        eyebrow="PELACAKAN LAYANAN"
        title="Ikuti setiap perkembangannya."
      >
        Masukkan kode yang Anda terima saat mengirim pendaftaran atau laporan.
      </PageHeading>
      <div className="panel tracking-panel">
        <div className="tabs" role="tablist" aria-label="Jenis layanan">
          <button
            role="tab"
            aria-selected={type === 'pendaftaran'}
            className={type === 'pendaftaran' ? 'active' : ''}
            onClick={() => {
              setType('pendaftaran')
              setResult(null)
              setCode('')
              setError(null)
            }}
            disabled={busy}
          >
            <FileSearch size={17} />
            Pendaftaran santri
          </button>
          <button
            role="tab"
            aria-selected={type === 'pengaduan'}
            className={type === 'pengaduan' ? 'active' : ''}
            onClick={() => {
              setType('pengaduan')
              setResult(null)
              setCode('')
              setError(null)
            }}
            disabled={busy}
          >
            <ShieldCheck size={17} />
            Pengaduan
          </button>
          <button
            role="tab"
            aria-selected={type === 'psb'}
            className={type === 'psb' ? 'active' : ''}
            onClick={() => {
              setType('psb')
              setResult(null)
              setCode('')
              setError(null)
            }}
            disabled={busy}
          >
            <Users size={17} />
            PSB
          </button>
        </div>
        <form onSubmit={submit}>
          <Field
            label={
              type === 'pendaftaran'
                ? 'Nomor registrasi'
                : type === 'pengaduan'
                ? 'Kode tiket pengaduan'
                : 'Nomor registrasi'
            }
          >
            <input
              required
              maxLength={40}
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={
                type === 'pendaftaran'
                  ? 'REG-YYYYMM-XXXXXXXXXXXXXXXX'
                  : type === 'pengaduan'
                  ? 'Kode tiket 32 karakter'
                  : 'REG-YYYYMM-XXXXXXXXXXXXXXXX'
              }
            />
          </Field>
          <Button type="submit" busy={busy}>
            <Search size={17} />
            Periksa status
          </Button>
        </form>
        <Alert error={error} />
        {result && (
          <div className="tracking-result" aria-live="polite">
            <span className="eyebrow">STATUS TERBARU</span>
            <Badge value={result.status_seleksi || result.status_tindakan} />
            <dl>
              <div>
                <dt>Referensi</dt>
                <dd className="mono">
                  {result.nomor_registrasi || result.kode_tiket}
                </dd>
              </div>
              <div>
                <dt>Dikirim pada</dt>
                <dd>{date(result.created_at)}</dd>
              </div>
              {result.gelombang_nama && (
                <div>
                  <dt>Gelombang</dt>
                  <dd>{result.gelombang_nama}</dd>
                </div>
              )}
              {result.sisa_hari_daftar_ulang !== undefined && (
                <div>
                  <dt>Sisa tenggat daftar ulang</dt>
                  <dd>
                    {result.sisa_hari_daftar_ulang > 0
                      ? `${result.sisa_hari_daftar_ulang} hari lagi`
                      : result.sisa_hari_daftar_ulang === 0
                      ? 'Hari ini'
                      : 'Tenggat telah lewat'}
                  </dd>
                </div>
              )}
              {result.has_bukti_bayar && (
                <div>
                  <dt>Bukti bayar</dt>
                  <dd>
                    <Badge value="terkirim" variant="success" />
                  </dd>
                </div>
              )}
              {result.kamar && (
                <div>
                  <dt>Kamar</dt>
                  <dd>{result.kamar}</dd>
                </div>
              )}
              {result.nomor_induk && (
                <div>
                  <dt>Nomor induk</dt>
                  <dd className="mono">{result.nomor_induk}</dd>
                </div>
              )}
            </dl>
            <StatusGuidance
              status={result.status_seleksi || result.status_tindakan}
              type={type}
              result={result}
            />
            {type === 'pendaftaran' && (
              <Button variant="secondary" busy={busy} onClick={pdf}>
                <Download size={16} />
                Unduh bukti PDF
              </Button>
            )}
            {type === 'psb' && result.status_seleksi === 'diterima' && !result.has_bukti_bayar && (
              <Button variant="primary" busy={busy} onClick={daftarUlang}>
                <CalendarDays size={16} />
                Daftar ulang sekarang
              </Button>
            )}
            {type === 'psb' && result.status_seleksi === 'diterima' && result.has_bukti_bayar && (
              <Button variant="primary" busy={busy}>
                <Upload size={16} />
                Unggah bukti bayar
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={(e) => {
                    if (e.target.files.length > 0) uploadBukti(e.target.files[0])
                  }}
                  style={{ display: 'none' }}
                />
              </Button>
            )}
          </div>
        )}
        <p className="note">
          <ShieldCheck size={16} />
          Pelacakan hanya menampilkan status. Identitas dan isi laporan tetap
          dibatasi.
        </p>
      </div>
    </div>
  )
}

function StatusGuidance({ status, type, result }) {
  const registration = [
    'menunggu_verifikasi',
    'lolos_berkas',
    'diterima',
    'cadangan',
    'daftar_ulang',
    'gugur',
  ]
  const report = [
    'masuk_antrian',
    'penyelidikan_satgas',
    'pendampingan',
    'proses_hukum',
    'selesai',
  ]
  const stages = type === 'pendaftaran' ? registration : report
  const labels = {
    menunggu_verifikasi: 'Verifikasi',
    lolos_berkas: 'Berkas lolos',
    diterima: 'Diterima',
    cadangan: 'Cadangan',
    daftar_ulang: 'Daftar ulang',
    gugur: 'Gugur',
    masuk_antrian: 'Antrean',
    penyelidikan_satgas: 'Penyelidikan',
    pendampingan: 'Pendampingan',
    proses_hukum: 'Proses hukum',
    selesai: 'Selesai',
  }
  const guidance = {
    menunggu_verifikasi:
      'Pendaftaran telah diterima portal. Pengurus akan memeriksa data dan berkas. Simpan nomor registrasi untuk memeriksa perkembangan.',
    lolos_berkas:
      'Berkas dinyatakan lolos. Hubungi sekretariat untuk mengetahui tahap seleksi atau jadwal berikutnya.',
    diterima:
      'Selamat, pendaftaran Anda diterima. Hubungi sekretariat untuk informasi daftar ulang dan persiapan masuk.',
    cadangan:
      'Anda berada dalam daftar cadangan. Jika ada pendaftar yang mundur, kursi akan diisi sesuai urutan cadangan.',
    daftar_ulang:
      'Pengurus telah membuka daftar ulang untuk Anda. Lakukan pembayaran dan unggah bukti transfer sebelum tenggat berakhir.',
    gugur:
      'Pendaftaran tidak dapat dilanjutkan karena kehilangan kuota atau pelanggaran aturan. Hubungi sekretariat untuk penjelasan.',
    ditolak:
      'Pendaftaran belum diterima. Hubungi pengurus untuk penjelasan dan pilihan langkah berikutnya.',
    masuk_antrian:
      'Laporan berada dalam antrean Satgas. Simpan tiket secara pribadi agar Anda dapat melihat perkembangan.',
    penyelidikan_satgas:
      'Satgas sedang meninjau laporan. Informasi rinci dibatasi untuk menjaga privasi pihak terkait.',
    pendampingan:
      'Laporan berada pada tahap pendampingan. Periksa halaman ini kembali menggunakan tiket Anda.',
    proses_hukum:
      'Status laporan telah diperbarui menjadi proses hukum. Informasi penanganan rinci tidak ditampilkan pada pelacakan publik.',
    selesai: 'Penanganan laporan telah ditandai selesai oleh Satgas.',
    tidak_valid:
      'Laporan ditandai tidak valid oleh Satgas. Status ini mengikuti hasil peninjauan dalam portal.',
  }
  return (
    <>
      {stages.includes(status) && (
        <div className="tracking-steps" aria-label="Tahap layanan saat ini">
          {stages.map((s) => (
            <StatusStep key={s} status={s} current={s === status} label={labels[s]} />
          ))}
        </div>
      )}
      <p className="tracking-guidance">{guidance[status]}</p>
      <small className="note">
        Indikator menunjukkan status saat ini, bukan riwayat waktu setiap tahap.
      </small>
    </>
  )
}