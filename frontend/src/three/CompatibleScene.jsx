import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { compatibleModel } from './compatibleModel'
import { cameraView, overview } from './cameraModel'

export function CompatibleScene(props) {
  const host = useRef(null),
    engine = useRef(null),
    latest = useRef(props)
  latest.current = props
  const { mode, districts, command, reduced } = props
  useEffect(() => {
    const container = host.current
    const { scene, markers } = compatibleModel(mode, districts)
    const renderer = new SVGRenderer()
    renderer.setPrecision(2)
    const svg = renderer.domElement
    svg.setAttribute('role', 'img')
    svg.setAttribute(
      'aria-label',
      'Jelajah 3D interaktif: geser untuk memutar dan gulir untuk memperbesar',
    )
    container.appendChild(svg)
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000)
    const initial = overview(mode)
    camera.position.set(...initial.position)
    const controls = new OrbitControls(camera, svg)
    controls.target.set(...initial.target)
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.075
    controls.minDistance = 2.8
    controls.maxDistance = 24
    controls.minPolarAngle = 0.25
    controls.maxPolarAngle = Math.PI / 2.12
    controls.autoRotateSpeed = 0.45
    controls.update()
    const state = { camera, controls, motion: null, dirty: true }
    engine.current = state
    let hovered = null,
      down = null,
      moved = false,
      frame,
      last = 0,
      visible = true,
      ready = false
    const activePointers = new Set()
    const raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2()
    const hit = (e) => {
      const bounds = svg.getBoundingClientRect()
      pointer.set(
        ((e.clientX - bounds.left) / bounds.width) * 2 - 1,
        1 - ((e.clientY - bounds.top) / bounds.height) * 2,
      )
      raycaster.setFromCamera(pointer, camera)
      const first = raycaster.intersectObjects(scene.children, true)[0]
      let object = first?.object
      while (object && !object.userData.type) object = object.parent
      return object?.userData || null
    }
    const setHover = (item) => {
      const id = item?.type === 'district' ? item.id : null
      if (id !== hovered) {
        hovered = id
        latest.current.onDistrictHover?.(id)
        state.dirty = true
      }
      svg.style.cursor = item ? 'pointer' : 'grab'
    }
    const onStart = () => {
      state.motion = null
      latest.current.onManualChange?.()
    }
    const onDown = (e) => {
      activePointers.add(e.pointerId)
      if (activePointers.size > 1) moved = true
      else {
        down = { x: e.clientX, y: e.clientY }
        moved = false
      }
    }
    const onMove = (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5)
        moved = true
      if (!down) setHover(hit(e))
    }
    const onUp = (e) => {
      activePointers.delete(e.pointerId)
      if (down && !moved && e.button === 0) {
        const item = hit(e)
        if (item?.type === 'campus')
          latest.current.onCampusSelect?.(item.id, item.target)
        if (item?.type === 'district')
          latest.current.onChoose?.(item.id, item.target)
      }
      if (!activePointers.size) down = null
    }
    const onCancel = (e) => {
      activePointers.delete(e.pointerId)
      moved = true
      down = null
    }
    const onLeave = () => setHover(null)
    controls.addEventListener('start', onStart)
    svg.addEventListener('pointerdown', onDown)
    svg.addEventListener('pointermove', onMove)
    svg.addEventListener('pointerup', onUp)
    svg.addEventListener('pointercancel', onCancel)
    svg.addEventListener('pointerleave', onLeave)
    const resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      state.dirty = true
    })
    resize.observe(container)
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    visibility.observe(container)
    const project = new THREE.Vector3()
    const draw = (now) => {
      frame = requestAnimationFrame(draw)
      if (!visible || document.hidden || now - last < 33) return
      const delta = Math.min((now - last) / 1000, 0.1)
      last = now
      controls.autoRotate =
        !latest.current.paused && !latest.current.reduced && !state.motion
      if (state.motion) {
        const alpha = 1 - Math.exp(-delta * 5)
        camera.position.lerp(state.motion.position, alpha)
        controls.target.lerp(state.motion.target, alpha)
        if (
          camera.position.distanceTo(state.motion.position) < 0.005 &&
          controls.target.distanceTo(state.motion.target) < 0.005
        )
          state.motion = null
        state.dirty = true
      }
      if (controls.update(delta)) state.dirty = true
      const current = latest.current
      markers.forEach(({ id, object, color }) => {
        const active = id === current.selected || id === hovered
        const scale = active ? 1.5 : 1
        if (object.scale.x !== scale) {
          object.scale.setScalar(scale)
          object.material.color.copy(
            active ? new THREE.Color('#ffdfa4') : color,
          )
          state.dirty = true
        }
      })
      if (state.dirty) {
        renderer.render(scene, camera)
        // SVGRenderer writes a solid background; the stage supplies the backdrop.
        svg.style.backgroundColor = 'transparent'
        state.dirty = false
        if (!ready) {
          ready = true
          current.onRenderState?.('svg')
        }
      }
      const stage = current.stageRef?.current
      if (!stage) return
      stage.dataset.cameraPosition = JSON.stringify(
        camera.position.toArray().map((v) => +v.toFixed(3)),
      )
      stage.dataset.cameraTarget = JSON.stringify(
        controls.target.toArray().map((v) => +v.toFixed(3)),
      )
      const box = svg.getBoundingClientRect(),
        stageBox = stage.getBoundingClientRect()
      for (const element of stage.querySelectorAll('[data-world-point]')) {
        project
          .set(...element.dataset.worldPoint.split(',').map(Number))
          .project(camera)
        element.style.visibility =
          project.z > -1 &&
          project.z < 1 &&
          Math.abs(project.x) < 1 &&
          Math.abs(project.y) < 1
            ? 'visible'
            : 'hidden'
        element.style.transform = `translate3d(${Math.round(box.left - stageBox.left + ((project.x + 1) * box.width) / 2)}px,${Math.round(box.top - stageBox.top + ((1 - project.y) * box.height) / 2)}px,0) translate(-50%,-50%)`
      }
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      visibility.disconnect()
      controls.removeEventListener('start', onStart)
      controls.dispose()
      svg.removeEventListener('pointerdown', onDown)
      svg.removeEventListener('pointermove', onMove)
      svg.removeEventListener('pointerup', onUp)
      svg.removeEventListener('pointercancel', onCancel)
      svg.removeEventListener('pointerleave', onLeave)
      svg.remove()
      scene.traverse((object) => {
        object.geometry?.dispose()
        object.material?.dispose()
      })
      if (engine.current === state) engine.current = null
    }
  }, [mode, districts])
  useEffect(() => {
    const state = engine.current
    if (!state) return
    const view = cameraView(
      command?.kind || 'overview',
      state.camera.position.toArray(),
      state.controls.target.toArray(),
      command?.target,
      mode,
    )
    if (reduced) {
      state.camera.position.set(...view.position)
      state.controls.target.set(...view.target)
      state.controls.update()
      state.dirty = true
      state.motion = null
    } else
      state.motion = {
        position: new THREE.Vector3(...view.position),
        target: new THREE.Vector3(...view.target),
      }
  }, [command, mode, reduced, districts])
  return (
    <div ref={host} className="canvas-frame explorer-canvas compatible-scene" />
  )
}
