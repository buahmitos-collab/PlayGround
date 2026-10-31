import * as THREE from 'three'
import { hash2, hash3 } from './noise.js'
import { BLOCKS, tileFor } from './blocks.js'

export const TILE_SIZE = 32
export const ATLAS_COLS = 8
export const ATLAS_ROWS = 8
export const ATLAS_SIZE = TILE_SIZE * ATLAS_COLS

const TILE_NAMES = [
  'grass_top', 'grass_side', 'dirt', 'stone', 'cobble', 'sand', 'sandstone_top', 'sandstone_side',
  'gravel', 'log_side', 'log_top', 'leaves', 'planks', 'glass', 'water', 'bedrock',
  'snow', 'coal', 'iron', 'gold', 'diamond', 'emerald', 'brick', 'obsidian',
  'glowstone', 'tnt_side', 'tnt_top', 'bookshelf', 'wool_white', 'wool_red', 'wool_blue', 'wool_yellow',
  'wool_green', 'wool_black', 'pumpkin_side', 'pumpkin_top', 'cactus_side', 'cactus_top', 'ice', 'mossy',
  'clay', 'birch_side', 'birch_top', 'leaves_birch', 'flower_red', 'flower_yellow', 'tall_grass', 'dead_bush',
  'crafting_top', 'crafting_side', 'furnace_front', 'furnace_side', 'furnace_top', 'torch', 'mushroom_red', 'mushroom_brown',
  'stone_bricks',
]

const tileIndex = new Map(TILE_NAMES.map((name, i) => [name, i]))

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  let r = (n >> 16) & 255
  let g = (n >> 8) & 255
  let b = n & 255
  r = Math.max(0, Math.min(255, Math.round(r + amount)))
  g = Math.max(0, Math.min(255, Math.round(g + amount)))
  b = Math.max(0, Math.min(255, Math.round(b + amount)))
  return `rgb(${r},${g},${b})`
}

function baseNoise(ctx, colors, seed, density = 0.34) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const r = hash2(x, y, seed)
      let c = colors[0]
      if (r < density) {
        const pick = Math.floor(hash2(x, y, seed + 11) * (colors.length - 1)) + 1
        c = colors[pick] || colors[0]
      }
      ctx.fillStyle = c
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

function speckle(ctx, x, y, w, h, color, seed) {
  for (let i = 0; i < w * h; i++) {
    if (hash2(x + i, y + i * 7, seed) < 0.7) {
      ctx.fillStyle = color
      ctx.fillRect(x + (i % w), y + Math.floor(i / w), 1, 1)
    }
  }
}

function ring(ctx, cx, cy, radius, color, width = 1) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.stroke()
}

function horizontalBand(ctx, y, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(0, y, 16, h)
}

