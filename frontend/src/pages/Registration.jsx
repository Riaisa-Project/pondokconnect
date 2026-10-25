import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  ShieldCheck,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { attachment, download, post } from '../lib/api'
import { formValues } from '../lib/format'
import PonpesSelect from '../components/PonpesSelect'
import OcrAssistant from '../components/OcrAssistant'
import { useFeatures } from '../lib/hooks'
import {
  Alert,
  Button,
  CopyCode,
  Field,
  LinkButton,
  PageHeading,
} from '../components/UI'

export default function Registration() {
  const [params] = useSearchParams()
  const [ponpes, setPonpes] = useState(params.get('ponpes') || '')
  const [receipt, setReceipt] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [kkFile, setKkFile] = useState(null)
  const formRef = useRef(null)
  const features = useFeatures()
  const cache = useQueryClient()
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const data = formValues(e.currentTarget, ['ponpes_id'])
      data.file_kk = await attachment(data.file_kk)
      delete data.consent
      const result = await post('/pendaftaran/kirim', data)
      setReceipt(result)
      cache.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0]?.startsWith('/ponpes') ||
          q.queryKey[0] === 'ponpes-options',
      })
      window.scrollTo(0, 0)
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
        `/pendaftaran/kartu/${receipt.nomor_registrasi}`,
        `${receipt.nomor_registrasi}.pdf`,
      )
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  if (receipt)
    return (
      <div className="container section narrow">
        <div className="success-card">
          <CheckCircle2 size={44} />
          <span className="eyebrow">LANGKAH PERTAMA SELESAI</span>
          <h1>Pendaftaran terkirim.</h1>
          <p>
            Pengurus pesantren akan memeriksa berkas Anda. Simpan nomor
            registrasi berikut untuk melihat hasil seleksi.
          </p>
          <CopyCode value={receipt.nomor_registrasi} />
          <Alert error={error} />
          <div className="button-row">
            <Button busy={busy} onClick={pdf}>
              <Download size={17} />
              Unduh bukti PDF
            </Button>
            <LinkButton to="/lacak" variant="secondary">
              Lacak pendaftaran
            </LinkButton>
          </div>
          <small>
            Hubungi sekretariat pesantren untuk jadwal daftar ulang.
          </small>
        </div>
      </div>
    )
  return (
    <div className="container section">
      <PageHeading
        eyebrow="PENDAFTARAN SANTRI"
        title="Awali perjalanan belajar Anda."
      >
        Lengkapi data calon santri dan wali. Pengurus akan memeriksa berkas
        melalui portal.
      </PageHeading>
      <div className="form-layout">
        <form ref={formRef} className="panel form-panel" onSubmit={submit}>
          <div className="form-section-title">
            <span>01</span>
            <h2>Pesantren tujuan</h2>
          </div>
          <PonpesSelect value={ponpes} onChange={setPonpes} />
          <div className="form-section-title">
            <span>02</span>
            <h2>Data calon santri</h2>
          </div>
          <div className="form-grid">
            <Field label="Nama lengkap santri">
              <input
                name="nama_santri"
                required
                maxLength={100}
                autoComplete="name"
              />
            </Field>
            <Field
              label="NIK santri"
              hint="16 digit sesuai dokumen kependudukan."
            >
              <input
                name="nik_santri"
                required
                pattern="[0-9]{16}"
                minLength={16}
                maxLength={16}
                inputMode="numeric"
              />
            </Field>
            <Field label="Jenis kelamin">
              <select name="jenis_kelamin" required defaultValue="">
                <option value="" disabled>
                  Pilih jenis kelamin
                </option>
                <option value="L">Laki-laki / putra</option>
                <option value="P">Perempuan / putri</option>
              </select>
            </Field>
          </div>
          <div className="form-section-title">
            <span>03</span>
            <h2>Wali & kelengkapan berkas</h2>
          </div>
          <div className="form-grid">
            <Field label="Nama wali">
              <input name="nama_wali" required maxLength={100} />
            </Field>
            <Field label="Nomor HP wali">
              <input
                name="no_hp_wali"
                type="tel"
                required
                maxLength={20}
                placeholder="081234567890"
              />
            </Field>
          </div>
          <Field
            label="Kartu Keluarga (opsional)"
            hint="PDF, PNG, atau JPEG. Maksimum 5 MiB. Hanya pengurus pesantren tujuan yang dapat mengakses berkas."
          >
            <input
              name="file_kk"
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(e) => setKkFile(e.target.files?.[0] || null)}
            />
          </Field>
          {features.data?.ocr_available && (
            <OcrAssistant file={kkFile} formRef={formRef} />
          )}
          <label className="check-field">
            <input type="checkbox" name="consent" required />
            <span>
              Saya telah memeriksa data dan memahami{' '}
              <Link to="/privasi" target="_blank">
                penggunaan data pendaftaran
              </Link>
              .
            </span>
          </label>
          <Alert error={error} />
          <Button type="submit" busy={busy}>
            Kirim pendaftaran <ArrowRight size={17} />
          </Button>
        </form>
        <aside className="form-aside">
          <div className="aside-icon">
            <FileText size={29} />
          </div>
          <h2>Persiapkan dengan tenang.</h2>
          <ol className="process-list">
            <li>
              <strong>Pilih pesantren</strong>
              <span>Periksa profil dan sisa kuota sebelum mendaftar.</span>
            </li>
            <li>
              <strong>Pastikan data sesuai</strong>
              <span>
                Satu NIK hanya dapat didaftarkan sekali pada pesantren yang
                sama.
              </span>
            </li>
            <li>
              <strong>Simpan bukti daftar</strong>
              <span>
                Nomor registrasi digunakan untuk melacak hasil seleksi dan
                mengunduh kartu.
              </span>
            </li>
          </ol>
          <div className="aside-note">
            <ShieldCheck size={20} />
            <p>NIK dan kontak wali tidak ditampilkan dalam pelacakan publik.</p>
          </div>
          {features.data?.demo && (
            <p className="note">
              Portal ini masih berupa demo akademik. Gunakan data simulasi untuk
              mencoba pendaftaran.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
