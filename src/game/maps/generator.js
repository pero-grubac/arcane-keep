import { mulberry32, randomSeed, shuffle, intRange } from '../rng.js'

// ─── Random map generation ────────────────────────────────────────────────────
// The old generator did a biased random walk and gave up on dead ends, which
// could emit a 22-cell straight line or a path that folded back onto itself.
//
// This one walks a half-resolution lattice instead: path nodes only ever sit on
// even coordinates, and consecutive nodes are joined through the odd cell
// between them. Two consequences fall out for free:
//   • a randomised DFS with backtracking always reaches the exit, so there is
//     no "give up and draw a straight line" fallback, and
//   • parallel corridors are always separated by exactly one empty tile, so the
//     path can never touch itself and every map stays readable and buildable.

export const GEN_COLS = 23
export const GEN_ROWS = 13

const NODE_W = (GEN_COLS + 1) / 2 // 12 lattice columns
const NODE_H = (GEN_ROWS + 1) / 2 // 7 lattice rows

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

// Randomised depth-first search across the lattice. Always finds the exit.
function dfsNodePath(rng, start, end) {
  const key = (c, r) => r * NODE_W + c
  const visited = new Set([key(start[0], start[1])])
  const stack = [start]

  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1]
    if (cx === end[0] && cy === end[1]) return stack.slice()

    const options = shuffle(rng, DIRS.slice()).filter(([dx, dy]) => {
      const nx = cx + dx
      const ny = cy + dy
      return (
        nx >= 0 && nx < NODE_W && ny >= 0 && ny < NODE_H && !visited.has(key(nx, ny))
      )
    })

    if (options.length === 0) {
      stack.pop()
      continue
    }
    const [dx, dy] = options[0]
    const next = [cx + dx, cy + dy]
    visited.add(key(next[0], next[1]))
    stack.push(next)
  }
  return null
}

function nodesToCells(nodes) {
  const cells = []
  for (let i = 0; i < nodes.length; i++) {
    const [nx, ny] = nodes[i]
    const cell = [nx * 2, ny * 2]
    if (i > 0) {
      const [px, py] = nodes[i - 1]
      cells.push([px * 2 + (nx - px), py * 2 + (ny - py)]) // the joining tile
    }
    cells.push(cell)
  }
  return cells
}

// Generate several candidates and keep one with a satisfying amount of winding.
function buildPath(rng, startRow = null, targetRatio = 0.45) {
  const sr = startRow ?? intRange(rng, 0, NODE_H - 1)
  const endRow = intRange(rng, 0, NODE_H - 1)
  const target = NODE_W * NODE_H * targetRatio

  let best = null
  for (let attempt = 0; attempt < 24; attempt++) {
    const nodes = dfsNodePath(rng, [0, sr], [NODE_W - 1, endRow])
    if (!nodes) continue
    const score = -Math.abs(nodes.length - target)
    if (!best || score > best.score) best = { nodes, score }
    if (nodes.length >= target && nodes.length <= target * 1.5) break
  }
  if (!best) return null
  return { nodes: best.nodes, cells: nodesToCells(best.nodes) }
}

// ─── Branching ────────────────────────────────────────────────────────────────
// A second lane that merges into the first. The tributary is forbidden from
// using any node on the main path OR lattice-adjacent to it (except the junction
// itself), which preserves the one-empty-tile separation the lattice gives us —
// two lanes can never end up running shoulder to shoulder.

function dfsAvoiding(rng, start, end, blocked) {
  const key = (c, r) => r * NODE_W + c
  const visited = new Set([key(start[0], start[1])])
  const stack = [start]

  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1]
    if (cx === end[0] && cy === end[1]) return stack.slice()

    const options = shuffle(rng, DIRS.slice()).filter(([dx, dy]) => {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || nx >= NODE_W || ny < 0 || ny >= NODE_H) return false
      if (visited.has(key(nx, ny))) return false
      // The junction is the one blocked node we are allowed to enter.
      if (blocked.has(key(nx, ny)) && !(nx === end[0] && ny === end[1])) return false
      return true
    })

    if (options.length === 0) {
      stack.pop()
      continue
    }
    const [dx, dy] = options[0]
    const next = [cx + dx, cy + dy]
    visited.add(key(next[0], next[1]))
    stack.push(next)
  }
  return null
}

