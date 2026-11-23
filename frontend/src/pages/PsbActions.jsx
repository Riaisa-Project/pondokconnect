import { useState } from 'react'
import { Upload, CalendarDays } from 'lucide-react'
import { Button, Field } from '../components/UI'

export default function PsbActions({ result, busy, onSign, onUpload }) {
  const [file, setFile] = useState(null)

  return (
    <div className="psb-actions">
      {result.status_seleksi === 'diterima' && !result.has_bukti_bayar && (
        <Button variant="primary" busy={busy} onClick={onSign}>
          <CalendarDays size={16} />
          Daftar ulang sekarang
        </Button>
      )}
      {result.status_seleksi === 'diterima' && result.has_bukti_bayar && (
        <Button variant="primary" busy={busy}>
          <Upload size={16} />
          Unggah bukti bayar
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(e) => {
              if (e.target.files.length > 0) {
                setFile(e.target.files[0])
                onUpload(e.target.files[0])
              }
            }}
            style={{ display: 'none' }}
          />
        </Button>
      )}
      {result.status_seleksi === 'daftar_ulang' && (
        <div className="stack">
          <p>
            Anda telah memulai proses daftar ulang. Silakan unggah bukti pembayaran
            untuk melanjutkan.
          </p>
          <Field label="Unggah bukti transfer (PDF/JPEG/PNG)">
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(e) => {
                if (e.target.files.length > 0) {
                  setFile(e.target.files[0])
                  onUpload(e.target.files[0])
                }
              }}
            />
          </Field>
        </div>
      )}
      {file && (
        <p className="note">
          File terpilih: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
        </p>
      )}
    </div>
  )
}