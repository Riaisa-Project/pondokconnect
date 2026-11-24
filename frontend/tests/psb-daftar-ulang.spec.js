import { test, expect } from '@playwright/test'

// Alur daftar ulang PSB lewat UI publik: tanda tangan pernyataan + unggah bukti
// bayar. Fixture (gelombang, pengumuman, pembukaan daftar ulang) disiapkan lewat
// API pengurus di database uji terisolasi (port 8001); yang diuji di browser
// adalah jalur yang dilihat calon santri.
const PDF = {
  name: 'bukti-transfer.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n%%EOF'),
}

async function adminToken(page) {
  const features = await (await page.request.get('/api/system/features')).json()
  const account = (features.demo_accounts ?? []).find(
    (item) => item.role === 'admin_ponpes',
  )
  const response = await page.request.post('/api/admin/login', {
    data: { email: account.email, password: account.password },
  })
  expect(response.status()).toBe(200)
  return (await response.json()).access_token
}

async function api(page, token, method, path, data) {
  const response = await page.request.fetch(`/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    data,
  })
  return response
}

test('daftar ulang: pernyataan wali lalu unggah bukti bayar dari halaman lacak', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  // 1. Calon santri mendaftar lewat formulir publik.
  await page.goto('/daftar?ponpes=1')
  await page.getByLabel('Nama lengkap santri').fill('Santri Daftar Ulang')
  await page.getByLabel('NIK santri').fill('8877665544332211')
  await page.getByLabel('Jenis kelamin').selectOption('L')
  await page.getByLabel('Nama wali', { exact: true }).fill('Wali Daftar Ulang')
  await page.getByLabel('Nomor HP wali').fill('081234567891')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Kirim pendaftaran' }).click()
  await expect(
    page.getByRole('heading', { name: 'Pendaftaran terkirim.' }),
  ).toBeVisible()
  const code = (await page.locator('.copy-block code').textContent()).trim()

  // 2. Pengurus mengumumkan diterima lalu membuka daftar ulang.
  const token = await adminToken(page)
  const listed = await api(
    page,
    token,
    'GET',
    '/admin/pendaftaran?limit=100&offset=0',
  )
  expect(listed.status()).toBe(200)
  const record = (await listed.json()).items.find(
    (row) => row.nomor_registrasi === code,
  )
  expect(
    record,
    'pendaftaran baru harus muncul di daftar pengurus',
  ).toBeTruthy()

  const announced = await api(
    page,
    token,
    'PUT',
    `/admin/pendaftaran/${record.id}/status`,
    { status_seleksi: 'diterima' },
  )
  expect(announced.status()).toBe(200)

  // Sebelum dibuka, jalur publik menolak dan UI hanya menjelaskan (tanpa tombol).
  await page.goto('/lacak')
  await page.getByRole('tab', { name: 'PSB' }).click()
  await page.getByLabel('Nomor registrasi').fill(code)
  await page.getByRole('button', { name: 'Periksa status' }).click()
  await expect(page.locator('.tracking-result')).toContainText('Diterima')
  await expect(
    page.getByRole('button', { name: 'Unggah bukti bayar' }),
  ).toHaveCount(0)

  const opened = await api(
    page,
    token,
    'POST',
    `/admin/pendaftaran/${record.id}/daftar-ulang`,
    { pendaftaran_id: record.id, biaya_masuk: '500000', infaq: '100000' },
  )
  expect(opened.status()).toBe(201)

  // 3. Wali melihat panggilan daftar ulang beserta tenggatnya.
  await page.getByRole('button', { name: 'Periksa status' }).click()
  await expect(page.locator('.tracking-result')).toContainText('Daftar ulang')
  await expect(page.locator('.tracking-result')).toContainText('hari lagi')

  // 4. Tanda tangan pernyataan: satu POST ke endpoint publik, tanpa error.
  const signed = page.waitForResponse(
    (r) =>
      r.url().includes(`/pendaftaran/lacak/${code}/daftar-ulang`) &&
      r.request().method() === 'POST',
  )
  await page
    .getByRole('button', { name: 'Tanda tangani pernyataan daftar ulang' })
    .click()
  const signResponse = await signed
  expect(signResponse.status()).toBe(200)
  expect(signResponse.request().postDataJSON()).toEqual({ pernyataan: true })
  await expect(
    page.getByRole('button', { name: 'Tanda tangani pernyataan daftar ulang' }),
  ).toHaveCount(0)

  // 5. Unggah bukti bayar: lampiran terkirim sebagai base64, status berubah.
  const uploaded = page.waitForResponse(
    (r) =>
      r.url().includes(`/pendaftaran/lacak/${code}/daftar-ulang`) &&
      r.request().method() === 'POST',
  )
  await page.locator('input[type=file]').setInputFiles(PDF)
  const uploadResponse = await uploaded
  expect(uploadResponse.status()).toBe(200)
  const payload = uploadResponse.request().postDataJSON()
  expect(payload.bukti_bayar.filename).toBe('bukti-transfer.pdf')
  expect(payload.pernyataan).toBe(true)
  const body = await uploadResponse.json()
  expect(body.has_bukti_bayar).toBe(true)
  expect(body.daftar_ulang.bukti_bayar).toBeNull()

  await expect(page.locator('.tracking-result')).toContainText('terkirim')
  await expect(
    page.getByRole('button', { name: 'Kirim ulang bukti bayar' }),
  ).toBeVisible()

  // 6. Pengurus melihat bukti bayar dan barisnya di papan daftar ulang.
  expect(
    (
      await api(
        page,
        token,
        'GET',
        `/admin/pendaftaran/${record.id}/bukti-bayar`,
      )
    ).status(),
  ).toBe(200)
  const board = await api(page, token, 'GET', '/admin/papan-daftar-ulang')
  expect(board.status()).toBe(200)
  expect((await board.json()).map((row) => row.nomor_registrasi)).toContain(
    code,
  )

  expect(errors).toEqual([])
})
