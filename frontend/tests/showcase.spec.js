import { test, expect } from '@playwright/test'

test('saved profiles, comparison limit, shareable URL and unavailable selections', async ({
  page,
}) => {
  await page.goto('/pesantren?layanan=aktif')
  const cards = page.locator('.ponpes-card')
  await expect(cards.nth(3)).toBeVisible()
  expect(await cards.count()).toBeGreaterThanOrEqual(4)
  await cards
    .first()
    .getByRole('button', { name: /^Simpan / })
    .click()
  await page.getByRole('button', { name: /^Tersimpan / }).click()
  await expect(cards).toHaveCount(1)
  await page.getByRole('button', { name: 'Semua pesantren' }).click()
  await expect(cards.nth(3)).toBeVisible()
  for (let i = 0; i < 3; i++)
    await cards
      .nth(i)
      .getByRole('button', { name: /^Bandingkan / })
      .click()
  await cards
    .nth(3)
    .getByRole('button', { name: /^Bandingkan / })
    .click()
  await expect(page.getByRole('status')).toContainText('maksimal 3')
  await page.getByRole('link', { name: 'Lihat perbandingan' }).click()
  await expect(page.locator('.comparison-table thead th')).toHaveCount(4)
  await expect(page.locator('.comparison-table')).toContainText('Kuota putra')
  await expect(page.locator('.comparison-table')).toContainText('Asrama')
  await page.reload()
  await expect(page.locator('.comparison-table thead th')).toHaveCount(4)
  await page.goto('/bandingkan?pilihan=sunan-drajat,does-not-exist')
  await expect(page.getByText('Pesantren tidak tersedia')).toBeVisible()
})

test('3D modes, district choice, pause and reset remain available', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.locator('.explorer-canvas canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Peta Lamongan', exact: true }).click()
  await page.getByLabel('Jelajahi kecamatan').selectOption({ label: 'Paciran' })
  await expect(page.locator('.explorer-info strong')).toHaveText('Paciran')
  await expect(
    page.getByRole('link', { name: 'Jelajahi pesantren Paciran' }),
  ).toHaveAttribute('href', /kecamatan_id=/)
  await page
    .getByRole('button', { name: 'Kampus pesantren', exact: true })
    .click()
  await page.getByRole('button', { name: 'Masjid', exact: true }).click()
  await expect(page.locator('.explorer-info')).toContainText(
    'Masjid & ruang ibadah',
  )
  if (await page.getByRole('button', { name: 'Jeda animasi 3D' }).isVisible())
    await page.getByRole('button', { name: 'Jeda animasi 3D' }).click()
  await expect(
    page.getByRole('button', { name: 'Jalankan animasi 3D' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Asrama', exact: true }).click()
  await expect(page.locator('.explorer-info')).toContainText(
    'Kehidupan berasrama',
  )
  const canvas = page.locator('.explorer-canvas canvas')
  await page.waitForTimeout(600)
  const beforeDrag = await canvas.screenshot()
  const box = await canvas.boundingBox()
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.66, box.y + box.height * 0.45, {
    steps: 15,
  })
  await page.mouse.up()
  await page.waitForTimeout(600)
  const afterDrag = await canvas.screenshot()
  expect(beforeDrag.equals(afterDrag)).toBe(false)
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45)
  await page.mouse.wheel(0, -260)
  await page.waitForTimeout(600)
  expect(afterDrag.equals(await canvas.screenshot())).toBe(false)
  await page.getByRole('button', { name: 'Reset tampilan 3D' }).click()
  expect(errors).toEqual([])
})

test('dashboard and edited public profile read through to comparison', async ({
  page,
}) => {
  await page.goto('/masuk')
  await page.getByLabel('Email pengelola').fill('admin@sunandrajat.id')
  await page.getByLabel('Password', { exact: true }).fill('admin123')
  await page.getByRole('button', { name: 'Masuk ke portal' }).click()
  await expect(page.locator('.metric-card')).toHaveCount(4)
  await expect(
    page.getByRole('button', { name: 'Pengaduan santri' }),
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Profil & kuota', exact: true })
    .click()
  await page
    .getByLabel('Deskripsi pesantren')
    .fill('Profil hasil pengujian showcase yang disimpan di database terpisah.')
  await page.getByLabel('Program unggulan').fill('Program Showcase E2E\nTahfiz')
  await page.getByLabel('Fasilitas pesantren').fill('Perpustakaan E2E\nAsrama')
  await page.getByRole('button', { name: 'Simpan profil publik' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Konten profil publik berhasil disimpan',
  )
  await page.goto('/pesantren/sunan-drajat')
  await expect(page.locator('.profile-description')).toContainText(
    'Profil hasil pengujian showcase',
  )
  await expect(page.locator('.profile-offerings')).toContainText(
    'Program Showcase E2E',
  )
  await page.goto('/bandingkan?pilihan=sunan-drajat')
  await expect(page.locator('.comparison-table')).toContainText(
    'Perpustakaan E2E',
  )
})

test('removing a comparison releases its slot in the directory', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'pondok.compare.v1',
      JSON.stringify(['sunan-drajat', 'al-maruf', 'matholiul-anwar']),
    ),
  )
  await page.goto('/bandingkan?pilihan=sunan-drajat,al-maruf,matholiul-anwar')
  await page.getByRole('button', { name: 'Hapus pilihan 1' }).click()
  await page.getByRole('link', { name: 'Kembali', exact: true }).click()
  await page.getByLabel('Cari pesantren', { exact: true }).fill('Tarbiyatut')
  await page
    .locator('.ponpes-card')
    .filter({ hasText: 'Tarbiyatut' })
    .getByRole('button', { name: /^Bandingkan / })
    .click()
  await expect(
    page.getByRole('link', { name: 'Lihat perbandingan' }),
  ).toHaveAttribute('href', /tarbiyatut-tholabah/)
})

test('inactive profile refetch hides cached details and registration action', async ({
  page,
}) => {
  await page.goto('/bandingkan?pilihan=sunan-drajat')
  await expect(
    page.getByRole('link', { name: 'Daftar santri', exact: true }).first(),
  ).toBeVisible()
  await page.route('**/api/ponpes/sunan-drajat', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: '{"detail":"Ponpes aktif tidak ditemukan"}',
    }),
  )
  await page.getByRole('button', { name: 'Perbarui data' }).click()
  await expect(page.getByText('Pesantren tidak tersedia')).toBeVisible()
  await expect(
    page
      .locator('.comparison-table')
      .getByRole('link', { name: 'Daftar santri' }),
  ).toHaveCount(0)
  await expect(page.locator('.comparison-table tbody')).not.toContainText(
    'Asrama',
  )
})

test('mobile compare tray does not cover consultation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/pesantren/sunan-drajat')
  await page.getByRole('button', { name: /^Bandingkan Pondok/ }).click()
  const trigger = page.getByRole('button', { name: 'Tanya pengurus' })
  await expect(trigger).toBeVisible()
  expect(
    await trigger.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return el.contains(
        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
      )
    }),
  ).toBe(true)
  await trigger.click()
  await expect(page.getByLabel('Pesan konsultasi')).toBeVisible()
})
