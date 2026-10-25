import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, Save, ShieldCheck, Search } from 'lucide-react'
import { useApi, useDebounce } from '../lib/hooks'
import { post, put } from '../lib/api'
import { actions, date, formValues, label, localToday } from '../lib/format'
import {
  Alert,
  Badge,
  Button,
  CopyCode,
  Empty,
  Field,
  Modal,
  Pagination,
  QueryState,
  SelectOptions,
} from '../components/UI'
import {
  DownloadButton,
  ProfileFields,
  StatusEditor,
  usePaged,
} from '../components/AdminShared'
import { documentStatuses, operationalStatuses } from '../components/Oversight'
import { usePonpesOptions } from '../components/PonpesSelect'
function Credentials({ data, onClose }) {
  return (
    <Modal title="Kredensial admin pesantren" onClose={onClose}>
      <div className="stack">
        <Alert success>
          Akun siap digunakan. Admin wajib mengganti password saat pertama kali
          masuk.
        </Alert>
        <Field label="Email admin">
          <input readOnly value={data.email_admin} />
        </Field>
        <CopyCode
          value={data.temporary_password}
          caption="Password sementara — simpan sebelum menutup"
        />
        <p className="note">
          Serahkan secara pribadi kepada pengurus yang berwenang. Password ini
          tidak ditampilkan lagi setelah jendela ditutup.
        </p>
        <Button onClick={onClose}>Selesai</Button>
      </div>
    </Modal>
  )
}
export function CreatePonpes() {
  const districts = useApi('/kecamatan/')
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [credentials, setCredentials] = useState(null)
  const cache = useQueryClient()
  async function submit(e) {
    e.preventDefault()
    const form = e.currentTarget
    setBusy(true)
    setError(null)
    try {
      const data = formValues(form, [
        'kecamatan_id',
        'kuota_putra',
        'kuota_putri',
        'latitude',
        'longitude',
      ])
      for (const key of [
        'nspp',
        'nama_pengasuh',
        'tipe_pesantren',
        'kontak_sekretariat',
        'latitude',
        'longitude',
      ]) {
        if (new FormData(form).get(key) === '') data[key] = null
      }
      setCredentials(await post('/admin/kemenag/ponpes', data))
      form.reset()
      cache.invalidateQueries()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <form className="panel form-panel" onSubmit={submit}>
        <h2>Catat profil pesantren baru</h2>
        <p>
          Profil dan akun admin dibuat bersama. Isi hanya fakta yang diketahui.
          Layanan pendaftaran dan konsultasi dimulai dalam keadaan tertutup;
          pengurus mengaturnya secara mandiri.
        </p>
        <QueryState query={districts}>
          {(data) => <ProfileFields create districts={data} />}
        </QueryState>
        <div className="form-section-title">
          <KeyRound size={19} />
          <h3>Perwakilan pesantren</h3>
        </div>
        <div className="form-grid">
          <Field label="Nama admin">
            <input name="nama_admin" required maxLength={100} />
          </Field>
          <Field label="Email admin">
            <input name="email_admin" type="email" required maxLength={100} />
          </Field>
          <Field label="Nomor HP admin">
            <input name="no_hp_admin" type="tel" required maxLength={20} />
          </Field>
        </div>
        <Alert error={error} />
        <Button type="submit" busy={busy} disabled={!districts.data}>
          <Plus size={17} />
          Buat pesantren & akun
        </Button>
      </form>
      {credentials && (
        <Credentials data={credentials} onClose={() => setCredentials(null)} />
      )}
    </>
  )
}
const oversightFields = [
  'nomor_statistik',
  'nomor_dokumen',
  'penerbit_dokumen',
  'tanggal_dokumen',
  'sumber_dokumen',
  'tanggal_pemeriksaan_dokumen',
  'catatan_dokumen',
  'sumber_operasional',
  'tanggal_pemeriksaan_operasional',
  'catatan_operasional',
]
function OversightEditor({ item, onClose }) {
  const [values, setValues] = useState(() => ({
    ...Object.fromEntries(
      oversightFields.map((key) => [key, item.pengawasan?.[key] || '']),
    ),
    status_dokumen: item.pengawasan?.status_dokumen || 'belum_dikonfirmasi',
    status_operasional:
      item.pengawasan?.status_operasional || 'belum_dikonfirmasi',
  }))
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false)
  const cache = useQueryClient()
  const confirmedDocument = values.status_dokumen === 'terdaftar',
    confirmedOperation = values.status_operasional !== 'belum_dikonfirmasi'
  function field(name, text, required = false, type = 'text', extra = {}) {
    const props = {
      name,
      value: values[name],
      required,
      onChange: (e) => setValues((old) => ({ ...old, [name]: e.target.value })),
      ...extra,
    }
    return (
      <Field label={text} key={name}>
        {type === 'textarea' ? (
          <textarea {...props} rows={3} maxLength={2000} />
        ) : (
          <input
            {...props}
            type={type}
            maxLength={props.maxLength ?? (type === 'text' ? 1000 : undefined)}
          />
        )}
      </Field>
    )
  }
  async function submit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const data = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          key,
          value.trim() || null,
        ]),
      )
      await put(`/admin/kemenag/ponpes/${item.id}/pengawasan`, data)
      await cache.invalidateQueries()
      onClose()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title="Perbarui catatan pengawasan" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p>
          <strong>{item.nama_ponpes}</strong>
        </p>
        <p className="note">
          Catat hasil pemeriksaan beserta sumbernya. Semua catatan di formulir
          ini tampil publik. Pembaruan mengganti kedua kelompok data; kosongkan
          hanya fakta yang belum diketahui.
        </p>
        <h3>Dokumen / pendaftaran lembaga</h3>
        <Field label="Status dokumen">
          <select
            value={values.status_dokumen}
            onChange={(e) =>
              setValues((old) => ({ ...old, status_dokumen: e.target.value }))
            }
          >
            <SelectOptions values={documentStatuses} />
          </select>
        </Field>
        <div className="form-grid">
          {field(
            'nomor_statistik',
            'Nomor statistik pada dokumen',
            confirmedDocument,
            'text',
            { maxLength: 50 },
          )}
          {field('nomor_dokumen', 'Nomor dokumen', confirmedDocument, 'text', {
            maxLength: 150,
          })}
          {field(
            'penerbit_dokumen',
            'Penerbit dokumen',
            confirmedDocument,
            'text',
            { maxLength: 200 },
          )}
          {field(
            'tanggal_dokumen',
            'Tanggal dokumen',
            confirmedDocument,
            'date',
            { max: values.tanggal_pemeriksaan_dokumen || localToday() },
          )}
        </div>
        {field(
          'sumber_dokumen',
          'Sumber dokumen',
          confirmedDocument ||
            !!values.tanggal_pemeriksaan_dokumen ||
            !!values.tanggal_dokumen,
          'text',
        )}
        <p className="note">
          Gunakan URL http(s) atau referensi dokumen tertulis yang dapat
          ditelusuri.
        </p>
        {field(
          'tanggal_pemeriksaan_dokumen',
          'Tanggal pemeriksaan dokumen',
          confirmedDocument ||
            !!values.sumber_dokumen.trim() ||
            !!values.tanggal_dokumen,
          'date',
          { max: localToday(), min: values.tanggal_dokumen || undefined },
        )}
        {field(
          'catatan_dokumen',
          'Catatan dokumen (publik)',
          false,
          'textarea',
        )}
        <h3>Kondisi operasional</h3>
        <Field label="Status operasional">
          <select
            value={values.status_operasional}
            onChange={(e) =>
              setValues((old) => ({
                ...old,
                status_operasional: e.target.value,
              }))
            }
          >
            <SelectOptions values={operationalStatuses} />
          </select>
        </Field>
        {field(
          'sumber_operasional',
          'Sumber pemeriksaan operasional',
          confirmedOperation || !!values.tanggal_pemeriksaan_operasional,
        )}
        {field(
          'tanggal_pemeriksaan_operasional',
          'Tanggal pemeriksaan operasional',
          confirmedOperation || !!values.sumber_operasional.trim(),
          'date',
          { max: localToday() },
        )}
        {field(
          'catatan_operasional',
          'Catatan operasional (publik)',
          confirmedOperation,
          'textarea',
        )}
        <Alert error={error} />
        <Button type="submit" busy={busy}>
          <Save size={17} />
          Simpan pengawasan
        </Button>
      </form>
    </Modal>
  )
}
export function KemenagPonpes() {
  const [search, setSearch] = useState(''),
    [offset, setOffset] = useState(0)
  const q = useDebounce(search),
    paging = { offset, limit: 20 }
  const query = useApi('/admin/kemenag/ponpes', {
    ...paging,
    q: q || undefined,
  })
  const [oversight, setOversight] = useState(null),
    [reset, setReset] = useState(null),
    [credentials, setCredentials] = useState(null)
  return (
    <div className="panel">
      <h2>Profil & pengawasan pesantren</h2>
      <p>
        Catat pemeriksaan dokumen dan kondisi operasional. Akses pengurus
        dikelola terpisah dari layanan pesantren.
      </p>
      <div className="search-input">
        <Search size={19} />
        <input
          aria-label="Cari pesantren terdaftar"
          placeholder="Cari nama, NSPP, atau slug pesantren…"
          maxLength={150}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOffset(0)
          }}
        />
      </div>
      <QueryState query={query}>
        {(data) => (
          <>
            {!data.items.length && (
              <Empty title="Pesantren belum ditemukan">
                Coba nama, nomor statistik, atau slug lain.
              </Empty>
            )}
            <div className="record-list">
              {data.items.map((item) => (
                <div className="management-record" key={item.id}>
                  <div>
                    <strong>{item.nama_ponpes}</strong>
                    <small className="mono">
                      NSPP {item.nspp || 'Belum dicantumkan'}
                    </small>
                    <Badge>
                      {documentStatuses[item.pengawasan?.status_dokumen] ||
                        documentStatuses.belum_dikonfirmasi}
                    </Badge>
                    <small>
                      Operasional:{' '}
                      {operationalStatuses[
                        item.pengawasan?.status_operasional
                      ] || operationalStatuses.belum_dikonfirmasi}
                    </small>
                  </div>
                  <div className="button-row">
                    <Button
                      variant="secondary"
                      onClick={() => setOversight(item)}
                    >
                      <ShieldCheck size={15} />
                      Catat pengawasan
                    </Button>
                    <Button variant="ghost" onClick={() => setReset(item)}>
                      <KeyRound size={15} />
                      Reset akun
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Pagination {...paging} total={data.total} onChange={setOffset} />
          </>
        )}
      </QueryState>
      {oversight && (
        <OversightEditor item={oversight} onClose={() => setOversight(null)} />
      )}
      {reset && (
        <ResetEditor
          item={reset}
          onClose={() => setReset(null)}
          onReset={(data) => {
            setReset(null)
            setCredentials(data)
          }}
        />
      )}
      {credentials && (
        <Credentials data={credentials} onClose={() => setCredentials(null)} />
      )}
    </div>
  )
}
function CaseDetail({ id }) {
  const query = useApi(`/admin/pengaduan/${id}`)
  return (
    <QueryState query={query}>
      {(row) => (
        <div className="record-body">
          <dl className="info-grid">
            <div>
              <dt>Pesantren</dt>
              <dd>{row.nama_ponpes || `ID ${row.ponpes_id}`}</dd>
            </div>
            <div>
              <dt>Tanggal & lokasi kejadian</dt>
              <dd>
                {date(row.tanggal_kejadian)} · {row.lokasi_kejadian}
              </dd>
            </div>
            <div>
              <dt>Pelapor</dt>
              <dd>
                {row.mode_pelapor === 'rahasia'
                  ? 'Rahasia / anonim'
                  : row.nama_pelapor}
              </dd>
            </div>
            <div>
              <dt>Kontak</dt>
              <dd>{row.kontak_pelapor || 'Tidak disimpan'}</dd>
            </div>
          </dl>
          <div className="case-description">{row.deskripsi_peristiwa}</div>
          {row.has_bukti_lampiran && (
            <DownloadButton
              path={`/admin/pengaduan/${row.id}/bukti`}
              filename={`bukti-${row.id}`}
            >
              Unduh bukti
            </DownloadButton>
          )}
          <StatusEditor
            key={row.status_tindakan + ':' + (row.riwayat?.length || 0)}
            path={`/admin/pengaduan/${row.id}/status`}
            field="status_tindakan"
            value={row.status_tindakan}
            values={actions}
            internalNotes
          />
          <section className="case-history">
            <h3>Riwayat tindak lanjut</h3>
            <p className="note">
              Catatan internal hanya tersedia untuk Satgas.
            </p>
            {row.riwayat?.length ? (
              <ol>
                {row.riwayat.map((entry) => (
                  <li key={entry.id}>
                    <strong>
                      {label(entry.status_sebelum)} →{' '}
                      {label(entry.status_sesudah)}
                    </strong>
                    <small>{date(entry.created_at)}</small>
                    {entry.catatan_internal && (
                      <p className="case-description">
                        {entry.catatan_internal}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p>Belum ada perubahan status.</p>
            )}
          </section>
        </div>
      )}
    </QueryState>
  )
}
function CaseRow({ row }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="record" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <div>
          <strong>{label(row.kategori_kasus)}</strong>
          <small>
            {row.nama_ponpes || `Pesantren #${row.ponpes_id}`} · Kasus #{row.id}{' '}
            · {date(row.created_at)}
          </small>
        </div>
        <Badge value={row.status_tindakan} />
      </summary>
      {open && <CaseDetail id={row.id} />}
    </details>
  )
}
export function Cases() {
  const [status, setStatus] = useState(''),
    [ponpes, setPonpes] = useState(''),
    [search, setSearch] = useState(''),
    [offset, setOffset] = useState(0)
  const q = useDebounce(search),
    profiles = usePonpesOptions({ serviceOnly: false })
  const query = useApi('/admin/pengaduan', {
    offset,
    limit: 20,
    status: status || undefined,
    ponpes_id: ponpes || undefined,
    q: q || undefined,
  })
  return (
    <div className="panel">
      <h2>Pengaduan perlindungan santri</h2>
      <p>
        Informasi terbatas untuk Satgas. Jangan membagikan tiket, identitas, isi
        laporan, lampiran, atau catatan internal.
      </p>
      <div className="form-grid">
        <Field label="Cari nama pesantren">
          <input
            value={search}
            maxLength={150}
            onChange={(e) => {
              setSearch(e.target.value)
              setOffset(0)
            }}
            placeholder="Nama pesantren…"
          />
        </Field>
        <Field label="Filter status pengaduan">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setOffset(0)
            }}
          >
            <option value="">Semua status</option>
            <SelectOptions values={actions} />
          </select>
        </Field>
        <Field label="Filter pesantren">
          <select
            value={ponpes}
            onChange={(e) => {
              setPonpes(e.target.value)
              setOffset(0)
            }}
          >
            <option value="">Semua pesantren</option>
            {profiles.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nama_ponpes}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <QueryState query={query}>
        {(data) => (
          <>
            {!data.items.length && (
              <Empty title="Belum ada pengaduan yang cocok">
                Sesuaikan filter untuk meninjau laporan lainnya.
              </Empty>
            )}
            <div className="record-list">
              {data.items.map((row) => (
                <CaseRow key={row.id} row={row} />
              ))}
            </div>
            <Pagination
              offset={offset}
              limit={20}
              total={data.total}
              onChange={setOffset}
            />
          </>
        )}
      </QueryState>
    </div>
  )
}
function ResetEditor({ item, onClose, onReset }) {
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onReset(
        await post(
          `/admin/kemenag/reset-password-ponpes/${item.id}`,
          formValues(e.currentTarget),
        ),
      )
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title="Reset password admin" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <p>
          Password admin <strong>{item.nama_ponpes}</strong> akan diganti. Semua
          sesi login sebelumnya akan berakhir.
        </p>
        <Field label="Alasan reset">
          <textarea
            name="alasan"
            required
            minLength={5}
            maxLength={500}
            rows={3}
          />
        </Field>
        <Alert error={error} />
        <Button type="submit" busy={busy}>
          <KeyRound size={16} />
          Buat password sementara
        </Button>
      </form>
    </Modal>
  )
}
export function AuditLogs() {
  const { query, ...paging } = usePaged('/admin/audit-logs')
  return (
    <div className="panel">
      <h2>Jejak aktivitas</h2>
      <p>Catatan perubahan penting dalam pengelolaan layanan.</p>
      <QueryState query={query}>
        {(data) => (
          <>
            {!data.items.length ? (
              <Empty title="Belum ada aktivitas tercatat" />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Pengguna</th>
                      <th>Aktivitas</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) => (
                      <tr key={row.id}>
                        <td>{date(row.created_at)}</td>
                        <td>#{row.user_id || '—'}</td>
                        <td>{label(row.aksi)}</td>
                        <td>
                          <code>{row.detail}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
