import axios from 'axios'

const SESSION_KEY = 'pondokconnect.token'
export const session = {
  get: () => sessionStorage.getItem(SESSION_KEY),
  set: (token) => sessionStorage.setItem(SESSION_KEY, token),
  clear: () => sessionStorage.removeItem(SESSION_KEY),
}
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 20000,
})
api.interceptors.request.use((config) => {
  const token = session.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      error.config?.headers?.Authorization === `Bearer ${session.get()}`
    ) {
      session.clear()
      window.dispatchEvent(new Event('pondok:unauthorized'))
    }
    return Promise.reject(error)
  },
)
export const get = (path, params) =>
  api.get(path, { params }).then((r) => r.data)
export const post = (path, data) => api.post(path, data).then((r) => r.data)
export const put = (path, data) => api.put(path, data).then((r) => r.data)

export function errorMessage(error) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail))
    return detail
      .map((e) => `${e.loc?.slice(1).join(' › ') || 'Formulir'}: ${e.msg}`)
      .join('. ')
  if (error?.response?.status === 429)
    return 'Terlalu banyak permintaan. Tunggu satu menit, lalu coba lagi.'
  if (error?.message && !error.isAxiosError) return error.message
  return 'Layanan belum dapat dihubungi. Periksa koneksi Anda dan coba lagi.'
}
export async function download(path, filename) {
  const response = await api.get(path, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export async function attachment(file) {
  if (!file?.size) return undefined
  if (file.size > 5 * 1024 * 1024)
    throw new Error('Ukuran lampiran maksimal 5 MiB.')
  if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type))
    throw new Error('Gunakan file PDF, PNG, atau JPEG.')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () =>
      reject(new Error('File tidak dapat dibaca. Pilih ulang lampiran.'))
    reader.onload = () =>
      resolve({
        filename: file.name,
        content_base64: String(reader.result).split(',')[1],
      })
    reader.readAsDataURL(file)
  })
}