const painters = {
  grass_top(ctx) {
    baseNoise(ctx, ['#5c9f3d', '#4f8f35', '#6bae4b', '#437c2d', '#78b954'], 1, 0.55)
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(hash2(i, 4, 21) * 16)
      const y = Math.floor(hash2(i, 9, 22) * 16)
      ctx.fillStyle = i % 3 ? '#7fbe58' : '#3b6d28'
      ctx.fillRect(x, y, 1, 1)
    }
  },
  grass_side(ctx) {
    baseNoise(ctx, ['#8b5a2b', '#7f5126', '#96632f', '#744a22'], 3, 0.5)
    const edge = [5, 4, 5, 3, 4, 5, 4, 6, 5, 4, 3, 4, 5, 4, 5, 4]
    for (let x = 0; x < 16; x++) {
      const h = edge[x]
      ctx.fillStyle = '#5c9f3d'
      ctx.fillRect(x, 0, 1, h)
      ctx.fillStyle = x % 2 ? '#4f8f35' : '#6bae4b'
      ctx.fillRect(x, h - 1, 1, 1)
    }
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = '#5c9f3d'
      ctx.fillRect(Math.floor(hash2(i, 2, 31) * 16), 4 + Math.floor(hash2(i, 3, 32) * 3), 1, 1)
    }
  },
  dirt(ctx) {
    baseNoise(ctx, ['#8b5a2b', '#7c4f24', '#966331', '#6d441f', '#a06a37'], 5, 0.55)
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = '#5c3a1c'
      ctx.fillRect(Math.floor(hash2(i, 1, 41) * 16), Math.floor(hash2(i, 2, 42) * 16), 1, 1)
    }
  },
  stone(ctx) {
    baseNoise(ctx, ['#8a8a8a', '#7e7e7e', '#969696', '#737373', '#a0a0a0'], 7, 0.5)
    ctx.strokeStyle = '#666666'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(2, 3); ctx.lineTo(6, 5); ctx.lineTo(5, 9); ctx.lineTo(8, 12)
    ctx.moveTo(11, 2); ctx.lineTo(9, 6); ctx.lineTo(12, 8); ctx.lineTo(13, 13)
    ctx.stroke()
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = '#5f5f5f'
      ctx.fillRect(Math.floor(hash2(i, 8, 51) * 16), Math.floor(hash2(i, 9, 52) * 16), 1, 1)
    }
  },
  cobble(ctx) {
    baseNoise(ctx, ['#7d7d7d', '#6f6f6f', '#8a8a8a'], 9, 0.4)
    const stones = [
      [1, 1, 6, 4], [8, 1, 7, 3], [1, 6, 4, 4], [6, 5, 5, 4], [12, 5, 3, 5],
      [1, 11, 7, 4], [9, 10, 6, 5], [5, 10, 3, 2],
    ]
    for (const [x, y, w, h] of stones) {
      ctx.fillStyle = '#8f8f8f'
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = '#9c9c9c'
      ctx.fillRect(x, y, w, 1)
      ctx.fillStyle = '#666666'
      ctx.fillRect(x, y + h - 1, w, 1)
      ctx.fillRect(x + w - 1, y, 1, h)
    }
    speckle(ctx, 0, 0, 16, 16, '#5c5c5c', 61)
  },
  sand(ctx) {
    baseNoise(ctx, ['#dccb92', '#d2bf84', '#e6d7a4', '#c9b67a', '#efe1b5'], 13, 0.55)
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = '#b9a66d'
      ctx.fillRect(Math.floor(hash2(i, 5, 71) * 16), Math.floor(hash2(i, 6, 72) * 16), 1, 1)
    }
  },
  sandstone_top(ctx) {
    baseNoise(ctx, ['#d8c58d', '#cfba7e', '#e2d29d', '#c5af72'], 15, 0.45)
    ctx.strokeStyle = '#b8a166'
    ctx.strokeRect(1.5, 1.5, 13, 13)
  },
  sandstone_side(ctx) {
    baseNoise(ctx, ['#d4c086', '#cbb67a', '#decb94'], 17, 0.35)
    horizontalBand(ctx, 0, 1, '#e4d4a1')
    horizontalBand(ctx, 5, 1, '#b9a46c')
    horizontalBand(ctx, 11, 1, '#b9a46c')
    horizontalBand(ctx, 15, 1, '#a9945f')
    for (let x = 0; x < 16; x += 4) {
      ctx.fillStyle = '#c1ad74'
      ctx.fillRect(x, 6, 1, 5)
    }
  },
  gravel(ctx) {
    baseNoise(ctx, ['#8a8580', '#77726d', '#9b9690', '#68635f'], 19, 0.6)
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(hash2(i, 1, 81) * 14)
      const y = Math.floor(hash2(i, 2, 82) * 14)
      ctx.fillStyle = i % 2 ? '#aaa5a0' : '#5c5854'
      ctx.fillRect(x, y, 2, 2)
      ctx.fillStyle = '#c0bbb5'
      ctx.fillRect(x, y, 1, 1)
    }
  },
  log_side(ctx) {
    baseNoise(ctx, ['#6b4b2a', '#5e4124', '#795530', '#54391f'], 23, 0.55)
    for (let x = 0; x < 16; x += 3) {
      ctx.fillStyle = x % 2 ? '#4e341b' : '#805b35'
      ctx.fillRect(x, 0, 1, 16)
    }
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = '#8d6339'
      ctx.fillRect(Math.floor(hash2(i, 3, 91) * 16), Math.floor(hash2(i, 4, 92) * 16), 1, 3)
    }
  },
  log_top(ctx) {
    baseNoise(ctx, ['#b98b4e', '#ab7f45', '#c69a5c'], 25, 0.4)
    for (let r = 2; r <= 7; r += 2) ring(ctx, 8, 8, r, '#6b4b2a', 1)
    ring(ctx, 8, 8, 7.5, '#4e341b', 1)
    ctx.fillStyle = '#4e341b'
    ctx.fillRect(7, 7, 2, 2)
  },
  leaves(ctx) {
    baseNoise(ctx, ['#4a8c39', '#3f7a2f', '#59a047', '#356b27', '#69b052'], 27, 0.65)
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 3 === 0 ? '#2a5a21' : '#7bc063'
      ctx.fillRect(Math.floor(hash2(i, 1, 101) * 16), Math.floor(hash2(i, 2, 102) * 16), 1, 1)
    }
  },
  planks(ctx) {
    baseNoise(ctx, ['#b98b4e', '#ad8047', '#c69a5c', '#a2763f'], 29, 0.35)
    for (const y of [0, 5, 10, 15]) {
      horizontalBand(ctx, y, 1, '#8a6234')
    }
    ctx.fillStyle = '#8a6234'
    ctx.fillRect(5, 1, 1, 4)
    ctx.fillRect(11, 6, 1, 4)
    ctx.fillRect(3, 11, 1, 4)
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = '#cfa76a'
      ctx.fillRect(Math.floor(hash2(i, 3, 111) * 16), Math.floor(hash2(i, 4, 112) * 16), 2, 1)
    }
  },
  glass(ctx) {
    ctx.clearRect(0, 0, 16, 16)
    ctx.fillStyle = 'rgba(196, 232, 248, 0.14)'
    ctx.fillRect(1, 1, 14, 14)
    ctx.strokeStyle = 'rgba(216, 244, 255, 0.92)'
    ctx.lineWidth = 1
    ctx.strokeRect(1.5, 1.5, 13, 13)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.beginPath()
    ctx.moveTo(3, 12); ctx.lineTo(12, 3)
    ctx.moveTo(7, 13); ctx.lineTo(13, 7)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillRect(3, 3, 1, 1)
    ctx.fillRect(12, 12, 1, 1)
  },
  water(ctx) {
    ctx.clearRect(0, 0, 16, 16)
    ctx.fillStyle = 'rgba(48, 112, 198, 0.82)'
    ctx.fillRect(0, 0, 16, 16)
    for (let y = 1; y < 16; y += 3) {
      ctx.fillStyle = 'rgba(122, 184, 240, 0.65)'
      for (let x = 0; x < 16; x++) {
        if ((x + y) % 7 < 3) ctx.fillRect(x, y, 1, 1)
      }
    }
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = 'rgba(188, 226, 255, 0.5)'
      ctx.fillRect(Math.floor(hash2(i, 2, 121) * 16), Math.floor(hash2(i, 3, 122) * 16), 2, 1)
    }
  },
  bedrock(ctx) {
    baseNoise(ctx, ['#3b3b3b', '#2e2e2e', '#484848', '#232323', '#565656'], 33, 0.65)
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(Math.floor(hash2(i, 1, 131) * 15), Math.floor(hash2(i, 2, 132) * 15), 2, 1)
    }
  },
  snow(ctx) {
    baseNoise(ctx, ['#f2f7ff', '#e8f0fb', '#ffffff', '#dce7f5', '#f8fbff'], 35, 0.4)
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = '#cddcee'
      ctx.fillRect(Math.floor(hash2(i, 1, 141) * 16), Math.floor(hash2(i, 2, 142) * 16), 1, 1)
    }
  },
  coal(ctx) {
    painters.stone(ctx)
    const spots = [[3, 4], [10, 3], [6, 10], [12, 11], [3, 12]]
    for (const [x, y] of spots) {
      ctx.fillStyle = '#262626'
      ctx.fillRect(x, y, 3, 3)
      ctx.fillStyle = '#111111'
      ctx.fillRect(x + 1, y + 1, 2, 2)
      ctx.fillStyle = '#4a4a4a'
      ctx.fillRect(x, y, 1, 1)
    }
  },
  iron(ctx) {
    painters.stone(ctx)
    const spots = [[3, 4], [10, 3], [6, 10], [12, 11]]
    for (const [x, y] of spots) {
      ctx.fillStyle = '#c58d6a'
      ctx.fillRect(x, y, 3, 3)
      ctx.fillStyle = '#e6b18c'
      ctx.fillRect(x + 1, y, 2, 1)
      ctx.fillStyle = '#9c6a4c'
      ctx.fillRect(x, y + 2, 2, 1)
    }
  },
  gold(ctx) {
    painters.stone(ctx)
    const spots = [[3, 4], [10, 3], [6, 10], [12, 11]]
    for (const [x, y] of spots) {
      ctx.fillStyle = '#e7c34a'
      ctx.fillRect(x, y, 3, 3)
      ctx.fillStyle = '#fff09a'
      ctx.fillRect(x + 1, y, 2, 1)
      ctx.fillStyle = '#b08a1f'
      ctx.fillRect(x, y + 2, 2, 1)
    }
  },
  diamond(ctx) {
    painters.stone(ctx)
    const spots = [[3, 4], [10, 3], [6, 10], [12, 11]]
    for (const [x, y] of spots) {
      ctx.fillStyle = '#4fd6c8'
      ctx.fillRect(x, y, 3, 3)
      ctx.fillStyle = '#b9fff6'
      ctx.fillRect(x + 1, y, 1, 1)
      ctx.fillStyle = '#2b9c94'
      ctx.fillRect(x + 2, y + 2, 1, 1)
    }
  },
  emerald(ctx) {
    painters.stone(ctx)
    const spots = [[3, 4], [10, 3], [6, 10], [12, 11]]
    for (const [x, y] of spots) {
      ctx.fillStyle = '#3ecf8e'
      ctx.fillRect(x, y, 3, 3)
      ctx.fillStyle = '#b6ffdc'
      ctx.fillRect(x + 1, y, 1, 1)
      ctx.fillStyle = '#1f8a5c'
      ctx.fillRect(x + 2, y + 2, 1, 1)
    }
  },
  brick(ctx) {
    ctx.fillStyle = '#b7a89a'
    ctx.fillRect(0, 0, 16, 16)
    for (let row = 0; row < 4; row++) {
      const y = row * 4
      const off = row % 2 ? 4 : 0
      for (let col = -1; col < 3; col++) {
        const x = col * 8 + off
        ctx.fillStyle = '#a34b3b'
        ctx.fillRect(x + 1, y + 1, 7, 3)
        ctx.fillStyle = '#bc5a48'
        ctx.fillRect(x + 1, y + 1, 7, 1)
        ctx.fillStyle = '#873a2e'
        ctx.fillRect(x + 1, y + 3, 7, 1)
      }
    }
  },
  obsidian(ctx) {
    baseNoise(ctx, ['#1b1428', '#241a35', '#150f20', '#2c2141'], 37, 0.5)
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#4a3a6b' : '#0d0914'
      ctx.fillRect(Math.floor(hash2(i, 1, 151) * 14), Math.floor(hash2(i, 2, 152) * 14), 2, 1)
    }
    ctx.fillStyle = '#6a4fa0'
    ctx.fillRect(4, 3, 1, 3)
    ctx.fillRect(10, 9, 1, 4)
  },
  glowstone(ctx) {
    baseNoise(ctx, ['#e8b84a', '#f2cb63', '#d8a63a', '#f7dc8c'], 39, 0.55)
    const spots = [[2, 3], [8, 2], [12, 5], [4, 9], [10, 11], [6, 13]]
    for (const [x, y] of spots) {
      ctx.fillStyle = '#fff3b0'
      ctx.fillRect(x, y, 2, 2)
      ctx.fillStyle = '#c48b22'
      ctx.fillRect(x + 2, y + 1, 1, 1)
    }
  },
  tnt_side(ctx) {
    baseNoise(ctx, ['#c0392b', '#ad3327', '#d44737', '#982a20'], 41, 0.35)
    horizontalBand(ctx, 5, 6, '#e8e2d8')
    ctx.fillStyle = '#2b2b2b'
    ctx.fillRect(2, 6, 1, 4)
    ctx.fillRect(4, 6, 1, 4)
    ctx.fillRect(5, 6, 1, 4)
    ctx.fillRect(7, 6, 1, 4)
    ctx.fillRect(9, 6, 1, 4)
    ctx.fillRect(11, 6, 1, 4)
    ctx.fillRect(13, 6, 1, 4)
    ctx.fillStyle = '#e8e2d8'
    ctx.fillRect(5, 7, 1, 1)
    ctx.fillRect(9, 7, 1, 1)
  },
  tnt_top(ctx) {
    baseNoise(ctx, ['#c0392b', '#ad3327', '#d44737'], 43, 0.3)
    ctx.fillStyle = '#3b3b3b'
    ctx.fillRect(6, 6, 4, 4)
    ctx.fillStyle = '#6a6a6a'
    ctx.fillRect(7, 7, 2, 2)
    ctx.strokeStyle = '#e8e2d8'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(8, 6); ctx.lineTo(8, 2); ctx.lineTo(11, 1)
    ctx.stroke()
  },
  bookshelf(ctx) {
    painters.planks(ctx)
    ctx.fillStyle = '#5b3a1e'
    ctx.fillRect(1, 2, 14, 12)
    const colors = ['#b84a4a', '#4a6fb8', '#c9a13a', '#4a9a5a', '#8a4ab8', '#c06a2a']
    for (let row = 0; row < 2; row++) {
      const y = 2 + row * 6
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = colors[(i + row * 2) % colors.length]
        ctx.fillRect(2 + i * 2, y, 2, 5)
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.fillRect(2 + i * 2, y, 1, 1)
      }
      ctx.fillStyle = '#3f2814'
      ctx.fillRect(1, y + 5, 14, 1)
    }
  },
  wool_white(ctx) { wool(ctx, '#eeeeee', '#d8d8d8', '#ffffff') },
  wool_red(ctx) { wool(ctx, '#cf4a4a', '#b83c3c', '#e05c5c') },
  wool_blue(ctx) { wool(ctx, '#4a6fcf', '#3c5cb8', '#5c82e0') },
  wool_yellow(ctx) { wool(ctx, '#e0c04a', '#c9aa3a', '#f0d05c') },
  wool_green(ctx) { wool(ctx, '#4a9f5a', '#3c8a4a', '#5cae6a') },
  wool_black(ctx) { wool(ctx, '#333333', '#252525', '#454545') },
  pumpkin_side(ctx) {
    baseNoise(ctx, ['#d67a2a', '#c46b22', '#e88a36'], 45, 0.3)
    for (let x = 2; x < 16; x += 4) {
      ctx.fillStyle = '#b25d1c'
      ctx.fillRect(x, 0, 1, 16)
    }
    ctx.fillStyle = '#5c7a2a'
    ctx.fillRect(0, 0, 16, 2)
    ctx.fillStyle = '#7a9a3a'
    ctx.fillRect(2, 0, 3, 1)
  },
  pumpkin_top(ctx) {
    baseNoise(ctx, ['#c46b22', '#b25d1c', '#d67a2a'], 47, 0.3)
    ring(ctx, 8, 8, 6, '#9a4e16', 1)
    ctx.fillStyle = '#5c7a2a'
    ctx.fillRect(7, 6, 2, 4)
    ctx.fillStyle = '#7a9a3a'
    ctx.fillRect(7, 6, 1, 3)
  },
  cactus_side(ctx) {
    baseNoise(ctx, ['#4d7a3a', '#426b31', '#5a8a44'], 49, 0.35)
    for (const x of [1, 5, 9, 13]) {
      ctx.fillStyle = '#2f5225'
      ctx.fillRect(x, 0, 1, 16)
      ctx.fillStyle = '#7aa85e'
      ctx.fillRect(x + 1, 0, 1, 16)
    }
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = '#d8e8b0'
      ctx.fillRect(Math.floor(hash2(i, 1, 161) * 16), Math.floor(hash2(i, 2, 162) * 16), 1, 1)
    }
  },
  cactus_top(ctx) {
    baseNoise(ctx, ['#4d7a3a', '#5a8a44', '#426b31'], 51, 0.3)
    ring(ctx, 8, 8, 5, '#2f5225', 1)
    ring(ctx, 8, 8, 2, '#7aa85e', 1)
  },
  ice(ctx) {
    ctx.clearRect(0, 0, 16, 16)
    ctx.fillStyle = 'rgba(168, 220, 250, 0.62)'
    ctx.fillRect(0, 0, 16, 16)
    ctx.strokeStyle = 'rgba(235, 250, 255, 0.85)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(2, 3); ctx.lineTo(7, 6); ctx.lineTo(5, 11); ctx.lineTo(11, 14)
    ctx.moveTo(10, 2); ctx.lineTo(12, 7); ctx.lineTo(14, 9)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillRect(3, 12, 2, 1)
  },
  mossy(ctx) {
    painters.cobble(ctx)
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(70, 120, 52, 0.85)' : 'rgba(92, 145, 68, 0.8)'
      ctx.fillRect(Math.floor(hash2(i, 1, 171) * 16), Math.floor(hash2(i, 2, 172) * 16), 2, 1)
    }
  },
  clay(ctx) {
    baseNoise(ctx, ['#9aa0a8', '#8d939b', '#a7adb5', '#82888f'], 53, 0.35)
  },
  birch_side(ctx) {
    baseNoise(ctx, ['#d8d4c8', '#cec9bc', '#e4e0d5', '#c2bdb0'], 55, 0.3)
    for (let i = 0; i < 7; i++) {
      const x = Math.floor(hash2(i, 1, 181) * 13)
      const y = Math.floor(hash2(i, 2, 182) * 14)
      ctx.fillStyle = '#4a463e'
      ctx.fillRect(x, y, 3, 1)
      ctx.fillStyle = '#6a665c'
      ctx.fillRect(x + 1, y + 1, 1, 1)
    }
  },
  birch_top(ctx) {
    baseNoise(ctx, ['#d8d4c8', '#cec9bc', '#e4e0d5'], 57, 0.3)
    for (let r = 2; r <= 6; r += 2) ring(ctx, 8, 8, r, '#a39e91', 1)
    ring(ctx, 8, 8, 7, '#8f8a7d', 1)
  },
  leaves_birch(ctx) {
    baseNoise(ctx, ['#7fb069', '#6f9f59', '#8fc079', '#5f8f4a'], 59, 0.6)
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 ? '#4f7a3a' : '#a8d492'
      ctx.fillRect(Math.floor(hash2(i, 1, 191) * 16), Math.floor(hash2(i, 2, 192) * 16), 1, 1)
    }
  },
  flower_red(ctx) {
    ctx.clearRect(0, 0, 16, 16)
    ctx.fillStyle = '#3f7a2f'
    ctx.fillRect(7, 7, 2, 9)
    ctx.fillRect(5, 11, 2, 1)
    ctx.fillRect(9, 9, 2, 1)
    ctx.fillStyle = '#4a8c39'
    ctx.fillRect(6, 12, 1, 1)
    const petals = [[5, 3], [8, 2], [11, 3], [5, 6], [8, 5], [11, 6], [6, 4], [10, 4]]
    for (const [x, y] of petals) {
      ctx.fillStyle = '#d04a4a'
      ctx.fillRect(x, y, 3, 3)
    }
    ctx.fillStyle = '#e86a6a'
    ctx.fillRect(6, 3, 1, 1)
    ctx.fillStyle = '#f2d04a'
    ctx.fillRect(8, 4, 2, 2)
  },
  flower_yellow(ctx) {
    ctx.clearRect(0, 0, 16, 16)
    ctx.fillStyle = '#3f7a2f'
    ctx.fillRect(7, 7, 2, 9)
    ctx.fillRect(5, 10, 2, 1)
    ctx.fillRect(9, 12, 2, 1)
    const petals = [[5, 3], [8, 2], [11, 3], [5, 6], [8, 5], [11, 6], [6, 4], [10, 4]]
    for (const [x, y] of petals) {
      ctx.fillStyle = '#e8d04a'
      ctx.fillRect(x, y, 3, 3)
    }
    ctx.fillStyle = '#fff09a'
    ctx.fillRect(6, 3, 1, 1)
    ctx.fillStyle = '#c99a2a'
    ctx.fillRect(8, 4, 2, 2)
  },
  tall_grass(ctx) {
    ctx.clearRect(0, 0, 16, 16)
    const blades = [[3, 14, 2, 7], [6, 15, 3, 10], [9, 14, 2, 8], [12, 15, 2, 6], [1, 15, 1, 5]]
    for (const [x, y, w, h] of blades) {
      ctx.fillStyle = '#4a8c39'
      ctx.fillRect(x, y - h, w, h)
      ctx.fillStyle = '#6aac52'
      ctx.fillRect(x, y - h, 1, h)
      ctx.fillStyle = '#2c5d21'
      ctx.fillRect(x + w - 1, y - h + 2, 1, h - 2)
    }
    ctx.fillStyle = '#7fbe58'
    ctx.fillRect(7, 3, 1, 2)
    ctx.fillRect(11, 5, 1, 2)
  },
  dead_bush(ctx) {
    ctx.clearRect(0, 0, 16, 16)
    ctx.strokeStyle = '#7a5a2a'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(8, 15); ctx.lineTo(8, 8); ctx.lineTo(4, 4)
    ctx.moveTo(8, 9); ctx.lineTo(12, 5); ctx.lineTo(13, 2)
    ctx.moveTo(8, 11); ctx.lineTo(5, 8); ctx.lineTo(2, 8)
    ctx.moveTo(8, 12); ctx.lineTo(12, 10); ctx.lineTo(14, 11)
    ctx.stroke()
    ctx.fillStyle = '#9a7a3a'
    ctx.fillRect(4, 4, 1, 1)
    ctx.fillRect(12, 5, 1, 1)
  },
  crafting_top(ctx) {
    baseNoise(ctx, ['#b98b4e', '#ad8047', '#c69a5c'], 61, 0.3)
    ctx.strokeStyle = '#6b4b2a'
    ctx.lineWidth = 1
    ctx.strokeRect(1.5, 1.5, 13, 13)
    ctx.beginPath()
    ctx.moveTo(6, 2); ctx.lineTo(6, 14)
    ctx.moveTo(10, 2); ctx.lineTo(10, 14)
    ctx.moveTo(2, 6); ctx.lineTo(14, 6)
    ctx.moveTo(2, 10); ctx.lineTo(14, 10)
    ctx.stroke()
    ctx.fillStyle = '#8a6234'
    for (const [x, y] of [[3, 3], [11, 3], [3, 11], [11, 11]]) ctx.fillRect(x, y, 2, 2)
  },
  crafting_side(ctx) {
    painters.planks(ctx)
    ctx.fillStyle = '#6b4b2a'
    ctx.fillRect(1, 1, 14, 1)
    ctx.fillRect(1, 14, 14, 1)
    ctx.fillStyle = '#8a6234'
    ctx.fillRect(2, 4, 5, 2)
    ctx.fillRect(9, 7, 5, 2)
    ctx.fillStyle = '#d8d4c8'
    ctx.fillRect(4, 9, 1, 4)
    ctx.fillRect(11, 3, 1, 4)
  },
  furnace_front(ctx) {
    painters.stone(ctx)
    ctx.fillStyle = '#4a4a4a'
    ctx.fillRect(3, 5, 10, 8)
    ctx.fillStyle = '#2b2b2b'
    ctx.fillRect(4, 6, 8, 6)
    ctx.fillStyle = '#f2a03a'
    ctx.fillRect(5, 9, 6, 3)
    ctx.fillStyle = '#ffd76a'
    ctx.fillRect(6, 10, 2, 2)
    ctx.fillRect(9, 9, 1, 2)
    ctx.fillStyle = '#8a8a8a'
    ctx.fillRect(2, 2, 12, 1)
  },
  furnace_side(ctx) {
    painters.stone(ctx)
    ctx.fillStyle = '#6a6a6a'
    ctx.fillRect(2, 2, 12, 1)
    ctx.fillRect(2, 13, 12, 1)
  },
  furnace_top(ctx) {
    painters.stone(ctx)
    ring(ctx, 8, 8, 4, '#5a5a5a', 1)
    ctx.fillStyle = '#3a3a3a'
    ctx.fillRect(7, 7, 2, 2)
  },
  torch(ctx) {
    ctx.clearRect(0, 0, 16, 16)
    ctx.fillStyle = '#6b4b2a'
    ctx.fillRect(7, 7, 2, 8)
    ctx.fillStyle = '#8a6234'
    ctx.fillRect(7, 7, 1, 8)
    ctx.fillStyle = '#f2a03a'
    ctx.fillRect(6, 3, 4, 4)
    ctx.fillStyle = '#ffd76a'
    ctx.fillRect(7, 2, 2, 4)
    ctx.fillStyle = '#fff3b0'
    ctx.fillRect(7, 3, 1, 2)
  },
  mushroom_red(ctx) {
    ctx.clearRect(0, 0, 16, 16)
    ctx.fillStyle = '#e8e0d0'
    ctx.fillRect(7, 9, 2, 6)
    ctx.fillStyle = '#c0392b'
    ctx.fillRect(3, 4, 10, 6)
    ctx.fillRect(4, 3, 8, 1)
    ctx.fillRect(5, 10, 6, 1)
    ctx.fillStyle = '#f2e8d8'
    ctx.fillRect(5, 5, 2, 2)
    ctx.fillRect(9, 6, 2, 2)
    ctx.fillRect(7, 8, 1, 1)
  },
  mushroom_brown(ctx) {
    ctx.clearRect(0, 0, 16, 16)
    ctx.fillStyle = '#d8d0c0'
    ctx.fillRect(7, 9, 2, 6)
    ctx.fillStyle = '#9a6b4a'
    ctx.fillRect(3, 5, 10, 5)
    ctx.fillRect(4, 4, 8, 1)
    ctx.fillStyle = '#b98a62'
    ctx.fillRect(5, 5, 4, 2)
    ctx.fillStyle = '#7a4e32'
    ctx.fillRect(9, 8, 3, 1)
  },
  stone_bricks(ctx) {
    painters.stone(ctx)
    ctx.strokeStyle = '#5f5f5f'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, 5); ctx.lineTo(16, 5)
    ctx.moveTo(0, 11); ctx.lineTo(16, 11)
    ctx.moveTo(8, 0); ctx.lineTo(8, 5)
    ctx.moveTo(4, 5); ctx.lineTo(4, 11)
    ctx.moveTo(12, 5); ctx.lineTo(12, 11)
    ctx.moveTo(8, 11); ctx.lineTo(8, 16)
    ctx.stroke()
    ctx.fillStyle = '#a8a8a8'
    ctx.fillRect(1, 1, 6, 1)
    ctx.fillRect(9, 1, 6, 1)
    ctx.fillRect(5, 7, 6, 1)
    ctx.fillRect(1, 13, 6, 1)
    ctx.fillRect(9, 13, 6, 1)
  },
}

