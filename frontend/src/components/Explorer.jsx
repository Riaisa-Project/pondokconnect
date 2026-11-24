import { lazy, Suspense } from 'react'

const KecamatanMap = lazy(() => import('./KecamatanMap'))

// Peta sebaran pesantren per kecamatan, memakai data nyata dari /stats
// (jumlah_ponpes per kecamatan) — bukan ilustrasi.
// Penjelajah kampus 3D dihapus: isinya bangunan generik tanpa data, jadi
// menyesatkan kalau dipakai untuk mempresentasikan ponpes tertentu.
// Kalau nanti perlu visual kampus lagi, buat scene baru sebagai komponen
// terpisah lalu lazy() di sini — jangan hidupkan kembali yang lama.
export default function Explorer({ districts = [] }) {
  return (
    <div className="explorer-stage" data-mode="region">
      <div className="explorer-top">
        <span>
          <span className="live-dot" /> SEBARAN PESANTREN DI LAMONGAN
        </span>
        <span className="explorer-tech is-live">PETA AKTIF</span>
      </div>
      <Suspense
        fallback={<div className="scene-loading">Memuat peta sebaran...</div>}
      >
        <KecamatanMap districts={districts} />
      </Suspense>
    </div>
  )
}