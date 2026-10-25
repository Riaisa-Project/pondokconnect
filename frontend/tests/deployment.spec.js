import { test, expect } from '@playwright/test'

test('production deployment hides demo credentials and explains optional Groq OCR', async ({
  page,
}) => {
  await page.route('**/api/system/features', (route) =>
    route.fulfill({
      json: { demo: false, ocr_available: true, provider: 'Groq' },
    }),
  )
  await page.goto('/masuk')
  await expect(
    page.getByRole('heading', { name: 'Selamat datang kembali.' }),
  ).toBeVisible()
  await expect(page.locator('.demo-accounts')).toHaveCount(0)
  await expect(page.locator('.utility-bar')).not.toContainText('Layanan demo')
  await expect(page.locator('.footer-bottom')).not.toContainText(
    'Proyek akademik',
  )
  await expect(page.getByText(/admin05@pondokconnect\.id/)).toBeVisible()
  await page.goto('/privasi')
  await expect(page.locator('.prose')).toContainText('Groq')
  await expect(page.locator('.prose')).toContainText('persetujuan')
  await expect(page.locator('.prose')).toContainText('tidak disimpan')
  await expect(page.locator('.prose')).not.toContainText(
    'proyek akademik dengan data',
  )
  await page.goto('/lapor')
  await expect(page.locator('.report-aside')).not.toContainText(
    'Portal demo akademik',
  )
  await page.goto('/')
  await expect(page.locator('.stat-note')).not.toContainText('Demo akademik')
})

test('demo deployment still labels sample access and data', async ({
  page,
}) => {
  await page.route('**/api/system/features', (route) =>
    route.fulfill({
      json: { demo: true, ocr_available: false, provider: null },
    }),
  )
  await page.goto('/masuk')
  await expect(page.locator('.demo-accounts')).toBeVisible()
  await expect(page.locator('.utility-bar')).toContainText('Layanan demo')
  await page.goto('/lapor')
  await expect(page.locator('.report-aside')).toContainText(
    'Portal demo akademik',
  )
})

test('reference administrators keep unknown facts blank when saving a profile', async ({
  page,
}) => {
  test.skip(
    process.env.REFERENCE_CATALOG_FIXTURE !== '1',
    'Needs a reference profile fixture',
  )
  const response = await page.request.get('/api/ponpes/al-ishlah-sendangagung')
  expect(response.ok()).toBe(true)
  const reference = await response.json()
  await page.route('**/api/admin/ponpes/my', async (route) => {
    if (route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON()
      for (const key of [
        'nama_pengasuh',
        'tipe_pesantren',
        'latitude',
        'longitude',
      ])
        expect(payload).not.toHaveProperty(key)
      expect(payload.kontak_sekretariat).toBe('081234567890')
      expect(payload.kuota_putra).toBe(0)
      expect(payload.kuota_putri).toBe(0)
      await route.fulfill({ json: { ...reference, ...payload } })
    } else
      await route.fulfill({
        json: { ...reference, kuota_putra: 0, kuota_putri: 0 },
      })
  })
  await page.goto('/masuk')
  await page.getByLabel('Email pengelola').fill('admin@sunandrajat.id')
  await page.getByLabel('Password', { exact: true }).fill('admin123')
  await page.getByRole('button', { name: 'Masuk ke portal' }).click()
  await page
    .getByRole('button', { name: 'Profil & kuota', exact: true })
    .click()
  await expect(page.getByLabel('Kapasitas putra')).toHaveValue('0')
  await expect(page.getByLabel('Latitude', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Tipe pesantren', { exact: true })).toHaveValue(
    '',
  )
  await expect(
    page.getByText('Belum dikonfirmasi', { exact: true }),
  ).toBeVisible()
  await page.getByLabel('Kontak sekretariat').fill('081234567890')
  await page
    .getByRole('button', { name: 'Simpan perubahan', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText(
    'Profil pesantren berhasil disimpan',
  )
})
