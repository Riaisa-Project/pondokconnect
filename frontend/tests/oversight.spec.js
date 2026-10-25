import { test, expect } from '@playwright/test'
const profile = {
  id: 42,
  slug: 'pondok-rujukan',
  nama_ponpes: 'Pondok Rujukan',
  kecamatan_id: 1,
  alamat_lengkap: 'Alamat dari dokumen',
  profil_referensi: true,
  referensi: {
    sumber_url: 'https://example.org/direktori',
    sumber_nama: 'Direktori lembaga',
    diperiksa_pada: '2026-01-02',
  },
  program_unggulan: [],
  fasilitas: [],
  pendaftaran_dibuka: false,
  konsultasi_dibuka: false,
  pendaftaran_tersedia: false,
  konsultasi_tersedia: false,
  layanan_tersedia: false,
  pengawasan: {
    status_dokumen: 'belum_dikonfirmasi',
    status_operasional: 'beroperasi',
    sumber_operasional: 'Berita acara kunjungan 04',
    tanggal_pemeriksaan_operasional: '2026-01-04',
    catatan_operasional: 'Kegiatan belajar terlihat saat kunjungan.',
  },
}
async function fixture(page, item = profile, role = null) {
  if (role)
    await page.addInitScript(() =>
      sessionStorage.setItem('pondokconnect.token', 'test-token'),
    )
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname.replace('/api', '')
    let body = {}
    if (path === '/admin/me')
      body = {
        id: 7,
        nama_lengkap: 'Pengelola Uji',
        role,
        must_change_password: false,
      }
    else if (path === '/system/features') body = { demo: false }
    else if (path === '/kecamatan/')
      body = [{ id: 1, nama_kecamatan: 'Paciran' }]
    else if (
      path === '/admin/ponpes/my' ||
      path.includes('/status/') ||
      path === `/ponpes/${item.slug}` ||
      path.includes('/verifikasi-ijop/')
    )
      body = item
    else if (path === '/ponpes/' || path === '/admin/kemenag/ponpes')
      body = { items: [item], total: 1 }
    await route.fulfill({ json: body })
  })
}
test('public oversight separates document uncertainty from operational evidence and uses slug QR', async ({
  page,
}) => {
  await fixture(page)
  await page.goto('/pesantren/pondok-rujukan')
  await expect(
    page.getByRole('img', { name: 'QR status pesantren' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Lihat catatan pengawasan' }).click()
  await expect(page).toHaveURL(/status-pesantren\/pondok-rujukan/)
  await expect(
    page.getByRole('heading', { name: 'Status dokumen' }),
  ).toBeVisible()
  await expect(page.getByText('Berita acara kunjungan 04')).toBeVisible()
  await expect(page.getByText('4 Januari 2026', { exact: true })).toBeVisible()
  await expect(page.getByText(/ilegal|Berlaku hingga|IJOP aktif/i)).toHaveCount(
    0,
  )
  await expect(
    page.getByText(/catatan_internal|kode_tiket|jumlah pengaduan/i),
  ).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})
test('reference provenance survives open registration while consultation stays closed', async ({
  page,
}) => {
  await fixture(page, {
    ...profile,
    pendaftaran_dibuka: true,
    pendaftaran_tersedia: true,
    layanan_tersedia: true,
    kuota_putra: 8,
    sisa_kuota_putra: 8,
    kuota_putri: 0,
    sisa_kuota_putri: 0,
  })
  await page.goto('/pesantren/pondok-rujukan')
  await expect(
    page.getByRole('link', { name: /Daftar ke pesantren ini/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Sumber profil' }),
  ).toHaveAttribute('href', 'https://example.org/direktori')
  await expect(
    page.getByRole('button', { name: 'Tanya pengurus' }),
  ).toHaveCount(0)
  await page.goto('/daftar')
  await expect(
    page.getByLabel('Pilih pesantren').locator('option[value="42"]'),
  ).toHaveCount(1)
})
test('consultation-only profile is excluded from registration but remains reportable', async ({
  page,
}) => {
  await fixture(page, {
    ...profile,
    konsultasi_dibuka: true,
    konsultasi_tersedia: true,
    layanan_tersedia: true,
  })
  await page.goto('/daftar')
  await expect(
    page.getByLabel('Pilih pesantren').locator('option[value="42"]'),
  ).toHaveCount(0)
  await page.goto('/lapor')
  await expect(
    page.getByLabel('Pilih pesantren').locator('option[value="42"]'),
  ).toHaveCount(1)
})

test('oversight editor requires traceable evidence and replaces both groups without issuance fields', async ({
  page,
}) => {
  await fixture(page, { ...profile, pengawasan: null }, 'satgas_kemenag')
  const writes = []
  await page.route(
    '**/api/admin/kemenag/ponpes/42/pengawasan',
    async (route) => {
      writes.push(route.request().postDataJSON())
      await route.fulfill({ json: profile })
    },
  )
  await page.goto('/admin?tab=pesantren')
  await expect(
    page.getByRole('button', { name: /Kelola IJOP|Aktifkan layanan/ }),
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Catat pengawasan', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Status dokumen').selectOption('terdaftar')
  await dialog.getByRole('button', { name: 'Simpan pengawasan' }).click()
  expect(
    await dialog
      .getByLabel('Nomor dokumen', { exact: true })
      .evaluate((input) => input.validity.valueMissing),
  ).toBe(true)
  expect(writes).toHaveLength(0)
  await dialog.getByLabel('Nomor statistik pada dokumen').fill('919000000001')
  await dialog.getByLabel('Nomor dokumen', { exact: true }).fill('DOK-UJI/01')
  await dialog.getByLabel('Penerbit dokumen').fill('Instansi pada dokumen')
  await dialog.getByLabel('Tanggal dokumen', { exact: true }).fill('2026-01-01')
  await dialog
    .getByLabel('Sumber dokumen', { exact: true })
    .fill('Arsip dokumen 01')
  await dialog.getByLabel('Tanggal pemeriksaan dokumen').fill('2099-01-01')
  await dialog.getByRole('button', { name: 'Simpan pengawasan' }).click()
  expect(
    await dialog
      .getByLabel('Tanggal pemeriksaan dokumen')
      .evaluate((input) => input.validity.rangeOverflow),
  ).toBe(true)
  expect(writes).toHaveLength(0)
  await dialog.getByLabel('Tanggal pemeriksaan dokumen').fill('2025-12-31')
  await dialog.getByRole('button', { name: 'Simpan pengawasan' }).click()
  expect(writes).toHaveLength(0)
  await dialog.getByLabel('Tanggal pemeriksaan dokumen').fill('2026-01-02')
  await dialog.getByRole('button', { name: 'Simpan pengawasan' }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toEqual([
    {
      status_dokumen: 'terdaftar',
      nomor_statistik: '919000000001',
      nomor_dokumen: 'DOK-UJI/01',
      penerbit_dokumen: 'Instansi pada dokumen',
      tanggal_dokumen: '2026-01-01',
      sumber_dokumen: 'Arsip dokumen 01',
      tanggal_pemeriksaan_dokumen: '2026-01-02',
      catatan_dokumen: null,
      status_operasional: 'belum_dikonfirmasi',
      sumber_operasional: null,
      tanggal_pemeriksaan_operasional: null,
      catatan_operasional: null,
    },
  ])
})

test('source entered for unconfirmed status still requires inspection date', async ({
  page,
}) => {
  await fixture(page, { ...profile, pengawasan: null }, 'satgas_kemenag')
  await page.goto('/admin?tab=pesantren')
  await page
    .getByRole('button', { name: 'Catat pengawasan', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByLabel('Sumber pemeriksaan operasional')
    .fill('Catatan awal kunjungan')
  await dialog.getByRole('button', { name: 'Simpan pengawasan' }).click()
  expect(
    await dialog
      .getByLabel('Tanggal pemeriksaan operasional')
      .evaluate((input) => input.validity.valueMissing),
  ).toBe(true)
})

test('owner controls registration independently of consultation and oversight', async ({
  page,
}) => {
  await fixture(page, profile, 'admin_ponpes')
  const writes = []
  await page.route('**/api/admin/ponpes/my/layanan', async (route) => {
    writes.push(route.request().postDataJSON())
    await route.fulfill({ json: { ...profile, pendaftaran_dibuka: true } })
  })
  await page.goto('/admin?tab=profil')
  await expect(
    page.getByRole('button', { name: 'Catat pengawasan' }),
  ).toHaveCount(0)
  await page.getByRole('switch', { name: 'Buka pendaftaran santri' }).check()
  await page.getByRole('button', { name: 'Simpan pengaturan layanan' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Pengaturan layanan tersimpan',
  )
  expect(writes).toEqual([
    { pendaftaran_dibuka: true, konsultasi_dibuka: false },
  ])
})

test('Satgas report filters use names and private detail exposes history and internal notes', async ({
  page,
}) => {
  await fixture(page, profile, 'satgas_kemenag')
  const row = {
    id: 81,
    ponpes_id: 42,
    nama_ponpes: profile.nama_ponpes,
    kategori_kasus: 'perundungan_bullying',
    status_tindakan: 'masuk_antrian',
    mode_pelapor: 'rahasia',
    created_at: '2026-01-04',
    lokasi_kejadian: 'Lokasi uji',
    deskripsi_peristiwa: 'Deskripsi terbatas Satgas',
  }
  let history = [
    {
      id: 1,
      status_sebelum: 'masuk_antrian',
      status_sesudah: 'penyelidikan_satgas',
      catatan_internal: 'Catatan khusus petugas',
      created_at: '2026-01-05',
    },
  ]
  const filters = [],
    writes = []
  await page.route('**/api/admin/pengaduan?*', async (route) => {
    filters.push(new URL(route.request().url()).searchParams)
    await route.fulfill({ json: { items: [row], total: 1 } })
  })
  await page.route('**/api/admin/pengaduan/81', (route) =>
    route.fulfill({ json: { ...row, riwayat: history } }),
  )
  await page.route('**/api/admin/pengaduan/81/status', async (route) => {
    writes.push(route.request().postDataJSON())
    row.status_tindakan = writes[0].status_tindakan
    history = [
      ...history,
      {
        id: 2,
        status_sebelum: 'masuk_antrian',
        status_sesudah: 'pendampingan',
        catatan_internal: writes[0].catatan_internal,
        created_at: '2026-01-06',
      },
    ]
    await route.fulfill({ json: row })
  })
  await page.goto('/admin?tab=pengaduan')
  await page.getByLabel('Filter status pengaduan').selectOption('masuk_antrian')
  await page.getByLabel('Filter pesantren').selectOption('42')
  await page.getByLabel('Cari nama pesantren').fill('Rujukan')
  await expect.poll(() => filters.at(-1)?.get('q')).toBe('Rujukan')
  expect(filters.at(-1).get('status')).toBe('masuk_antrian')
  expect(filters.at(-1).get('ponpes_id')).toBe('42')
  await page.locator('summary').filter({ hasText: 'Pondok Rujukan' }).click()
  await expect(
    page.getByText('Catatan khusus petugas', { exact: true }),
  ).toBeVisible()
  await page.getByLabel('Ubah status').selectOption('pendampingan')
  await page
    .getByLabel('Catatan internal', { exact: true })
    .fill('Hubungi pendamping yang ditugaskan')
  await page.getByRole('button', { name: 'Simpan', exact: true }).click()
  await expect(
    page.getByText('Hubungi pendamping yang ditugaskan', { exact: true }),
  ).toBeVisible()
  expect(writes).toEqual([
    {
      status_tindakan: 'pendampingan',
      catatan_internal: 'Hubungi pendamping yang ditugaskan',
    },
  ])
  await page.goto('/status-pesantren/pondok-rujukan')
  await expect(page.getByText('Catatan khusus petugas')).toHaveCount(0)
})

test('full registration quota is disclosed without offering a new application', async ({
  page,
}) => {
  await fixture(page, {
    ...profile,
    pendaftaran_dibuka: true,
    pendaftaran_tersedia: true,
    kuota_putra: 8,
    sisa_kuota_putra: 0,
    kuota_putri: 0,
    sisa_kuota_putri: 0,
  })
  await page.goto('/pesantren/pondok-rujukan')
  await expect(page.getByText('Kuota penuh', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Daftar ke pesantren ini/ }),
  ).toHaveCount(0)
  await expect(page.locator('.capacity-cards')).toContainText('/ 8')
  await page.goto('/daftar')
  await expect(
    page.getByLabel('Pilih pesantren').locator('option[value="42"]'),
  ).toHaveCount(0)
})

test('existing consultation stays readable when refetch reports service closure', async ({
  page,
}) => {
  await page.clock.install()
  await fixture(page, {
    ...profile,
    konsultasi_dibuka: true,
    konsultasi_tersedia: true,
  })
  let available = true
  await page.route('**/api/ponpes/pondok-rujukan', (route) =>
    route.fulfill({
      json: {
        ...profile,
        konsultasi_dibuka: available,
        konsultasi_tersedia: available,
      },
    }),
  )
  const message = {
    id: 1,
    session_id: 'existing-session',
    sender_role: 'warga',
    pesan: 'Percakapan yang harus tetap terbaca',
  }
  await page.route('**/api/chat/kirim', (route) =>
    route.fulfill({ json: message }),
  )
  await page.route('**/api/chat/42/existing-session?*', (route) =>
    route.fulfill({ json: { items: [message], next_after_id: 1 } }),
  )
  await page.goto('/pesantren/pondok-rujukan')
  await page.getByRole('button', { name: 'Tanya pengurus' }).click()
  await page.getByLabel('Nama Anda').fill('Wali uji')
  await page.getByLabel('Kontak / WhatsApp').fill('08123456789')
  await page.getByLabel('Pesan konsultasi').fill(message.pesan)
  await page.getByRole('button', { name: 'Kirim pesan' }).click()
  await expect(page.locator('.chat-messages')).toContainText(message.pesan)
  available = false
  await page.clock.fastForward(30000)
  await expect(
    page.getByText(
      'Konsultasi baru sedang ditutup. Riwayat percakapan tetap dapat dibaca.',
      { exact: true },
    ),
  ).toBeVisible()
  await expect(page.locator('.chat-messages')).toContainText(message.pesan)
  await expect(page.getByLabel('Pesan konsultasi')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Kirim pesan' })).toBeDisabled()
  await page.getByRole('button', { name: 'Tutup chat' }).click()
  await page.getByRole('button', { name: 'Lihat riwayat konsultasi' }).click()
  await expect(page.locator('.chat-messages')).toContainText(message.pesan)
})

test('recording a new profile leaves unknown facts empty and sends no permit fields', async ({
  page,
}) => {
  await fixture(page, profile, 'satgas_kemenag')
  let payload
  await page.route('**/api/admin/kemenag/ponpes', async (route) => {
    payload = route.request().postDataJSON()
    await route.fulfill({
      json: {
        email_admin: payload.email_admin,
        temporary_password: 'UniqueTemporaryPassword123!',
      },
    })
  })
  await page.goto('/admin?tab=tambah')
  await page
    .getByLabel('Nama pesantren', { exact: true })
    .fill('Pesantren baru dari sumber')
  await page.getByLabel('Kecamatan', { exact: true }).selectOption('1')
  await page.getByLabel('Alamat lengkap').fill('Alamat dari arsip lembaga')
  await page.getByLabel('Nama admin').fill('Pengurus uji')
  await page.getByLabel('Email admin').fill('pengurus@example.org')
  await page.getByLabel('Nomor HP admin').fill('08123456789')
  await page.getByRole('button', { name: 'Buat pesantren & akun' }).click()
  await expect(page.getByRole('dialog')).toContainText(
    'Kredensial admin pesantren',
  )
  expect(payload).toMatchObject({
    nspp: null,
    nama_pengasuh: null,
    tipe_pesantren: null,
    latitude: null,
    longitude: null,
    kontak_sekretariat: null,
    kuota_putra: 0,
    kuota_putri: 0,
  })
  expect(Object.keys(payload).some((key) => /ijop|pengawasan/.test(key))).toBe(
    false,
  )
})
