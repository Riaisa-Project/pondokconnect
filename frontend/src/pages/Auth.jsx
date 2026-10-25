import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'
import { post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFeatures } from '../lib/hooks'
import { formValues, validatePassword } from '../lib/format'
import { Alert, Button, Field, Loading } from '../components/UI'

export function Login() {
  const { login, user, loading } = useAuth()
  const features = useFeatures()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await login(formValues(e.currentTarget))
      navigate(result.must_change_password ? '/ganti-password' : '/admin', {
        replace: true,
      })
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  if (loading) return <Loading />
  if (user)
    return (
      <Navigate
        to={user.must_change_password ? '/ganti-password' : '/admin'}
        replace
      />
    )
  return (
    <div className="container section login-layout">
      <div className="login-story">
        <span className="eyebrow">PORTAL PENGELOLA</span>
        <h1>
          Pelayanan yang baik,
          <br />
          dimulai dari
          <br />
          <em>keterhubungan.</em>
        </h1>
        <p>
          Ruang kerja untuk pengurus pesantren dan Satgas Kemenag dalam melayani
          santri serta masyarakat.
        </p>
        <div className="aside-note">
          <ShieldCheck size={23} />
          <span>
            Akses layanan diberikan sesuai tanggung jawab setiap pengelola.
          </span>
        </div>
        <small>Akun admin pesantren diterbitkan melalui Satgas.</small>
      </div>
      <form className="panel login-form" onSubmit={submit}>
        <div className="aside-icon">
          <LockKeyhole size={27} />
        </div>
        <h2>Selamat datang kembali.</h2>
        <p>Masuk menggunakan akun pengelola yang diberikan petugas Satgas.</p>
        {location.state?.notice && (
          <Alert success>{location.state.notice}</Alert>
        )}
        <Field label="Email pengelola">
          <input
            type="email"
            name="email"
            required
            maxLength={100}
            autoComplete="username"
            placeholder="ID akun dari petugas Satgas"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            name="password"
            required
            maxLength={128}
            autoComplete="current-password"
            placeholder="Masukkan password"
          />
        </Field>
        <Alert error={error} />
        <Button type="submit" busy={busy}>
          Masuk ke portal <ArrowRight size={17} />
        </Button>
        <p className="note">
          Lupa password? Hubungi petugas Satgas untuk reset akun pesantren.
        </p>
        <p className="note">
          Gunakan email pengelola atau ID portal dari petugas, misalnya
          admin05@pondokconnect.id. Kontak email resmi pesantren tercantum pada
          profil lembaga.
        </p>
        {features.data?.demo &&
          features.data?.demo_accounts_available !== false && (
            <details className="demo-accounts">
              <summary>Akun demo untuk mencoba</summary>
              <p>
                <strong>Satgas:</strong> satgas@kemenag.go.id / satgas123
                <br />
                <strong>Pengurus:</strong> admin@sunandrajat.id / admin123
              </p>
            </details>
          )}
      </form>
    </div>
  )
}
export function ChangePassword() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await post(
        '/admin/change-password',
        validatePassword(formValues(e.currentTarget)),
      )
      logout()
      navigate('/masuk', {
        replace: true,
        state: {
          notice:
            'Password berhasil diganti. Silakan masuk dengan password baru.',
        },
      })
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="container section narrow">
      <form className="panel form-panel" onSubmit={submit}>
        <KeyRound size={32} />
        <span className="eyebrow">KEAMANAN AKUN</span>
        <h1>Ganti password Anda.</h1>
        <p>
          {user?.must_change_password
            ? 'Akun Anda memakai password sementara. Buat password pribadi sebelum menggunakan dashboard.'
            : 'Setelah mengganti password, Anda perlu masuk kembali.'}
        </p>
        <Field label="Password lama">
          <input
            name="old_password"
            type="password"
            required
            autoComplete="current-password"
            maxLength={128}
          />
        </Field>
        <Field
          label="Password baru"
          hint="Minimal 10 karakter. Maksimal 72 byte."
        >
          <input
            name="new_password"
            type="password"
            required
            minLength={10}
            maxLength={72}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Konfirmasi password baru">
          <input
            name="confirm_password"
            type="password"
            required
            minLength={10}
            maxLength={72}
            autoComplete="new-password"
          />
        </Field>
        <Alert error={error} />
        <Button type="submit" busy={busy}>
          Simpan password baru
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            logout()
            navigate('/masuk')
          }}
        >
          Keluar dari akun
        </Button>
      </form>
    </div>
  )
}
