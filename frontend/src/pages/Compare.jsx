import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router-dom'
import { Copy, Check, X, GitCompareArrows } from 'lucide-react'
import { get } from '../lib/api'
import { hasRegistrationSeats } from '../lib/services'
import { useFeatures } from '../lib/hooks'
import { parseSaved } from '../lib/discovery'
import { useDiscovery } from '../lib/discovery.jsx'
import { types } from '../lib/format'
import { documentStatuses, operationalStatuses } from '../components/Oversight'
import {
  PageHeading,
  Button,
  Alert,
  Badge,
  Loading,
  Empty,
  LinkButton,
} from '../components/UI'
export default function Compare() {
  const features = useFeatures()
  const [params, setParams] = useSearchParams(),
    { compare, toggleCompare } = useDiscovery()
  const raw = params.has('pilihan') ? params.get('pilihan') : compare.join(',')
  const slugs = parseSaved(JSON.stringify(raw.split(',')), 3)
  const queries = useQueries({
    queries: slugs.map((slug) => ({
      queryKey: [`/ponpes/${slug}`, null],
      queryFn: () => get(`/ponpes/${slug}`),
      retry: false,
    })),
  })
  const [copied, setCopied] = useState(false),
    [error, setError] = useState(null)
  async function share() {
    try {
      const url = new URL('/bandingkan', location.origin)
      url.searchParams.set('pilihan', slugs.join(','))
      await navigator.clipboard.writeText(url.href)
      setCopied(true)
    } catch {
      setError('Tautan dapat disalin dari kolom alamat browser.')
    }
  }
  const rows = [
    ['Lokasi', (p) => p.alamat_lengkap],
    ['Tipe pesantren', (p) => types[p.tipe_pesantren] || 'Belum tersedia'],
    ['Program unggulan', (p) => <TagList items={p.program_unggulan} />],
    ['Fasilitas', (p) => <TagList items={p.fasilitas} />],
    [
      'Kuota putra',
      (p) =>
        !p.pendaftaran_dibuka
          ? 'Belum tersedia'
          : `${p.sisa_kuota_putra} tersedia / ${p.kuota_putra}`,
    ],
    [
      'Kuota putri',
      (p) =>
        !p.pendaftaran_dibuka
          ? 'Belum tersedia'
          : `${p.sisa_kuota_putri} tersedia / ${p.kuota_putri}`,
    ],
    [
      'Status operasional',
      (p) =>
        operationalStatuses[p.pengawasan?.status_operasional] ||
        operationalStatuses.belum_dikonfirmasi,
    ],
    ['Sekretariat', (p) => p.kontak_sekretariat || 'Belum tersedia'],
  ]
  return (
    <div className="container section">
      <PageHeading
        back="/pesantren"
        eyebrow="PILIH DENGAN LEBIH YAKIN"
        title="Tiga pilihan. Satu masa depan."
      >
        Lihat informasi pesantren berdampingan, lalu temukan pilihan yang
        sesuai.
      </PageHeading>
      {!slugs.length ? (
        <Empty title="Belum ada pilihan">
          <p>Pilih tombol Bandingkan pada kartu pesantren.</p>
          <LinkButton to="/pesantren">Jelajahi pesantren</LinkButton>
        </Empty>
      ) : (
        <>
          <div className="compare-toolbar">
            <span>
              <GitCompareArrows size={17} />
              {slugs.length} dari 3 pilihan
            </span>
            <div className="button-row">
              <Button
                variant="ghost"
                busy={queries.some((q) => q.isFetching)}
                onClick={() => queries.forEach((q) => q.refetch())}
              >
                Perbarui data
              </Button>
              <Button variant="secondary" onClick={share}>
                {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
                {copied ? 'Tautan tersalin' : 'Salin tautan'}
              </Button>
            </div>
          </div>
          <Alert error={error} />
          <div className="comparison-scroll">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Yang perlu Anda kenali</th>
                  {queries.map((query, i) => (
                    <th key={slugs[i]}>
                      <button
                        className="icon-button remove-comparison"
                        aria-label={`Hapus pilihan ${i + 1}`}
                        onClick={() => {
                          const next = slugs.filter((_, index) => index !== i)
                          if (compare.includes(slugs[i]))
                            toggleCompare(slugs[i])
                          setParams({ pilihan: next.join(',') })
                        }}
                      >
                        <X size={16} />
                      </button>
                      {query.isPending ? (
                        <Loading />
                      ) : query.isError ? (
                        <div className="compare-unavailable">
                          <strong>Pesantren tidak tersedia</strong>
                          <p>Profil mungkin tidak lagi aktif.</p>
                          <small>{slugs[i]}</small>
                          <Button
                            variant="ghost"
                            onClick={() => query.refetch()}
                          >
                            Coba lagi
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="eyebrow">PILIHAN 0{i + 1}</span>
                          <h2>{query.data.nama_ponpes}</h2>
                          {query.data.profil_referensi && (
                            <Badge>
                              {query.data.referensi
                                ? 'Profil bersumber'
                                : 'Profil rujukan'}
                            </Badge>
                          )}
                          <Badge>
                            {documentStatuses[
                              query.data.pengawasan?.status_dokumen
                            ] || documentStatuses.belum_dikonfirmasi}
                          </Badge>
                          <Link
                            to={`/pesantren/${query.data.slug}`}
                            className="text-link"
                          >
                            Lihat profil ↗
                          </Link>
                        </>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([title, render]) => (
                  <tr key={title}>
                    <th scope="row">{title}</th>
                    {queries.map((q, i) => (
                      <td key={slugs[i]}>
                        {q.isSuccess && q.data ? render(q.data) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row">Langkah selanjutnya</th>
                  {queries.map((q, i) => (
                    <td key={slugs[i]}>
                      {q.isSuccess &&
                        q.data &&
                        (!hasRegistrationSeats(q.data) ? (
                          <LinkButton to={`/pesantren/${q.data.slug}`}>
                            Lihat sumber & alamat
                          </LinkButton>
                        ) : (
                          <LinkButton to={`/daftar?ponpes=${q.data.id}`}>
                            Daftar santri
                          </LinkButton>
                        ))}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="note">
            Profil bersumber mencantumkan rujukan lembaga atau pemerintah.
            Informasi yang belum dikonfirmasi ditandai belum tersedia.{' '}
            {features.data?.demo &&
              'Profil layanan demo tetap diberi label demo.'}
          </p>
        </>
      )}
    </div>
  )
}
function TagList({ items }) {
  return items?.length ? (
    <div className="tag-list">
      {items.map((item, i) => (
        <span key={`${item}-${i}`}>{item}</span>
      ))}
    </div>
  ) : (
    'Belum diisi pengurus'
  )
}
