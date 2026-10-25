import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSaved, toggleSlug } from '../src/lib/discovery.js'

test('corrupt storage and unexpected values cannot break or pollute discovery', () => {
  assert.deepEqual(parseSaved('{broken'), [])
  assert.deepEqual(parseSaved('{"token":"secret"}'), [])
  assert.deepEqual(
    parseSaved(
      '["sunan-drajat","sunan-drajat",null,"../../admin",17,"al-maruf"]',
    ),
    ['sunan-drajat', 'al-maruf'],
  )
})
test('comparison is limited to three and removals remain possible when full', () => {
  const current = ['one', 'two', 'three']
  assert.deepEqual(toggleSlug(current, 'four', 3), {
    items: current,
    full: true,
  })
  assert.deepEqual(toggleSlug(current, 'two', 3), {
    items: ['one', 'three'],
    full: false,
  })
  assert.deepEqual(parseSaved('["one","two","three","four"]', 3), current)
})

test('legacy slugs from non-Latin institution names stay selectable', () => {
  assert.deepEqual(parseSaved('["-000000000099"]'), ['-000000000099'])
  assert.deepEqual(toggleSlug([], '-000000000099', 3), {
    items: ['-000000000099'],
    full: false,
  })
})
