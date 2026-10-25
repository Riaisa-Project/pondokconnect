import {
  ArrowUpRight,
  BookOpen,
  GraduationCap,
  History,
  Library,
  Globe,
  ExternalLink,
} from 'lucide-react'
import { date } from '../lib/format'
import { Badge } from './UI'

const sections = [
  ['Sekilas pesantren', BookOpen],
  ['Sejarah & pendiri', History],
  ['Pendidikan', GraduationCap],
  ['Program santri', BookOpen],
  ['Fasilitas & kegiatan', Library],
]

export default function SourcedProfileContent({ data }) {
  const profile = data.profil_publik
  if (!profile)
    return (
      <section className="panel sourced-profile" id="profil-pesantren">
        <h2>Profil pesantren</h2>
        <p>Profil bersumber belum tersedia untuk data ini.</p>
      </section>
    )
  const available = profile.bagian.length > 0
  return (
    <section
      className="panel sourced-profile"
      id="profil-pesantren"
      aria-label="Profil pesantren dari sumber publik"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">MENGENAL LEBIH DEKAT</span>
          <h2>Profil pesantren</h2>
        </div>
        <Badge>{available ? 'Rujukan internet' : 'Belum terkonfirmasi'}</Badge>
      </div>
      <p className="sourced-profile-intro">
        Informasi lembaga dari penelusuran sumber publik. Diperiksa{' '}
        {date(profile.diperiksa_pada)}.
      </p>
      {profile.catatan && (
        <p className="sourced-profile-note">{profile.catatan}</p>
      )}
      <div className="sourced-profile-sections">
        {sections.map(([title, Icon]) => {
          const content = profile.bagian.find((item) => item.judul === title)
          return (
            <article
              key={title}
              className={content ? '' : 'sourced-unavailable'}
            >
              <h3>
                <Icon size={20} /> {title}
              </h3>
              {content ? (
                <>
                  {content.teks && <p>{content.teks}</p>}
                  {content.butir.length > 0 && (
                    <ul>
                      {content.butir.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                  <div className="sourced-section-citation">
                    <a
                      href={content.sumber_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Sumber {title} <ExternalLink size={12} />
                    </a>
                    {content.tahun_sumber && (
                      <span>Tahun rujukan {content.tahun_sumber}</span>
                    )}
                  </div>
                </>
              ) : (
                <p>Belum ditemukan informasi yang dapat dikonfirmasi.</p>
              )}
            </article>
          )
        })}
      </div>
      <div className="sourced-contact">
        <h3>
          <Globe size={20} /> Situs & kontak lembaga
        </h3>
        {profile.situs_resmi ? (
          <a
            className="location-directions"
            href={profile.situs_resmi}
            target="_blank"
            rel="noopener noreferrer"
          >
            Kunjungi situs resmi <ArrowUpRight size={16} />
          </a>
        ) : (
          <p>Situs resmi belum berhasil dikonfirmasi.</p>
        )}
        {profile.kontak.length ? (
          <dl>
            {profile.kontak.map((contact) => (
              <div key={`${contact.jenis}-${contact.nilai}`}>
                <dt>{contact.jenis}</dt>
                <dd>
                  <span>{contact.nilai}</span>
                  <a
                    href={contact.sumber_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Sumber ${contact.jenis} ${contact.nilai}`}
                  >
                    Sumber kontak <ExternalLink size={12} />
                  </a>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>Kontak resmi belum dicantumkan pada sumber yang dikonfirmasi.</p>
        )}
        <small>
          Informasi profil tidak menyatakan verifikasi izin, biaya, atau
          ketersediaan tempat. Konfirmasikan informasi terkini langsung kepada
          lembaga.
        </small>
      </div>
    </section>
  )
}
