import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, Save } from 'lucide-react'
import { useApi } from '../lib/hooks'
import { download, put } from '../lib/api'
import { label } from '../lib/format'
import { Alert, Button, Field, SelectOptions } from './UI'

export function usePaged(path, options = {}) {
  const [offset, setOffset] = useState(0)
  const query = useApi(path, { limit: 20, offset }, options)
  return { query, offset, setOffset, limit: 20 }
}
export function StatusEditor({
  path,
  field,
  value,
  values,
  onSaved,
  internalNotes = false,
}) {
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)
  const cache = useQueryClient()
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(false)
    try {
      const data = new FormData(e.currentTarget)
      await put(path, {
        [field]: data.get(field),
        ...(internalNotes
          ? {
              catatan_internal:
                String(data.get('catatan_internal') || '').trim() || null,
            }
          : {}),
      })

      setSuccess(true)
      cache.invalidateQueries()
      onSaved?.()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="status-editor" onSubmit={submit}>
      <Field label="Ubah status">
        <select key={value} name={field} defaultValue={value}>
          <SelectOptions values={values} />
        </select>
      </Field>
      {internalNotes && (
        <Field
          label="Catatan internal"
          hint="Hanya tersedia untuk Satgas; tidak tampil pada pelacakan publik."
        >
          <textarea name="catatan_internal" maxLength={2000} rows={3} />
        </Field>
      )}
      <Button type="submit" variant="secondary" busy={busy}>
        <Save size={15} />
        Simpan
      </Button>
      <Alert error={error} />
      {success && <small role="status">Status tersimpan.</small>}
    </form>
  )
}
export function DownloadButton({ path, filename, children }) {
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true)
    setError(null)
    try {
      await download(path, filename)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <Button variant="secondary" busy={busy} onClick={run}>
        <Download size={15} />
        {children}
      </Button>
      <Alert error={error} />
    </div>
  )
}
export function ProfileFields({ data = {}, create = false, districts = [] }) {
  return (
    <>
      <div className="form-grid">
        <Field label="Nama pesantren">
          <input
            name="nama_ponpes"
            required
            maxLength={150}
            defaultValue={data.nama_ponpes || ''}
          />
        </Field>
        <Field label="Nama pengasuh">
          <input
            name="nama_pengasuh"
            maxLength={100}
            defaultValue={data.nama_pengasuh || ''}
          />
        </Field>
        {create && (
          <>
            <Field label="NSPP (12 digit)">
              <input
                name="nspp"
                pattern="[0-9]{12}"
                maxLength={12}
                inputMode="numeric"
              />
            </Field>
            <Field label="Kecamatan">
              <select name="kecamatan_id" required defaultValue="">
                <option value="" disabled>
                  Pilih kecamatan
                </option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nama_kecamatan}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
        <Field label="Tipe pesantren">
          <select
            name="tipe_pesantren"
            defaultValue={data.tipe_pesantren || ''}
          >
            <option value="">Belum diketahui</option>
            {['salafiyah', 'khalafiyah_modern', 'kombinasi'].map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kontak sekretariat">
          <input
            name="kontak_sekretariat"
            type="tel"
            maxLength={20}
            defaultValue={data.kontak_sekretariat || ''}
          />
        </Field>
      </div>
      <Field label="Alamat lengkap">
        <textarea
          name="alamat_lengkap"
          required
          rows={3}
          maxLength={4000}
          defaultValue={data.alamat_lengkap || ''}
        />
      </Field>
      <div className="form-grid">
        {[
          ['kuota_putra', 'Kapasitas putra', 0, 100000, 0],
          ['kuota_putri', 'Kapasitas putri', 0, 100000, 0],
          ['latitude', 'Latitude', -90, 90],
          ['longitude', 'Longitude', -180, 180],
        ].map(([name, text, min, max]) => (
          <Field label={text} key={name}>
            <input
              type="number"
              name={name}
              min={min}
              max={max}
              step={name.startsWith('kuota') ? 1 : '0.00000001'}
              defaultValue={data[name] ?? (name.startsWith('kuota') ? 0 : '')}
            />
          </Field>
        ))}
      </div>
    </>
  )
}
