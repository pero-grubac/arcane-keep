import { Enemy, scaledEnemy } from './enemies.js'
import { calcStats, supportAura, isSupport, PROJ_COLORS, DEFAULT_TARGETING } from './towers.js'
import { buildWave, clearBonus, earlyBonus } from './waves.js'
import { mulberry32, hashSeed } from './rng.js'
import { ABILITY_BY_ID, makeAbilityState } from './abilities.js'
import { TERRAIN } from './maps/generator.js'

// ─── Simulation ───────────────────────────────────────────────────────────────
// Everything in here works in TILE space and seconds. The renderer is the only
// thing that multiplies by cell size, so resizing the window can never desync
// the simulation from the grid.
//
// The loop runs on a fixed substep. At 4× speed a single animation frame can
// represent 60ms, and the old build moved projectiles in one 60ms jump — far
// enough to teleport straight through an enemy and orbit it forever.

const SUBSTEP = 1 / 60
const MAX_SUBSTEPS = 8

// Sound events are queued here and drained by the audio layer each frame, so
// the simulation stays headless and the balance sim keeps running unchanged.
const MAX_SFX_PER_FRAME = 24

function sfx(state, kind, key) {
  if (state.sfx.length >= MAX_SFX_PER_FRAME) return
  state.sfx.push({ kind, key })
}

export function makeGameState(map, seed) {
  return {
    phase: 'playing', // 'playing' | 'gameover' | 'victory'
    paused: false,
    seed,
    // Gameplay rolls (crits, freezes, stuns) come from here so a seed
    // reproduces the fight, not just the map and the wave composition.
    // Cosmetic jitter deliberately stays on Math.random().
    rng: mulberry32(hashSeed(seed, 0x5eed)),
    sfx: [],
    acc: 0,
    // Active abilities: remaining cooldown per id, plus the one awaiting a
    // target click and the live Rally timer.
    abilityCd: makeAbilityState(),
    pendingAbility: null,
    rallyT: 0,
    time: 0,
    wave: 0,
    gold: 220,
    lives: 20,
    kills: 0,
    leaked: 0,
    gameSpeed: 1,
    waveActive: false,
    waveData: null,
    spawnQueue: [],
    spawnTimer: 0,
    spawnCount: 0,
    currentMap: map,
    towers: [],
    enemies: [],
    projectiles: [],
    particles: [],
    dmgNums: [],
    effects: [],
    hazards: [],
    selectedBuild: 'archer',
    selectedTowerId: null,
    hoverCell: null,
    towerCounts: { archer: 0, mage: 0, frost: 0, cannon: 0, obelisk: 0 },
  }
}

let nextTowerId = 1

// A map may have more than one lane. `path` stays the primary for anything that
// only needs one; `paths` is the full set.
export function pathsOf(map) {
  return map.paths ?? [map.path]
}

export function pathSetOf(map) {
  if (!map._pathSet) {
    map._pathSet = new Set(pathsOf(map).flat().map(([c, r]) => `${c},${r}`))
  }
  return map._pathSet
}

export function terrainAt(map, col, row) {
  return map.terrain?.[`${col},${row}`] ?? null
}

// The single place that decides whether a tile can be built on, shared by the
// click handler and the hover preview so they can never disagree.
export function buildCheck(state, col, row) {
  const map = state.currentMap
  if (col < 0 || row < 0 || col >= map.cols || row >= map.rows) {
    return { ok: false, reason: 'Off the map' }
  }
  if (pathSetOf(map).has(`${col},${row}`)) {
    return { ok: false, reason: 'Cannot build on the path' }
  }
  if (state.towers.some((t) => t.col === col && t.row === row)) {
    return { ok: false, reason: 'Already occupied' }
  }
  const kind = terrainAt(map, col, row)
  const def = kind ? TERRAIN[kind] : null
  if (def && !def.buildable) {
    return { ok: false, reason: `Cannot build on ${def.label.toLowerCase()}`, terrain: kind }
  }
  return { ok: true, terrain: kind, extraCost: def?.extraCost ?? 0 }
}

