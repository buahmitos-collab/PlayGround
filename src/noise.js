// Deterministic, seedable noise helpers used by the terrain generator.
// Everything is integer-hash based so a world can be rebuilt identically
// from a seed on any machine.

export function hash2(x, z, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

export function hash3(x, y, z, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 2246822519) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function smooth(t) {
  return t * t * (3 - 2 * t)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

export function noise2(x, z, seed = 0) {
  const x0 = Math.floor(x)
  const z0 = Math.floor(z)
  const fx = smooth(x - x0)
  const fz = smooth(z - z0)
  const a = hash2(x0, z0, seed)
  const b = hash2(x0 + 1, z0, seed)
  const c = hash2(x0, z0 + 1, seed)
  const d = hash2(x0 + 1, z0 + 1, seed)
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz)
}

export function noise3(x, y, z, seed = 0) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const z0 = Math.floor(z)
  const fx = smooth(x - x0)
  const fy = smooth(y - y0)
  const fz = smooth(z - z0)
  const a = hash3(x0, y0, z0, seed)
  const b = hash3(x0 + 1, y0, z0, seed)
  const c = hash3(x0, y0 + 1, z0, seed)
  const d = hash3(x0 + 1, y0 + 1, z0, seed)
  const e = hash3(x0, y0, z0 + 1, seed)
  const f = hash3(x0 + 1, y0, z0 + 1, seed)
  const g = hash3(x0, y0 + 1, z0 + 1, seed)
  const h = hash3(x0 + 1, y0 + 1, z0 + 1, seed)
  const xy0 = lerp(lerp(a, b, fx), lerp(c, d, fx), fy)
  const xy1 = lerp(lerp(e, f, fx), lerp(g, h, fx), fy)
  return lerp(xy0, xy1, fz)
}

export function fbm2(x, z, octaves = 4, seed = 0, persistence = 0.5, lacunarity = 2) {
  let total = 0
  let amp = 1
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    total += noise2(x, z, seed + i * 101) * amp
    norm += amp
    amp *= persistence
    x *= lacunarity
    z *= lacunarity
  }
  return total / norm
}

export function fbm3(x, y, z, octaves = 3, seed = 0, persistence = 0.5, lacunarity = 2) {
  let total = 0
  let amp = 1
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    total += noise3(x, y, z, seed + i * 137) * amp
    norm += amp
    amp *= persistence
    x *= lacunarity
    y *= lacunarity
    z *= lacunarity
  }
  return total / norm
}

export function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v
}