function buildBranch(rng, mainNodes, mainStartRow) {
  const key = (c, r) => r * NODE_W + c
  const mainSet = new Set(mainNodes.map(([c, r]) => key(c, r)))

  const blocked = new Set(mainSet)
  for (const [c, r] of mainNodes) {
    for (const [dc, dr] of DIRS) {
      const nc = c + dc
      const nr = r + dr
      if (nc >= 0 && nc < NODE_W && nr >= 0 && nr < NODE_H) blocked.add(key(nc, nr))
    }
  }

  // Join no later than 70% along, so the shared run to the keep is always at
  // least ~30% of the main path. A junction right next to the keep leaves too
  // little common ground to defend and makes the map unfairly punishing.
  const tryOrder = shuffle(rng, [0.45, 0.55, 0.62, 0.7].slice())
  for (const frac of tryOrder) {
    const jIdx = Math.min(Math.floor(mainNodes.length * frac), mainNodes.length - 2)
    const junction = mainNodes[jIdx]

    const allowed = new Set([key(junction[0], junction[1])])
    for (const [dc, dr] of DIRS) {
      const nc = junction[0] + dc
      const nr = junction[1] + dr
      if (nc < 0 || nc >= NODE_W || nr < 0 || nr >= NODE_H) continue
      // Re-open the approach, but never a node that is itself on the main path.
      if (!mainSet.has(key(nc, nr))) allowed.add(key(nc, nr))
    }
    const effective = new Set([...blocked].filter((k) => !allowed.has(k)))

    const candidates = []
    for (let r = 0; r < NODE_H; r++) {
      if (r === mainStartRow) continue
      if (effective.has(key(0, r))) continue
      candidates.push(r)
    }
    shuffle(rng, candidates)

    for (const startRow of candidates) {
      const nodes = dfsAvoiding(rng, [0, startRow], junction, effective)
      if (nodes && nodes.length >= 4) {
        const mergeAt = jIdx
        // Tributary, then the shared run to the keep.
        return { nodes: nodes.concat(mainNodes.slice(mergeAt + 1)), junction }
      }
    }
  }
  return null
}

// ─── Themes ───────────────────────────────────────────────────────────────────

// Ground stays near-black; the road is deliberately several stops lighter and
// warmer. Low path/ground contrast was the single worst readability problem in
// the original build — you could not see where the enemies would walk.
export const THEMES = [
  {
    id: 'moor', name: 'Blighted Moor', emoji: '🌾',
    pathFg: '#4a4230', pathBg: '#2e2a1c', pathEdge: '#14120a',
    cellBg: '#0d0f16', cellAlt: '#0a0c12', accent: '#8a7440', decor: 'grass',
  },
  {
    id: 'ember', name: 'Ember Wastes', emoji: '🔥',
    pathFg: '#4e3026', pathBg: '#331c16', pathEdge: '#150a08',
    cellBg: '#130d10', cellAlt: '#0f090c', accent: '#b8542c', decor: 'rubble',
  },
  {
    id: 'glade', name: 'Verdant Glade', emoji: '🌿',
    pathFg: '#443a26', pathBg: '#2b2418', pathEdge: '#10140e',
    cellBg: '#0a1310', cellAlt: '#07100c', accent: '#4aa050', decor: 'trees',
  },
  {
    id: 'abyss', name: 'Abyssal Rift', emoji: '🌌',
    pathFg: '#39406a', pathBg: '#232847', pathEdge: '#0c0e1c',
    cellBg: '#0a0b16', cellAlt: '#070811', accent: '#6a6ae0', decor: 'crystals',
  },
  {
    id: 'tundra', name: 'Frozen Reach', emoji: '❄️',
    pathFg: '#3d4c5c', pathBg: '#26313d', pathEdge: '#0d1218',
    cellBg: '#0b1016', cellAlt: '#080c11', accent: '#74a8c8', decor: 'crystals',
  },
]

const NAME_A = ['Hollow', 'Grim', 'Ashen', 'Weeping', 'Sable', 'Thorn', 'Rune', 'Pale', 'Storm', 'Gilded']
const NAME_B = ['march', 'fell', 'reach', 'hold', 'barrow', 'moor', 'spire', 'vale', 'gate', 'wend']

// ─── Terrain ──────────────────────────────────────────────────────────────────
// Buildable ground is no longer uniform. Water blocks building outright, high
// ground extends range, and rubble has to be cleared before you can build.

export const TERRAIN = {
  water: {
    id: 'water', label: 'Water', buildable: false, extraCost: 0,
    blurb: 'Cannot be built on',
  },
  high: {
    id: 'high', label: 'High ground', buildable: true, extraCost: 0,
    blurb: '+15% range for the tower placed here',
  },
  rubble: {
    id: 'rubble', label: 'Rubble', buildable: true, extraCost: 25,
    blurb: 'Costs 25g extra to clear',
  },
}

// Grows a blob of `kind` from a seed tile so water and high ground form
// coherent regions instead of confetti.
function adjacentToPath(pathSet, c, r) {
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (pathSet.has(`${c + dc},${r + dr}`)) return true
  }
  return false
}