export function createTower(col, row, baseType, cost, terrain = null) {
  return {
    id: `t${nextTowerId++}`,
    col,
    row,
    terrain,
    x: col + 0.5,
    y: row + 0.5,
    baseType,
    upgrades: { dmg: 0, spd: 0, rng: 0 },
    evolved: false,
    evolveStat: null,
    cooldown: 0,
    disabledT: 0,
    targeting: DEFAULT_TARGETING,
    angle: -Math.PI / 2,
    spin: 0,
    recoil: 0,
    pulse: Math.random() * Math.PI * 2,
    killCount: 0,
    damageDealt: 0,
    invested: cost,
  }
}

// The player picks the evolution branch; upgrades are kept, not wiped.
export function evolveTower(tower, stat) {
  tower.evolved = true
  tower.evolveStat = stat
  tower.spin = 0
}

// How much gold sending the next wave right now would pay.
export function pendingEarlyBonus(state) {
  if (!state.waveActive || !state.waveData) return 0
  const remaining = state.spawnQueue.length + state.enemies.length
  return earlyBonus(state.wave, remaining, state.waveData.totalCount)
}

// Starting a wave while one is already running MERGES the two spawn queues.
// Queue delays are absolute from the start of the current wave, so the incoming
// wave is offset by the clock and the whole queue is re-sorted.
export function startWave(state) {
  const bonus = pendingEarlyBonus(state)
  state.wave++
  const data = buildWave(state.wave, state.seed)
  state.waveData = data

  if (state.waveActive) {
    const offset = state.spawnTimer
    const merged = state.spawnQueue.concat(
      data.queue.map((q) => ({ ...q, delay: q.delay + offset })),
    )
    merged.sort((a, b) => a.delay - b.delay)
    state.spawnQueue = merged
  } else {
    state.spawnQueue = data.queue.map((q) => ({ ...q }))
    state.spawnTimer = 0
  }
  state.waveActive = true
  return { data, bonus }
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function dist2(ax, ay, bx, by) {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

function spawnParticles(state, x, y, color, count, speedMin, speedMax, life, size = 1) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const s = speedMin + Math.random() * (speedMax - speedMin)
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life, maxLife: life, color,
      size: size * (0.5 + Math.random() * 0.8),
    })
  }
}

export function spawnEvolveParticles(state, tower, color) {
  spawnParticles(state, tower.x, tower.y, color, 46, 1.5, 4.5, 0.9, 1.6)
  state.effects.push({
    kind: 'pulse', x: tower.x, y: tower.y, r: 2.6, color, life: 0.7, maxLife: 0.7,
  })
}

function spawnDmgNum(state, x, y, val, color, crit = false) {
  if (val < 0.5) return
  state.dmgNums.push({
    x: x + (Math.random() - 0.5) * 0.35,
    y,
    val: Math.round(val),
    vy: -1.1,
    life: crit ? 0.85 : 0.6,
    maxLife: crit ? 0.85 : 0.6,
    color,
    crit,
  })
}

// ─── Support auras ────────────────────────────────────────────────────────────
// Recomputed once per frame rather than per substep: O(towers × supports) is
// cheap, and doing it here means calcStats stays a pure function of the tower.
// Support towers deliberately do not buff each other — stacking Obelisks to
// amplify Obelisks would be a degenerate strategy.

export function recomputeAuras(state) {
  const rally = state.rallyT > 0 ? ABILITY_BY_ID.rally.mult : 0
  for (const t of state.towers) t.rallyMult = rally || 0

  const supports = state.towers.filter(isSupport)
  if (supports.length === 0) {
    for (const t of state.towers) t.auraBuff = null
    return
  }
  const auras = supports.map((t) => ({ t, a: supportAura(t) }))

  for (const tower of state.towers) {
    if (isSupport(tower)) {
      tower.auraBuff = null
      continue
    }
    let dmg = 1
    let fireRate = 1
    let range = 1
    for (const { t, a } of auras) {
      if (!a) continue
      if (dist2(tower.x, tower.y, t.x, t.y) > a.radius * a.radius) continue
      dmg *= a.dmg
      fireRate *= a.fireRate
      range *= a.range
    }
    tower.auraBuff = dmg === 1 && fireRate === 1 && range === 1
      ? null
      : { dmg, fireRate, range }
  }
}

