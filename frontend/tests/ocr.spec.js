import { test, expect } from '@playwright/test'

const image = {
  name: 'kk-simulasi.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jAZkAAAAASUVORK5CYII=',
    'base64',
  ),
}
const household = {
  members: [
    { nama: 'ANAK SIMULASI', nik: '0000000000000001', jenis_kelamin: 'L' },
    { nama: 'ANGGOTA SIMULASI', nik: null, jenis_kelamin: null },
  ],
  kepala_keluarga: 'WALI SIMULASI',
}

async function features(page, enabled = true) {
  await page.route('**/api/system/features', (route) =>
    route.fulfill({
      json: { demo: false, ocr_available: enabled, ocr_provider: 'Groq' },
    }),
  )
}

async function readImage(page) {
  await page.getByLabel('Kartu Keluarga (opsional)').setInputFiles(image)
  await page
    .getByLabel('Saya setuju gambar KK dikirim ke Groq untuk dibaca.')
    .check()
  await page.getByRole('button', { name: 'Baca gambar KK' }).click()
}

test('OCR requires consent and explicit field selection before applying to the form', async ({
  page,
}) => {
  await features(page)
  let requests = 0
  await page.route('**/api/ocr/kk', (route) => {
    requests += 1
    const sent = route.request().postDataJSON()
    expect(sent.consent).toBe(true)
    expect(sent.attachment.filename).toBe('kk-simulasi.png')
    return route.fulfill({ json: household })
  })
  await page.goto('/daftar')
  const read = page.getByRole('button', { name: 'Baca gambar KK' })
  await expect(read).toBeDisabled()
  await page.getByLabel('Kartu Keluarga (opsional)').setInputFiles(image)
  await expect(read).toBeDisabled()
  expect(requests).toBe(0)
  await page
    .getByLabel('Saya setuju gambar KK dikirim ke Groq untuk dibaca.')
    .check()
  await read.click()
  await page.getByLabel('Anggota KK untuk calon santri').selectOption('0')
  await expect(page.getByLabel('Nama lengkap santri')).toHaveValue('')
  await expect(
    page.getByRole('button', { name: 'Terapkan ke formulir' }),
  ).toBeDisabled()
  await page.getByLabel('Gunakan nama santri: ANAK SIMULASI').check()
  await page.getByLabel('Gunakan NIK santri: 0000000000000001').check()
  await page.getByRole('button', { name: 'Terapkan ke formulir' }).click()
  await expect(page.getByLabel('Nama lengkap santri')).toHaveValue(
    'ANAK SIMULASI',
  )
  await expect(page.getByLabel('NIK santri', { exact: true })).toHaveValue(
    '0000000000000001',
  )
  await expect(page.getByLabel('Jenis kelamin', { exact: true })).toHaveValue(
    '',
  )
  await expect(page.getByLabel('Nama wali', { exact: true })).toHaveValue('')
  expect(requests).toBe(1)
})