function growBlob(rng, terrain, pathSet, cols, rows, kind, seed, size) {
  const frontier = [seed]
  let placed = 0
  while (frontier.length && placed < size) {
    const i = Math.floor(rng() * frontier.length)
    const [c, r] = frontier.splice(i, 1)[0]
    const key = `${c},${r}`
    if (c < 0 || r < 0 || c >= cols || r >= rows) continue
    if (pathSet.has(key) || terrain[key]) continue
    // Water never takes the tiles immediately beside the road — those are the
    // spots the player most needs, and losing them can make a map unwinnable.
    if (kind === 'water' && adjacentToPath(pathSet, c, r)) continue
    terrain[key] = kind
    placed++
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (rng() < 0.75) frontier.push([c + dc, r + dr])
    }
  }
  return placed
}

function buildTerrain(rng, cols, rows, pathSet) {
  const terrain = {}
  const area = cols * rows

  // Water and high ground come in patches; rubble is scattered.
  const waterBlobs = 1 + Math.floor(rng() * 3)
  for (let i = 0; i < waterBlobs; i++) {
    growBlob(rng, terrain, pathSet, cols, rows, 'water',
      [Math.floor(rng() * cols), Math.floor(rng() * rows)],
      3 + Math.floor(rng() * 6))
  }
  const highBlobs = 1 + Math.floor(rng() * 3)
  for (let i = 0; i < highBlobs; i++) {
    growBlob(rng, terrain, pathSet, cols, rows, 'high',
      [Math.floor(rng() * cols), Math.floor(rng() * rows)],
      3 + Math.floor(rng() * 5))
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${c},${r}`
      if (pathSet.has(key) || terrain[key]) continue
      if (rng() < 0.05) terrain[key] = 'rubble'
    }
  }

  // Safety valve: never let terrain swallow the map.
  const blocked = Object.values(terrain).filter((t) => t === 'water').length
  if (blocked > area * 0.14) {
    for (const k of Object.keys(terrain)) {
      if (terrain[k] === 'water' && rng() < 0.4) delete terrain[k]
    }
  }
  return terrain
}

// Deterministic scenery for empty tiles — purely decorative.
function buildDecor(rng, cols, rows, pathSet) {
  const decor = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (pathSet.has(`${c},${r}`)) continue
      if (rng() < 0.11) decor.push({ c, r, variant: Math.floor(rng() * 3), jx: rng(), jy: rng() })
    }
  }
  return decor
}

export function generateMap(seed) {
  const actualSeed = seed ?? randomSeed()
  const rng = mulberry32(actualSeed)
  const theme = THEMES[Math.floor(rng() * THEMES.length) % THEMES.length]

  // Branching maps get a deliberately shorter main path, or the tributary has
  // nowhere left to run.
  const wantBranch = rng() < 0.4
  const main = buildPath(rng, null, wantBranch ? 0.26 : 0.45)
  // The lattice DFS is exhaustive, so this only trips if the constants above
  // are ever changed to something degenerate. Keep a sane serpentine fallback.
  let path = main ? main.cells : serpentine(GEN_COLS, GEN_ROWS)
  if (path.length < 8) path = serpentine(GEN_COLS, GEN_ROWS)

  const paths = [path]
  if (main && wantBranch) {
    const branch = buildBranch(rng, main.nodes, main.nodes[0][1])
    if (branch) paths.push(nodesToCells(branch.nodes))
  }

  const pathSet = new Set(paths.flat().map(([c, r]) => `${c},${r}`))
  const name = `${NAME_A[Math.floor(rng() * NAME_A.length)]}${NAME_B[Math.floor(rng() * NAME_B.length)]}`
  const terrain = buildTerrain(rng, GEN_COLS, GEN_ROWS, pathSet)

  return {
    id: `random_${actualSeed}`,
    seed: actualSeed,
    name,
    cols: GEN_COLS,
    rows: GEN_ROWS,
    theme,
    path,
    paths,
    branching: paths.length > 1,
    terrain,
    decor: buildDecor(rng, GEN_COLS, GEN_ROWS, pathSet),
    isRandom: true,
  }
}

function serpentine(cols, rows) {
  const path = []
  let row = 0
  let dir = 1
  let col = 0
  while (row < rows) {
    while (col >= 0 && col < cols) {
      path.push([col, row])
      col += dir
    }
    col -= dir
    dir *= -1
    row += 2
    if (row < rows) {
      path.push([col, row - 1])
    }
  }
  return path
}

// Attaches generated scenery to the handcrafted maps too.
export function decorateMap(map) {
  if (map.decor) return map
  const rng = mulberry32(
    map.id.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7),
  )
  const pathSet = new Set(map.path.map(([c, r]) => `${c},${r}`))
  return {
    ...map,
    terrain: map.terrain ?? buildTerrain(rng, map.cols, map.rows, pathSet),
    decor: buildDecor(rng, map.cols, map.rows, pathSet),
  }
}
