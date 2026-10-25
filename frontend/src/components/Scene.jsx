import { lazy, Suspense } from 'react'
const DigitalTwin = lazy(() =>
  import('../three/Explorer').then((module) => ({
    default: module.DigitalTwin,
  })),
)
const Vault = lazy(() =>
  import('../three/Scenes').then((module) => ({ default: module.Vault })),
)
const Seal = lazy(() =>
  import('../three/Scenes').then((module) => ({ default: module.Seal })),
)
export const Map3D = (props) => (
  <Suspense
    fallback={<div className="scene-loading">Menyiapkan peta Lamongan…</div>}
  >
    <DigitalTwin {...props} />
  </Suspense>
)
export const Vault3D = (props) => (
  <Suspense fallback={<div className="scene-loading">◇</div>}>
    <Vault {...props} />
  </Suspense>
)
export const Seal3D = (props) => (
  <Suspense fallback={<div className="seal-fallback">✓</div>}>
    <Seal {...props} />
  </Suspense>
)