// ─── Targeting ────────────────────────────────────────────────────────────────
// Per-tower priority. 'first' (furthest along the path, closest to leaking) is
// the sensible default, but a Cannon usually wants the pack at the back and a
// Deadeye wants whatever has the most health.

const TARGET_SORT = {
  first: (a, b) => b.progress - a.progress,
  last: (a, b) => a.progress - b.progress,
  strong: (a, b) => b.hp + b.shield - (a.hp + a.shield),
  close: (a, b) => a.distToTower - b.distToTower,
}

function findTargets(state, tower, range, count = 1, mode = DEFAULT_TARGETING) {
  const r2 = range * range
  const found = []
  for (const e of state.enemies) {
    if (e.dead || e.reached) continue
    const d2 = dist2(e.x, e.y, tower.x, tower.y)
    if (d2 > r2) continue
    e.distToTower = d2
    found.push(e)
  }
  if (found.length === 0) return found
  if (found.length > 1) found.sort(TARGET_SORT[mode] ?? TARGET_SORT.first)
  return count >= found.length ? found : found.slice(0, count)
}

// ─── Damage application ───────────────────────────────────────────────────────

function damageEnemy(state, enemy, amount, opts) {
  const { towerId, color, traits = {}, crit = false, showNumber = true } = opts
  const dealt = enemy.takeDamage(amount, { armorPen: traits.armorPen ?? 0 })
  if (dealt <= 0) return 0
  enemy.lastHitBy = towerId
  if (showNumber) spawnDmgNum(state, enemy.x, enemy.y - enemy.r - 0.15, dealt, color, crit)
  return dealt
}

function applyStatuses(state, enemy, traits, color) {
  if (traits.slow && enemy.applySlow(traits.slow.factor, traits.slow.dur)) {
    if (Math.random() < 0.3) spawnParticles(state, enemy.x, enemy.y, color, 2, 0.5, 1.4, 0.3, 0.7)
  }
  if (traits.freeze && state.rng() < traits.freeze.chance) enemy.applyFreeze(traits.freeze.dur)
  if (traits.stun && state.rng() < traits.stun.chance) enemy.applyStun(traits.stun.dur)
  if (traits.mark) enemy.applyMark(traits.mark.mult, traits.mark.dur)
  if (traits.burn) enemy.addBurn(traits.burn.dps, traits.burn.dur)
}

// Rolls crit and the Rime shatter bonus for one hit.
function rollDamage(state, baseDmg, traits, enemy) {
  let dmg = baseDmg
  let crit = false
  if (traits.crit && state.rng() < traits.crit.chance) {
    dmg *= traits.crit.mult
    crit = true
  }
  if (traits.shatter && (enemy.slowT > 0 || enemy.freezeT > 0)) {
    dmg *= traits.shatter
    crit = true
  }
  return { dmg, crit }
}

