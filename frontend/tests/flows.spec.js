import { test, expect } from '@playwright/test'

async function login(
  page,
  email = 'admin@sunandrajat.id',
  password = 'admin123',
) {
  await page.goto('/masuk')
  await page.getByLabel('Email pengelola').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Masuk ke portal' }).click()
  await expect(page).toHaveURL(/\/(admin|ganti-password)/)
}

// Mutations target the isolated frontend_test database on API port 8001.
test('public directory, profile QR and evidence-backed oversight', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: /Tempat bertumbuh/ }),
  ).toBeVisible()
  await expect(page.locator('.stat').nth(1)).toContainText('27')
  await page.getByLabel('Cari nama pesantren').fill('Sunan')
  await page
    .getByRole('button', { name: 'Cari pesantren', exact: true })
    .click()
  await expect(page.locator('.ponpes-card')).toHaveCount(1)
  await page
    .getByRole('heading', { name: 'Pondok Pesantren Sunan Drajat Paciran' })
    .getByRole('link')
    .click()
  await expect(
    page.getByRole('heading', { name: 'Mengenal pesantren' }),
  ).toBeVisible()
  await expect(
    page.getByRole('img', { name: 'QR status pesantren' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Lihat catatan pengawasan' }).click()
  await expect(
    page.getByText('Belum dikonfirmasi', { exact: true }).first(),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('registration upload, PDF, tracking and admin selection', async ({
  page,
}) => {
  await page.goto('/daftar?ponpes=1')
  await expect(page.getByLabel('Pilih pesantren')).toHaveValue('1')
  await page.getByLabel('Nama lengkap santri').fill('Santri Browser E2E')
  await page.getByLabel('NIK santri').fill('9911223344556677')
  await page.getByLabel('Jenis kelamin').selectOption('L')
  await page.getByLabel('Nama wali', { exact: true }).fill('Wali Browser E2E')
  await page.getByLabel('Nomor HP wali').fill('081234567890')
  await page.getByLabel('Kartu Keluarga (opsional)').setInputFiles({
    name: 'kk.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF'),
  })
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Kirim pendaftaran' }).click()
  await expect(
    page.getByRole('heading', { name: 'Pendaftaran terkirim.' }),
  ).toBeVisible()
  const code = await page.locator('.copy-block code').textContent()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Unduh bukti PDF' }).click()
  expect((await downloaded).suggestedFilename()).toBe(`${code}.pdf`)
  await page.goto('/lacak')
  await page.getByLabel('Nomor registrasi').fill(code)
  await page.getByRole('button', { name: 'Periksa status' }).click()
  await expect(page.locator('.tracking-result')).toContainText(
    'Menunggu verifikasi',
  )
  await expect(page.locator('.tracking-result')).not.toContainText(
    '9911223344556677',
  )
  await login(page)
  await page.getByRole('button', { name: 'Seleksi santri' }).click()
  await page
    .locator('summary')
    .filter({ hasText: 'Santri Browser E2E' })
    .click()
  await page.getByLabel('Ubah status').selectOption('diterima')
  await page.getByRole('button', { name: 'Simpan', exact: true }).click()
  await expect(
    page.locator('summary').filter({ hasText: 'Santri Browser E2E' }),
  ).toContainText('Diterima')
  await expect(
    page.getByRole('button', { name: 'Pengaduan santri' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Keluar', exact: true }).click()
  await expect(page).toHaveURL(/masuk/)
})

test('anonymous report removes identity and Satgas updates progress', async ({
  page,
}) => {
  await page.goto('/lapor')
  await page.getByRole('switch', { name: 'Mode rahasia' }).click()
  await page.getByLabel('Nama pelapor').fill('Hapus Identitas Saya')
  await page.getByLabel('Kontak pelapor').fill('081111111111')
  await page.getByRole('switch', { name: 'Mode rahasia' }).click()
  await expect(page.getByLabel('Nama pelapor')).toHaveCount(0)
  await page.getByLabel('Pilih pesantren').selectOption('1')
  await page
    .getByLabel('Kategori kejadian')
    .selectOption('perundungan_bullying')
  await page.getByLabel('Tanggal kejadian').fill('2026-01-01')
  await page.getByLabel('Lokasi kejadian').fill('Lokasi pengujian browser')
  await page
    .getByLabel('Ceritakan kejadian')
    .fill('Kasus simulasi untuk pengujian browser, tanpa identitas korban.')
  const sent = page.waitForRequest(
    (r) => r.url().endsWith('/pengaduan/kirim') && r.method() === 'POST',
  )
  await page.getByRole('button', { name: 'Kirim laporan ke Satgas' }).click()
  const payload = (await sent).postDataJSON()
  expect(payload.mode_pelapor).toBe('rahasia')
  expect(payload).not.toHaveProperty('nama_pelapor')
  expect(payload).not.toHaveProperty('kontak_pelapor')
  await expect(
    page.getByRole('heading', { name: 'Terima kasih telah bersuara.' }),
  ).toBeVisible()
  const ticket = await page.locator('.copy-block code').textContent()
  expect(ticket).toMatch(/^[a-f0-9]{32}$/)
  await login(page, 'satgas@kemenag.go.id', 'satgas123')
  await page.getByRole('button', { name: 'Pengaduan santri' }).click()
  await page
    .locator('summary')
    .filter({ hasText: 'Perundungan / bullying' })
    .first()
    .click()
  await expect(
    page.getByText('Rahasia / anonim', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Hapus Identitas Saya')).toHaveCount(0)
  await page.getByLabel('Ubah status').selectOption('pendampingan')
  await page
    .getByLabel('Catatan internal', { exact: true })
    .fill('Catatan internal browser yang hanya boleh dibaca petugas')
  await page.getByRole('button', { name: 'Simpan', exact: true }).click()
  await expect(page.locator('summary').first()).toContainText('Pendampingan')
  await page.goto('/lacak')
  await page.getByRole('button', { name: 'Pengaduan', exact: true }).click()
  await page.getByLabel('Kode tiket pengaduan').fill(ticket)
  await page.getByRole('button', { name: 'Periksa status' }).click()
  await expect(page.locator('.tracking-result')).toContainText('Pendampingan')
  await expect(page.locator('.tracking-result')).not.toContainText(
    'Lokasi pengujian browser',
  )
  await expect(page.locator('.tracking-result')).not.toContainText(
    'Catatan internal browser',
  )
})

test('provisioning, forced password change, oversight and reset', async ({
  page,
  browser,
}) => {
  await login(page, 'satgas@kemenag.go.id', 'satgas123')
  await page.getByRole('button', { name: 'Tambah pesantren' }).click()
  await page
    .getByLabel('Nama pesantren', { exact: true })
    .fill('Pesantren Browser Test')
  await page.getByLabel('Nama pengasuh').fill('Pengasuh Test')
  await page.getByLabel('NSPP (12 digit)').fill('999999000001')
  await page
    .getByRole('combobox', { name: 'Kecamatan', exact: true })
    .selectOption({ label: 'Paciran' })
  await page.getByLabel('Kontak sekretariat').fill('081111112222')
  await page.getByLabel('Alamat lengkap').fill('Alamat simulasi browser test')
  await page.getByLabel('Nama admin').fill('Pengurus Browser')
  await page.getByLabel('Email admin').fill('browser@example.org')
  await page.getByLabel('Nomor HP admin').fill('081111112222')
  await page.getByRole('button', { name: 'Buat pesantren & akun' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const temp = await dialog.locator('code').textContent()
  await dialog.getByRole('button', { name: 'Selesai', exact: true }).click()
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5174' })
  const admin = await context.newPage()
  await login(admin, 'browser@example.org', temp)
  await expect(admin).toHaveURL(/ganti-password/)
  await admin.getByLabel('Password lama').fill(temp)
  await admin
    .getByLabel('Password baru', { exact: true })
    .fill('NewBrowserPass123!')
  await admin.getByLabel('Konfirmasi password baru').fill('NewBrowserPass123!')
  await admin.getByRole('button', { name: 'Simpan password baru' }).click()
  await expect(admin).toHaveURL(/masuk/)
  await login(admin, 'browser@example.org', 'NewBrowserPass123!')
  await admin
    .getByRole('button', { name: 'Profil & kuota', exact: true })
    .click()
  await expect(admin.getByLabel('Nama pesantren', { exact: true })).toHaveValue(
    'Pesantren Browser Test',
  )
  await page.getByRole('button', { name: 'Daftar pesantren' }).click()
  await page
    .getByLabel('Cari pesantren terdaftar')
    .fill('Pesantren Browser Test')
  const row = page
    .locator('.management-record')
    .filter({ hasText: 'Pesantren Browser Test' })
  await row
    .getByRole('button', { name: 'Catat pengawasan', exact: true })
    .click()
  await page.getByLabel('Status dokumen').selectOption('terdaftar')
  await page.getByLabel('Nomor statistik pada dokumen').fill('999999000001')
  await page.getByLabel('Nomor dokumen', { exact: true }).fill('DOK-BROWSER/01')
  await page.getByLabel('Penerbit dokumen').fill('Penerbit dokumen pengujian')
  await page.getByLabel('Tanggal dokumen', { exact: true }).fill('2026-01-01')
  await page
    .getByLabel('Sumber dokumen', { exact: true })
    .fill('Arsip pengujian 01')
  await page.getByLabel('Tanggal pemeriksaan dokumen').fill('2026-01-02')
  await page.getByRole('button', { name: 'Simpan pengawasan' }).click()
  await expect(row.locator('.badge')).toHaveText(
    'Terdaftar berdasarkan dokumen',
  )
  await row.getByRole('button', { name: 'Reset akun' }).click()
  await page.getByLabel('Alasan reset').fill('Pengujian reset akun browser')
  await page.getByRole('button', { name: 'Buat password sementara' }).click()
  await expect(page.getByRole('dialog')).toContainText(
    'Kredensial admin pesantren',
  )
  await admin.reload()
  await expect(admin).toHaveURL(/masuk/)
  await context.close()
})

test('consultation message and admin reply', async ({ page, browser }) => {
  await page.goto('/pesantren/sunan-drajat')
  await page.getByRole('button', { name: 'Tanya pengurus' }).click()
  await page.getByLabel('Nama Anda').fill('Wali Percakapan E2E')
  await page.getByLabel('Kontak / WhatsApp').fill('081222333444')
  await page.getByLabel('Pesan konsultasi').fill('Kapan jadwal kunjungan?')
  await page.getByRole('button', { name: 'Kirim pesan' }).click()
  await expect(page.locator('.bubble')).toContainText('Kapan jadwal kunjungan?')
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5174' })
  const admin = await context.newPage()
  await login(admin)
  await admin.getByRole('button', { name: 'Konsultasi warga' }).click()
  await admin.getByRole('button', { name: /Wali Percakapan E2E/ }).click()
  await expect(admin.locator('.bubble')).toContainText(
    'Kapan jadwal kunjungan?',
  )
  await admin
    .getByLabel('Balasan konsultasi')
    .fill('Silakan datang hari Sabtu pukul 09.00.')
  await admin.getByRole('button', { name: 'Kirim', exact: true }).click()
  await expect(page.locator('.chat-messages')).toContainText(
    'Silakan datang hari Sabtu pukul 09.00.',
    { timeout: 20000 },
  )
  await context.close()
})

test('mobile navigation and WebGL fallback stay usable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.startsWith('webgl')
        ? null
        : original.call(this, type, ...args)
    }
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('.compatible-scene svg')).toBeVisible()
  await expect(page.locator('.explorer-stage')).toHaveAttribute(
    'data-renderer',
    'svg',
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  expect(
    await page
      .locator('.hero-copy')
      .evaluate((el) => el.getBoundingClientRect().right <= innerWidth),
  ).toBe(true)
  await page.getByRole('button', { name: 'Buka navigasi' }).click()
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .getByRole('link', { name: 'Direktori Pesantren' })
    .click()
  await expect(page.locator('.ponpes-card').first()).toBeVisible()
  await page.getByRole('button', { name: 'Tampilan peta' }).click()
  await expect(page.locator('.leaflet-container')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('API outage offers retry without invented directory results', async ({
  page,
}) => {
  await page.route('**/api/ponpes/?*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"detail":"Database sementara tidak tersedia"}',
    }),
  )
  await page.goto('/pesantren')
  await expect(page.getByRole('alert')).toContainText(
    'Database sementara tidak tersedia',
  )
  await expect(page.locator('.ponpes-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Coba lagi' })).toBeVisible()
})
