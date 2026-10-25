import * as THREE from 'three'
import { DISTRICT_POINTS } from './cameraModel'
import { REGION_OUTLINE } from './regionModel'

// A low-polygon counterpart of the WebGL diorama for SVGRenderer.
// Shared world positions keep selection and camera focus consistent.
export function compatibleModel(mode, districts) {
  const scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight('#b6c3b5'))
  const light = new THREE.DirectionalLight('#fff1d0', 0.7)
  light.position.set(4, 9, 5)
  scene.add(light)
  const mesh = (parent, geometry, color, position = [0, 0, 0]) => {
    const material = new THREE.MeshLambertMaterial({ color })
    const object = new THREE.Mesh(geometry, material)
    object.position.set(...position)
    parent.add(object)
    return object
  }
  const box = (parent, size, position, color) =>
    mesh(
      parent,
      new THREE.BoxGeometry(
        ...size,
        size[0] > 4 ? 16 : 1,
        1,
        size[2] > 4 ? 12 : 1,
      ),
      color,
      position,
    )
  const selectable = (id, type, target) => {
    const group = new THREE.Group()
    group.userData = { id, type, target }
    scene.add(group)
    return group
  }
  const markers = []
  if (mode === 'region') {
    const shape = new THREE.Shape()
    REGION_OUTLINE.forEach(([x, y], i) =>
      i ? shape.lineTo(x * 1.35, y * 1.35) : shape.moveTo(x * 1.35, y * 1.35),
    )
    shape.closePath()
    for (let i = 2; i >= 0; i--) {
      const layer = mesh(
        scene,
        new THREE.ExtrudeGeometry(shape, {
          depth: 0.18,
          bevelEnabled: false,
        }),
        ['#b8d1bd', '#65927c', '#254d42'][i],
        [0, -i * 0.2, 0],
      )
      layer.rotation.x = -Math.PI / 2
      layer.scale.setScalar(1 + i * 0.022)
    }
    districts.forEach((d, i) => {
      const [x, z] = DISTRICT_POINTS[i % 27]
      const target = [x * 1.35, 0.27, -z * 1.35]
      const pin = selectable(d.kecamatan_id || d.id, 'district', target)
      pin.position.set(...target)
      mesh(
        pin,
        new THREE.CylinderGeometry(0.02, 0.024, 0.36, 6),
        '#3a775e',
        [0, 0.18, 0],
      )
      const head = mesh(
        pin,
        new THREE.IcosahedronGeometry(0.095, 0),
        d.jumlah_ponpes ? '#edd28c' : '#448a6b',
        [0, 0.4, 0],
      )
      markers.push({
        id: pin.userData.id,
        object: head,
        color: head.material.color.clone(),
      })
      const hit = mesh(
        pin,
        new THREE.SphereGeometry(0.22, 8, 6),
        '#ffffff',
        [0, 0.4, 0],
      )
      hit.material.transparent = true
      hit.material.opacity = 0
      const ring = mesh(pin, new THREE.RingGeometry(0.13, 0.155, 12), '#d7dec2')
      ring.rotation.x = -Math.PI / 2
    })
    mesh(
      scene,
      new THREE.CylinderGeometry(0.16, 0.23, 0.32, 6),
      '#e7c674',
      [1.35, 0.3, 0],
    )
  } else {
    box(scene, [8.1, 0.12, 5.7], [0, -0.34, 0], '#345747')
    box(scene, [8, 0.3, 5.6], [0, -0.15, 0], '#93aa7d')
    box(scene, [1.7, 0.025, 1.2], [0, 0.015, 1.3], '#d8d0b6')
    box(scene, [0.8, 0.025, 1.4], [0, 0.015, 2.15], '#e6debf')
    box(scene, [0.7, 0.06, 0.7], [0, 0.04, 1.32], '#577e69')
    const water = mesh(
      scene,
      new THREE.CircleGeometry(0.29, 12),
      '#6cbcb1',
      [0, 0.083, 1.32],
    )
    water.rotation.x = -Math.PI / 2
    const mosque = selectable('masjid', 'campus', [0, 0.6, -0.55])
    mosque.position.z = -0.55
    box(mosque, [1.8, 0.14, 1.6], [0, 0.07, 0], '#cec8ad')
    box(mosque, [1.5, 0.8, 1.3], [0, 0.47, 0], '#f3ecda')
    box(mosque, [1.7, 0.12, 1.48], [0, 0.9, 0], '#23604b')
    mesh(
      mosque,
      new THREE.SphereGeometry(0.53, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      '#cbae65',
      [0, 0.96, 0],
    )
    mesh(mosque, new THREE.SphereGeometry(0.045, 6, 4), '#e8c779', [0, 1.58, 0])
    box(mosque, [0.3, 0.46, 0.025], [0, 0.3, 0.66], '#285d4b')
    box(mosque, [1.7, 0.1, 0.45], [0, 0.05, 1.04], '#e5ddc1')
    for (const x of [-0.93, 0.93]) {
      box(mosque, [0.24, 1.45, 0.24], [x, 0.74, -0.48], '#e6e0ca')
      box(mosque, [0.34, 0.12, 0.34], [x, 1.32, -0.48], '#cfb168')
      mesh(mosque, new THREE.ConeGeometry(0.22, 0.4, 8), '#245f49', [
        x,
        1.6,
        -0.48,
      ])
      mesh(mosque, new THREE.SphereGeometry(0.04, 6, 4), '#d9b870', [
        x,
        1.87,
        -0.48,
      ])
    }
    for (const [id, x, z, rotation] of [
      ['belajar', -2.2, -0.5, Math.PI / 2],
      ['belajar', 2.2, -0.5, -Math.PI / 2],
      ['asrama', -2.15, 1.55, 0],
      ['asrama', 2.15, 1.55, 0],
    ]) {
      const school = selectable(id, 'campus', [x, 0.4, z])
      school.position.set(x, 0, z)
      school.rotation.y = rotation
      box(school, [1.6, 0.75, 0.72], [0, 0.38, 0], '#eee7d3')
      box(school, [1.8, 0.09, 0.88], [0, 0.82, 0], '#285c49')
      box(school, [1.6, 0.045, 0.74], [0, 0.88, 0], '#55826a')
      box(school, [1.9, 0.15, 0.23], [0, 0.18, -0.42], '#c3beaa')
      for (const wx of [-0.6, -0.3, 0, 0.3, 0.6]) {
        box(school, [0.16, 0.22, 0.025], [wx, 0.51, 0.365], '#28594d')
        box(school, [0.16, 0.18, 0.025], [wx, 0.18, 0.365], '#466f62')
      }
    }
    const trees = [...Array(11)]
      .flatMap((_, i) => [
        [-3.55, -2.2 + i * 0.43],
        [3.55, -2.2 + i * 0.43],
      ])
      .concat([...Array(8)].map((_, i) => [-2.8 + i * 0.8, -2.45]))
    trees.forEach(([x, z]) => {
      mesh(scene, new THREE.CylinderGeometry(0.035, 0.05, 0.5, 5), '#776752', [
        x,
        0.24,
        z,
      ])
      mesh(scene, new THREE.IcosahedronGeometry(0.28, 0), '#527e56', [
        x,
        0.55,
        z,
      ])
      mesh(scene, new THREE.IcosahedronGeometry(0.23, 0), '#86a76d', [
        x + 0.08,
        0.75,
        z,
      ])
    })
  }
  return { scene, markers }
}
