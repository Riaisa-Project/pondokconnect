const length = (v) => Math.hypot(...v)
export const CAMPUS_TARGETS = {
  masjid: [0, 0.6, -0.55],
  belajar: [-2.2, 0.4, -0.5],
  asrama: [2.15, 0.4, 1.55],
}
export function overview(mode) {
  return {
    position: mode === 'campus' ? [7, 7, 9] : [7, 8, 9.5],
    target: mode === 'campus' ? [0, 0.4, 0] : [0, 0.2, 0],
  }
}
export function cameraView(kind, position, target, focus, mode = 'campus') {
  if (kind === 'overview') return overview(mode)
  if (kind === 'focus' && focus)
    return {
      target: [...focus],
      position: [focus[0] + 3.6, focus[1] + 2.8, focus[2] + 4.2],
    }
  const offset = position.map((v, i) => v - target[i])
  if (kind === 'left' || kind === 'right') {
    const a = ((kind === 'left' ? -1 : 1) * Math.PI) / 6,
      c = Math.cos(a),
      s = Math.sin(a)
    return {
      target: [...target],
      position: [
        target[0] + offset[0] * c + offset[2] * s,
        position[1],
        target[2] + offset[2] * c - offset[0] * s,
      ],
    }
  }
  const distance = length(offset) || 1,
    desired = Math.max(
      2.8,
      Math.min(24, distance * (kind === 'in' ? 0.76 : 1.3)),
    )
  return {
    target: [...target],
    position: offset.map((v, i) => target[i] + (v * desired) / distance),
  }
}

export const DISTRICT_POINTS = [
  [-1.9, 0],
  [-1.45, -1.8],
  [1.7, 1.85],
  [1.5, -0.2],
  [2, 0.5],
  [0.5, 0.8],
  [1.7, 1],
  [-0.3, 0.8],
  [-1.6, -0.9],
  [0.2, -1.3],
  [1, 0],
  [0.2, 1.8],
  [-0.65, 1.55],
  [-0.1, -1.9],
  [-1.3, -1.2],
  [-0.7, -1.8],
  [1, 2.05],
  [-0.8, 0.1],
  [-0.3, -1.2],
  [1.1, -0.9],
  [-1.3, 0.8],
  [0.75, 1.3],
  [-0.6, -0.65],
  [0.1, 0],
  [-1.75, -1.35],
  [0.7, -0.6],
  [0.7, 0.55],
]
