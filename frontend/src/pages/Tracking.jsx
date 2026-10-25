import { useState } from 'react'
import { Download, FileSearch, Search, ShieldCheck } from 'lucide-react'
import { download, get } from '../lib/api'
import { date } from '../lib/format'
import { Alert, Badge, Button, Field, PageHeading } from '../components/UI'

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
      setResult(await get(`/${type}/lacak/${encodeURIComponent(code.trim())}`))
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
  return (
    <div className="container section narrow">
      <PageHeading
        eyebrow="PELACAKAN LAYANAN"
        title="Ikuti setiap perkembangannya."
      >
        Masukkan kode yang Anda terima saat mengirim pendaftaran atau laporan.
      </PageHeading>
      <div className="panel tracking-panel">
        <div className="tabs" aria-label="Jenis layanan">
          <button
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
        </div>
        <form onSubmit={submit}>
          <Field
            label={
              type === 'pendaftaran'
                ? 'Nomor registrasi'
                : 'Kode tiket pengaduan'
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
                  : 'Kode tiket 32 karakter'
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
            </dl>
            <StatusGuidance
              status={result.status_seleksi || result.status_tindakan}
              type={type}
            />
            {type === 'pendaftaran' && (
              <Button variant="secondary" busy={busy} onClick={pdf}>
                <Download size={16} />
                Unduh bukti PDF
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

function StatusGuidance({ status, type }) {
  const registration = ['menunggu_verifikasi', 'lolos_berkas', 'diterima']
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
            <div
              className={s === status ? 'current' : ''}
              key={s}
              aria-current={s === status ? 'step' : undefined}
            >
              {labels[s]}
            </div>
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
