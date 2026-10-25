import { createContext, useContext, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useLocation } from 'react-router-dom'
import { get, post, session } from './api'
import { Loading, Alert, Button } from '../components/UI'

const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const client = useQueryClient()
  const [token, setToken] = useState(session.get)
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => get('/admin/me'),
    enabled: !!token,
    staleTime: 0,
    retry: false,
  })
  const logout = () => {
    session.clear()
    setToken(null)
    client.clear()
  }
  useEffect(() => {
    window.addEventListener('pondok:unauthorized', logout)
    return () => window.removeEventListener('pondok:unauthorized', logout)
  }, [])
  const login = async (data) => {
    const result = await post('/admin/login', data)
    client.clear()
    session.set(result.access_token)
    setToken(result.access_token)
    return result
  }
  return (
    <AuthContext.Provider
      value={{
        user: token ? me.data : null,
        token,
        loading: !!token && me.isPending,
        error: me.error,
        retry: me.refetch,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
export const useAuth = () => useContext(AuthContext)
export function Protected({ children, allowPasswordChange = false }) {
  const { token, user, loading, error, retry } = useAuth()
  const location = useLocation()
  if (!token)
    return <Navigate to="/masuk" replace state={{ from: location.pathname }} />
  if (loading) return <Loading />
  if (error)
    return (
      <div className="container section">
        <Alert error={error} />
        <Button onClick={retry}>Coba lagi</Button>
      </div>
    )
  if (user?.must_change_password && !allowPasswordChange)
    return <Navigate to="/ganti-password" replace />
  if (!['admin_ponpes', 'satgas_kemenag'].includes(user?.role))
    return (
      <div className="container section">
        <Alert>
          Halaman ini hanya tersedia untuk pengelola pesantren dan Satgas.
        </Alert>
      </div>
    )
  return children
}
