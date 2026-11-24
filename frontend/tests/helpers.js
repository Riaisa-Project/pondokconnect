import { expect } from '@playwright/test'

// Kredensial akun demo diambil dari API (hanya dikirim saat mode demo) supaya
// spec tidak menyimpan password. Vite memproksi /api ke server uji.
export async function demoLogin(page, role) {
  const response = await page.request.get('/api/system/features')
  const features = await response.json()
  const account = (features.demo_accounts ?? []).find(
    (item) => item.role === role,
  )
  if (!account) {
    throw new Error(
      `Akun demo ${role} tidak tersedia: ${JSON.stringify(features)}`,
    )
  }
  await page.goto('/masuk')
  await page.getByLabel('Email pengelola').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Masuk ke portal' }).click()
  await expect(page).toHaveURL(/\/(admin|ganti-password)/)
  return account
}
