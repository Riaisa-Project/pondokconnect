import { useState } from 'react'
import { CheckCircle2, LockKeyhole, Send, ShieldCheck } from 'lucide-react'
import { attachment, post } from '../lib/api'
import { useFeatures } from '../lib/hooks'
import { categories, formValues, localToday } from '../lib/format'
import { Vault3D } from '../components/Scene'
import PonpesSelect from '../components/PonpesSelect'
import {
  Alert,
  Button,
  CopyCode,
  Field,
  LinkButton,
  PageHeading,
  SelectOptions,
} from '../components/UI'

export default function Report() {
  const features = useFeatures()
  const [secret, setSecret] = useState(true)
  const [ponpes, setPonpes] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const data = formValues(e.currentTarget, ['ponpes_id'])
      data.mode_pelapor = secret ? 'rahasia' : 'terbuka'
      if (secret) {
        delete data.nama_pelapor
        delete data.kontak_pelapor
      }
      if (new TextEncoder().encode(data.deskripsi_peristiwa).length > 65535)
        throw new Error(
          'Uraian terlalu panjang. Kurangi teks, terutama karakter emoji.',
        )
      data.bukti_lampiran = await attachment(data.bukti_lampiran)
      setReceipt(await post('/pengaduan/kirim', data))
      window.scrollTo(0, 0)
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
          <span className="eyebrow">LAPORAN TELAH DITERIMA</span>
          <h1>Terima kasih telah bersuara.</h1>
          <p>
            Laporan masuk ke antrean Satgas. Simpan tiket ini secara pribadi;
            tiket tidak bisa dipulihkan dari identitas Anda dalam mode rahasia.
          </p>
          <CopyCode
            value={receipt.kode_tiket}
            caption="Kode tiket rahasia Anda"
          />
          <LinkButton to="/lacak">Lacak laporan</LinkButton>
        </div>
      </div>
    )
  return (
    <div className="container section">
      <PageHeading
        eyebrow="LAPOR AMAN · PERLINDUNGAN SANTRI"
        title="Ruang aman untuk bersuara."
      >
        Sampaikan kejadian kepada Satgas melalui kanal yang terpisah dari
        pengelola pesantren.
      </PageHeading>
      <div className="form-layout report-layout">
        <aside className="report-aside">
          <Vault3D locked={secret} />
          <div className="report-aside-copy">
            <span className="eyebrow">
              <LockKeyhole size={15} /> AKSES TERBATAS
            </span>
            <h2>
              Anda memilih
              <br />
              cara untuk bercerita.
            </h2>
            <p>
              Mode rahasia tidak menyimpan nama dan kontak pada kolom identitas.
              Isi laporan dan bukti hanya dapat dibuka Satgas.
            </p>
            <div className="aside-note">
              <ShieldCheck size={22} />
              <span>
                Hindari menulis identitas dalam uraian atau lampiran jika ingin
                tetap anonim.
              </span>
            </div>
            <small>
              {features.data?.demo
                ? 'Portal demo akademik. Jangan gunakan untuk penanganan darurat atau mengirim data korban nyata.'
                : 'Laporan diproses melalui antrean Satgas. Untuk keadaan darurat, segera hubungi bantuan setempat.'}
            </small>
          </div>
        </aside>
        <form className="panel form-panel" onSubmit={submit}>
          <div className="privacy-toggle">
            <div>
              <strong>Mode rahasia</strong>
              <p>
                {secret
                  ? 'Nama dan kontak tidak diminta.'
                  : 'Nama dan kontak diperlukan untuk tindak lanjut.'}
              </p>
            </div>
            <button
              type="button"
              className={`switch ${secret ? 'on' : ''}`}
              role="switch"
              aria-label="Mode rahasia"
              aria-checked={secret}
              onClick={() => setSecret(!secret)}
            >
              <span />
            </button>
          </div>
          {!secret && (
            <div className="form-grid">
              <Field label="Nama pelapor">
                <input name="nama_pelapor" required maxLength={100} />
              </Field>
              <Field label="Kontak pelapor">
                <input name="kontak_pelapor" required maxLength={100} />
              </Field>
            </div>
          )}
          <PonpesSelect value={ponpes} onChange={setPonpes} allowInactive />
          <div className="form-grid">
            <Field label="Kategori kejadian">
              <select name="kategori_kasus" required defaultValue="">
                <option value="" disabled>
                  Pilih kategori
                </option>
                <SelectOptions values={categories} />
              </select>
            </Field>
            <Field label="Tanggal kejadian">
              <input
                name="tanggal_kejadian"
                type="date"
                required
                max={localToday()}
              />
            </Field>
          </div>
          <Field label="Lokasi kejadian">
            <input
              name="lokasi_kejadian"
              required
              maxLength={150}
              placeholder="Contoh: area asrama"
            />
          </Field>
          <Field
            label="Ceritakan kejadian"
            hint="Uraikan peristiwa secara jelas. Minimal 10 karakter."
          >
            <textarea
              name="deskripsi_peristiwa"
              required
              minLength={10}
              maxLength={20000}
              rows={6}
              placeholder="Apa yang terjadi, kapan, dan hal yang perlu diketahui Satgas…"
            />
          </Field>
          <Field
            label="Lampiran bukti (opsional)"
            hint="PDF, PNG, atau JPEG. Maksimum 5 MiB."
          >
            <input
              type="file"
              name="bukti_lampiran"
              accept="application/pdf,image/png,image/jpeg"
            />
          </Field>
          <Alert error={error} />
          <Button type="submit" busy={busy}>
            <Send size={16} />
            Kirim laporan ke Satgas
          </Button>
          <small className="muted">
            Simpan kode tiket setelah mengirim. Jangan membagikannya kepada
            orang lain.
          </small>
        </form>
      </div>
    </div>
  )
}
