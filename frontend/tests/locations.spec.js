import { test, expect } from '@playwright/test'

test('district discovery shows real addresses, source links, directions and distinct map points', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Peta Lamongan', exact: true }).click()
  await page.getByLabel('Jelajahi kecamatan').selectOption({ label: 'Paciran' })
  await page.getByRole('link', { name: 'Jelajahi pesantren Paciran' }).click()
  const cards = page.locator('.ponpes-card')
  await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(2)
  await expect(cards.filter({ hasText: 'Sunan Drajat' })).toContainText(
    'Banjaranyar',
  )
  await expect(cards.filter({ hasText: 'Tarbiyatut Tholabah' })).toContainText(
    'KH. Musthofa No. 40',
  )
  const directions = cards
    .filter({ hasText: 'Sunan Drajat' })
    .getByRole('link', { name: /Petunjuk arah/ })
  await expect(directions).toHaveAttribute(
    'href',
    /google\.com\/maps\/dir\/\?api=1&destination=/,
  )
  await expect(directions).toHaveAttribute('target', '_blank')
  await page.getByRole('button', { name: 'Tampilan peta' }).click()
  await expect
    .poll(() => page.locator('.leaflet-interactive').count())
    .toBeGreaterThanOrEqual(2)
  await page.locator('.leaflet-interactive').first().click()
  await expect(
    page.locator('.leaflet-popup-content .location-address'),
  ).toBeVisible()
  await expect(
    page
      .locator('.leaflet-popup-content')
      .getByRole('link', { name: /Sumber alamat/ }),
  ).toBeVisible()
  await page.goto('/pesantren/sunan-drajat')
  const location = page.getByRole('region', { name: 'Alamat dan lokasi' })
  await expect(location).toContainText('Banjarwati')
  await expect(
    location.getByRole('link', { name: /Sumber alamat/ }),
  ).toHaveAttribute('href', 'https://ppsd.id/hubungi-kami/')
  await page.goto('/pesantren/al-maruf')
  await expect(
    page.getByRole('region', { name: 'Alamat dan lokasi' }),
  ).toContainText('Alamat belum diverifikasi')
  await expect(page.getByRole('link', { name: /Petunjuk arah/ })).toHaveCount(0)
})

test('mobile location details stay within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/pesantren/sunan-drajat')
  await expect(
    page.getByRole('region', { name: 'Alamat dan lokasi' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test.afterAll(async () => {
  if (process.env.CAPTURE_LOCATIONS === '1')
    await import('./capture-locations.mjs')
})
