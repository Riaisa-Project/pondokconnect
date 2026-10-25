import { useEffect, useId, useRef, useState } from 'react'
import { ScanText } from 'lucide-react'
import { api, attachment } from '../lib/api'
import { Alert, Button, Field } from './UI'

const fieldLabels = {
  nama_santri: 'nama santri',
  nik_santri: 'NIK santri',
  jenis_kelamin: 'jenis kelamin',
  nama_wali: 'nama wali (kepala keluarga)',
}

export default function OcrAssistant({ file, formRef }) {
  const headingId = useId()
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [selectedMember, setSelectedMember] = useState('')
  const [chosenFields, setChosenFields] = useState([])
  const [notice, setNotice] = useState('')
  const controller = useRef(null)
  const generation = useRef(0)

  function clearReading() {
    generation.current += 1
    controller.current?.abort()
    controller.current = null
    setBusy(false)
    setError(null)
    setResult(null)
    setSelectedMember('')
    setChosenFields([])
    setNotice('')
  }

  useEffect(() => {
    clearReading()
    setConsent(false)
    return () => {
      generation.current += 1
      controller.current?.abort()
    }
  }, [file])

  function changeConsent(checked) {
    setConsent(checked)
    if (!checked) clearReading()
  }

  async function read() {
    if (!consent || !file) return
    clearReading()
    const requestGeneration = generation.current
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    try {
      if (!['image/png', 'image/jpeg'].includes(file.type))
        throw new Error(
          'OCR memerlukan PNG atau JPEG. Lampiran PDF tetap dapat dikirim dengan formulir manual.',
        )
      const image = await attachment(file)
      if (abort.signal.aborted || requestGeneration !== generation.current)
        return
      const response = await api.post(
        '/ocr/kk',
        { attachment: image, consent: true },
        {
          timeout: 45000,
          signal: abort.signal,
        },
      )
      if (abort.signal.aborted || requestGeneration !== generation.current)
        return
      setResult(response.data)
    } catch (e) {
      if (!abort.signal.aborted && requestGeneration === generation.current)
        setError(e)
    } finally {
      if (requestGeneration === generation.current) {
        setBusy(false)
        controller.current = null
      }
    }
  }

  const member = result?.members?.[Number(selectedMember)]
  const values =
    selectedMember === ''
      ? {}
      : {
          nama_santri: member?.nama,
          nik_santri: member?.nik,
          jenis_kelamin: member?.jenis_kelamin,
          nama_wali: result?.kepala_keluarga,
        }

  function apply() {
    const form = formRef.current
    if (!form || !consent || !result) return
    const changes = chosenFields.filter((key) => values[key])
    const overwrites = changes.filter((key) => {
      const previous = form.elements.namedItem(key)?.value
      return previous && previous !== values[key]
    })
    if (
      overwrites.length &&
      !window.confirm(
        `Kolom ${overwrites.map((key) => fieldLabels[key]).join(', ')} sudah terisi. Ganti dengan nilai OCR yang Anda pilih?`,
      )
    )
      return
    for (const key of changes) {
      const input = form.elements.namedItem(key)
      if (input) {
        input.value = values[key]
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }
    setNotice(
      'Nilai terpilih diterapkan. Periksa kembali seluruh formulir sebelum mengirim pendaftaran.',
    )
  }

  const isImage = file && ['image/png', 'image/jpeg'].includes(file.type)
  return (
    <section className="ocr-assistant stack-small" aria-labelledby={headingId}>
      <div className="ocr-heading">
        <ScanText size={21} aria-hidden="true" />
        <h3 id={headingId}>Isi dari foto KK (opsional)</h3>
      </div>
      <p className="note">
        Asisten membaca nama, NIK, dan jenis kelamin dari gambar KK yang Anda
        pilih di atas. Gambar akan dikirim ke Groq setelah Anda memberi
        persetujuan dan menekan tombol baca. Anda tetap dapat mengisi dan
        mengirim formulir secara manual.
      </p>
      <label className="check-field">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => changeConsent(e.target.checked)}
        />
        <span>Saya setuju gambar KK dikirim ke Groq untuk dibaca.</span>
      </label>
      {file && !isImage && (
        <p className="note">
          OCR memerlukan PNG atau JPEG. Lampiran PDF tetap dapat dikirim dengan
          formulir manual.
        </p>
      )}
      <div>
        <Button
          variant="secondary"
          onClick={read}
          busy={busy}
          disabled={!consent || !isImage}
        >
          <ScanText size={17} /> Baca gambar KK
        </Button>
      </div>
      {busy && (
        <p role="status" className="note">
          Membaca gambar. Anda dapat melanjutkan pengisian manual.
        </p>
      )}
      <Alert error={error} />
      {result && (
        <div className="ocr-results stack-small">
          <p className="note">
            Hasil OCR dapat keliru. Cocokkan setiap nilai dengan KK; data yang
            tidak terbaca dibiarkan kosong. Kepala keluarga belum tentu wali
            calon santri.
          </p>
          {!result.members?.length ? (
            <p role="status">
              Anggota KK belum terbaca. Gunakan foto yang lebih jelas atau isi
              formulir manual.
            </p>
          ) : (
            <>
              <Field label="Anggota KK untuk calon santri">
                <select
                  value={selectedMember}
                  onChange={(e) => {
                    setSelectedMember(e.target.value)
                    setChosenFields([])
                    setNotice('')
                  }}
                >
                  <option value="">Pilih anggota keluarga</option>
                  {result.members.map((person, index) => (
                    <option key={index} value={index}>
                      {person.nama ||
                        `Anggota ${index + 1} (nama belum terbaca)`}
                    </option>
                  ))}
                </select>
              </Field>
              {selectedMember !== '' && (
                <fieldset className="ocr-field-choices stack-small">
                  <legend>Pilih nilai yang sudah Anda periksa</legend>
                  {Object.entries(fieldLabels).map(([key, text]) => {
                    const value = values[key]
                    const display =
                      key === 'jenis_kelamin'
                        ? { L: 'Laki-laki', P: 'Perempuan' }[value] ||
                          'Belum terbaca'
                        : value || 'Belum terbaca'
                    return (
                      <label className="check-field" key={key}>
                        <input
                          type="checkbox"
                          disabled={!value}
                          checked={chosenFields.includes(key)}
                          onChange={(e) =>
                            setChosenFields((previous) =>
                              e.target.checked
                                ? [...previous, key]
                                : previous.filter((field) => field !== key),
                            )
                          }
                        />
                        <span>
                          Gunakan {text}: {display}
                        </span>
                      </label>
                    )
                  })}
                </fieldset>
              )}
              <div>
                <Button
                  variant="secondary"
                  onClick={apply}
                  disabled={!chosenFields.length}
                >
                  Terapkan ke formulir
                </Button>
              </div>
            </>
          )}
          {notice && (
            <p className="note" role="status">
              {notice}
            </p>
          )}
          <div>
            <Button variant="ghost" onClick={clearReading}>
              Hapus hasil OCR
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
