import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Save, BookOpen } from 'lucide-react'
import { put } from '../lib/api'
import { Alert, Button, Field } from './UI'
export default function ProfileContent({ data }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [saved, setSaved] = useState(false),
    cache = useQueryClient()
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const form = new FormData(e.currentTarget)
      const lines = (key) => [
        ...new Set(
          String(form.get(key))
            .split('\n')
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      ]
      await put('/admin/ponpes/my', {
        deskripsi: String(form.get('deskripsi')).trim(),
        program_unggulan: lines('program_unggulan'),
        fasilitas: lines('fasilitas'),
      })
      setSaved(true)
      cache.invalidateQueries()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="panel form-panel public-content-form">
      <div className="section-heading">
        <div>
          <span className="eyebrow">PROFIL PUBLIK</span>
          <h2>Ceritakan pesantren Anda</h2>
        </div>
        <BookOpen size={26} />
      </div>
      <p>
        Informasi ini tampil di profil, direktori, dan perbandingan pesantren.
        Gunakan informasi yang telah dikonfirmasi pengurus.
      </p>
      <Field
        label="Deskripsi pesantren"
        hint="Maksimal 5.000 karakter. Tulis pengantar pendidikan dan kehidupan pesantren."
      >
        <textarea
          name="deskripsi"
          rows={5}
          maxLength={5000}
          defaultValue={data.deskripsi || ''}
        />
      </Field>
      <div className="form-grid">
        <Field
          label="Program unggulan"
          hint="Satu program per baris. Maksimal 20 program, masing-masing 100 karakter."
        >
          <textarea
            name="program_unggulan"
            rows={5}
            defaultValue={data.program_unggulan?.join('\n') || ''}
            placeholder="Tahfiz Al-Qur'an\nKajian kitab"
          />
        </Field>
        <Field
          label="Fasilitas pesantren"
          hint="Satu fasilitas per baris. Maksimal 20 fasilitas, masing-masing 100 karakter."
        >
          <textarea
            name="fasilitas"
            rows={5}
            defaultValue={data.fasilitas?.join('\n') || ''}
            placeholder="Asrama\nPerpustakaan"
          />
        </Field>
      </div>
      <Alert error={error} />
      {saved && <Alert success>Konten profil publik berhasil disimpan.</Alert>}
      <Button type="submit" busy={busy}>
        <Save size={16} />
        Simpan profil publik
      </Button>
    </form>
  )
}
