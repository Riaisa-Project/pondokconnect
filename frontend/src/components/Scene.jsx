import { lazy, Suspense } from 'react'
const Vault = lazy(() =>
  import('../three/Scenes').then((module) => ({ default: module.Vault })),
)
const Seal = lazy(() =>
  import('../three/Scenes').then((module) => ({ default: module.Seal })),
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