function resolveHit(state, proj, primary, hx, hy) {
  const traits = proj.traits
  const tower = state.towers.find((t) => t.id === proj.towerId)
  let totalDealt = 0

  const hitOne = (enemy, mult, isPrimary) => {
    if (enemy.dead || enemy.reached) return
    const { dmg, crit } = rollDamage(state, proj.dmg * mult, traits, enemy)
    totalDealt += damageEnemy(state, enemy, dmg, {
      towerId: proj.towerId, color: proj.color, traits, crit,
      showNumber: isPrimary || mult >= 0.7,
    })
    applyStatuses(state, enemy, traits, proj.color)
    spawnParticles(state, enemy.x, enemy.y, proj.color, isPrimary ? 5 : 3, 1, 2.6, 0.26, 0.9)
  }

  if (proj.splash > 0) {
    state.effects.push({
      kind: 'blast', x: hx, y: hy, r: proj.splash, color: proj.color, life: 0.26, maxLife: 0.26,
    })
    sfx(state, 'hit')
    const r2 = proj.splash * proj.splash
    for (const e of state.enemies) {
      if (e.dead || e.reached) continue
      if (dist2(e.x, e.y, hx, hy) <= r2) hitOne(e, e === primary ? 1 : 0.75, e === primary)
    }
    if (primary && !primary.dead && dist2(primary.x, primary.y, hx, hy) > r2) hitOne(primary, 1, true)
  } else if (primary) {
    hitOne(primary, 1, true)
  }

  // Frost chill spreads a little wider than the impact itself.
  if (traits.slowSplash) {
    const r2 = traits.slowSplash * traits.slowSplash
    for (const e of state.enemies) {
      if (e.dead || e.reached || e === primary) continue
      if (dist2(e.x, e.y, hx, hy) <= r2 && traits.slow) {
        e.applySlow(traits.slow.factor, traits.slow.dur)
      }
    }
  }

  // Destroyer arcs to nearby foes with falling damage.
  if (traits.chain && primary) {
    const hit = new Set([primary.id])
    let from = primary
    let dmg = proj.dmg
    for (let j = 0; j < traits.chain.jumps; j++) {
      let best = null
      let bestD = Infinity
      for (const e of state.enemies) {
        if (e.dead || e.reached || hit.has(e.id)) continue
        const d = dist2(e.x, e.y, from.x, from.y)
        if (d < bestD && d <= traits.chain.range * traits.chain.range) {
          best = e
          bestD = d
        }
      }
      if (!best) break
      dmg *= traits.chain.falloff
      state.effects.push({
        kind: 'beam', x1: from.x, y1: from.y, x2: best.x, y2: best.y,
        color: proj.color, life: 0.18, maxLife: 0.18,
      })
      const { dmg: d2, crit } = rollDamage(state, dmg, traits, best)
      totalDealt += damageEnemy(state, best, d2, {
        towerId: proj.towerId, color: proj.color, traits, crit,
      })
      applyStatuses(state, best, traits, proj.color)
      hit.add(best.id)
      from = best
    }
  }

  // Siege shells leave burning ground behind.
  if (traits.groundFire) {
    state.hazards.push({
      x: hx, y: hy,
      r: traits.groundFire.radius,
      dps: traits.groundFire.dps,
      t: traits.groundFire.dur,
      maxT: traits.groundFire.dur,
      color: '#ff7a20',
      towerId: proj.towerId,
    })
  }

  if (tower) tower.damageDealt += totalDealt
}

// ─── Firing ───────────────────────────────────────────────────────────────────

function createProjectile(tower, stats, target, angle) {
  const traits = stats.traits
  const kind = traits.pierce ? 'pierce' : traits.arc ? 'arc' : 'homing'
  const proj = {
    id: Math.random(),
    x: tower.x,
    y: tower.y,
    kind,
    target,
    dmg: stats.dmg,
    splash: stats.splash,
    speed: stats.projSpeed,
    traits,
    color: PROJ_COLORS[stats.projKey] || '#fff',
    towerId: tower.id,
    angle,
    travelled: 0,
    dead: false,
  }
  if (kind === 'pierce') {
    proj.vx = Math.cos(angle)
    proj.vy = Math.sin(angle)
    proj.maxDist = stats.range * 1.35
    proj.pierceLeft = traits.pierce
    proj.hitIds = new Set()
  }
  if (kind === 'arc') {
    // Lobbed shells commit to where the target was when fired.
    proj.tx = target.x
    proj.ty = target.y
    proj.totalDist = Math.hypot(proj.tx - tower.x, proj.ty - tower.y)
  }
  return proj
}

function fireTower(state, tower, stats, targets) {
  if (targets.length === 0) return false

  tower.angle = Math.atan2(targets[0].y - tower.y, targets[0].x - tower.x)
  tower.recoil = 1

  for (const target of targets) {
    const angle = Math.atan2(target.y - tower.y, target.x - tower.x)
    state.projectiles.push(createProjectile(tower, stats, target, angle))
  }
  state.effects.push({
    kind: 'muzzle', x: tower.x, y: tower.y, angle: tower.angle,
    color: stats.color, life: 0.1, maxLife: 0.1,
  })
  sfx(state, 'shoot', stats.projKey)
  return true
}

