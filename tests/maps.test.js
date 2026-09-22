import { describe, it, expect } from 'vitest'
import { generateMap, TERRAIN, GEN_COLS, GEN_ROWS } from '../src/game/maps/generator.js'
import { HANDCRAFTED_MAPS } from '../src/game/maps/index.js'
import { makeGameState, buildCheck, pathsOf, pathSetOf } from '../src/game/engine.js'

// A map with a broken path is unplayable in a way that is hard to notice by
// eye, so every structural guarantee the generator makes is asserted here.

const SEEDS = Array.from({ length: 120 }, (_, i) => i + 1)

function isContiguous(path) {
  for (let i = 1; i < path.length; i++) {
    const d = Math.abs(path[i][0] - path[i - 1][0]) + Math.abs(path[i][1] - path[i - 1][1])
    if (d !== 1) return false
  }
  return true
}

function selfTouches(path) {
  const index = new Map(path.map((p, i) => [`${p[0]},${p[1]}`, i]))
  for (let i = 0; i < path.length; i++) {
    const [c, r] = path[i]
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = index.get(`${c + dc},${r + dr}`)
      if (j !== undefined && Math.abs(j - i) > 1) return true
    }
  }
  return false
}

describe('generated maps', () => {
  it('produce a contiguous path from the left edge to the right edge', () => {
    for (const seed of SEEDS) {
      const m = generateMap(seed)
      for (const lane of pathsOf(m)) {
        expect(isContiguous(lane), `seed ${seed} lane not contiguous`).toBe(true)
        expect(lane[0][0], `seed ${seed} does not start on the left edge`).toBe(0)
        for (const [c, r] of lane) {
          expect(c >= 0 && c < m.cols && r >= 0 && r < m.rows, `seed ${seed} off-map`).toBe(true)
        }
      }
    }
  })

  it('never let a lane touch itself', () => {
    // This is the property the half-resolution lattice buys us: corridors are
    // always separated by one empty tile, so the road stays readable.
    for (const seed of SEEDS) {
      const m = generateMap(seed)
      for (const lane of pathsOf(m)) {
        expect(selfTouches(lane), `seed ${seed} path folds onto itself`).toBe(false)
      }
    }
  })

  it('never repeat a tile within one lane', () => {
    for (const seed of SEEDS) {
      for (const lane of pathsOf(generateMap(seed))) {
        const unique = new Set(lane.map((c) => c.join(',')))
        expect(unique.size, `seed ${seed} revisits a tile`).toBe(lane.length)
      }
    }
  })

  it('are reproducible from their seed', () => {
    for (const seed of [1, 42, 4242]) {
      expect(JSON.stringify(generateMap(seed))).toBe(JSON.stringify(generateMap(seed)))
    }
    expect(JSON.stringify(generateMap(1))).not.toBe(JSON.stringify(generateMap(2)))
  })

  it('stay a sensible length', () => {
    for (const seed of SEEDS) {
      const m = generateMap(seed)
      expect(m.path.length).toBeGreaterThan(20)
      expect(m.path.length).toBeLessThanOrEqual(GEN_COLS * GEN_ROWS)
    }
  })
})

describe('terrain', () => {
  it('never puts water on a tile beside the road', () => {
    // Roadside tiles are the ones the player most needs; walling them off can
    // make a map unwinnable.
    for (const seed of SEEDS) {
      const m = generateMap(seed)
      const pathSet = pathSetOf(m)
      for (const [key, kind] of Object.entries(m.terrain)) {
        if (kind !== 'water') continue
        const [c, r] = key.split(',').map(Number)
        const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .some(([dc, dr]) => pathSet.has(`${c + dc},${r + dr}`))
        expect(beside, `seed ${seed} water at ${key} blocks the roadside`).toBe(false)
      }
    }
  })

  it('never covers the road itself', () => {
    for (const seed of SEEDS) {
      const m = generateMap(seed)
      const pathSet = pathSetOf(m)
      for (const key of Object.keys(m.terrain)) {
        expect(pathSet.has(key), `seed ${seed} terrain on the road at ${key}`).toBe(false)
      }
    }
  })

  it('leaves plenty of buildable ground beside the road', () => {
    for (const seed of SEEDS) {
      const m = generateMap(seed)
      const state = makeGameState(m, seed)
      const lanes = pathsOf(m).flat()
      const pathSet = pathSetOf(m)
      let spots = 0
      for (let r = 0; r < m.rows; r++) {
        for (let c = 0; c < m.cols; c++) {
          if (pathSet.has(`${c},${r}`)) continue
          if (!buildCheck(state, c, r).ok) continue
          if (lanes.some(([pc, pr]) => Math.hypot(pc - c, pr - r) <= 1.6)) spots++
        }
      }
      expect(spots, `seed ${seed} has too few build spots`).toBeGreaterThan(30)
    }
  })

  it('applies the documented build rules', () => {
    const m = generateMap(1)
    const state = makeGameState(m, 1)
    const found = { water: false, rubble: false, high: false }
    for (const [key, kind] of Object.entries(m.terrain)) {
      const [c, r] = key.split(',').map(Number)
      const res = buildCheck(state, c, r)
      if (kind === 'water') {
        expect(res.ok).toBe(false)
        found.water = true
      } else {
        expect(res.ok).toBe(true)
        expect(res.extraCost).toBe(TERRAIN[kind].extraCost)
        found[kind] = true
      }
    }
    expect(found.water).toBe(true)
  })
})

describe('branching maps', () => {
  const branching = SEEDS.map(generateMap).filter((m) => m.branching)

  it('are generated at a reasonable rate', () => {
    expect(branching.length).toBeGreaterThan(10)
    expect(branching.length).toBeLessThan(SEEDS.length * 0.7)
  })

  it('have lanes that start apart and end together', () => {
    for (const m of branching) {
      const lanes = pathsOf(m)
      expect(lanes.length).toBe(2)
      const starts = new Set(lanes.map((p) => p[0].join(',')))
      expect(starts.size, `${m.name} lanes share a start`).toBe(2)
      const ends = new Set(lanes.map((p) => p[p.length - 1].join(',')))
      expect(ends.size, `${m.name} lanes end apart`).toBe(1)
    }
  })

  it('share a decent run to the keep', () => {
    // Merging right next to the keep leaves too little common ground to defend.
    for (const m of branching) {
      const [a, b] = pathsOf(m)
      const first = new Set(a.map((c) => c.join(',')))
      const shared = b.filter((c) => first.has(c.join(','))).length
      expect(shared, `${m.name} merges too late`).toBeGreaterThanOrEqual(8)
      expect(shared / a.length, `${m.name} shared tail too short`).toBeGreaterThan(0.2)
    }
  })
})

describe('handcrafted maps', () => {
  it('have contiguous, non-self-touching paths', () => {
    for (const m of HANDCRAFTED_MAPS) {
      expect(isContiguous(m.path), `${m.name} not contiguous`).toBe(true)
      expect(selfTouches(m.path), `${m.name} folds onto itself`).toBe(false)
    }
  })

  it('get terrain and scenery attached', () => {
    for (const m of HANDCRAFTED_MAPS) {
      expect(m.decor.length).toBeGreaterThan(0)
      expect(m.terrain).toBeTypeOf('object')
    }
  })
})
