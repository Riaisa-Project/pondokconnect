import { test, expect } from '@playwright/test'

test('individual sourced profile presents education and direct institution links', async ({
  page,
}) => {
  test.skip(
    process.env.REFERENCE_CATALOG_FIXTURE !== '1',
    'Uses expanded catalog',
  )
  await page.goto('/pesantren/al-fattah-siman')
  const profile = page.getByRole('region', {
    name: 'Profil pesantren dari sumber publik',
  })
  await expect(profile).toBeVisible()
  await expect(
    profile.getByRole('heading', { name: 'Pendidikan', exact: true }),
  ).toBeVisible()
  await expect(profile).toContainText('Salafiyah')
  await expect(
    profile.getByRole('link', { name: 'Kunjungi situs resmi' }),
  ).toHaveAttribute('href', 'https://yppalfattahsiman.or.id/')
  await expect(
    profile.getByRole('link', { name: 'Sumber Pendidikan', exact: true }),
  ).toHaveAttribute('href', 'https://yppalfattahsiman.or.id/pendidikan')
  await expect(
    page.getByRole('img', { name: 'QR status pesantren' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Daftar ke pesantren ini/ }),
  ).toHaveCount(0)
})

test('service profiles keep sourced information separate from portal simulation', async ({
  page,
}) => {
  await page.goto('/pesantren/sunan-drajat')
  const profile = page.getByRole('region', {
    name: 'Profil pesantren dari sumber publik',
  })
  await expect(profile).toBeVisible()
  await expect(
    profile.getByRole('link', { name: 'Kunjungi situs resmi' }),
  ).toHaveAttribute('href', 'https://ppsd.id/')
  await expect(profile).not.toContainText('(contoh)')
  await expect(
    page.getByText(
      'Informasi profil, pengasuh, kuota, dan kontak pada lingkungan ini merupakan data simulasi.',
    ),
  ).toBeVisible()
  await expect(page.locator('.qr-box')).toBeVisible()
})

test('unconfirmed institution is transparent and its profile fits mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/pesantren/al-maruf')
  const profile = page.getByRole('region', {
    name: 'Profil pesantren dari sumber publik',
  })
  await expect(profile).toContainText('Belum terkonfirmasi')
  await expect(
    profile.getByRole('link', { name: 'Kunjungi situs resmi' }),
  ).toHaveCount(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test.afterAll(async () => {
  if (process.env.CAPTURE_PROFILES === '1')
    await import('./capture-profiles.mjs')
})
