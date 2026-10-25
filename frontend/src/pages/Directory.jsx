import { lazy, Suspense, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  LayoutGrid,
  Map,
  Search,
  SlidersHorizontal,
  Bookmark,
} from 'lucide-react'
import { useApi, useDebounce, useFeatures } from '../lib/hooks'
import { useDiscovery } from '../lib/discovery.jsx'
import { types } from '../lib/format'
import {
  Button,
  Empty,
  Loading,
  PageHeading,
  Pagination,
  QueryState,
  SelectOptions,
} from '../components/UI'
import PonpesCard from '../components/PonpesCard'
const PonpesMap = lazy(() => import('../components/PonpesMap'))
export default function Directory() {
  const features = useFeatures()
  const [params, setParams] = useSearchParams(),
    [map, setMap] = useState(false),
    { saved } = useDiscovery()
  const q = useDebounce(params.get('q') || ''),
    offset = Math.max(0, Number(params.get('offset')) || 0),
    district = params.get('kecamatan_id') || '',
    type = params.get('tipe') || '',
    onlySaved = params.get('tersimpan') === '1'
  const sort = ['nama', 'kuota', 'terbaru'].includes(params.get('sort'))
    ? params.get('sort')
    : 'nama'
  const districts = useApi('/kecamatan/')
  const query = useApi('/ponpes/', {
    q,
    kecamatan_id: district || undefined,
    tipe: type || undefined,
    sort,
    layanan: params.get('layanan') === 'aktif' ? 'aktif' : undefined,
    slugs: onlySaved ? saved.join(',') : undefined,
    limit: 9,
    offset,
  })
  const change = (key, value) => {
    const next = new URLSearchParams(params)
    value ? next.set(key, value) : next.delete(key)
    next.delete('offset')
    setParams(next, { replace: true })
  }
  return (
    <div className="container section directory-page">
      <PageHeading
        eyebrow="DIREKTORI PESANTREN"
        title="Pilihan yang baik dimulai dari mengenal."
      >
        Temukan pesantren, kenali lingkungannya, dan bandingkan pilihan sebelum
        memulai perjalanan.
      </PageHeading>
      <div className="directory-tools">
        <div className="directory-tabs">
          <button
            className={!onlySaved ? 'active' : ''}
            onClick={() => change('tersimpan', '')}
          >
            Semua pesantren
          </button>
          <button
            className={onlySaved ? 'active' : ''}
            onClick={() => change('tersimpan', '1')}
          >
            <Bookmark size={16} />
            Tersimpan <span>{saved.length}</span>
          </button>
        </div>
        <label className="sort-control service-filter">
          Layanan
          <select
            aria-label="Filter layanan"
            value={params.get('layanan') || ''}
            onChange={(e) => change('layanan', e.target.value)}
          >
            <option value="">Semua profil</option>
            <option value="aktif">Layanan portal aktif</option>
          </select>
        </label>
        <label className="sort-control">
          Urutkan
          <select
            aria-label="Urutkan pesantren"
            value={sort}
            onChange={(e) => change('sort', e.target.value)}
          >
            <option value="nama">Nama A–Z</option>
            <option value="kuota">Kuota terbanyak</option>
            <option value="terbaru">Terbaru terdaftar</option>
          </select>
        </label>
      </div>
      <div className="filter-bar">
        <div className="search-input">
          <Search size={19} />
          <input
            aria-label="Cari pesantren"
            placeholder="Cari nama pesantren…"
            value={params.get('q') || ''}
            onChange={(e) => change('q', e.target.value)}
            maxLength={150}
          />
        </div>
        <select
          aria-label="Filter kecamatan"
          value={district}
          onChange={(e) => change('kecamatan_id', e.target.value)}
        >
          <option value="">Semua kecamatan</option>
          {districts.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nama_kecamatan}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter tipe pesantren"
          value={type}
          onChange={(e) => change('tipe', e.target.value)}
        >
          <option value="">Semua tipe</option>
          <SelectOptions values={types} />
        </select>
        <div className="view-switch">
          <button
            className={!map ? 'active' : ''}
            onClick={() => setMap(false)}
            aria-label="Tampilan kartu"
            aria-pressed={!map}
          >
            <LayoutGrid size={19} />
          </button>
          <button
            className={map ? 'active' : ''}
            onClick={() => setMap(true)}
            aria-label="Tampilan peta"
            aria-pressed={map}
          >
            <Map size={19} />
          </button>
        </div>
      </div>
      <div className="results-label">
        <span>
          <SlidersHorizontal size={15} />
          {query.data
            ? `${query.data.total} pesantren ditemukan`
            : 'Mencari pesantren…'}
        </span>
        {params.size > 0 && (
          <button className="text-link" onClick={() => setParams({})}>
            Hapus filter
          </button>
        )}
      </div>
      {districts.error && (
        <div className="note">
          Pilihan kecamatan belum dapat dimuat.{' '}
          <button className="text-link" onClick={() => districts.refetch()}>
            Coba lagi
          </button>
        </div>
      )}
      <QueryState query={query}>
        {(data) => (
          <>
            {!data.items.length ? (
              <Empty
                title={
                  onlySaved && !saved.length
                    ? 'Belum ada pesantren tersimpan'
                    : 'Pesantren belum ditemukan'
                }
              >
                {onlySaved
                  ? 'Gunakan tombol Simpan pada kartu pesantren. Gunakan pencarian untuk memeriksa profil yang tersimpan.'
                  : 'Coba nama lain atau pilih kecamatan yang berbeda.'}
              </Empty>
            ) : map ? (
              <Suspense fallback={<Loading />}>
                <PonpesMap items={data.items} />
              </Suspense>
            ) : (
              <div className="ponpes-grid">
                {data.items.map((p) => (
                  <PonpesCard
                    key={p.id}
                    ponpes={p}
                    district={
                      districts.data?.find((d) => d.id === p.kecamatan_id)
                        ?.nama_kecamatan
                    }
                  />
                ))}
              </div>
            )}
            <Pagination
              total={data.total}
              offset={offset}
              limit={9}
              onChange={(value) => {
                const next = new URLSearchParams(params)
                next.set('offset', value)
                setParams(next)
              }}
            />
          </>
        )}
      </QueryState>
      <p className="directory-note note">
        Profil bersumber mencantumkan rujukan nama dan alamat. Cek status
        dokumen dan operasional melalui catatan pengawasan. Layanan portal
        mengikuti pengaturan pengurus.{' '}
        {features.data?.demo && 'Profil layanan demo tetap diberi label demo. '}
        Simpanan berada pada browser ini.
      </p>
    </div>
  )
}
