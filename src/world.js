import * as THREE from 'three'
import { fbm2, fbm3, hash2, hash3, noise3, smoothstep, clamp } from './noise.js'
import {
  AIR, WATER, GLASS, ICE, BEDROCK, GLOWSTONE, BLOCKS,
  isOpaque, isSolid, tileFor,
} from './blocks.js'
import { tileUV, createWaterTexture } from './textures.js'

export const CHUNK_SIZE = 16
export const WORLD_HEIGHT = 96
export const SEA_LEVEL = 38
const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT

export function chunkKey(cx, cz) {
  return `${cx},${cz}`
}

export function localIndex(x, y, z) {
  return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE
}

const FACES = [
  {
    name: 'px', dir: [1, 0, 0], uAxis: 2, vAxis: 1, shade: 0.79,
    corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
    uv: [[0, 0], [0, 1], [1, 1], [1, 0]],
  },
  {
    name: 'nx', dir: [-1, 0, 0], uAxis: 2, vAxis: 1, shade: 0.79,
    corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]],
    uv: [[0, 0], [0, 1], [1, 1], [1, 0]],
  },
  {
    name: 'py', dir: [0, 1, 0], uAxis: 0, vAxis: 2, shade: 1,
    corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
    uv: [[0, 1], [1, 1], [1, 0], [0, 0]],
  },
  {
    name: 'ny', dir: [0, -1, 0], uAxis: 0, vAxis: 2, shade: 0.5,
    corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
    uv: [[0, 0], [1, 0], [1, 1], [0, 1]],
  },
  {
    name: 'pz', dir: [0, 0, 1], uAxis: 0, vAxis: 1, shade: 0.9,
    corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]],
    uv: [[0, 0], [0, 1], [1, 1], [1, 0]],
  },
  {
    name: 'nz', dir: [0, 0, -1], uAxis: 0, vAxis: 1, shade: 0.9,
    corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]],
    uv: [[0, 0], [0, 1], [1, 1], [1, 0]],
  },
]

class GeoBuilder {
  constructor() {
    this.pos = []
    this.nrm = []
    this.uv = []
    this.col = []
    this.idx = []
  }

