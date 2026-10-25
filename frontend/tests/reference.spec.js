import { test, expect } from '@playwright/test'

test.skip(
  process.env.REFERENCE_CATALOG_FIXTURE !== '1',
  'Uses the expanded reference catalog fixture',
)

test('real reference profiles expose sources and unknown facts without fake portal services', async ({
  page,
}) => {
  await page.goto('/pesantren?q=Al-Ishlah')
  const card = page.locator('.ponpes-card').filter({ hasText: 'Al-Ishlah' })
  await expect(card).toBeVisible()
  await expect(card).toContainText('Profil bersumber')
  await expect(card).not.toContainText('kuota tersedia')
  await card.getByRole('link', { name: /^Lihat / }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Al-Ishlah',
  )
  await expect(page.getByRole('link', { name: 'Sumber profil' })).toBeVisible()
  await expect(page.getByText('NSPP belum dicantumkan')).toBeVisible()
  await expect(
    page.getByText('Pengajuan pendaftaran baru belum tersedia melalui portal.'),
  ).toBeVisible()
  await expect(
    page.getByRole('img', { name: 'QR status pesantren' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Daftar ke pesantren ini/ }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: /Tanya pengurus/ }),
  ).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Petunjuk arah/ })).toBeVisible()
  await page.goto('/bandingkan?pilihan=al-ishlah-sendangagung,sunan-drajat')
  await expect(page.locator('.comparison-table')).toContainText(
    'Belum tersedia',
  )
  await expect(
    page.getByRole('link', { name: 'Daftar santri', exact: true }),
  ).toHaveCount(1)
  await page.goto('/daftar')
  await expect(
    page
      .locator('select')
      .first()
      .locator('option')
      .filter({ hasText: 'Al-Ishlah' }),
  ).toHaveCount(0)
})

test('catalog spans districts with transparent historical sources and fits mobile', async ({
  page,
}) => {
  const result = await page.request.get('/api/ponpes/?limit=100')
  expect((await result.json()).total).toBeGreaterThanOrEqual(30)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/pesantren/al-musaaadah-tikung')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('.reference-profile')).toContainText('2023')
  await expect(
    page.getByRole('link', { name: 'Sumber profil' }),
  ).toHaveAttribute('href', /lamongankab.go.id/)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('comparison drops the sourced badge after provenance is no longer valid', async ({
  page,
}) => {
  await page.route('**/api/ponpes/al-ishlah-sendangagung', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    await route.fulfill({ json: { ...body, referensi: null } })
  })
  await page.goto('/bandingkan?pilihan=al-ishlah-sendangagung')
  await expect(
    page
      .locator('.comparison-table .badge')
      .filter({ hasText: 'Profil rujukan' }),
  ).toHaveText('Profil rujukan')
})

test('reference profiles display programs and facilities supplied by their administrators', async ({
  page,
}) => {
  await page.route('**/api/ponpes/al-ishlah-sendangagung', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    await route.fulfill({
      json: {
        ...body,
        program_unggulan: ['Program pengurus terkonfirmasi'],
        fasilitas: ['Fasilitas pengurus terkonfirmasi'],
      },
    })
  })
  await page.goto('/pesantren/al-ishlah-sendangagung')
  await expect(page.locator('.profile-offerings')).toContainText(
    'Program pengurus terkonfirmasi',
  )
  await expect(page.locator('.profile-offerings')).toContainText(
    'Fasilitas pengurus terkonfirmasi',
  )
  await expect(
    page.getByRole('img', { name: 'QR status pesantren' }),
  ).toBeVisible()
})

test.afterAll(async () => {
  if (process.env.CAPTURE_REFERENCE_CATALOG === '1')
    await import('./capture-reference.mjs')
})