function wool(ctx, base, dark, light) {
  baseNoise(ctx, [base, dark, light], 200 + base.length, 0.55)
  for (let y = 0; y < 16; y += 2) {
    for (let x = (y / 2) % 2; x < 16; x += 4) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)'
      ctx.fillRect(x, y, 2, 1)
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(x + 1, y + 1, 1, 1)
    }
  }
}

export function createTextureAtlas() {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_SIZE
  canvas.height = ATLAS_SIZE
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const tileCanvases = new Map()
  const averages = new Map()

  for (let i = 0; i < TILE_NAMES.length; i++) {
    const name = TILE_NAMES[i]
    const col = i % ATLAS_COLS
    const row = Math.floor(i / ATLAS_COLS)
    const tile = document.createElement('canvas')
    tile.width = TILE_SIZE
    tile.height = TILE_SIZE
    const tctx = tile.getContext('2d')
    tctx.imageSmoothingEnabled = false
    tctx.save()
    tctx.scale(2, 2)
    painters[name](tctx)
    tctx.restore()
    tileCanvases.set(name, tile)
    ctx.drawImage(tile, col * TILE_SIZE, row * TILE_SIZE)

    const data = tctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data
    let r = 0, g = 0, b = 0, a = 0, count = 0
    for (let p = 0; p < data.length; p += 4) {
      if (data[p + 3] > 20) {
        r += data[p]; g += data[p + 1]; b += data[p + 2]; a += data[p + 3]; count++
      }
    }
    averages.set(name, count ? { r: r / count, g: g / count, b: b / count, a: a / count } : { r: 255, g: 0, b: 255, a: 255 })
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 4
  texture.needsUpdate = true

  return { texture, canvas, tileCanvases, averages, tileIndex }
}

export function tileUV(atlas, tileName, inset = 0.0015) {
  const idx = atlas.tileIndex.get(tileName) ?? 0
  const col = idx % ATLAS_COLS
  const row = Math.floor(idx / ATLAS_COLS)
  const u0 = (col * TILE_SIZE + inset * TILE_SIZE) / ATLAS_SIZE
  const u1 = ((col + 1) * TILE_SIZE - inset * TILE_SIZE) / ATLAS_SIZE
  const v1 = 1 - (row * TILE_SIZE + inset * TILE_SIZE) / ATLAS_SIZE
  const v0 = 1 - ((row + 1) * TILE_SIZE - inset * TILE_SIZE) / ATLAS_SIZE
  return [u0, v0, u1, v1]
}

export function createWaterTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, 64, 64)
  const grad = ctx.createLinearGradient(0, 0, 64, 64)
  grad.addColorStop(0, 'rgba(56, 128, 212, 0.72)')
  grad.addColorStop(0.55, 'rgba(40, 104, 188, 0.78)')
  grad.addColorStop(1, 'rgba(72, 150, 224, 0.72)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x++) {
      if (hash2(x, y, 311) < 0.34) {
        ctx.fillStyle = 'rgba(150, 208, 255, 0.24)'
        ctx.fillRect(x, y + Math.floor(hash2(x, y, 312) * 3), 3, 1)
      }
    }
  }
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = 'rgba(200, 236, 255, 0.22)'
    ctx.fillRect(Math.floor(hash2(i, 1, 321) * 64), Math.floor(hash2(i, 2, 322) * 64), 6, 1)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestMipmapLinearFilter
  texture.anisotropy = 4
  return texture
}

