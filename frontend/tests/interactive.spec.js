import { test, expect } from '@playwright/test'
const camera = (stage) =>
  stage.evaluate((el) => JSON.parse(el.dataset.cameraPosition || 'null'))
const target = (stage) =>
  stage.evaluate((el) => JSON.parse(el.dataset.cameraTarget || 'null'))
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]))

test('camera commands, object focus and fullscreen control a live scene', async ({
  page,
}) => {
  await page.goto('/')
  const stage = page.locator('.explorer-stage')
  await expect(stage).toHaveAttribute('data-renderer', 'webgl')
  await expect(
    page.getByRole('button', { name: 'Kampus pesantren', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Jeda animasi 3D' }).click()
  const initial = await camera(stage)
  await page.getByRole('button', { name: 'Putar kanan 3D' }).click()
  await expect
    .poll(async () => distance(await camera(stage), initial))
    .toBeGreaterThan(1)
  await page.getByRole('button', { name: 'Perbesar 3D' }).click()
  await page.getByRole('button', { name: 'Fokus ke asrama' }).click()
  await expect
    .poll(async () => distance(await target(stage), [2.15, 0.4, 1.55]))
    .toBeLessThan(0.05)
  await expect(page.locator('.explorer-info')).toContainText(
    'Kehidupan berasrama',
  )
  await page.getByRole('button', { name: 'Buka layar penuh 3D' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Jelajah 3D pesantren' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Peta Lamongan', exact: true }).click()
  await page.getByLabel('Jelajahi kecamatan').selectOption({ label: 'Paciran' })
  await expect(page.locator('.explorer-info')).toContainText('Paciran')
  await expect
    .poll(async () => distance(await target(stage), [1.35, 0.27, -2.7675]))
    .toBeLessThan(0.05)
})

for (const failure of ['unavailable', 'lost']) {
  test(`3D remains interactive when WebGL is ${failure}`, async ({ page }) => {
    test.setTimeout(90000)
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    if (failure === 'unavailable')
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          return type.startsWith('webgl')
            ? null
            : original.call(this, type, ...args)
        }
      })
    await page.goto('/')
    const stage = page.locator('.explorer-stage')
    if (failure === 'lost') {
      await expect(stage).toHaveAttribute('data-renderer', 'webgl')
      await stage
        .locator('canvas')
        .first()
        .evaluate((el) =>
          el.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
        )
    }
    await expect(stage).toHaveAttribute('data-renderer', 'svg')
    await expect(stage.locator('.explorer-tech')).toHaveText('3D COMPATIBLE')
    const svg = stage.locator('.compatible-scene svg')
    await expect(svg).toBeVisible()
    await expect.poll(() => svg.locator('path').count()).toBeGreaterThan(20)
    await page.getByRole('button', { name: 'Jeda animasi 3D' }).click()
    await expect.poll(() => camera(stage)).not.toBeNull()
    const initial = await camera(stage)
    const before = await svg.innerHTML()
    await page.getByRole('button', { name: 'Putar kanan 3D' }).click()
    await expect
      .poll(async () => distance(await camera(stage), initial))
      .toBeGreaterThan(1)
    await expect.poll(() => svg.innerHTML()).not.toBe(before)
    await page.waitForTimeout(900)
    const box = await svg.boundingBox(),
      start = await camera(stage)
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.4, {
      steps: 12,
    })
    await page.mouse.up()
    await expect
      .poll(async () => distance(await camera(stage), start))
      .toBeGreaterThan(1)
    await page.getByRole('button', { name: 'Reset tampilan 3D' }).click()
    await page
      .getByRole('button', { name: 'Fokus ke masjid' })
      .click({ timeout: 10000 })
    await expect
      .poll(async () => distance(await target(stage), [0, 0.6, -0.55]))
      .toBeLessThan(0.05)
    const priorZoom = distance(await camera(stage), await target(stage))
    await page.getByRole('button', { name: 'Perbesar 3D' }).click()
    await expect
      .poll(async () => distance(await camera(stage), await target(stage)))
      .toBeLessThan(priorZoom * 0.9)
    await page.getByRole('button', { name: 'Asrama', exact: true }).click()
    await expect
      .poll(async () => distance(await target(stage), [2.15, 0.4, 1.55]))
      .toBeLessThan(0.05)
    await page.getByRole('button', { name: 'Buka layar penuh 3D' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await page
      .getByRole('button', { name: 'Peta Lamongan', exact: true })
      .click()
    await expect
      .poll(async () => distance(await target(stage), [0, 0.2, 0]))
      .toBeLessThan(0.05)
    await page.waitForTimeout(500)
    const { PerspectiveCamera, Vector3 } = await import('three')
    const bounds = await svg.boundingBox()
    const view = new PerspectiveCamera(
      38,
      bounds.width / bounds.height,
      0.1,
      1000,
    )
    view.position.set(...(await camera(stage)))
    view.lookAt(...(await target(stage)))
    view.updateMatrixWorld()
    const p = new Vector3(1.35, 0.67, -2.7675).project(view)
    const x = bounds.x + ((p.x + 1) * bounds.width) / 2,
      y = bounds.y + ((1 - p.y) * bounds.height) / 2
    await page.mouse.move(x, y)
    await expect(stage.locator('.world-tooltip')).toContainText('Paciran')
    await page.mouse.click(x, y)
    await expect
      .poll(async () => distance(await target(stage), [1.35, 0.27, -2.7675]))
      .toBeLessThan(0.05)
    await expect(
      page.getByRole('link', { name: 'Jelajahi pesantren Paciran' }),
    ).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('hover and direct mesh clicks select a building and district pin', async ({
  page,
}) => {
  const { PerspectiveCamera, Vector3 } = await import('three')
  await page.goto('/')
  const stage = page.locator('.explorer-stage'),
    canvas = stage.locator('canvas').first()
  await expect(stage).toHaveAttribute('data-renderer', 'webgl')
  await page.getByRole('button', { name: 'Jeda animasi 3D' }).click()
  await expect.poll(async () => await camera(stage)).not.toBeNull()
  async function point(world) {
    const box = await canvas.boundingBox(),
      position = await camera(stage),
      lookAt = await target(stage)
    const view = new PerspectiveCamera(38, box.width / box.height, 0.1, 1000)
    view.position.set(...position)
    view.lookAt(...lookAt)
    view.updateMatrixWorld()
    const projected = new Vector3(...world).project(view)
    return {
      x: box.x + ((projected.x + 1) * box.width) / 2,
      y: box.y + ((1 - projected.y) * box.height) / 2,
    }
  }
  await page.waitForTimeout(1100)
  let screen = await point([0, 1.25, -0.55])
  expect(
    await page.evaluate(
      (p) => document.elementFromPoint(p.x, p.y).tagName,
      screen,
    ),
  ).toBe('CANVAS')
  await page.mouse.click(screen.x, screen.y)
  await expect(page.locator('.explorer-info')).toContainText(
    'Masjid & ruang ibadah',
  )
  await expect
    .poll(async () => distance(await target(stage), [0, 0.6, -0.55]))
    .toBeLessThan(0.05)
  await page.getByRole('button', { name: 'Peta Lamongan', exact: true }).click()
  await expect
    .poll(async () => distance(await target(stage), [0, 0.2, 0]))
    .toBeLessThan(0.05)
  screen = await point([1.35, 0.67, -2.7675])
  await page.mouse.move(screen.x, screen.y)
  await expect(page.locator('.world-tooltip')).toContainText('Paciran')
  await page.mouse.click(screen.x, screen.y)
  await expect(page.locator('.explorer-info')).toContainText('Paciran')
  await expect
    .poll(async () => distance(await target(stage), [1.35, 0.27, -2.7675]))
    .toBeLessThan(0.05)
})

test('fullscreen controls stay reachable on a short landscape screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 360 })
  await page.goto('/')
  await expect(page.locator('.explorer-stage')).toHaveAttribute(
    'data-renderer',
    'webgl',
  )
  await page.getByRole('button', { name: 'Buka layar penuh 3D' }).click()
  for (const button of await page.locator('.explorer-controls button').all()) {
    expect(
      await button.evaluate((el) => {
        const r = el.getBoundingClientRect()
        return (
          r.top >= 0 &&
          r.bottom <= innerHeight &&
          el.contains(
            document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
          )
        )
      }),
    ).toBe(true)
  }
  await page.keyboard.press('Escape')
})

test('each classroom and dormitory focuses the building actually clicked', async ({
  page,
}) => {
  const { PerspectiveCamera, Vector3 } = await import('three')
  await page.goto('/')
  const stage = page.locator('.explorer-stage'),
    canvas = stage.locator('canvas').first()
  await expect(stage).toHaveAttribute('data-renderer', 'webgl')
  await page.getByRole('button', { name: 'Jeda animasi 3D' }).click()
  for (const [world, expected] of [
    [
      [2.2, 0.85, -0.5],
      [2.2, 0.4, -0.5],
    ],
    [
      [-2.15, 0.85, 1.55],
      [-2.15, 0.4, 1.55],
    ],
  ]) {
    await page.getByRole('button', { name: 'Reset tampilan 3D' }).click()
    await expect
      .poll(async () => distance(await target(stage), [0, 0.4, 0]))
      .toBeLessThan(0.01)
    await page.waitForTimeout(600)
    const box = await canvas.boundingBox(),
      view = new PerspectiveCamera(38, box.width / box.height, 0.1, 1000)
    view.position.set(...(await camera(stage)))
    view.lookAt(...(await target(stage)))
    view.updateMatrixWorld()
    const p = new Vector3(...world).project(view)
    await page.mouse.click(
      box.x + ((p.x + 1) * box.width) / 2,
      box.y + ((1 - p.y) * box.height) / 2,
    )
    await expect
      .poll(async () => distance(await target(stage), expected))
      .toBeLessThan(0.05)
  }
})
