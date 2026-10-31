// Block registry. Numeric ids are what get stored in chunk arrays and saves.

export const AIR = 0
export const WATER = 12
export const GLASS = 11
export const ICE = 32
export const BEDROCK = 13
export const GLOWSTONE = 21

export const BLOCKS = [
  null,
  { name: 'Grass Block', tiles: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' }, solid: true, opaque: true, breakTime: 0.26, sound: 'grass', icon: 'grass_top' },
  { name: 'Dirt', tiles: { all: 'dirt' }, solid: true, opaque: true, breakTime: 0.22, sound: 'grass', icon: 'dirt' },
  { name: 'Stone', tiles: { all: 'stone' }, solid: true, opaque: true, breakTime: 0.55, sound: 'stone', icon: 'stone' },
  { name: 'Cobblestone', tiles: { all: 'cobble' }, solid: true, opaque: true, breakTime: 0.55, sound: 'stone', icon: 'cobble' },
  { name: 'Sand', tiles: { all: 'sand' }, solid: true, opaque: true, breakTime: 0.22, sound: 'sand', icon: 'sand' },
  { name: 'Sandstone', tiles: { top: 'sandstone_top', side: 'sandstone_side', bottom: 'sandstone_top' }, solid: true, opaque: true, breakTime: 0.5, sound: 'stone', icon: 'sandstone_side' },
  { name: 'Gravel', tiles: { all: 'gravel' }, solid: true, opaque: true, breakTime: 0.28, sound: 'gravel', icon: 'gravel' },
  { name: 'Oak Log', tiles: { top: 'log_top', side: 'log_side', bottom: 'log_top' }, solid: true, opaque: true, breakTime: 0.55, sound: 'wood', icon: 'log_side' },
  { name: 'Oak Leaves', tiles: { all: 'leaves' }, solid: true, opaque: true, breakTime: 0.12, sound: 'grass', icon: 'leaves' },
  { name: 'Oak Planks', tiles: { all: 'planks' }, solid: true, opaque: true, breakTime: 0.5, sound: 'wood', icon: 'planks' },
  { name: 'Glass', tiles: { all: 'glass' }, solid: true, opaque: false, transparent: true, breakTime: 0.14, sound: 'glass', icon: 'glass' },
  { name: 'Water', tiles: { all: 'water' }, solid: false, opaque: false, liquid: true, breakTime: 0, sound: 'water', icon: 'water' },
  { name: 'Bedrock', tiles: { all: 'bedrock' }, solid: true, opaque: true, breakTime: Infinity, sound: 'stone', icon: 'bedrock' },
  { name: 'Snow Block', tiles: { all: 'snow' }, solid: true, opaque: true, breakTime: 0.18, sound: 'snow', icon: 'snow' },
  { name: 'Coal Ore', tiles: { all: 'coal' }, solid: true, opaque: true, breakTime: 0.7, sound: 'stone', icon: 'coal' },
  { name: 'Iron Ore', tiles: { all: 'iron' }, solid: true, opaque: true, breakTime: 0.75, sound: 'stone', icon: 'iron' },
  { name: 'Gold Ore', tiles: { all: 'gold' }, solid: true, opaque: true, breakTime: 0.8, sound: 'stone', icon: 'gold' },
  { name: 'Diamond Ore', tiles: { all: 'diamond' }, solid: true, opaque: true, breakTime: 0.9, sound: 'stone', icon: 'diamond' },
  { name: 'Bricks', tiles: { all: 'brick' }, solid: true, opaque: true, breakTime: 0.6, sound: 'stone', icon: 'brick' },
  { name: 'Obsidian', tiles: { all: 'obsidian' }, solid: true, opaque: true, breakTime: 2.5, sound: 'stone', icon: 'obsidian' },
  { name: 'Glowstone', tiles: { all: 'glowstone' }, solid: true, opaque: true, glow: true, breakTime: 0.35, sound: 'glass', icon: 'glowstone' },
  { name: 'TNT', tiles: { top: 'tnt_top', side: 'tnt_side', bottom: 'tnt_top' }, solid: true, opaque: true, breakTime: 0.2, sound: 'grass', icon: 'tnt_side' },
  { name: 'Bookshelf', tiles: { top: 'planks', side: 'bookshelf', bottom: 'planks' }, solid: true, opaque: true, breakTime: 0.5, sound: 'wood', icon: 'bookshelf' },
  { name: 'White Wool', tiles: { all: 'wool_white' }, solid: true, opaque: true, breakTime: 0.3, sound: 'wool', icon: 'wool_white' },
  { name: 'Red Wool', tiles: { all: 'wool_red' }, solid: true, opaque: true, breakTime: 0.3, sound: 'wool', icon: 'wool_red' },
  { name: 'Blue Wool', tiles: { all: 'wool_blue' }, solid: true, opaque: true, breakTime: 0.3, sound: 'wool', icon: 'wool_blue' },
  { name: 'Yellow Wool', tiles: { all: 'wool_yellow' }, solid: true, opaque: true, breakTime: 0.3, sound: 'wool', icon: 'wool_yellow' },
  { name: 'Green Wool', tiles: { all: 'wool_green' }, solid: true, opaque: true, breakTime: 0.3, sound: 'wool', icon: 'wool_green' },
  { name: 'Black Wool', tiles: { all: 'wool_black' }, solid: true, opaque: true, breakTime: 0.3, sound: 'wool', icon: 'wool_black' },
  { name: 'Pumpkin', tiles: { top: 'pumpkin_top', side: 'pumpkin_side', bottom: 'pumpkin_top' }, solid: true, opaque: true, breakTime: 0.35, sound: 'wood', icon: 'pumpkin_side' },
  { name: 'Cactus', tiles: { top: 'cactus_top', side: 'cactus_side', bottom: 'cactus_top' }, solid: true, opaque: true, breakTime: 0.25, sound: 'grass', icon: 'cactus_side' },
  { name: 'Ice', tiles: { all: 'ice' }, solid: true, opaque: false, transparent: true, breakTime: 0.3, sound: 'glass', icon: 'ice' },
  { name: 'Mossy Stone', tiles: { all: 'mossy' }, solid: true, opaque: true, breakTime: 0.55, sound: 'stone', icon: 'mossy' },
  { name: 'Clay', tiles: { all: 'clay' }, solid: true, opaque: true, breakTime: 0.3, sound: 'gravel', icon: 'clay' },
  { name: 'Birch Log', tiles: { top: 'birch_top', side: 'birch_side', bottom: 'birch_top' }, solid: true, opaque: true, breakTime: 0.5, sound: 'wood', icon: 'birch_side' },
  { name: 'Birch Leaves', tiles: { all: 'leaves_birch' }, solid: true, opaque: true, breakTime: 0.12, sound: 'grass', icon: 'leaves_birch' },
  { name: 'Poppy', tiles: { all: 'flower_red' }, solid: false, opaque: false, cross: true, breakTime: 0.05, sound: 'grass', icon: 'flower_red' },
  { name: 'Dandelion', tiles: { all: 'flower_yellow' }, solid: false, opaque: false, cross: true, breakTime: 0.05, sound: 'grass', icon: 'flower_yellow' },
  { name: 'Tall Grass', tiles: { all: 'tall_grass' }, solid: false, opaque: false, cross: true, breakTime: 0.05, sound: 'grass', icon: 'tall_grass' },
  { name: 'Dead Bush', tiles: { all: 'dead_bush' }, solid: false, opaque: false, cross: true, breakTime: 0.05, sound: 'grass', icon: 'dead_bush' },
  { name: 'Crafting Table', tiles: { top: 'crafting_top', side: 'crafting_side', bottom: 'planks' }, solid: true, opaque: true, breakTime: 0.45, sound: 'wood', icon: 'crafting_top' },
  { name: 'Furnace', tiles: { top: 'furnace_top', side: 'furnace_side', bottom: 'furnace_top', front: 'furnace_front' }, solid: true, opaque: true, breakTime: 0.55, sound: 'stone', icon: 'furnace_front' },
  { name: 'Torch', tiles: { all: 'torch' }, solid: false, opaque: false, cross: true, breakTime: 0.05, sound: 'wood', icon: 'torch' },
  { name: 'Emerald Ore', tiles: { all: 'emerald' }, solid: true, opaque: true, breakTime: 0.85, sound: 'stone', icon: 'emerald' },
  { name: 'Red Mushroom', tiles: { all: 'mushroom_red' }, solid: false, opaque: false, cross: true, breakTime: 0.05, sound: 'grass', icon: 'mushroom_red' },
  { name: 'Brown Mushroom', tiles: { all: 'mushroom_brown' }, solid: false, opaque: false, cross: true, breakTime: 0.05, sound: 'grass', icon: 'mushroom_brown' },
  { name: 'Stone Bricks', tiles: { all: 'stone_bricks' }, solid: true, opaque: true, breakTime: 0.6, sound: 'stone', icon: 'stone_bricks' },
]

// Blocks that can be overwritten by placing a block into them.
export function isReplaceable(id) {
  return id === AIR || id === WATER || (BLOCKS[id] && (BLOCKS[id].cross || false))
}

export function isOpaque(id) {
  const b = BLOCKS[id]
  return !!(b && b.opaque)
}

export function isSolid(id) {
  const b = BLOCKS[id]
  return !!(b && b.solid)
}

export function isLiquid(id) {
  const b = BLOCKS[id]
  return !!(b && b.liquid)
}

export function tileFor(id, face) {
  const b = BLOCKS[id]
  if (!b) return 'stone'
  const t = b.tiles
  if (t.all) return t.all
  if (face === 'top') return t.top
  if (face === 'bottom') return t.bottom
  if (face === 'front' && t.front) return t.front
  return t.side
}

// Natural block palette used by particles and map accents.
export const PARTICLE_COLORS = {
  1: 0x6aa84f, 2: 0x8b5a2b, 3: 0x888888, 4: 0x777777, 5: 0xd8c68a, 6: 0xcbb47a,
  7: 0x8a8580, 8: 0x6b4b2a, 9: 0x3f7a2f, 10: 0xb98b4e, 11: 0xbfe8ff, 12: 0x3b7fd4,
  13: 0x333333, 14: 0xf4f8ff, 15: 0x5a5a5a, 16: 0xb08a72, 17: 0xe7c34a, 18: 0x5ee0d0,
  19: 0xa34b3b, 20: 0x1a1226, 21: 0xf5d76e, 22: 0xc0392b, 23: 0x9a6b3a, 24: 0xeeeeee,
  25: 0xcf4a4a, 26: 0x4a6fcf, 27: 0xe0c04a, 28: 0x4a9f5a, 29: 0x333333, 30: 0xd67a2a,
  31: 0x4d7a3a, 32: 0xbfe8ff, 33: 0x5f7a55, 34: 0x9aa0a8, 35: 0xd8d4c8, 36: 0x7fb069,
  37: 0xd04a4a, 38: 0xe8d04a, 39: 0x5f8a3a, 40: 0x7a5a2a, 41: 0xa87a44, 42: 0x777777,
  43: 0xe8c04a, 44: 0x3ecf8e, 45: 0xc0392b, 46: 0x9a6b4a, 47: 0x8a8a8a,
}
