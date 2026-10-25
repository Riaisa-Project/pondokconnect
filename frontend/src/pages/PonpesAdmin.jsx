import ProfileContent from '../components/ProfileContent'
import { documentStatuses, operationalStatuses } from '../components/Oversight'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Send, Save } from 'lucide-react'
import { useApi } from '../lib/hooks'
import { get, post, put } from '../lib/api'
import { date, formValues, selection } from '../lib/format'
import {
  Alert,
  Badge,
  Button,
  Empty,
  Field,
  Pagination,
  QueryState,
} from '../components/UI'
import {
  DownloadButton,
  ProfileFields,
  StatusEditor,
  usePaged,
} from '../components/AdminShared'

export function MyProfile() {
  const query = useApi('/admin/ponpes/my')
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false)
  const cache = useQueryClient()
  async function submit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    setSaved(false)
    try {
      const values = formValues(e.currentTarget)
      for (const key of [
        'nama_pengasuh',
        'tipe_pesantren',
        'kontak_sekretariat',
        'kuota_putra',
        'kuota_putri',
        'latitude',
        'longitude',
      ])
        if (values[key] === '') delete values[key]
      for (const key of ['kuota_putra', 'kuota_putri', 'latitude', 'longitude'])
        if (key in values) values[key] = Number(values[key])
      await put('/admin/ponpes/my', values)
      setSaved(true)
      cache.invalidateQueries()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <QueryState query={query}>
      {(data) => (
        <>
          <form onSubmit={submit} className="panel form-panel">
            <div className="section-heading">
              <h2>Profil pesantren</h2>
              <Badge>
                {documentStatuses[data.pengawasan?.status_dokumen] ||
                  documentStatuses.belum_dikonfirmasi}
              </Badge>
            </div>
            <p>
              NSPP{' '}
              <strong className="mono">
                {data.nspp || 'Belum dicantumkan'}
              </strong>{' '}
              · Catatan pemeriksaan dokumen dan operasional dikelola oleh
              Satgas.
            </p>
            <ProfileFields data={data} />
            <p className="note">
              {data.profil_referensi
                ? 'Isi hanya informasi yang sudah dikonfirmasi. Kolom kosong tetap belum diketahui. Sumber profil rujukan tetap tercatat saat layanan dibuka.'
                : 'Kapasitas adalah total kursi, bukan sisa kuota. Tidak dapat dikurangi di bawah jumlah pendaftaran aktif.'}
            </p>
            <Alert error={error} />
            {saved && (
              <Alert success>Profil pesantren berhasil disimpan.</Alert>
            )}
            <Button type="submit" busy={busy}>
              <Save size={16} />
              Simpan perubahan
            </Button>
          </form>
          <ServiceSettings data={data} />
          <ProfileContent data={data} />
        </>
      )}
    </QueryState>
  )
}
function ServiceSettings({ data }) {
  const [registration, setRegistration] = useState(data.pendaftaran_dibuka),
    [consultation, setConsultation] = useState(data.konsultasi_dibuka)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [saved, setSaved] = useState(false)
  const cache = useQueryClient()
  useEffect(() => {
    setRegistration(data.pendaftaran_dibuka)
    setConsultation(data.konsultasi_dibuka)
  }, [data.pendaftaran_dibuka, data.konsultasi_dibuka])
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await put('/admin/ponpes/my/layanan', {
        pendaftaran_dibuka: registration,
        konsultasi_dibuka: consultation,
      })
      setSaved(true)
      await cache.invalidateQueries()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="panel stack service-settings" onSubmit={submit}>
      <div>
        <span className="eyebrow">PENGATURAN LAYANAN</span>
        <h2>Pendaftaran & konsultasi</h2>
      </div>
      <p>
        Buka kedua layanan secara mandiri sesuai kesiapan pengurus. Pendaftaran
        juga mengikuti kuota yang tersedia.
      </p>
      <label className="service-switch">
        <input
          type="checkbox"
          role="switch"
          checked={!!registration}
          onChange={(e) => setRegistration(e.target.checked)}
        />
        <span>Buka pendaftaran santri</span>
      </label>
      <label className="service-switch">
        <input
          type="checkbox"
          role="switch"
          checked={!!consultation}
          onChange={(e) => setConsultation(e.target.checked)}
        />
        <span>Buka konsultasi warga</span>
      </label>
      <p className="note">
        Operasional:{' '}
        {operationalStatuses[data.pengawasan?.status_operasional] ||
          operationalStatuses.belum_dikonfirmasi}
        . Operasional yang terkonfirmasi tidak beroperasi menutup pengajuan
        baru. Riwayat pendaftaran dan percakapan tetap dapat dibuka.
      </p>
      <Alert error={error} />
      {saved && <Alert success>Pengaturan layanan tersimpan.</Alert>}
      <Button type="submit" busy={busy}>
        <Save size={16} />
        Simpan pengaturan layanan
      </Button>
    </form>
  )
}
export function Registrations() {
  const { query, ...paging } = usePaged('/admin/pendaftaran')
  return (
    <div className="panel">
      <h2>Pendaftaran masuk</h2>
      <p>Tinjau berkas santri dan perbarui hasil seleksi.</p>
      <QueryState query={query}>
        {(data) => (
          <>
            {!data.items.length && (
              <Empty title="Belum ada pendaftaran">
                Pendaftaran santri untuk pesantren Anda akan muncul di sini.
              </Empty>
            )}
            <div className="record-list">
              {data.items.map((row) => (
                <details className="record" key={row.id}>
                  <summary>
                    <div>
                      <strong>{row.nama_santri}</strong>
                      <small className="mono">{row.nomor_registrasi}</small>
                    </div>
                    <Badge value={row.status_seleksi} />
                  </summary>
                  <div className="record-body">
                    <dl className="info-grid">
                      <div>
                        <dt>NIK</dt>
                        <dd className="mono">{row.nik_santri}</dd>
                      </div>
                      <div>
                        <dt>Jenis kelamin</dt>
                        <dd>{row.jenis_kelamin === 'L' ? 'Putra' : 'Putri'}</dd>
                      </div>
                      <div>
                        <dt>Wali</dt>
                        <dd>
                          {row.nama_wali} · {row.no_hp_wali}
                        </dd>
                      </div>
                      <div>
                        <dt>Dikirim</dt>
                        <dd>{date(row.created_at)}</dd>
                      </div>
                    </dl>
                    {row.has_file_kk && (
                      <DownloadButton
                        path={`/admin/pendaftaran/${row.id}/berkas`}
                        filename={`kk-${row.id}`}
                      >
                        Unduh Kartu Keluarga
                      </DownloadButton>
                    )}
                    <StatusEditor
                      path={`/admin/pendaftaran/${row.id}/status`}
                      field="status_seleksi"
                      value={row.status_seleksi}
                      values={selection}
                    />
                  </div>
                </details>
              ))}
            </div>
            <Pagination
              {...paging}
              total={data.total}
              onChange={paging.setOffset}
            />
          </>
        )}
      </QueryState>
    </div>
  )
}
function Conversation({ session }) {
  const [messages, setMessages] = useState([]),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [text, setText] = useState('')
  const profile = useApi('/admin/ponpes/my')
  const cache = useQueryClient()
  useEffect(() => {
    if (!profile.data) return
    let cancelled = false,
      timer,
      cursor = 0
    setMessages([])
    setError(null)
    setText('')
    async function load() {
      try {
        const data = await get(
          `/chat/${profile.data.id}/${session.session_id}`,
          { after_id: cursor },
        )
        if (!cancelled) {
          setMessages((prev) =>
            [
              ...new Map(
                [...prev, ...data.items].map((m) => [m.id, m]),
              ).values(),
            ].sort((a, b) => a.id - b.id),
          )
          cursor = data.next_after_id
          setError(null)
          await put('/admin/chat/read', { session_id: session.session_id })
          cache.invalidateQueries({ queryKey: ['/admin/chat'] })
        }
        if (!cancelled)
          timer = setTimeout(load, data.items.length === 100 ? 1000 : 12000)
      } catch (e) {
        if (!cancelled) {
          setError(e)
          timer = setTimeout(load, 20000)
        }
      }
    }
    load()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [session.session_id, profile.data?.id])
  async function send(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const message = await post('/admin/chat/reply', {
        session_id: session.session_id,
        pesan: text,
      })
      setMessages((prev) => [
        ...new Map([...prev, message].map((m) => [m.id, m])).values(),
      ])
      setText('')
      cache.invalidateQueries({ queryKey: ['/admin/chat'] })
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="admin-conversation">
      <div className="conversation-heading">
        <strong>{session.nama_warga}</strong>
        <small>{session.kontak_warga}</small>
      </div>
      <div className="chat-messages" aria-live="polite">
        {messages.map((m) => (
          <div
            className={`bubble ${m.sender_role === 'admin_ponpes' ? 'bubble-own' : ''}`}
            key={m.id}
          >
            <small>
              {m.sender_role === 'admin_ponpes'
                ? 'Pengurus'
                : session.nama_warga}
            </small>
            <p>{m.pesan}</p>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="chat-compose">
        <Alert error={error} />
        <div className="chat-send">
          <input
            aria-label="Balasan konsultasi"
            required
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tulis balasan…"
          />
          <Button type="submit" busy={busy}>
            <Send size={17} />
            Kirim
          </Button>
        </div>
      </form>
    </div>
  )
}
export function Inbox() {
  const { query, ...paging } = usePaged('/admin/chat', {
    refetchInterval: 20000,
  })
  const [selected, setSelected] = useState(null)
  return (
    <div className="panel">
      <h2>Kotak masuk konsultasi</h2>
      <p>Jawab pertanyaan warga mengenai pesantren Anda.</p>
      <QueryState query={query}>
        {(data) => (
          <>
            {!data.items.length ? (
              <Empty title="Belum ada percakapan">
                Pesan warga akan muncul di sini.
              </Empty>
            ) : (
              <div className="inbox-layout">
                <div className="inbox-sessions">
                  {data.items.map((row) => (
                    <button
                      className={
                        selected?.session_id === row.session_id
                          ? 'selected'
                          : ''
                      }
                      key={row.session_id}
                      onClick={() => setSelected(row)}
                    >
                      <strong>
                        {row.nama_warga}
                        {row.unread_count > 0 && (
                          <span className="unread-count">
                            {row.unread_count}
                          </span>
                        )}
                      </strong>
                      <span>{row.last_message.pesan}</span>
                    </button>
                  ))}
                </div>
                {selected ? (
                  <Conversation key={selected.session_id} session={selected} />
                ) : (
                  <Empty title="Pilih percakapan">
                    Klik nama warga untuk melihat dan membalas pesan.
                  </Empty>
                )}
              </div>
            )}
            <Pagination
              {...paging}
              total={data.total}
              onChange={paging.setOffset}
            />
          </>
        )}
      </QueryState>
    </div>
  )
}