// Blizzard has no projectiles at all — it damages and chills everything in
// range on a steady tick.
function pulseAura(state, tower, stats, targets) {
  state.effects.push({
    kind: 'pulse', x: tower.x, y: tower.y, r: stats.range,
    color: stats.color, life: 0.35, maxLife: 0.35,
  })
  if (targets.length === 0) return
  let dealt = 0
  for (const e of targets) {
    const { dmg, crit } = rollDamage(state, stats.dmg, stats.traits, e)
    dealt += damageEnemy(state, e, dmg, {
      towerId: tower.id, color: stats.color, traits: stats.traits, crit,
      showNumber: false,
    })
    applyStatuses(state, e, stats.traits, stats.color)
  }
  tower.damageDealt += dealt
}

// ─── Projectile stepping ──────────────────────────────────────────────────────

function stepProjectile(state, p, dt) {
  if (p.kind === 'pierce') {
    const step = p.speed * dt
    const nx = p.x + p.vx * step
    const ny = p.y + p.vy * step
    for (const e of state.enemies) {
      if (e.dead || e.reached || p.hitIds.has(e.id)) continue
      // Distance from the enemy to this frame's travel segment.
      if (segDist2(p.x, p.y, nx, ny, e.x, e.y) <= (e.r + 0.14) ** 2) {
        p.hitIds.add(e.id)
        resolveHit(state, p, e, e.x, e.y)
        if (--p.pierceLeft <= 0) {
          p.dead = true
          break
        }
      }
    }
    p.x = nx
    p.y = ny
    p.travelled += step
    if (p.travelled >= p.maxDist) p.dead = true
    return
  }

  if (p.kind === 'arc') {
    const step = p.speed * dt
    const dx = p.tx - p.x
    const dy = p.ty - p.y
    const d = Math.hypot(dx, dy)
    if (d <= step || d < 1e-5) {
      p.x = p.tx
      p.y = p.ty
      p.dead = true
      // A lobbed shell explodes where it lands, hitting whoever is there now.
      let victim = null
      let bestD = Infinity
      for (const e of state.enemies) {
        if (e.dead || e.reached) continue
        const dd = dist2(e.x, e.y, p.tx, p.ty)
        if (dd < bestD) {
          victim = e
          bestD = dd
        }
      }
      resolveHit(state, p, bestD <= (p.splash || 0.5) ** 2 ? victim : null, p.tx, p.ty)
      return
    }
    p.x += (dx / d) * step
    p.y += (dy / d) * step
    p.travelled += step
    return
  }

  // Homing: if the target dies mid-flight, splash shots still land, single
  // target shots fizzle.
  if (!p.target || p.target.dead || p.target.reached) {
    if (p.splash > 0) {
      const hx = p.target ? p.target.x : p.x
      const hy = p.target ? p.target.y : p.y
      resolveHit(state, p, null, hx, hy)
    }
    p.dead = true
    return
  }

  const step = p.speed * dt
  const dx = p.target.x - p.x
  const dy = p.target.y - p.y
  const d = Math.hypot(dx, dy)
  const hitRadius = p.target.r + 0.12

  if (d <= step + hitRadius) {
    p.x = p.target.x
    p.y = p.target.y
    p.dead = true
    resolveHit(state, p, p.target, p.target.x, p.target.y)
    return
  }
  p.x += (dx / d) * step
  p.y += (dy / d) * step
  p.angle = Math.atan2(dy, dx)
  p.travelled += step
}

// Squared distance from point (px,py) to segment (ax,ay)-(bx,by).
function segDist2(ax, ay, bx, by, px, py) {
  const vx = bx - ax
  const vy = by - ay
  const len2 = vx * vx + vy * vy
  if (len2 < 1e-9) return dist2(ax, ay, px, py)
  let t = ((px - ax) * vx + (py - ay) * vy) / len2
  t = Math.max(0, Math.min(1, t))
  return dist2(ax + t * vx, ay + t * vy, px, py)
}

// ─── Player abilities ─────────────────────────────────────────────────────────
// These are called from UI handlers, outside the tick, so they deliberately do
// not use the sfx queue — the caller plays their sound directly.

export function abilityReady(state, id) {
  return state.phase === 'playing' && (state.abilityCd[id] ?? 0) <= 0
}

