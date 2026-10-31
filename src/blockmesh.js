import * as THREE from 'three'
import { BLOCKS, tileFor } from './blocks.js'
import { tileUV } from './textures.js'

// Six faces of a unit cube, wound counter-clockwise when seen from outside.
const FACES = [
  {
    dir: [1, 0, 0], shade: 0.82,
    corners: [[0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5]],
    uv: [[0, 0], [0, 1], [1, 1], [1, 0]], face: 'side',
  },
  {
    dir: [-1, 0, 0], shade: 0.82,
    corners: [[-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, -0.5]],
    uv: [[0, 0], [0, 1], [1, 1], [1, 0]], face: 'side',
  },
  {
    dir: [0, 1, 0], shade: 1,
    corners: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]],
    uv: [[0, 1], [1, 1], [1, 0], [0, 0]], face: 'top',
  },
  {
    dir: [0, -1, 0], shade: 0.55,
    corners: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]],
    uv: [[0, 0], [1, 0], [1, 1], [0, 1]], face: 'bottom',
  },
  {
    dir: [0, 0, 1], shade: 0.92,
    corners: [[0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, -0.5, 0.5]],
    uv: [[0, 0], [0, 1], [1, 1], [1, 0]], face: 'side',
  },
  {
    dir: [0, 0, -1], shade: 0.92,
    corners: [[-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0.5, -0.5, -0.5]],
    uv: [[0, 0], [0, 1], [1, 1], [1, 0]], face: 'side',
  },
]

export function createBlockGeometry(id, atlas, size = 1) {
  const block = BLOCKS[id]
  const pos = []
  const nrm = []
  const uv = []
  const col = []
  const idx = []

  for (const face of FACES) {
    const base = pos.length / 3
    const tileName = face.face === 'side' && block.tiles.front ? 'front' : tileFor(id, face.face)
    const [u0, v0, u1, v1] = tileUV(atlas, tileName)
    for (let i = 0; i < 4; i++) {
      const c = face.corners[i]
      pos.push(c[0] * size, c[1] * size, c[2] * size)
      nrm.push(face.dir[0], face.dir[1], face.dir[2])
      const t = face.uv[i]
      uv.push(u0 + (u1 - u0) * t[0], v0 + (v1 - v0) * t[1])
      col.push(face.shade, face.shade, face.shade)
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}
