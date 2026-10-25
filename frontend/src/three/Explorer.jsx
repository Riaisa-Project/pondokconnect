import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Line, Edges, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { SafeScene } from './Scenes'
import { Campus } from './Campus'
import { CompatibleScene } from './CompatibleScene'
import { REGION_OUTLINE as outline } from './regionModel'
import { cameraView, overview, DISTRICT_POINTS as points } from './cameraModel'
import { useReducedMotion } from '../lib/hooks'

function Arc({ point, index, animate }) {
  const particles = useRef([])
  const curve = useMemo(
    () =>
      new THREE.CubicBezierCurve3(
        new THREE.Vector3(point[0] * 1.35, 0.32, -point[1] * 1.35),
        new THREE.Vector3(point[0] * 0.8, 1.6, -point[1]),
        new THREE.Vector3(0.9, 1.7, 0),
        new THREE.Vector3(1.35, 0.32, 0),
      ),
    [point],
  )
  useFrame(({ clock }) => {
    if (animate)
      particles.current.forEach((p, j) =>
        p?.position.copy(
          curve.getPoint(
            (clock.elapsedTime * 0.1 + index * 0.11 + j * 0.33) % 1,
          ),
        ),
      )
  })
  return (
    <>
      <Line
        points={curve.getPoints(45)}
        color="#f0d8a0"
        lineWidth={1.2}
        transparent
        opacity={0.45}
      />
      {[0, 1, 2].map((j) => (
        <mesh
          ref={(el) => (particles.current[j] = el)}
          key={j}
          position={curve.getPoint((index * 0.11 + j * 0.33) % 1)}
        >
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color="#ffe7a4" toneMapped={false} />
        </mesh>
      ))}
    </>
  )
}
function Region({ districts, selected, onChoose, animate, onHover }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape()
    outline.forEach(([x, y], i) =>
      i ? s.lineTo(x * 1.35, y * 1.35) : s.moveTo(x * 1.35, y * 1.35),
    )
    s.closePath()
    return s
  }, [])
  const [hover, setHover] = useState(null)
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -i * 0.2, 0]}
          scale={1 + i * 0.022}
          castShadow
          receiveShadow
        >
          <extrudeGeometry
            args={[
              shape,
              {
                depth: 0.18,
                bevelEnabled: true,
                bevelSegments: 3,
                bevelSize: 0.08,
                bevelThickness: 0.05,
                steps: 1,
              },
            ]}
          />
          <meshPhysicalMaterial
            color={['#b8d1bd', '#65927c', '#254d42'][i]}
            roughness={i === 0 ? 0.25 : 0.55}
            metalness={0.18}
            clearcoat={i === 0 ? 1 : 0.2}
            clearcoatRoughness={0.2}
          />
          <Edges color={i === 0 ? '#e6ead1' : '#7ba28a'} threshold={30} />
        </mesh>
      ))}
      {[0.36, 0.57, 0.78].map((scale) => (
        <Line
          key={scale}
          points={[...outline, outline[0]].map(([x, z]) => [
            x * scale * 1.35,
            0.23,
            -z * scale * 1.35,
          ])}
          color="#e4ead1"
          transparent
          opacity={0.55}
          lineWidth={1}
        />
      ))}
      {points
        .filter((_, i) => i % 4 === 0)
        .map((p, i) => (
          <Arc point={p} index={i} animate={animate} key={i} />
        ))}
      {districts.map((d, i) => {
        const id = d.kecamatan_id || d.id,
          [x, z] = points[i % 27],
          active = selected === id || hover === id
        return (
          <group
            key={id}
            position={[x * 1.35, 0.27, -z * 1.35]}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHover(id)
              onHover?.(id)
            }}
            onPointerOut={() => {
              setHover(null)
              onHover?.(null)
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (e.delta <= 5) onChoose(id, [x * 1.35, 0.27, -z * 1.35])
            }}
          >
            <mesh position={[0, 0.4, 0]}>
              <sphereGeometry args={[0.22, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            <mesh position={[0, 0.18, 0]}>
              <cylinderGeometry args={[0.02, 0.024, 0.36, 8]} />
              <meshStandardMaterial color="#3a775e" />
            </mesh>
            <mesh position={[0, 0.4, 0]} scale={active ? 1.5 : 1}>
              <icosahedronGeometry args={[0.095, 1]} />
              <meshStandardMaterial
                color={active || d.jumlah_ponpes ? '#edd28c' : '#448a6b'}
                emissive={active ? '#f4d181' : '#2f8a62'}
                emissiveIntensity={active ? 1.4 : 0.35}
                roughness={0.22}
                metalness={0.45}
              />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry
                args={[active ? 0.2 : 0.13, active ? 0.23 : 0.155, 32]}
              />
              <meshBasicMaterial
                color={active ? '#ffdfa4' : '#cadfc0'}
                transparent
                opacity={0.8}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        )
      })}
      <mesh position={[1.35, 0.3, 0]}>
        <cylinderGeometry args={[0.16, 0.23, 0.32, 6]} />
        <meshStandardMaterial color="#e7c674" metalness={0.4} roughness={0.2} />
      </mesh>
    </group>
  )
}
function Controls({
  paused,
  reduced,
  mode,
  command,
  stageRef,
  onManualChange,
}) {
  const ref = useRef(),
    { camera, gl } = useThree()
  const motion = useRef(null),
    tick = useRef(0)
  useEffect(() => {
    const currentTarget = ref.current?.target.toArray() || [0, 0, 0]
    const view = cameraView(
      command?.kind || 'overview',
      camera.position.toArray(),
      currentTarget,
      command?.target,
      mode,
    )
    motion.current = {
      position: new THREE.Vector3(...view.position),
      target: new THREE.Vector3(...view.target),
    }
    if (reduced) {
      camera.position.copy(motion.current.position)
      ref.current?.target.copy(motion.current.target)
      ref.current?.update()
      motion.current = null
    }
  }, [command, mode, reduced, camera])
  useFrame((_, delta) => {
    if (ref.current)
      ref.current.autoRotate = !paused && !reduced && !motion.current
    if (motion.current && ref.current) {
      const alpha = 1 - Math.exp(-Math.min(delta, 0.1) * 5)
      camera.position.lerp(motion.current.position, alpha)
      ref.current.target.lerp(motion.current.target, alpha)
      ref.current.update()
      if (
        camera.position.distanceTo(motion.current.position) < 0.005 &&
        ref.current.target.distanceTo(motion.current.target) < 0.005
      )
        motion.current = null
    }
    const host = stageRef?.current
    if (host) {
      const canvasBox = gl.domElement.getBoundingClientRect(),
        hostBox = host.getBoundingClientRect()
      for (const element of host.querySelectorAll('[data-world-point]')) {
        const point = new THREE.Vector3(
          ...element.dataset.worldPoint.split(',').map(Number),
        ).project(camera)
        const visible =
          point.z > -1 &&
          point.z < 1 &&
          Math.abs(point.x) < 1 &&
          Math.abs(point.y) < 1
        element.style.visibility = visible ? 'visible' : 'hidden'
        element.style.transform = `translate3d(${canvasBox.left - hostBox.left + ((point.x + 1) * canvasBox.width) / 2}px,${canvasBox.top - hostBox.top + ((1 - point.y) * canvasBox.height) / 2}px,0) translate(-50%,-50%)`
      }
    }
    if (stageRef?.current && ref.current && ++tick.current % 5 === 0) {
      stageRef.current.dataset.cameraPosition = JSON.stringify(
        camera.position.toArray().map((v) => +v.toFixed(3)),
      )
      stageRef.current.dataset.cameraTarget = JSON.stringify(
        ref.current.target.toArray().map((v) => +v.toFixed(3)),
      )
    }
  })
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enablePan={false}
      minDistance={2.8}
      maxDistance={24}
      minPolarAngle={0.25}
      maxPolarAngle={Math.PI / 2.12}
      autoRotate={!paused && !reduced}
      autoRotateSpeed={0.45}
      enableDamping
      dampingFactor={0.075}
      onStart={() => {
        motion.current = null
        onManualChange?.()
      }}
    />
  )
}
export function DigitalTwin({
  districts = [],
  selected,
  onChoose,
  mode = 'campus',
  paused = false,
  command,
  stageRef,
  onManualChange,
  onRenderState,
  onDistrictHover,
  campusSelected = null,
  onCampusSelect = () => {},
}) {
  const reduced = useReducedMotion()
  const cameraConfig = useMemo(
    () => ({ position: overview('campus').position, fov: 38 }),
    [],
  )
  const webglState = useCallback(
    (state) => {
      if (state === 'webgl') onRenderState?.(state)
    },
    [onRenderState],
  )
  const fallback = (
    <CompatibleScene
      districts={districts}
      selected={selected}
      onChoose={onChoose}
      mode={mode}
      paused={paused}
      command={command}
      stageRef={stageRef}
      onManualChange={onManualChange}
      onRenderState={onRenderState}
      onDistrictHover={onDistrictHover}
      campusSelected={campusSelected}
      onCampusSelect={onCampusSelect}
      reduced={reduced}
    />
  )
  return (
    <SafeScene
      shadows
      onRenderState={webglState}
      camera={cameraConfig}
      fallback={fallback}
      className="explorer-canvas"
    >
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#eff7ed', '#164139', 1.3]} />
      <directionalLight
        position={[4, 9, 5]}
        intensity={3.5}
        color="#fff3d5"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.001}
      />
      <directionalLight
        position={[-5, 3, -3]}
        intensity={1.8}
        color="#98e5d3"
      />
      {mode === 'campus' ? (
        <Campus onSelect={onCampusSelect} selected={campusSelected} />
      ) : (
        <Region
          districts={districts}
          selected={selected}
          onChoose={onChoose}
          animate={!paused && !reduced}
          onHover={onDistrictHover}
        />
      )}
      <ContactShadows
        key={mode}
        position={[0, -0.68, 0]}
        opacity={0.35}
        scale={18}
        blur={2.5}
        far={5}
        frames={1}
      />
      <Controls
        paused={paused}
        reduced={reduced}
        mode={mode}
        command={command}
        stageRef={stageRef}
        onManualChange={onManualChange}
      />
    </SafeScene>
  )
}
