import test from 'node:test'
import assert from 'node:assert/strict'
import { cameraView, overview } from '../src/three/cameraModel.js'
test('rotation moves position around its current target and preserves distance', () => {
  const position = [7, 7, 9],
    target = [0, 0.4, 0],
    next = cameraView('right', position, target)
  assert.notDeepEqual(next.position, position)
  assert.deepEqual(next.target, target)
  const distance = (p, t) => Math.hypot(...p.map((v, i) => v - t[i]))
  assert.ok(
    Math.abs(distance(position, target) - distance(next.position, target)) <
      1e-9,
  )
})
test('focus targets the selected object and zoom remains within useful bounds', () => {
  assert.deepEqual(
    cameraView('focus', [7, 7, 9], [0, 0, 0], [2.15, 0.4, 1.55]).target,
    [2.15, 0.4, 1.55],
  )
  const zoom = cameraView('in', [0, 3, 0], [0, 0, 0])
  assert.ok(Math.abs(zoom.position[1] - 2.8) < 1e-9)
  assert.deepEqual(
    cameraView('overview', [1, 1, 1], [1, 1, 1], null, 'campus'),
    overview('campus'),
  )
})
