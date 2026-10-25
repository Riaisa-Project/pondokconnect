import test from 'node:test'
import assert from 'node:assert/strict'
import { date, validatePassword } from '../src/lib/format.js'

test('password validation uses UTF-8 bytes and rejects mismatched confirmation', () => {
  assert.throws(
    () =>
      validatePassword({
        old_password: 'old',
        new_password: '🔒'.repeat(20),
        confirm_password: '🔒'.repeat(20),
      }),
    /72 byte/,
  )
  assert.throws(
    () =>
      validatePassword({
        old_password: 'old',
        new_password: 'ValidPassword123!',
        confirm_password: 'different',
      }),
    /tidak sama/,
  )
  assert.throws(
    () =>
      validatePassword({
        old_password: 'ValidPassword123!',
        new_password: 'ValidPassword123!',
        confirm_password: 'ValidPassword123!',
      }),
    /berbeda/,
  )
  assert.equal(
    validatePassword({
      old_password: 'old',
      new_password: 'ValidPassword123!',
      confirm_password: 'ValidPassword123!',
    }).new_password,
    'ValidPassword123!',
  )
})
test('date-only oversight checks retain their calendar day', () => {
  assert.match(date('2026-10-13'), /^13 Oktober 2026$/)
  assert.equal(date(null), 'Belum tersedia')
})
