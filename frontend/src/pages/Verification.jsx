import { useParams } from 'react-router-dom'
import { useApi } from '../lib/hooks'
import { LinkButton, PageHeading, QueryState } from '../components/UI'
import { OversightRecord } from '../components/Oversight'

export default function Verification() {
  const { slug, nspp } = useParams()
  const query = useApi(
    slug
      ? `/ponpes/status/${encodeURIComponent(slug)}`
      : `/ponpes/verifikasi-ijop/${encodeURIComponent(nspp)}`,
  )
  return (
    <div className="container section narrow">
      <PageHeading
        eyebrow="PENGAWASAN PESANTREN"
        title="Periksa status dan sumbernya."
      >
        Telusuri dokumen dan kondisi operasional berdasarkan pemeriksaan yang
        tercatat.
      </PageHeading>
      {!slug && (
        <p className="note">
          Tautan verifikasi lama kini menampilkan catatan pengawasan. Aplikasi
          tidak menerbitkan atau mengesahkan izin.
        </p>
      )}
      <QueryState query={query}>
        {(data) => (
          <>
            <div className="section-heading">
              <div>
                <h2>{data.nama_ponpes}</h2>
                <p>{data.alamat_lengkap}</p>
              </div>
            </div>
            <OversightRecord data={data} />
            <LinkButton to={`/pesantren/${data.slug}`} variant="secondary">
              Lihat profil pesantren
            </LinkButton>
          </>
        )}
      </QueryState>
    </div>
  )
}
