import {
  Component,
  Suspense,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Edges, Line } from '@react-three/drei'
import * as THREE from 'three'
import { useReducedMotion } from '../lib/hooks'

class SceneBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onFailure?.()
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
let supported
function supportsWebGL() {
  if (supported !== undefined) return supported
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    supported = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    supported = false
  }
  return supported
}
export function SafeScene({
  children,
  fallback,
  camera,
  className = '',
  shadows = false,
  onRenderState,
}) {
  const available = supportsWebGL()
  const [lost, setLost] = useState(false)
  const host = useRef(null)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    )
    if (host.current) observer.observe(host.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!available || lost) onRenderState?.('fallback')
  }, [available, lost, onRenderState])
  if (!available || lost) return fallback
  return (
    <SceneBoundary
      fallback={fallback}
      onFailure={() => onRenderState?.('fallback')}
    >
      <div ref={host} className={`canvas-frame ${className}`}>
        <Canvas
          dpr={[1, 1.5]}
          shadows={shadows ? { type: THREE.PCFShadowMap } : false}
          frameloop={visible ? 'always' : 'demand'}
          camera={camera}
          onCreated={() => onRenderState?.('webgl')}
          gl={{ antialias: true, alpha: true }}
          fallback={null}
        >
          <ContextWatcher onLost={() => setLost(true)} />
          <Suspense fallback={null}>{children}</Suspense>
        </Canvas>
      </div>
    </SceneBoundary>
  )
}
function ContextWatcher({ onLost }) {
  const { gl } = useThree()
  useEffect(() => {
    const canvas = gl.domElement
    const handle = (event) => {
      event.preventDefault()
      onLost()
    }
    canvas.addEventListener('webglcontextlost', handle)
    return () => canvas.removeEventListener('webglcontextlost', handle)
  }, [gl, onLost])
  return null
}
function VaultScene({ locked, reduced }) {
  const core = useRef(),
    rings = useRef([])
  useFrame(({ clock }, delta) => {
    if (!reduced && core.current) core.current.rotation.y += delta * 0.16
    rings.current.forEach((ring, i) => {
      if (!ring) return
      const target = locked
        ? [0, Math.PI / 2, Math.PI / 3][i]
        : reduced
          ? i
          : clock.elapsedTime * (0.3 + i * 0.13)
      ring.rotation.x = THREE.MathUtils.damp(ring.rotation.x, target, 5, delta)
      ring.rotation.y = THREE.MathUtils.damp(
        ring.rotation.y,
        locked ? (i * Math.PI) / 3 : target * 0.5,
        5,
        delta,
      )
    })
  })
  return (
    <>
      <ambientLight intensity={1.5} />
      <pointLight position={[3, 3, 5]} intensity={50} color="#b7f9d7" />
      <mesh ref={core}>
        <dodecahedronGeometry args={[0.9, 0]} />
        <meshPhysicalMaterial
          color={locked ? '#358e66' : '#6a8f7a'}
          roughness={0.15}
          metalness={0.6}
          transparent
          opacity={0.75}
        />
        <Edges color="#aeedc9" />
      </mesh>
      {[1.25, 1.48, 1.7].map((r, i) => (
        <mesh
          key={r}
          ref={(el) => (rings.current[i] = el)}
          rotation={[i, i * 0.8, 0]}
        >
          <torusGeometry args={[r, 0.018, 12, 100]} />
          <meshStandardMaterial
            color={locked ? '#88e2b4' : '#b2a475'}
            emissive={locked ? '#60da9e' : '#95886a'}
            emissiveIntensity={locked ? 1.5 : 0.4}
          />
        </mesh>
      ))}
    </>
  )
}
export function Vault({ locked = true }) {
  const reduced = useReducedMotion()
  return (
    <SafeScene
      className="vault-canvas"
      camera={{ position: [0, 0, 5], fov: 48 }}
      fallback={
        <div className="vault-fallback">
          ◇<span>{locked ? 'Mode rahasia aktif' : 'Mode terbuka'}</span>
        </div>
      }
    >
      <VaultScene locked={locked} reduced={reduced} />
    </SafeScene>
  )
}
function SealScene() {
  const mesh = useRef()
  const reduced = useReducedMotion()
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        uniforms: { color: { value: new THREE.Color('#d9bd78') } },
        vertexShader:
          'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p;}',
        fragmentShader:
          'uniform vec3 color; varying vec3 n; varying vec3 v; void main(){float f=pow(1.0-abs(dot(normalize(n),normalize(v))),2.0); gl_FragColor=vec4(mix(color*0.55,vec3(0.63,1.0,0.82),f),0.85);}',
      }),
    [],
  )
  useFrame(({ pointer }, delta) => {
    if (!reduced && mesh.current) {
      mesh.current.rotation.x = THREE.MathUtils.damp(
        mesh.current.rotation.x,
        pointer.y * 0.3,
        5,
        delta,
      )
      mesh.current.rotation.y = THREE.MathUtils.damp(
        mesh.current.rotation.y,
        pointer.x * 0.5,
        5,
        delta,
      )
    }
  })
  return (
    <group ref={mesh}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={material}>
        <cylinderGeometry args={[1, 1, 0.12, 12]} />
        <Edges color="#eddaa7" />
      </mesh>
      <mesh position={[0, 0, 0.09]}>
        <torusGeometry args={[0.77, 0.025, 12, 80]} />
        <meshBasicMaterial color="#e5d4a0" />
      </mesh>
      <Line
        points={[
          [-0.35, 0, 0.15],
          [-0.09, -0.22, 0.15],
          [0.4, 0.28, 0.15],
        ]}
        color="#f8edcb"
        lineWidth={5}
      />
    </group>
  )
}
export function Seal() {
  return (
    <SafeScene
      className="seal-canvas"
      camera={{ position: [0, 0, 3], fov: 48 }}
      fallback={<div className="seal-fallback">✓</div>}
    >
      <SealScene />
    </SafeScene>
  )
}