// `tile` is {col,row} for targeted abilities, ignored otherwise. Returns true if
// the ability actually fired.
export function castAbility(state, id, tile) {
  const def = ABILITY_BY_ID[id]
  if (!def || !abilityReady(state, id)) return false
  if (def.targeted && !tile) return false

  if (def.targeted) {
    const map = state.currentMap
    if (tile.col < 0 || tile.row < 0 || tile.col >= map.cols || tile.row >= map.rows) {
      return false
    }
  }

  state.abilityCd[id] = def.cooldown

  if (id === 'meteor') {
    const x = tile.col + 0.5
    const y = tile.row + 0.5
    const dmg = def.damage(state.wave)
    const r2 = def.radius * def.radius
    for (const e of state.enemies) {
      if (e.dead || e.reached) continue
      if (dist2(e.x, e.y, x, y) > r2) continue
      damageEnemy(state, e, dmg, {
        towerId: null, color: '#ff8030', traits: { armorPen: def.armorPen }, crit: true,
      })
      e.addBurn(def.burn.dps, def.burn.dur)
    }
    state.effects.push({
      kind: 'blast', x, y, r: def.radius, color: '#ff8030', life: 0.5, maxLife: 0.5,
    })
    state.hazards.push({
      x, y, r: def.radius * 0.8, dps: def.burn.dps, t: def.burn.dur,
      maxT: def.burn.dur, color: '#ff7a20', towerId: null,
    })
    spawnParticles(state, x, y, '#ff9040', 40, 2, 6, 0.7, 1.6)
    return true
  }

  if (id === 'freeze') {
    let hit = 0
    for (const e of state.enemies) {
      if (e.dead || e.reached) continue
      if (e.applyFreeze(def.duration)) hit++
    }
    state.effects.push({
      kind: 'screen', color: '#90e0ff', life: 0.45, maxLife: 0.45,
    })
    for (const e of state.enemies) {
      if (!e.dead) spawnParticles(state, e.x, e.y, '#c0f0ff', 5, 0.5, 2, 0.5, 1)
    }
    return hit >= 0
  }

  if (id === 'rally') {
    state.rallyT = def.duration
    for (const t of state.towers) {
      state.effects.push({
        kind: 'pulse', x: t.x, y: t.y, r: 1.4, color: '#ffd060', life: 0.5, maxLife: 0.5,
      })
    }
    return true
  }
  return false
}

// ─── Boss abilities ───────────────────────────────────────────────────────────
// Bosses used to be nothing but a large health bar. Now each one does something
// that changes how you have to fight it.

function castBossAbility(state, boss) {
  const a = boss.ability
  boss.castFlash = 0.5

  if (a.kind === 'shieldAllies') {
    // The Dread Lord hands its escort a shield, so the pack outlives it.
    const r2 = a.radius * a.radius
    let shielded = 0
    for (const e of state.enemies) {
      if (e.dead || e.reached || e === boss) continue
      if (dist2(e.x, e.y, boss.x, boss.y) > r2) continue
      e.grantShield(Math.round(e.maxHp * a.amount))
      shielded++
      state.effects.push({
        kind: 'beam', x1: boss.x, y1: boss.y, x2: e.x, y2: e.y,
        color: '#50d0c0', life: 0.3, maxLife: 0.3,
      })
    }
    state.effects.push({
      kind: 'pulse', x: boss.x, y: boss.y, r: a.radius,
      color: '#50d0c0', life: 0.5, maxLife: 0.5,
    })
    if (shielded) sfx(state, 'boss')
    return
  }

  if (a.kind === 'siphon') {
    // The Void Overlord heals itself and silences your nearest tower.
    boss.heal(boss.maxHp * a.healPct)
    spawnParticles(state, boss.x, boss.y, '#40e090', 14, 1, 3, 0.6, 1.2)

    let target = null
    let best = a.radius * a.radius
    for (const t of state.towers) {
      if (t.disabledT > 0) continue
      const d = dist2(t.x, t.y, boss.x, boss.y)
      if (d <= best) {
        best = d
        target = t
      }
    }
    if (target) {
      target.disabledT = a.disableDur
      state.effects.push({
        kind: 'beam', x1: boss.x, y1: boss.y, x2: target.x, y2: target.y,
        color: '#d03a70', life: 0.45, maxLife: 0.45,
      })
      spawnParticles(state, target.x, target.y, '#d03a70', 12, 1, 2.5, 0.5, 1.1)
    }
    state.effects.push({
      kind: 'pulse', x: boss.x, y: boss.y, r: a.radius,
      color: '#d03a70', life: 0.5, maxLife: 0.5,
    })
    sfx(state, 'boss')
  }
}

