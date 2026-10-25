import Dashboard from './Dashboard'
import { LayoutDashboard } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Building2,
  ClipboardList,
  FilePlus2,
  History,
  KeyRound,
  LogOut,
  MessageSquare,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useFeatures } from '../lib/hooks'
import { MyProfile, Registrations, Inbox } from './PonpesAdmin'
import { AuditLogs, Cases, CreatePonpes, KemenagPonpes } from './KemenagAdmin'

export default function Admin() {
  const { user, logout } = useAuth()
  const features = useFeatures()
  const [params, setParams] = useSearchParams()
  const satgas = user.role === 'satgas_kemenag'
  const tabs = satgas
    ? [
        ['ringkasan', 'Ringkasan layanan', LayoutDashboard, Dashboard],
        ['pesantren', 'Daftar pesantren', Building2, KemenagPonpes],
        ['tambah', 'Tambah pesantren', FilePlus2, CreatePonpes],
        ['pengaduan', 'Pengaduan santri', ShieldCheck, Cases],
        ['audit', 'Jejak aktivitas', History, AuditLogs],
      ]
    : [
        ['ringkasan', 'Ringkasan layanan', LayoutDashboard, Dashboard],
        ['profil', 'Profil & kuota', Building2, MyProfile],
        ['pendaftaran', 'Seleksi santri', ClipboardList, Registrations],
        ['chat', 'Konsultasi warga', MessageSquare, Inbox],
      ]
  const current = tabs.find((tab) => tab[0] === params.get('tab')) || tabs[0]
  const View = current[3]
  return (
    <div className="admin-shell container section">
      <aside className="admin-sidebar">
        <span className="eyebrow">RUANG PENGELOLA</span>
        <div className="admin-identity">
          <div>
            <UserRound size={23} />
          </div>
          <strong>{user.nama_lengkap}</strong>
          <small>{satgas ? 'Satgas Kemenag' : 'Admin pesantren'}</small>
        </div>
        <nav aria-label="Menu pengelola">
          {tabs.map(([key, text, Icon]) => (
            <button
              key={key}
              className={current[0] === key ? 'active' : ''}
              onClick={() => setParams({ tab: key })}
            >
              <Icon size={18} />
              {text}
            </button>
          ))}
          <Link to="/ganti-password">
            <KeyRound size={18} />
            Ganti password
          </Link>
          <button onClick={logout}>
            <LogOut size={18} />
            Keluar
          </button>
        </nav>
      </aside>
      <div className="admin-content">
        <div className="admin-heading">
          <div>
            <span className="eyebrow">PONDOK CONNECT / DASHBOARD</span>
            <h1>{current[1]}</h1>
          </div>
          <span className="badge badge-gold">
            {features.data?.demo ? 'Lingkungan demo' : 'Akses pengelola'}
          </span>
        </div>
        <View key={current[0]} />
      </div>
    </div>
  )
}
