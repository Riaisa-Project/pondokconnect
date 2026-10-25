import { BookOpen, GraduationCap, Library, Check } from 'lucide-react'
export default function PublicProfileContent({ data, offeringsOnly = false }) {
  return (
    <>
      {!offeringsOnly && (
        <section className="panel profile-story" id="tentang">
          <span className="eyebrow">CERITA & LINGKUNGAN BELAJAR</span>
          <h2>
            Ilmu yang membentuk.
            <br />
            <em>Lingkungan yang mendukung.</em>
          </h2>
          <p className="profile-description">
            {data.deskripsi ||
              'Pengurus belum melengkapi pengantar pesantren. Gunakan konsultasi untuk menanyakan program pendidikan dan kehidupan santri.'}
          </p>
        </section>
      )}
      <section className="panel" id="program">
        <span className="eyebrow">
          {data.profil_referensi
            ? 'INFORMASI DARI PENGURUS'
            : 'PENDIDIKAN & KEHIDUPAN SANTRI'}
        </span>
        <h2>Kenali lebih dekat</h2>
        <div className="profile-offerings">
          <div>
            <h3>
              <GraduationCap size={23} />
              Program unggulan
            </h3>
            {data.program_unggulan?.length ? (
              <ul>
                {data.program_unggulan.map((item, i) => (
                  <li key={i}>
                    <BookOpen size={17} />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Program belum diisi pengurus.</p>
            )}
          </div>
          <div>
            <h3>
              <Library size={23} />
              Fasilitas
            </h3>
            {data.fasilitas?.length ? (
              <ul>
                {data.fasilitas.map((item, i) => (
                  <li key={i}>
                    <Check size={17} />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Fasilitas belum diisi pengurus.</p>
            )}
          </div>
        </div>
        {data.demo && (
          <p className="note">
            Program dan fasilitas pada profil demo adalah contoh. Konfirmasikan
            informasi resmi kepada pengurus.
          </p>
        )}
      </section>
    </>
  )
}
