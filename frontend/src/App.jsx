import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { LinkButton, Loading } from './components/UI'
import { Protected } from './lib/auth'
const Home = lazy(() => import('./pages/Home'))
const Compare = lazy(() => import('./pages/Compare'))
const Directory = lazy(() => import('./pages/Directory'))
const Detail = lazy(() => import('./pages/PonpesDetail'))
const Registration = lazy(() => import('./pages/Registration'))
const Report = lazy(() => import('./pages/Report'))
const Tracking = lazy(() => import('./pages/Tracking'))
const Verification = lazy(() => import('./pages/Verification'))
const Login = lazy(() =>
  import('./pages/Auth').then((m) => ({ default: m.Login })),
)
const Password = lazy(() =>
  import('./pages/Auth').then((m) => ({ default: m.ChangePassword })),
)
const Admin = lazy(() => import('./pages/Admin'))
const Privacy = lazy(() => import('./pages/Privacy'))
export default function App() {
  return (
    <Suspense fallback={<Loading text="Menyiapkan halaman…" />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="pesantren" element={<Directory />} />
          <Route path="bandingkan" element={<Compare />} />
          <Route path="pesantren/:slug" element={<Detail />} />
          <Route path="daftar" element={<Registration />} />
          <Route path="lapor" element={<Report />} />
          <Route path="lacak" element={<Tracking />} />
          <Route path="status-pesantren/:slug" element={<Verification />} />
          <Route path="verifikasi-ijop/:nspp" element={<Verification />} />
          <Route path="masuk" element={<Login />} />
          <Route
            path="ganti-password"
            element={
              <Protected allowPasswordChange>
                <Password />
              </Protected>
            }
          />
          <Route
            path="admin"
            element={
              <Protected>
                <Admin />
              </Protected>
            }
          />
          <Route path="privasi" element={<Privacy />} />
          <Route
            path="*"
            element={
              <div className="container section narrow success-card">
                <span className="eyebrow">404 · HALAMAN TIDAK DITEMUKAN</span>
                <h1>Mari kembali ke jalan utama.</h1>
                <p>Alamat halaman mungkin telah berubah.</p>
                <LinkButton to="/">Kembali ke beranda</LinkButton>
              </div>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  )
}
