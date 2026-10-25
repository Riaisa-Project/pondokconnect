export const types = {
  salafiyah: 'Salafiyah',
  khalafiyah_modern: 'Khalafiyah / modern',
  kombinasi: 'Kombinasi',
}
export const selection = {
  menunggu_verifikasi: 'Menunggu verifikasi',
  lolos_berkas: 'Lolos berkas',
  diterima: 'Diterima',
  ditolak: 'Ditolak',
}
export const actions = {
  masuk_antrian: 'Masuk antrean',
  penyelidikan_satgas: 'Penyelidikan Satgas',
  pendampingan: 'Pendampingan',
  proses_hukum: 'Proses hukum',
  selesai: 'Selesai',
  tidak_valid: 'Tidak valid',
}
export const permits = {
  proses_verifikasi: 'Proses verifikasi',
  aktif: 'Aktif',
  kedaluwarsa: 'Kedaluwarsa',
  ditolak: 'Ditolak',
}
export const categories = {
  pelecehan_seksual: 'Pelecehan seksual',
  kekerasan_fisik: 'Kekerasan fisik',
  perundungan_bullying: 'Perundungan / bullying',
  pemerasan: 'Pemerasan',
  lainnya: 'Lainnya',
}
export const label = (value) =>
  ({ ...types, ...selection, ...actions, ...permits, ...categories })[value] ||
  value?.replaceAll('_', ' ') ||
  '—'
export const number = (value) =>
  new Intl.NumberFormat('id-ID').format(value ?? 0)
export function date(value) {
  if (!value) return 'Belum tersedia'
  const parsed = new Date(
    value.length === 10
      ? `${value}T12:00:00`
      : `${value}${/[Z+]/.test(value) ? '' : 'Z'}`,
  )
  return Number.isNaN(parsed.getTime())
    ? 'Tanggal tidak valid'
    : new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(parsed)
}
export function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
export function formValues(form, numeric = []) {
  const result = Object.fromEntries(new FormData(form))
  for (const key of numeric)
    if (key in result) result[key] = Number(result[key])
  return result
}
export function validatePassword(data) {
  if (data.new_password !== data.confirm_password)
    throw new Error('Konfirmasi password tidak sama.')
  if (
    data.new_password.length < 10 ||
    new TextEncoder().encode(data.new_password).length > 72
  )
    throw new Error('Password baru minimal 10 karakter dan maksimal 72 byte.')
  if (data.new_password === data.old_password)
    throw new Error('Password baru harus berbeda dari password lama.')
  return data
}
