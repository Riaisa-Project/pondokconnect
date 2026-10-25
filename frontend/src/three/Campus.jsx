import { useEffect, useMemo, useState } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { CAMPUS_TARGETS } from './cameraModel'

function Block({
  position = [0, 0, 0],
  size = [1, 1, 1],
  color = '#eee7d3',
  ...props
}) {
  return (
    <mesh castShadow receiveShadow position={position} {...props}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.65} />
    </mesh>
  )
}
function Tree({ x, z, scale = 1 }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh castShadow position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.035, 0.05, 0.5, 6]} />
        <meshStandardMaterial color="#776752" />
      </mesh>
      {[0, 1].map((i) => (
        <mesh key={i} castShadow position={[i * 0.08, 0.55 + i * 0.2, 0]}>
          <icosahedronGeometry args={[0.28 - i * 0.05, 1]} />
          <meshStandardMaterial
            color={i ? '#86a76d' : '#527e56'}
            roughness={0.8}
          />
        </mesh>
      ))}
    </group>
  )
}
function School({ x, z, rotation = 0 }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <Block position={[0, 0.38, 0]} size={[1.6, 0.75, 0.72]} />
      <Block position={[0, 0.82, 0]} size={[1.8, 0.09, 0.88]} color="#285c49" />
      <Block
        position={[0, 0.88, 0]}
        size={[1.6, 0.045, 0.74]}
        color="#55826a"
      />
      {[-0.6, -0.3, 0, 0.3, 0.6].map((x) => (
        <group key={x}>
          <Block
            position={[x, 0.51, 0.365]}
            size={[0.16, 0.22, 0.025]}
            color="#28594d"
          />
          <Block
            position={[x, 0.18, 0.365]}
            size={[0.16, 0.18, 0.025]}
            color="#466f62"
          />
        </group>
      ))}
      <Block
        position={[0, 0.18, -0.42]}
        size={[1.9, 0.15, 0.23]}
        color="#c3beaa"
      />
    </group>
  )
}
function Minaret({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <Block
        position={[0, 0.74, 0]}
        size={[0.24, 1.45, 0.24]}
        color="#e6e0ca"
      />
      <Block
        position={[0, 1.32, 0]}
        size={[0.34, 0.12, 0.34]}
        color="#cfb168"
      />
      <mesh castShadow position={[0, 1.6, 0]}>
        <coneGeometry args={[0.22, 0.4, 8]} />
        <meshStandardMaterial color="#245f49" />
      </mesh>
      <mesh position={[0, 1.87, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#d9b870" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}
function Mosque() {
  return (
    <group position={[0, 0, -0.55]}>
      <Block position={[0, 0.07, 0]} size={[1.8, 0.14, 1.6]} color="#cec8ad" />
      <Block position={[0, 0.47, 0]} size={[1.5, 0.8, 1.3]} color="#f3ecda" />
      <Block position={[0, 0.9, 0]} size={[1.7, 0.12, 1.48]} color="#23604b" />
      <mesh castShadow position={[0, 0.96, 0]}>
        <sphereGeometry args={[0.53, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#cbae65"
          roughness={0.32}
          metalness={0.45}
        />
      </mesh>
      <mesh position={[0, 1.58, 0]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial color="#e8c779" />
      </mesh>
      <Block
        position={[0, 0.3, 0.66]}
        size={[0.3, 0.46, 0.025]}
        color="#285d4b"
      />
      {[-0.52, 0.52].map((x) => (
        <group key={x}>
          <Block
            position={[x, 0.52, 0.66]}
            size={[0.16, 0.26, 0.025]}
            color="#3c6d5a"
          />
          <Block
            position={[x, 0.13, 0.85]}
            size={[0.06, 0.38, 0.06]}
            color="#e8e0c5"
          />
        </group>
      ))}
      <Block
        position={[0, 0.05, 1.04]}
        size={[1.7, 0.1, 0.45]}
        color="#e5ddc1"
      />
      <Minaret x={-0.93} z={-0.48} />
      <Minaret x={0.93} z={-0.48} />
    </group>
  )
}
function Plinth() {
  const shape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-4, -2.8)
    s.lineTo(3.4, -2.8)
    s.quadraticCurveTo(4, -2.8, 4, -2.2)
    s.lineTo(4, 2.2)
    s.quadraticCurveTo(4, 2.8, 3.4, 2.8)
    s.lineTo(-3.4, 2.8)
    s.quadraticCurveTo(-4, 2.8, -4, 2.2)
    s.lineTo(-4, -2.8)
    return s
  }, [])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} receiveShadow>
      <extrudeGeometry
        args={[
          shape,
          {
            depth: 0.3,
            bevelEnabled: true,
            bevelSize: 0.05,
            bevelThickness: 0.05,
            bevelSegments: 2,
            steps: 1,
          },
        ]}
      />
      <meshStandardMaterial color="#93aa7d" roughness={0.75} />
    </mesh>
  )
}
export function Campus({ onSelect, selected }) {
  const trees = useMemo(
    () =>
      [...Array(11)]
        .flatMap((_, i) => [
          [-3.55, -2.2 + i * 0.43],
          [3.55, -2.2 + i * 0.43],
        ])
        .concat([...Array(8)].map((_, i) => [-2.8 + i * 0.8, -2.45])),
    [],
  )
  return (
    <group>
      <Plinth />
      <Block position={[0, -0.34, 0]} size={[8.1, 0.1, 5.7]} color="#345747" />
      <InteractiveBuilding
        id="masjid"
        center={[0, -0.55]}
        size={[2.4, 1.9]}
        selected={selected}
        onSelect={onSelect}
      >
        <Mosque />
      </InteractiveBuilding>
      {[-2.2, 2.2].map((x) => (
        <InteractiveBuilding
          key={x}
          id="belajar"
          center={[x, -0.5]}
          size={[1.1, 2]}
          selected={selected}
          onSelect={onSelect}
        >
          <School
            x={x}
            z={-0.5}
            rotation={x < 0 ? Math.PI / 2 : -Math.PI / 2}
          />
        </InteractiveBuilding>
      ))}
      {[-2.15, 2.15].map((x) => (
        <InteractiveBuilding
          key={x}
          id="asrama"
          center={[x, 1.55]}
          size={[1.95, 1.1]}
          selected={selected}
          onSelect={onSelect}
        >
          <School x={x} z={1.55} />
        </InteractiveBuilding>
      ))}
      <Block
        position={[0, 0.008, 1.3]}
        size={[1.7, 0.025, 1.2]}
        color="#d8d0b6"
      />
      <Block
        position={[0, 0.012, 2.15]}
        size={[0.8, 0.025, 1.4]}
        color="#e6debf"
      />
      <Block
        position={[0, 0.035, 1.32]}
        size={[0.7, 0.06, 0.7]}
        color="#577e69"
      />
      <mesh position={[0, 0.083, 1.32]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.29, 32]} />
        <meshPhysicalMaterial color="#6cbcb1" roughness={0.1} metalness={0.4} />
      </mesh>
      {trees.map(([x, z], i) => (
        <Tree key={i} x={x} z={z} scale={i % 3 === 0 ? 1.2 : 0.9} />
      ))}
      <Line
        points={[
          [-3.4, 0.03, 2.36],
          [3.4, 0.03, 2.36],
        ]}
        color="#d6ccb1"
        lineWidth={2}
      />
    </group>
  )
}

function InteractiveBuilding({
  id,
  center,
  size,
  selected,
  onSelect,
  children,
}) {
  const [hover, setHover] = useState(false),
    { gl } = useThree()
  useEffect(() => {
    if (hover) gl.domElement.style.cursor = 'pointer'
    return () => {
      gl.domElement.style.cursor = 'grab'
    }
  }, [hover, gl])
  const active = selected === id || hover,
    [x, z] = center,
    [w, d] = size
  const choose = () => onSelect(id, [x, CAMPUS_TARGETS[id][1], z])
  return (
    <group
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation()
        if (e.delta <= 5) choose()
      }}
    >
      {children}
      {active && (
        <Line
          points={[
            [x - w / 2, 0.055, z - d / 2],
            [x + w / 2, 0.055, z - d / 2],
            [x + w / 2, 0.055, z + d / 2],
            [x - w / 2, 0.055, z + d / 2],
            [x - w / 2, 0.055, z - d / 2],
          ]}
          color="#f3d687"
          lineWidth={2.5}
        />
      )}
    </group>
  )
}
