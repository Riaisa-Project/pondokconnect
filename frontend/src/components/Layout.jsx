import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  ArrowUpRight,
  Building2,
  ChevronRight,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useFeatures } from '../lib/hooks'
import { CompareTray } from './DiscoveryActions'

export function Brand({ light = false }) {
  return (
    <Link
      to="/"
      className={`brand ${light ? 'brand-light' : ''}`}
      aria-label="Pondok Connect — Beranda"
    >
      <img src="/favicon.svg" alt="" width="42" height="42" />
      <span>
        Pondok
        <span className="brand-connect">
          Connect<span className="brand-dot">.</span>
        </span>
        <small>KABUPATEN LAMONGAN</small>
      </span>
    </Link>
  )
}
const links = [
  ['/', 'Beranda'],
  ['/pesantren', 'Direktori Pesantren'],
  ['/lacak', 'Lacak Layanan'],
  ['/lapor', 'Lapor Aman'],
]
export function Layout() {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const features = useFeatures()
  const location = useLocation()
  useEffect(() => {
    setOpen(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.title = `${links.find(([p]) => p === location.pathname)?.[1] || 'Layanan'} — Pondok Connect Lamongan`
  }, [location.pathname])
  return (
    <>
      <a href="#main" className="skip-link">
        Lewati ke konten utama
      </a>
      <div className="utility-bar">
        <div className="container">
          <span>
            <Building2 size={12} />
            Portal layanan pesantren Kabupaten Lamongan
          </span>
          <span className="demo-label">
            {features.data?.demo
              ? 'Direktori bersumber · Layanan demo'
              : 'Direktori & layanan pesantren'}
          </span>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav aria-label="Navigasi utama" className={open ? 'nav-open' : ''}>
            {links.map(([to, text]) => (
              <NavLink key={to} to={to} end>
                {text}
                {to === '/lapor' && <ShieldCheck size={14} />}
              </NavLink>
            ))}
          </nav>
          <Link className="admin-link" to={user ? '/admin' : '/masuk'}>
            {user ? 'Dashboard' : 'Portal Pengelola'}
            <ArrowUpRight size={16} />
          </Link>
          <button
            className="icon-button menu-button"
            aria-label={open ? 'Tutup navigasi' : 'Buka navigasi'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <CompareTray />
      <footer className="site-footer">
        <div className="container footer-main">
          <div>
            <Brand light />
            <p>
              Satu pintu untuk mengenal pesantren,
              <br />
              merencanakan pendidikan, dan menjaga santri.
            </p>
          </div>
          <div>
            <h3>Jelajahi layanan</h3>
            <Link to="/pesantren">
              Direktori pesantren <ChevronRight size={14} />
            </Link>
            <Link to="/daftar">
              Pendaftaran santri <ChevronRight size={14} />
            </Link>
            <Link to="/lacak">
              Pelacakan layanan <ChevronRight size={14} />
            </Link>
          </div>
          <div>
            <h3>Ruang yang lebih aman</h3>
            <Link to="/lapor">
              Lapor Aman <ChevronRight size={14} />
            </Link>
            <Link to="/privasi">
              Privasi & penggunaan data <ChevronRight size={14} />
            </Link>
            <Link to="/masuk">
              Masuk pengelola <ChevronRight size={14} />
            </Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Pondok Connect Lamongan</span>
          <span>
            {features.data?.demo ? 'Proyek akademik PENS · ' : ''}Bukan portal
            resmi Kemenag
          </span>
        </div>
      </footer>
    </>
  )
}