// ─── Deaths ───────────────────────────────────────────────────────────────────

function reapEnemies(state, callbacks) {
  if (state.enemies.length === 0) return
  const survivors = []
  const spawned = []

  for (const e of state.enemies) {
    if (e.reached) {
      state.leaked++
      spawnParticles(state, e.x, e.y, '#e04030', 12, 1.5, 3.5, 0.5, 1.2)
      sfx(state, 'leak')
      callbacks.onLeak(e)
      continue
    }
    if (!e.dead) {
      survivors.push(e)
      continue
    }

    state.kills++
    sfx(state, e.tags.includes('boss') ? 'bosskill' : 'kill')
    callbacks.onKill(e)
    const tower = state.towers.find((t) => t.id === e.lastHitBy)
    if (tower) tower.killCount++
    spawnParticles(state, e.x, e.y, e.color, 12, 1.5, 3, 0.45, 1.1)
    spawnParticles(state, e.x, e.y, '#d4a853', 6, 1, 2.2, 0.6, 0.9)

    // Brood Mothers burst into a pack that carries on from where they fell.
    const split = e.def.splitInto
    if (split) {
      for (let i = 0; i < split.count; i++) {
        const spec = scaledEnemy(split.type, e.wave, null)
        const child = new Enemy(split.type, spec, e.path, e.wave)
        child.segment = e.segment
        child.progress = e.progress
        const a = (i / split.count) * Math.PI * 2
        child.x = e.x + Math.cos(a) * 0.22
        child.y = e.y + Math.sin(a) * 0.22
        spawned.push(child)
      }
      state.effects.push({
        kind: 'pulse', x: e.x, y: e.y, r: 1.1, color: e.color, life: 0.35, maxLife: 0.35,
      })
    }
  }

  state.enemies = survivors.concat(spawned)
}

// ─── Main tick ────────────────────────────────────────────────────────────────

export function tick(state, rawDt, callbacks) {
  state.sfx.length = 0
  if (state.phase !== 'playing' || state.paused) return

  // Support auras are a function of tower layout, so once per frame is plenty.
  recomputeAuras(state)

  // A true fixed-timestep accumulator: every substep advances exactly 1/60s,
  // whatever the frame rate. Leftover time carries to the next frame, so the
  // simulation evolves identically at 30fps, 60fps and 144fps.
  state.acc += Math.min(rawDt, 0.25) * state.gameSpeed
  let steps = 0
  while (state.acc >= SUBSTEP && steps < MAX_SUBSTEPS) {
    substep(state, SUBSTEP, callbacks)
    state.acc -= SUBSTEP
    steps++
  }
  // If we are hopelessly behind (tab was backgrounded), drop the backlog rather
  // than spiral into a death loop.
  if (steps === MAX_SUBSTEPS && state.acc > SUBSTEP * 4) state.acc = 0
}

