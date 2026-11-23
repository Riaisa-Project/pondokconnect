import { api, get, post, put } from './api'

export function psbGelombang(ponpesId) {
  return get('/gelombang', { ponpes_id: ponpesId })
}

export function psbTrackDetail(noReg) {
  return get(`/pendaftaran/lacak/${noReg}/rincian`)
}

export function psbDaftarUlang(noReg, payload) {
  return post(`/pendaftaran/lacak/${noReg}/daftar-ulang`, payload)
}

export function adminPsbGelombang() {
  return get('/admin/gelombang')
}

export function adminPsbCreateGelombang(payload) {
  return post('/admin/gelombang', payload)
}

export function adminPsbUpdateGelombang(id, payload) {
  return put(`/admin/gelombang/${id}`, payload)
}

export function adminPsbRincian(id) {
  return get(`/admin/pendaftaran/${id}/rincian`)
}

export function adminPsbBuktiBayar(id) {
  return get(`/admin/pendaftaran/${id}/bukti-bayar`)
}

export function adminPsbAddTahapan(id, payload) {
  return post(`/admin/pendaftaran/${id}/tahapan`, payload)
}

export function adminPsbUpdateTahapan(id, payload) {
  return put(`/admin/tahapan/${id}`, payload)
}

export function adminPsbOpenDaftarUlang(id, payload) {
  return post(`/admin/pendaftaran/${id}/daftar-ulang`, payload)
}

export function adminPsbDecideDaftarUlang(id, payload) {
  return put(`/admin/daftar-ulang/${id}`, payload)
}

export function adminPsbPapanDaftarUlang() {
  return get('/admin/papan-daftar-ulang')
}