export function createCrackTextures() {
  const textures = []
  for (let stage = 0; stage < 5; stage++) {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 64, 64)
    ctx.strokeStyle = 'rgba(18, 18, 18, 0.82)'
    ctx.lineWidth = 3
    const count = 2 + stage * 3
    for (let i = 0; i < count; i++) {
      let x = 20 + hash3(i, stage, 1, 411) * 24
      let y = 20 + hash3(i, stage, 2, 412) * 24
      ctx.beginPath()
      ctx.moveTo(x, y)
      const steps = 3 + Math.floor(hash3(i, stage, 3, 413) * 3)
      for (let s = 0; s < steps; s++) {
        x += (hash3(i, stage, s, 414) - 0.5) * 22
        y += (hash3(i, stage, s, 415) - 0.5) * 22
        x = Math.max(2, Math.min(62, x))
        y = Math.max(2, Math.min(62, y))
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.magFilter = THREE.NearestFilter
    textures.push(texture)
  }
  return textures
}

export function createSunTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,240,1)')
  grad.addColorStop(0.28, 'rgba(255,244,190,1)')
  grad.addColorStop(0.45, 'rgba(255,220,130,0.85)')
  grad.addColorStop(0.75, 'rgba(255,190,90,0.18)')
  grad.addColorStop(1, 'rgba(255,180,80,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createMoonTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  const grad = ctx.createRadialGradient(64, 64, 18, 64, 64, 64)
  grad.addColorStop(0, 'rgba(238,244,255,1)')
  grad.addColorStop(0.4, 'rgba(206,220,240,0.9)')
  grad.addColorStop(0.62, 'rgba(160,180,210,0.12)')
  grad.addColorStop(1, 'rgba(140,160,200,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 128, 128)
  ctx.fillStyle = 'rgba(170,190,215,0.5)'
  ctx.beginPath(); ctx.arc(52, 54, 7, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(76, 74, 5, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(62, 82, 4, 0, Math.PI * 2); ctx.fill()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Build a 32x32 inventory icon from a block's atlas tiles. Isometric cube for
// solid blocks, flat sprite for flowers and torches.
export function makeBlockIcon(atlas, id) {
  const block = BLOCKS[id]
  if (!block) return null
  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const getTile = (name) => atlas.tileCanvases.get(name) || atlas.tileCanvases.get('stone')

  if (block.cross) {
    const tile = getTile(tileFor(id, 'side'))
    ctx.drawImage(tile, 4, 2, 40, 40)
    return canvas.toDataURL()
  }

  const top = getTile(tileFor(id, 'top'))
  const side = getTile(tileFor(id, 'side'))
  const bottom = getTile(tileFor(id, 'bottom'))
  const s = 40
  const x = 4
  const y = 5

  // Affine helper maps a 32x32 source tile onto a parallelogram.
  const drawFace = (tile, p0, p1, p2) => {
    const ax = (p1[0] - p0[0]) / 32
    const ay = (p1[1] - p0[1]) / 32
    const bx = (p2[0] - p0[0]) / 32
    const by = (p2[1] - p0[1]) / 32
    ctx.save()
    ctx.setTransform(ax, ay, bx, by, p0[0], p0[1])
    ctx.drawImage(tile, 0, 0)
    ctx.restore()
  }

  const topPts = [[x + s / 2, y], [x + s, y + s / 4], [x + s / 2, y + s / 2], [x, y + s / 4]]
  const leftPts = [[x, y + s / 4], [x + s / 2, y + s / 2], [x + s / 2, y + s], [x, y + s * 0.75]]
  const rightPts = [[x + s / 2, y + s / 2], [x + s, y + s / 4], [x + s, y + s * 0.75], [x + s / 2, y + s]]

  // Top face.
  drawFace(top, topPts[3], topPts[2], topPts[0])
  // Left face.
  drawFace(side, leftPts[0], leftPts[1], leftPts[3])
  // Right face (slightly darker).
  drawFace(side, rightPts[0], rightPts[1], rightPts[3])
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(rightPts[0][0], rightPts[0][1])
  for (let i = 1; i < rightPts.length; i++) ctx.lineTo(rightPts[i][0], rightPts[i][1])
  ctx.closePath()
  ctx.clip()
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(0, 0, size, size)
  ctx.restore()
  // Darken the underside of the cube.
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.75)
  ctx.lineTo(x + s / 2, y + s)
  ctx.lineTo(x + s, y + s * 0.75)
  ctx.lineTo(x + s, y + s * 0.8)
  ctx.lineTo(x + s / 2, y + s * 1.04)
  ctx.lineTo(x, y + s * 0.8)
  ctx.closePath()
  ctx.clip()
  ctx.fillStyle = 'rgba(0,0,0,0.1)'
  ctx.fillRect(0, 0, size, size)
  ctx.restore()
  return canvas.toDataURL()
}