function substep(state, dt, callbacks) {
  state.time += dt

  for (const id of Object.keys(state.abilityCd)) {
    if (state.abilityCd[id] > 0) state.abilityCd[id] = Math.max(0, state.abilityCd[id] - dt)
  }
  if (state.rallyT > 0) state.rallyT = Math.max(0, state.rallyT - dt)

  // ── Spawning ──
  if (state.waveActive && state.spawnQueue.length > 0) {
    state.spawnTimer += dt
    while (state.spawnQueue.length > 0 && state.spawnTimer >= state.spawnQueue[0].delay) {
      const { type, spec } = state.spawnQueue.shift()
      // Alternate lanes so a branching map is pressured on both sides.
      const lanes = pathsOf(state.currentMap)
      const lane = lanes[state.spawnCount % lanes.length]
      state.spawnCount++
      state.enemies.push(new Enemy(type, spec, lane, state.wave))
    }
  }

  // ── Burning ground ──
  for (const h of state.hazards) {
    h.t -= dt
    const r2 = h.r * h.r
    for (const e of state.enemies) {
      if (e.dead || e.reached) continue
      if (dist2(e.x, e.y, h.x, h.y) <= r2) {
        e.takeDamage(h.dps * dt, { armorPen: 1 })
        e.lastHitBy = h.towerId
      }
    }
    if (Math.random() < dt * 12) {
      spawnParticles(state, h.x + (Math.random() - 0.5) * h.r, h.y + (Math.random() - 0.5) * h.r,
        h.color, 1, 0.3, 1, 0.5, 1.1)
    }
  }
  if (state.hazards.length) state.hazards = state.hazards.filter((h) => h.t > 0)

  // ── Enemies ──
  for (const e of state.enemies) {
    if (e.dead) continue
    e.updateStatus(dt)
    if (e.ability && !e.dead) {
      e.abilityT -= dt
      if (e.abilityT <= 0) {
        e.abilityT = e.ability.every
        castBossAbility(state, e)
      }
    }
    if (!e.dead) e.move(dt)
  }
  reapEnemies(state, callbacks)

  // ── Towers ──
  for (const tower of state.towers) {
    tower.pulse += dt
    if (tower.recoil > 0) tower.recoil = Math.max(0, tower.recoil - dt * 6)
    if (tower.disabledT > 0) {
      tower.disabledT -= dt
      continue
    }
    // Obelisks project their buff through recomputeAuras and never shoot.
    if (isSupport(tower)) continue
    const stats = calcStats(tower)

    const traits = stats.traits
    // One scan per tower per substep — the result is reused for aiming, spin-up
    // and firing. This used to run findTargets three times over.
    const wanted = traits.aura ? 999 : (traits.multishot ?? 1)
    const targets = findTargets(state, tower, stats.range, wanted, tower.targeting)
    const hasTarget = targets.length > 0

    // Gatling spins up while it has something to shoot at.
    if (traits.spinup) {
      tower.spin = hasTarget
        ? Math.min(1, tower.spin + dt * traits.spinup.rate)
        : Math.max(0, tower.spin - dt * traits.spinup.rate * 1.6)
    }

    if (hasTarget && !traits.aura) {
      tower.angle = Math.atan2(targets[0].y - tower.y, targets[0].x - tower.x)
    }

    tower.cooldown -= dt
    if (tower.cooldown > 0) continue

    if (traits.aura) {
      tower.cooldown = 1 / stats.fireRate
      pulseAura(state, tower, stats, targets)
      continue
    }
    if (!hasTarget) {
      tower.cooldown = 0
      continue
    }
    if (fireTower(state, tower, stats, targets)) tower.cooldown = 1 / stats.fireRate
  }

  // ── Projectiles ──
  for (const p of state.projectiles) {
    if (p.dead) continue
    stepProjectile(state, p, dt)
  }
  if (state.projectiles.length) state.projectiles = state.projectiles.filter((p) => !p.dead)

  // Aura and hazard damage can kill too, so sweep again before the wave check.
  reapEnemies(state, callbacks)

  // ── Wave completion ──
  if (state.waveActive && state.spawnQueue.length === 0 && state.enemies.length === 0) {
    state.waveActive = false
    callbacks.onWaveCleared(state.wave, clearBonus(state.wave))
  }

  // ── Cosmetics ──
  for (const p of state.particles) {
    p.life -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 2.2 * dt
  }
  if (state.particles.length) state.particles = state.particles.filter((p) => p.life > 0)

  for (const n of state.dmgNums) {
    n.life -= dt
    n.y += n.vy * dt
  }
  if (state.dmgNums.length) state.dmgNums = state.dmgNums.filter((n) => n.life > 0)

  for (const e of state.effects) e.life -= dt
  if (state.effects.length) state.effects = state.effects.filter((e) => e.life > 0)
}