test('OCR preserves existing values when replacement confirmation is declined', async ({
  page,
}) => {
  await features(page)
  await page.route('**/api/ocr/kk', (route) =>
    route.fulfill({ json: household }),
  )
  await page.goto('/daftar')
  await page.getByLabel('Nama lengkap santri').fill('NAMA MANUAL')
  await readImage(page)
  await page.getByLabel('Anggota KK untuk calon santri').selectOption('0')
  await page.getByLabel('Gunakan nama santri: ANAK SIMULASI').check()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Terapkan ke formulir' }).click()
  await expect(page.getByLabel('Nama lengkap santri')).toHaveValue(
    'NAMA MANUAL',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Terapkan ke formulir' }).click()
  await expect(page.getByLabel('Nama lengkap santri')).toHaveValue(
    'ANAK SIMULASI',
  )
})

test('replacing an image or revoking consent clears OCR results', async ({
  page,
}) => {
  await features(page)
  await page.route('**/api/ocr/kk', (route) =>
    route.fulfill({ json: household }),
  )
  await page.goto('/daftar')
  await readImage(page)
  await expect(page.getByLabel('Anggota KK untuk calon santri')).toBeVisible()
  await page
    .getByLabel('Kartu Keluarga (opsional)')
    .setInputFiles({ ...image, name: 'kk-baru.png' })
  await expect(page.getByLabel('Anggota KK untuk calon santri')).toHaveCount(0)
  await expect(
    page.getByLabel('Saya setuju gambar KK dikirim ke Groq untuk dibaca.'),
  ).not.toBeChecked()
  await page
    .getByLabel('Saya setuju gambar KK dikirim ke Groq untuk dibaca.')
    .check()
  await page.getByRole('button', { name: 'Baca gambar KK' }).click()
  await expect(page.getByLabel('Anggota KK untuk calon santri')).toBeVisible()
  await page
    .getByLabel('Saya setuju gambar KK dikirim ke Groq untuk dibaca.')
    .uncheck()
  await expect(page.getByLabel('Anggota KK untuk calon santri')).toHaveCount(0)
  await expect(page.getByLabel('Nama lengkap santri')).toHaveValue('')
})

test('late OCR response cannot restore results after consent is revoked', async ({
  page,
}) => {
  await features(page)
  let release
  const held = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/api/ocr/kk', async (route) => {
    await held
    await route.fulfill({ json: household }).catch(() => {})
  })
  await page.goto('/daftar')
  const request = page.waitForRequest('**/api/ocr/kk')
  await readImage(page)
  await request
  await page
    .getByLabel('Saya setuju gambar KK dikirim ke Groq untuk dibaca.')
    .uncheck()
  release()
  await expect(
    page.getByRole('button', { name: 'Baca gambar KK' }),
  ).toBeDisabled()
  await expect(page.getByLabel('Anggota KK untuk calon santri')).toHaveCount(0)
  await expect(page.getByLabel('Nama lengkap santri')).toHaveValue('')
})

test('manual registration remains usable without OCR or a demo warning in production', async ({
  page,
}) => {
  await features(page, false)
  await page.goto('/daftar?ponpes=1')
  await expect(
    page.getByRole('heading', { name: 'Isi dari foto KK (opsional)' }),
  ).toHaveCount(0)
  await expect(
    page.getByText('Portal ini masih berupa demo akademik.', { exact: false }),
  ).toHaveCount(0)
  await page.getByLabel('Nama lengkap santri').fill('MANUAL SIMULASI')
  await page.getByLabel('NIK santri', { exact: true }).fill('0000000000000002')
  await page.getByLabel('Jenis kelamin', { exact: true }).selectOption('P')
  await page.getByLabel('Nama wali', { exact: true }).fill('WALI SIMULASI')
  await page.getByLabel('Nomor HP wali').fill('080000000000')
  await page.getByLabel('Kartu Keluarga (opsional)').setInputFiles({
    name: 'kk.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF'),
  })
  await page.getByRole('checkbox').check()
  await page.route('**/api/pendaftaran/kirim', (route) => {
    const sent = route.request().postDataJSON()
    expect(Object.keys(sent).sort()).toEqual([
      'file_kk',
      'jenis_kelamin',
      'nama_santri',
      'nama_wali',
      'nik_santri',
      'no_hp_wali',
      'ponpes_id',
    ])
    return route.fulfill({
      status: 201,
      json: {
        nomor_registrasi: 'REG-SIMULASI',
        status_seleksi: 'menunggu_verifikasi',
        ponpes_id: 1,
        created_at: '2026-01-01T00:00:00',
      },
    })
  })
  await page.getByRole('button', { name: 'Kirim pendaftaran' }).click()
  await expect(
    page.getByRole('heading', { name: 'Pendaftaran terkirim.' }),
  ).toBeVisible()
})

test('an OCR provider error keeps manual form and entered values available', async ({
  page,
}) => {
  await features(page)
  await page.route('**/api/ocr/kk', (route) =>
    route.fulfill({
      status: 503,
      json: {
        detail:
          'Layanan OCR belum dapat dihubungi. Silakan isi formulir secara manual.',
      },
    }),
  )
  await page.goto('/daftar')
  await page.getByLabel('Nama lengkap santri').fill('TETAP MANUAL')
  await readImage(page)
  await expect(page.getByRole('alert')).toContainText(
    'Silakan isi formulir secara manual.',
  )
  await expect(page.getByLabel('Nama lengkap santri')).toHaveValue(
    'TETAP MANUAL',
  )
  await expect(
    page.getByRole('button', { name: 'Kirim pendaftaran' }),
  ).toBeEnabled()
})
