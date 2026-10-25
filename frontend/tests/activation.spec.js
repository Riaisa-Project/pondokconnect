import { test, expect } from '@playwright/test'

test.skip(
  process.env.REFERENCE_CATALOG_FIXTURE !== '1',
  'Needs the expanded reference catalog',
)

test('Satgas records sourced oversight without changing provenance or opening reference services', async ({
  page,
}) => {
  const slug = 'al-aman-payaman'
  const response = await page.request.get(`/api/ponpes/${slug}`)
  const reference = await response.json()
  expect(reference.profil_referensi).toBe(true)
  expect(reference.pendaftaran_tersedia).toBe(false)
  await page.goto(`/pesantren/${slug}`)
  await expect(
    page.getByRole('img', { name: 'QR status pesantren' }),
  ).toBeVisible()
  await page.goto('/masuk')
  await page.getByLabel('Email pengelola').fill('satgas@kemenag.go.id')
  await page.getByLabel('Password', { exact: true }).fill('satgas123')
  await page.getByRole('button', { name: 'Masuk ke portal' }).click()
  await page
    .getByRole('button', { name: 'Daftar pesantren', exact: true })
    .click()
  await page.getByLabel('Cari pesantren terdaftar').fill(slug)
  const row = page
    .locator('.management-record')
    .filter({ hasText: reference.nama_ponpes })
  await expect(
    row.getByRole('button', { name: 'Aktifkan layanan', exact: true }),
  ).toHaveCount(0)
  await row
    .getByRole('button', { name: 'Catat pengawasan', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Status operasional').selectOption('beroperasi')
  await dialog
    .getByLabel('Sumber pemeriksaan operasional')
    .fill('Berita acara kunjungan pengujian')
  await dialog.getByLabel('Tanggal pemeriksaan operasional').fill('2026-01-02')
  await dialog
    .getByLabel('Catatan operasional (publik)')
    .fill('Kegiatan belajar diamati pada tanggal pemeriksaan.')
  await dialog.getByRole('button', { name: 'Simpan pengawasan' }).click()
  await expect(dialog).toHaveCount(0)
  const after = await page.request.get(`/api/ponpes/${slug}`)
  const recorded = await after.json()
  expect(recorded.profil_referensi).toBe(true)
  expect(recorded.referensi).toEqual(reference.referensi)
  expect(recorded.pendaftaran_dibuka).toBe(false)
  expect(recorded.konsultasi_dibuka).toBe(false)
  expect(recorded.pengawasan.status_dokumen).toBe('belum_dikonfirmasi')
  expect(recorded.pengawasan.status_operasional).toBe('beroperasi')
  expect(recorded.status_ijop).toBeNull()
  await page.goto(`/status-pesantren/${slug}`)
  await expect(
    page.getByText('Berita acara kunjungan pengujian', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText('2 Januari 2026', { exact: true })).toBeVisible()
  await page.goto(`/daftar?ponpes=${reference.id}`)
  await expect(
    page
      .getByLabel('Pilih pesantren')
      .locator(`option[value="${reference.id}"]`),
  ).toHaveCount(0)
})