  quad(corners, normal, uvs, shades) {
    const base = this.pos.length / 3
    for (let i = 0; i < 4; i++) {
      const c = corners[i]
      this.pos.push(c[0], c[1], c[2])
      this.nrm.push(normal[0], normal[1], normal[2])
      this.uv.push(uvs[i][0], uvs[i][1])
      const s = shades[i]
      this.col.push(s, s, s)
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  get empty() {
    return this.idx.length === 0
  }

  build() {
    if (this.empty) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.setIndex(this.idx)
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}

function surfaceAtHeight(x, z) {
  return 0
}

export class World {
  constructor(scene, atlas, seed = 12345) {
    this.scene = scene
    this.atlas = atlas
    this.seed = seed
    this.chunks = new Map()
    this.edits = new Map()
    this.waterTexture = createWaterTexture()
    this.materials = {
      opaque: new THREE.MeshLambertMaterial({
        map: atlas.texture,
        vertexColors: true,
        alphaTest: 0.35,
        side: THREE.FrontSide,
      }),
      plants: new THREE.MeshLambertMaterial({
        map: atlas.texture,
        vertexColors: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
      }),
      glass: new THREE.MeshLambertMaterial({
        map: atlas.texture,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      water: new THREE.MeshPhongMaterial({
        map: this.waterTexture,
        color: 0x9fd4ff,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        shininess: 110,
        specular: 0xb8ddff,
        side: THREE.DoubleSide,
      }),
      glow: new THREE.MeshBasicMaterial({
        map: atlas.texture,
        vertexColors: true,
      }),
    }
    this.stats = { chunks: 0, meshes: 0, triangles: 0 }
  }

  // ---------------------------------------------------------------- terrain
  heightAt(x, z) {
    const s = this.seed
    const continent = fbm2(x * 0.00165, z * 0.00165, 4, s + 1)
    const detail = fbm2(x * 0.013, z * 0.013, 3, s + 2)
    const ridgeN = fbm2(x * 0.0042, z * 0.0042, 4, s + 3)
    const ridge = 1 - Math.abs(ridgeN * 2 - 1)
    let h = 29 + continent * 17 + detail * 3.2
    const mountain = smoothstep(0.55, 0.83, continent)
    h += mountain * ridge * ridge * 31
    return clamp(Math.floor(h), 4, WORLD_HEIGHT - 8)
  }

  biomeAt(x, z, h = this.heightAt(x, z)) {
    const s = this.seed
    const temp = fbm2(x * 0.00105 + 311, z * 0.00105 - 97, 2, s + 11)
    const moist = fbm2(x * 0.00125 - 233, z * 0.00125 + 157, 2, s + 12)
    if (h > 74) return 'snow'
    if (temp < 0.35) return 'snow'
    if (temp > 0.61 && moist < 0.45) return 'desert'
    if (moist > 0.57) return 'forest'
    return 'plains'
  }

  slopeAt(x, z, h) {
    const a = Math.abs(h - this.heightAt(x + 1, z))
    const b = Math.abs(h - this.heightAt(x - 1, z))
    const c = Math.abs(h - this.heightAt(x, z + 1))
    const d = Math.abs(h - this.heightAt(x, z - 1))
    return Math.max(a, b, c, d)
  }

  getChunk(cx, cz) {
    const key = chunkKey(cx, cz)
    let chunk = this.chunks.get(key)
    if (!chunk) chunk = this.generateChunk(cx, cz)
    return chunk
  }

  generateChunk(cx, cz) {
    const key = chunkKey(cx, cz)
    const existing = this.chunks.get(key)
    if (existing) return existing

    const blocks = new Uint8Array(CHUNK_VOLUME)
    const heightMap = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE)
    const biomeMap = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE)
    const chunk = {
      cx, cz, key, blocks, heightMap, biomeMap,
      meshes: {}, meshed: false, meshDirty: true,
    }
    this.chunks.set(key, chunk)

    const s = this.seed
    const biomeNames = ['plains', 'forest', 'desert', 'snow']

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = cx * CHUNK_SIZE + lx
        const wz = cz * CHUNK_SIZE + lz
        const h = this.heightAt(wx, wz)
        const biome = this.biomeAt(wx, wz, h)
        const slope = this.slopeAt(wx, wz, h)
        const hi = lx + lz * CHUNK_SIZE
        heightMap[hi] = h
        biomeMap[hi] = biomeNames.indexOf(biome)

        let surface = 1
        let sub = 2
        let deep = 3
        if (biome === 'desert') {
          surface = 5
          sub = 5
          deep = 6
        } else if (biome === 'snow') {
          surface = h <= SEA_LEVEL + 1 ? 5 : 14
          sub = 2
          deep = 3
        } else if (h <= SEA_LEVEL + 1) {
          surface = 5
          sub = 5
          deep = 6
        }
        if (h > 66 || slope > 4) {
          surface = 3
          sub = 3
          deep = 3
          if (h > 75) surface = 14
        }

        for (let y = 0; y <= h; y++) {
          let id = 3
          if (y === 0) id = BEDROCK
          else if (y < 3 && hash3(wx, y, wz, s + 4) < 0.55) id = BEDROCK
          else if (y === h) id = surface
          else if (y >= h - 3) id = sub
          else if (y >= h - 8 && deep !== 3) id = deep
          else {
            id = 3
            const ore = hash3(wx, y, wz, s + 31)
            if (y < 56 && ore < 0.011) id = 15
            else if (y < 44 && ore < 0.018) id = 16
            else if (y < 27 && ore < 0.022) id = 17
            else if (y < 18 && ore < 0.025) id = 18
            else if (y < 22 && ore > 0.9985) id = 44
            else if (y < 34 && ore > 0.994) id = 33
          }

          // Caves. Keep a protective roof near the surface so the world does
          // not turn into Swiss cheese, and never carve the bedrock floor.
          if (y > 4 && y < h - 2 && y < WORLD_HEIGHT - 4) {
            const cave = fbm3(wx * 0.043, y * 0.062, wz * 0.043, 2, s + 41)
            const tunnel = noise3(wx * 0.024, y * 0.038, wz * 0.024, s + 42)
            if (cave > 0.635 || Math.abs(tunnel - 0.5) < 0.021) id = AIR
          }
          blocks[localIndex(lx, y, lz)] = id
        }

        // Ocean / lake water.
        if (h < SEA_LEVEL) {
          for (let y = h + 1; y <= SEA_LEVEL; y++) {
            blocks[localIndex(lx, y, lz)] = WATER
          }
          if (biome === 'snow') blocks[localIndex(lx, SEA_LEVEL, lz)] = ICE
        }
      }
    }

    this.addTrees(chunk)
    this.addPlants(chunk)
    this.applyEdits(chunk)

    // Neighbouring chunks that already have a mesh must be rebuilt at the seam.
    this.markNeighborsDirty(cx, cz)
    return chunk
  }

  forEachTree(cx, cz, cb) {
    const cell = 6
    const minGX = Math.floor((cx * CHUNK_SIZE - 4) / cell)
    const maxGX = Math.floor((cx * CHUNK_SIZE + CHUNK_SIZE + 4) / cell)
    const minGZ = Math.floor((cz * CHUNK_SIZE - 4) / cell)
    const maxGZ = Math.floor((cz * CHUNK_SIZE + CHUNK_SIZE + 4) / cell)
    for (let gx = minGX; gx <= maxGX; gx++) {
      for (let gz = minGZ; gz <= maxGZ; gz++) {
        const pick = hash2(gx, gz, this.seed + 900)
        const wx = gx * cell + Math.floor(hash2(gx, gz, this.seed + 901) * cell)
        const wz = gz * cell + Math.floor(hash2(gx, gz, this.seed + 902) * cell)
        const h = this.heightAt(wx, wz)
        if (h <= SEA_LEVEL + 1 || h > 72) continue
        const biome = this.biomeAt(wx, wz, h)
        let chance = 0.08
        if (biome === 'forest') chance = 0.48
        else if (biome === 'plains') chance = 0.09
        else if (biome === 'snow') chance = 0.3
        else if (biome === 'desert') chance = 0.08
        if (pick > chance) continue
        cb(wx, wz, h, biome)
      }
    }
  }

  addTrees(chunk) {
    const ox = chunk.cx * CHUNK_SIZE
    const oz = chunk.cz * CHUNK_SIZE
    const put = (wx, wy, wz, id, onlyAir = false) => {
      const lx = wx - ox
      const lz = wz - oz
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return
      if (wy < 1 || wy >= WORLD_HEIGHT) return
      const i = localIndex(lx, wy, lz)
      if (onlyAir && chunk.blocks[i] !== AIR) return
      chunk.blocks[i] = id
    }

    this.forEachTree(chunk.cx, chunk.cz, (wx, wz, h, biome) => {
      const r = hash2(wx, wz, this.seed + 950)
      if (biome === 'desert') {
        const height = 2 + Math.floor(r * 3)
        for (let i = 1; i <= height; i++) put(wx, h + i, wz, 31)
        if (r > 0.55) {
          const arm = r > 0.78 ? -1 : 1
          put(wx + arm, h + 2, wz, 31)
          put(wx + arm * 2, h + 2, wz, 31)
          put(wx + arm * 2, h + 3, wz, 31)
        }
        return
      }
      if (biome === 'snow') {
        const height = 7 + Math.floor(r * 4)
        for (let i = 1; i <= height; i++) put(wx, h + i, wz, 8)
        for (let layer = 2; layer <= height; layer++) {
          const radius = Math.max(0, Math.round((height - layer) * 0.33))
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              if (dx * dx + dz * dz > radius * radius + 1) continue
              if (dx === 0 && dz === 0 && layer < height) continue
              put(wx + dx, h + layer, wz + dz, 9, true)
            }
          }
        }
        put(wx, h + height + 1, wz, 9, true)
        return
      }

      const birch = r > 0.6
      const log = birch ? 35 : 8
      const leaf = birch ? 36 : 9
      const height = (birch ? 5 : 4) + Math.floor(r * 4)
      for (let i = 1; i <= height; i++) put(wx, h + i, wz, log)
      const top = h + height
      for (let dy = -2; dy <= 1; dy++) {
        const radius = dy <= -1 ? 2 : 1
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue
            if (dx === 0 && dz === 0 && dy < 1) continue
            put(wx + dx, top + dy, wz + dz, leaf, true)
          }
        }
      }
    })
  }

  addPlants(chunk) {
    const ox = chunk.cx * CHUNK_SIZE
    const oz = chunk.cz * CHUNK_SIZE
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = ox + lx
        const wz = oz + lz
        const h = chunk.heightMap[lx + lz * CHUNK_SIZE]
        if (h <= 0 || h >= WORLD_HEIGHT - 2) continue
        const ground = chunk.blocks[localIndex(lx, h, lz)]
        const above = chunk.blocks[localIndex(lx, h + 1, lz)]
        if (above !== AIR) continue
        const r = hash2(wx, wz, this.seed + 960)
        const biome = ['plains', 'forest', 'desert', 'snow'][chunk.biomeMap[lx + lz * CHUNK_SIZE]]
        if (ground === 1) {
          if (r < 0.038) chunk.blocks[localIndex(lx, h + 1, lz)] = 39
          else if (r < 0.044) chunk.blocks[localIndex(lx, h + 1, lz)] = 37
          else if (r < 0.05) chunk.blocks[localIndex(lx, h + 1, lz)] = 38
          else if (r > 0.998) chunk.blocks[localIndex(lx, h + 1, lz)] = r > 0.999 ? 45 : 46
        } else if (ground === 5 && biome === 'desert' && r < 0.012) {
          chunk.blocks[localIndex(lx, h + 1, lz)] = 40
        } else if (ground === 14 && r < 0.008) {
          chunk.blocks[localIndex(lx, h + 1, lz)] = 39
        }
      }
    }
  }

  applyEdits(chunk) {
    const edits = this.edits.get(chunk.key)
    if (!edits) return
    for (const [i, id] of edits) chunk.blocks[i] = id
  }

  // ---------------------------------------------------------------- access
  getBlock(x, y, z) {
    if (y < 0) return BEDROCK
    if (y >= WORLD_HEIGHT) return AIR
    const cx = Math.floor(x / CHUNK_SIZE)
    const cz = Math.floor(z / CHUNK_SIZE)
    const chunk = this.getChunk(cx, cz)
    const lx = x - cx * CHUNK_SIZE
    const lz = z - cz * CHUNK_SIZE
    return chunk.blocks[localIndex(lx, y, lz)]
  }

  setBlock(x, y, z, id, record = true) {
    if (y < 1 || y >= WORLD_HEIGHT) return false
    const cx = Math.floor(x / CHUNK_SIZE)
    const cz = Math.floor(z / CHUNK_SIZE)
    const chunk = this.getChunk(cx, cz)
    const lx = x - cx * CHUNK_SIZE
    const lz = z - cz * CHUNK_SIZE
    const i = localIndex(lx, y, lz)
    if (chunk.blocks[i] === id) return false
    chunk.blocks[i] = id
    if (record) {
      let edits = this.edits.get(chunk.key)
      if (!edits) {
        edits = new Map()
        this.edits.set(chunk.key, edits)
      }
      edits.set(i, id)
      this.editCount = (this.editCount || 0) + 1
    }
    chunk.meshDirty = true
    if (lx === 0) this.markDirty(cx - 1, cz)
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz)
    if (lz === 0) this.markDirty(cx, cz - 1)
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1)
    if (lx === 0 && lz === 0) this.markDirty(cx - 1, cz - 1)
    if (lx === 0 && lz === CHUNK_SIZE - 1) this.markDirty(cx - 1, cz + 1)
    if (lx === CHUNK_SIZE - 1 && lz === 0) this.markDirty(cx + 1, cz - 1)
    if (lx === CHUNK_SIZE - 1 && lz === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz + 1)
    return true
  }

  markDirty(cx, cz) {
    const c = this.chunks.get(chunkKey(cx, cz))
    if (c && c.meshed) c.meshDirty = true
  }

  markNeighborsDirty(cx, cz) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue
        this.markDirty(cx + dx, cz + dz)
      }
    }
  }

  getSurfaceY(x, z) {
    for (let y = WORLD_HEIGHT - 1; y > 0; y--) {
      const id = this.getBlock(x, y, z)
      if (isSolid(id) && id !== 9 && id !== 36) return y
    }
    return SEA_LEVEL
  }

  findSpawn() {
    for (let ring = 0; ring < 80; ring++) {
      const points = ring === 0 ? [[0, 0]] : []
      if (ring > 0) {
        for (let i = -ring; i <= ring; i++) {
          points.push([i, -ring], [i, ring], [-ring, i], [ring, i])
        }
      }
      for (const [dx, dz] of points) {
        const x = dx * 7
        const z = dz * 7
        const h = this.heightAt(x, z)
        if (h <= SEA_LEVEL + 2 || h > 69) continue
        const biome = this.biomeAt(x, z, h)
        if (biome === 'desert') continue
        const chunk = this.getChunk(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE))
        const lx = x - Math.floor(x / CHUNK_SIZE) * CHUNK_SIZE
        const lz = z - Math.floor(z / CHUNK_SIZE) * CHUNK_SIZE
        for (let y = Math.min(h + 5, WORLD_HEIGHT - 3); y > SEA_LEVEL; y--) {
          const ground = chunk.blocks[localIndex(lx, y, lz)]
          const a = chunk.blocks[localIndex(lx, y + 1, lz)]
          const b = chunk.blocks[localIndex(lx, y + 2, lz)]
          if ((ground === 1 || ground === 14) && a === AIR && b === AIR) {
            return { x: x + 0.5, y: y + 1.001, z: z + 0.5, biome }
          }
        }
      }
    }
    return { x: 0.5, y: SEA_LEVEL + 6, z: 0.5, biome: 'plains' }
  }

  // ---------------------------------------------------------------- meshing
  isFaceVisible(id, nid) {
    if (nid === AIR) return true
    const nb = BLOCKS[nid]
    if (!nb) return true
    if (nb.opaque) return false
    if (nid === id) return false
    return true
  }

  aoAt(bx, by, bz, face, corner) {
    const n = face.dir
    const su = corner[face.uAxis] ? 1 : -1
    const sv = corner[face.vAxis] ? 1 : -1
    const ux = face.uAxis === 0 ? su : 0
    const uy = face.uAxis === 1 ? su : 0
    const uz = face.uAxis === 2 ? su : 0
    const vx = face.vAxis === 0 ? sv : 0
    const vy = face.vAxis === 1 ? sv : 0
    const vz = face.vAxis === 2 ? sv : 0
    const x = bx + n[0]
    const y = by + n[1]
    const z = bz + n[2]
    const side1 = isOpaque(this.getBlock(x + ux, y + uy, z + uz)) ? 1 : 0
    const side2 = isOpaque(this.getBlock(x + vx, y + vy, z + vz)) ? 1 : 0
    const cornerOcc = isOpaque(this.getBlock(x + ux + vx, y + uy + vy, z + uz + vz)) ? 1 : 0
    const ao = side1 && side2 ? 0 : 3 - (side1 + side2 + cornerOcc)
    return [0.62, 0.76, 0.9, 1][ao]
  }

  addCubeFace(builder, id, bx, by, bz, face, ox, oz) {
    const wx = ox + bx
    const wz = oz + bz
    const nid = this.getBlock(wx + face.dir[0], by + face.dir[1], wz + face.dir[2])
    if (!this.isFaceVisible(id, nid)) return
    const faceName = face.name === 'py' ? 'top' : face.name === 'ny' ? 'bottom' : 'side'
    const tileName = face.name === 'nz' && BLOCKS[id].tiles.front ? 'front' : tileFor(id, faceName)
    const [u0, v0, u1, v1] = tileUV(this.atlas, tileName)
    const variation = 0.94 + hash2(wx, wz, this.seed + 1777) * 0.12
    const uvs = []
    const shades = []
    for (let i = 0; i < 4; i++) {
      const c = face.corners[i]
      const uv = face.uv[i]
      uvs.push([u0 + (u1 - u0) * uv[0], v0 + (v1 - v0) * uv[1]])
      const ao = this.aoAt(wx, by, wz, face, c)
      shades.push(face.shade * ao * variation)
    }
    const corners = face.corners.map((c) => [bx + c[0], by + c[1], bz + c[2]])
    builder.quad(corners, face.dir, uvs, shades)
  }

  addCross(builder, id, bx, by, bz, ox, oz) {
    const tileName = tileFor(id, 'side')
    const [u0, v0, u1, v1] = tileUV(this.atlas, tileName)
    const uvs = [[u0, v0], [u0, v1], [u1, v1], [u1, v0]]
    const jitter = (hash2(ox + bx, oz + bz, this.seed + 970) - 0.5) * 0.16
    const x0 = bx + 0.12 + jitter
    const x1 = bx + 0.88 + jitter
    const z0 = bz + 0.12 - jitter
    const z1 = bz + 0.88 - jitter
    builder.quad(
      [[x0, by, z0], [x0, by + 1, z0], [x1, by + 1, z1], [x1, by, z1]],
      [0.7, 0.2, 0.7], uvs, [1, 1, 1, 1],
    )
    builder.quad(
      [[x1, by, z0], [x1, by + 1, z0], [x0, by + 1, z1], [x0, by, z1]],
      [0.7, 0.2, 0.7], uvs, [1, 1, 1, 1],
    )
  }

  addWaterFace(builder, bx, by, bz, face, height, ox, oz) {
    const wx = ox + bx
    const wz = oz + bz
    const nid = this.getBlock(wx + face.dir[0], by + face.dir[1], wz + face.dir[2])
    if (nid === WATER || isOpaque(nid)) return
    const uvs = []
    const shades = []
    const corners = face.corners.map((c) => {
      const py = c[1] === 1 ? height : 0
      return [bx + c[0], by + py, bz + c[2]]
    })
    for (let i = 0; i < 4; i++) {
      const c = face.corners[i]
      if (face.name === 'py') {
        uvs.push([(wx + c[0]) * 0.25, (wz + c[2]) * 0.25])
      } else {
        const u = (wx + c[0] + wz + c[2]) * 0.22
        const v = (by + (c[1] ? height : 0)) * 0.22
        uvs.push([u, v])
      }
      shades.push(face.shade * 0.95)
    }
    builder.quad(corners, face.dir, uvs, shades)
  }

  buildChunkMesh(chunk) {
    const opaque = new GeoBuilder()
    const plants = new GeoBuilder()
    const glass = new GeoBuilder()
    const water = new GeoBuilder()
    const glow = new GeoBuilder()
    const ox = chunk.cx * CHUNK_SIZE
    const oz = chunk.cz * CHUNK_SIZE
    const blocks = chunk.blocks

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const id = blocks[localIndex(lx, y, lz)]
          if (id === AIR) continue
          const block = BLOCKS[id]
          if (!block) continue
          if (id === WATER) {
            const above = this.getBlock(ox + lx, y + 1, oz + lz)
            const h = above === WATER ? 1 : 0.88
            for (const face of FACES) this.addWaterFace(water, lx, y, lz, face, h, ox, oz)
            continue
          }
          if (block.cross) {
            this.addCross(plants, id, lx, y, lz, ox, oz)
            continue
          }
          if (id === GLASS || id === ICE) {
            for (const face of FACES) {
              const nid = this.getBlock(ox + lx + face.dir[0], y + face.dir[1], oz + lz + face.dir[2])
              if (nid === id || isOpaque(nid)) continue
              const [u0, v0, u1, v1] = tileUV(this.atlas, tileFor(id, 'side'))
              const uvs = []
              const shades = []
              for (let i = 0; i < 4; i++) {
                const uv = face.uv[i]
                uvs.push([u0 + (u1 - u0) * uv[0], v0 + (v1 - v0) * uv[1]])
                shades.push(face.shade)
              }
              const corners = face.corners.map((c) => [lx + c[0], y + c[1], lz + c[2]])
              glass.quad(corners, face.dir, uvs, shades)
            }
            continue
          }
          if (block.glow) {
            for (const face of FACES) {
              const nid = this.getBlock(ox + lx + face.dir[0], y + face.dir[1], oz + lz + face.dir[2])
              if (isOpaque(nid)) continue
              const [u0, v0, u1, v1] = tileUV(this.atlas, tileFor(id, 'side'))
              const uvs = []
              for (let i = 0; i < 4; i++) {
                const uv = face.uv[i]
                uvs.push([u0 + (u1 - u0) * uv[0], v0 + (v1 - v0) * uv[1]])
              }
              const corners = face.corners.map((c) => [lx + c[0], y + c[1], lz + c[2]])
              glow.quad(corners, face.dir, uvs, [1, 1, 1, 1])
            }
            continue
          }
          for (const face of FACES) this.addCubeFace(opaque, id, lx, y, lz, face, ox, oz)
        }
      }
    }

    this.setChunkMesh(chunk, 'opaque', opaque, this.materials.opaque)
    this.setChunkMesh(chunk, 'plants', plants, this.materials.plants)
    this.setChunkMesh(chunk, 'glass', glass, this.materials.glass, 1)
    this.setChunkMesh(chunk, 'water', water, this.materials.water, 2)
    this.setChunkMesh(chunk, 'glow', glow, this.materials.glow)

    chunk.meshed = true
    chunk.meshDirty = false
  }

  setChunkMesh(chunk, key, builder, material, renderOrder = 0) {
    const old = chunk.meshes[key]
    if (old) {
      this.scene.remove(old)
      old.geometry.dispose()
      delete chunk.meshes[key]
    }
    const geometry = builder.build()
    if (!geometry) return
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE)
    mesh.matrixAutoUpdate = false
    mesh.updateMatrix()
    mesh.renderOrder = renderOrder
    mesh.frustumCulled = true
    mesh.userData.chunk = chunk.key
    chunk.meshes[key] = mesh
    this.scene.add(mesh)
  }

  disposeChunkMeshes(chunk) {
    for (const key of Object.keys(chunk.meshes)) {
      const mesh = chunk.meshes[key]
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      delete chunk.meshes[key]
    }
    chunk.meshed = false
    chunk.meshDirty = true
  }

  // ---------------------------------------------------------------- streaming
  neededCoords(px, pz, radius) {
    const pcx = Math.floor(px / CHUNK_SIZE)
    const pcz = Math.floor(pz / CHUNK_SIZE)
    const list = []
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        list.push({ cx: pcx + dx, cz: pcz + dz, d: dx * dx + dz * dz })
      }
    }
    list.sort((a, b) => a.d - b.d)
    return list
  }

  update(px, pz, radius, budgetMs = 6) {
    const start = performance.now()
    const coords = this.neededCoords(px, pz, radius)
    const pcx = Math.floor(px / CHUNK_SIZE)
    const pcz = Math.floor(pz / CHUNK_SIZE)
    const dataRadius = radius + 2

    // Ensure data exists a little beyond the visible radius so border faces and
    // ambient occlusion have real neighbours.
    for (let dx = -dataRadius; dx <= dataRadius; dx++) {
      for (let dz = -dataRadius; dz <= dataRadius; dz++) {
        const cx = pcx + dx
        const cz = pcz + dz
        if (!this.chunks.has(chunkKey(cx, cz))) {
          this.getChunk(cx, cz)
          if (performance.now() - start > budgetMs * 2.5) return
        }
      }
    }

    for (const { cx, cz } of coords) {
      const chunk = this.chunks.get(chunkKey(cx, cz))
      if (!chunk) continue
      if (!chunk.meshed || chunk.meshDirty) {
        this.buildChunkMesh(chunk)
        if (performance.now() - start > budgetMs) return
      }
    }

    // Unload distant chunk meshes and data. Edits are kept separately, so the
    // deterministic world can be regenerated later without losing builds.
    for (const [key, chunk] of this.chunks) {
      const dist = Math.max(Math.abs(chunk.cx - pcx), Math.abs(chunk.cz - pcz))
      if (dist > radius + 3) {
        this.disposeChunkMeshes(chunk)
        this.chunks.delete(key)
      }
    }
  }

  async preload(px, pz, radius, onProgress) {
    const pcx = Math.floor(px / CHUNK_SIZE)
    const pcz = Math.floor(pz / CHUNK_SIZE)
    const dataRadius = radius + 2
    const total = (radius * 2 + 1) * (radius * 2 + 1)
    let done = 0

    for (let dx = -dataRadius; dx <= dataRadius; dx++) {
      for (let dz = -dataRadius; dz <= dataRadius; dz++) {
        this.getChunk(pcx + dx, pcz + dz)
      }
    }

    const coords = this.neededCoords(px, pz, radius)
    for (const { cx, cz } of coords) {
      const chunk = this.chunks.get(chunkKey(cx, cz))
      if (chunk) this.buildChunkMesh(chunk)
      done++
      if (onProgress) onProgress(done / total)
      if (done % 3 === 0) await new Promise((resolve) => setTimeout(resolve, 0))
    }
    if (onProgress) onProgress(1)
  }

  // ---------------------------------------------------------------- saves
  exportEdits() {
    const out = []
    for (const [key, edits] of this.edits) {
      const [cx, cz] = key.split(',').map(Number)
      for (const [i, id] of edits) {
        const lx = i % CHUNK_SIZE
        const lz = Math.floor(i / CHUNK_SIZE) % CHUNK_SIZE
        const y = Math.floor(i / (CHUNK_SIZE * CHUNK_SIZE))
        out.push([cx * CHUNK_SIZE + lx, y, cz * CHUNK_SIZE + lz, id])
      }
    }
    return out
  }

  importEdits(list) {
    if (!Array.isArray(list)) return
    for (const item of list) {
      if (!Array.isArray(item) || item.length < 4) continue
      const [x, y, z, id] = item
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
      const cx = Math.floor(x / CHUNK_SIZE)
      const cz = Math.floor(z / CHUNK_SIZE)
      const lx = x - cx * CHUNK_SIZE
      const lz = z - cz * CHUNK_SIZE
      const key = chunkKey(cx, cz)
      let edits = this.edits.get(key)
      if (!edits) {
        edits = new Map()
        this.edits.set(key, edits)
      }
      edits.set(localIndex(lx, y, lz), id)
    }
    this.editCount = list.length
  }

  dispose() {
    for (const chunk of this.chunks.values()) this.disposeChunkMeshes(chunk)
    this.chunks.clear()
    for (const mat of Object.values(this.materials)) mat.dispose()
    this.waterTexture.dispose()
  }
}
