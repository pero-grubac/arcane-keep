import { describe, it, expect } from 'vitest'
import {
  makeGameState, createTower, startWave, tick, evolveTower, recomputeAuras,
  buildCheck, pendingEarlyBonus, pathsOf,
} from '../src/game/engine.js'
import { generateMap } from '../src/game/maps/generator.js'
import { Enemy, scaledEnemy } from '../src/game/enemies.js'
import { calcStats, TARGETING_MODES } from '../src/game/towers.js'

const noop = { onLeak: () => {}, onKill: () => {}, onWaveCleared: () => {} }
const run = (state, seconds, cb = noop) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) tick(state, 1 / 60, cb)
}

// Places a tower on the first buildable tile beside the road.
function towerBesideRoad(state, map, type = 'archer', at = 4) {
  const [pc, pr] = map.path[at]
  for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0], [1, 1], [-1, -1]]) {
    const c = pc + dc
    const r = pr + dr
    if (buildCheck(state, c, r).ok) {
      const t = createTower(c, r, type, 0)
      state.towers.push(t)
      return t
    }
  }
  throw new Error('no buildable tile beside the road')
}

// A stationary enemy parked on a given path tile.
function parkEnemy(state, map, type, at, wave = 1) {
  const e = new Enemy(type, scaledEnemy(type, wave, null), map.path, wave)
  e.baseSpd = 0
  e.segment = at
  e.progress = at
  e.x = map.path[at][0] + 0.5
  e.y = map.path[at][1] + 0.5
  state.enemies.push(e)
  return e
}

describe('the fixed timestep', () => {
  const sim = (frameDt, frames) => {
    const map = generateMap(4242)
    const s = makeGameState(map, 555)
    for (let i = 0; i < 4; i++) towerBesideRoad(s, map, 'archer', 3 + i * 4)
    startWave(s)
    for (let i = 0; i < frames; i++) tick(s, frameDt, noop)
    return s
  }

  it('reaches the same state at 30fps and 60fps', () => {
    const a = sim(1 / 60, 600)
    const b = sim(1 / 30, 300)
    expect(b.kills).toBe(a.kills)
    expect(b.enemies.length).toBe(a.enemies.length)
    expect(b.time).toBeCloseTo(a.time, 9)
  })

  it('reaches the same state at 144fps, to within one substep', () => {
    // Summing 1/144 over 1440 frames does not land exactly on 10s, so the
    // accumulator can be one substep short. Nothing may drift further.
    const a = sim(1 / 60, 600)
    const c = sim(1 / 144, 1440)
    expect(c.kills).toBe(a.kills)
    expect(Math.abs(c.time - a.time)).toBeLessThanOrEqual(1 / 60 + 1e-9)
  })

  it('does not spiral after a long stall', () => {
    const map = generateMap(4242)
    const s = makeGameState(map, 1)
    startWave(s)
    tick(s, 5, noop) // a five-second frame, as if the tab was backgrounded
    expect(s.time).toBeLessThan(1)
    expect(Number.isFinite(s.time)).toBe(true)
  })
})

describe('seeded combat', () => {
  const play = (seed) => {
    const map = generateMap(4242)
    const s = makeGameState(map, seed)
    for (let i = 0; i < 6; i++) {
      const t = towerBesideRoad(s, map, i % 2 ? 'frost' : 'archer', 3 + i * 3)
      t.upgrades = { dmg: 4, spd: 2, rng: 1 }
      evolveTower(t, 'dmg') // Deadeye and Rime both roll RNG
    }
    startWave(s)
    let guard = 0
    while (s.waveActive && guard++ < 60 * 200) tick(s, 1 / 60, noop)
    return {
      kills: s.kills,
      dmg: Math.round(s.towers.reduce((a, t) => a + t.damageDealt, 0)),
      time: s.time,
    }
  }

  it('reproduces the whole fight from a seed', () => {
    expect(play(12345)).toEqual(play(12345))
  })

  it('produces a different fight for a different seed', () => {
    expect(play(12345)).not.toEqual(play(99999))
  })
})

describe('targeting modes', () => {
  it('pick different enemies', () => {
    const map = generateMap(4242)
    const hitByMode = {}

    for (const { id } of TARGETING_MODES) {
      const s = makeGameState(map, 1)
      const t = towerBesideRoad(s, map, 'archer', 10)
      t.targeting = id
      const behind = parkEnemy(s, map, 'grunt', 8)
      const middle = parkEnemy(s, map, 'grunt', 10)
      const ahead = parkEnemy(s, map, 'grunt', 12)
      middle.maxHp = 5000
      middle.hp = 5000
      const before = [behind.hp, middle.hp, ahead.hp]
      run(s, 1)
      const tags = ['behind', 'middle', 'ahead']
      hitByMode[id] = [behind, middle, ahead]
        .map((e, i) => (e.hp < before[i] ? tags[i] : null))
        .filter(Boolean)
    }

    expect(hitByMode.first).toContain('ahead')
    expect(hitByMode.last).toContain('behind')
    expect(hitByMode.strong).toContain('middle')
    // The four modes must not all behave identically.
    expect(new Set(Object.values(hitByMode).map((v) => v.join(','))).size).toBeGreaterThan(1)
  })
})

describe('sending a wave early', () => {
  it('merges the queues without losing enemies', () => {
    const map = generateMap(4242)
    const s = makeGameState(map, 77)
    startWave(s)
    run(s, 1)

    const queuedBefore = s.spawnQueue.length
    const preview = pendingEarlyBonus(s)
    const { data, bonus } = startWave(s)

    expect(bonus).toBeGreaterThan(0)
    expect(bonus).toBe(preview)
    expect(s.wave).toBe(2)
    expect(s.spawnQueue.length).toBe(queuedBefore + data.queue.length)
    for (let i = 1; i < s.spawnQueue.length; i++) {
      expect(s.spawnQueue[i].delay).toBeGreaterThanOrEqual(s.spawnQueue[i - 1].delay)
    }
  })

  it('still lets the merged wave finish', () => {
    const map = generateMap(4242)
    const s = makeGameState(map, 77)
    startWave(s)
    run(s, 1)
    startWave(s)
    let guard = 0
    while (s.waveActive && guard++ < 60 * 400) tick(s, 1 / 60, noop)
    expect(s.waveActive).toBe(false)
    expect(s.enemies.length).toBe(0)
    expect(s.spawnQueue.length).toBe(0)
  })

  it('pays nothing when no wave is running', () => {
    const map = generateMap(4242)
    const s = makeGameState(map, 77)
    expect(pendingEarlyBonus(s)).toBe(0)
    expect(startWave(s).bonus).toBe(0)
  })
})

describe('support auras', () => {
  it('buff nearby towers but not distant ones, and never other supports', () => {
    const map = generateMap(4242)
    const s = makeGameState(map, 1)
    const archer = createTower(5, 5, 'archer', 0)
    const far = createTower(18, 10, 'archer', 0)
    s.towers.push(archer, far)
    recomputeAuras(s)
    const baseline = calcStats(archer).fireRate

    const ob = createTower(6, 5, 'obelisk', 0)
    evolveTower(ob, 'spd')
    const ob2 = createTower(7, 5, 'obelisk', 0)
    s.towers.push(ob, ob2)
    recomputeAuras(s)

    expect(calcStats(archer).fireRate).toBeGreaterThan(baseline)
    expect(calcStats(far).fireRate).toBeCloseTo(baseline)
    expect(ob.auraBuff).toBeNull()
    expect(ob2.auraBuff).toBeNull()
  })

  it('are refreshed by tick, so the panel never shows stale numbers', () => {
    const map = generateMap(4242)
    const s = makeGameState(map, 1)
    const archer = createTower(5, 5, 'archer', 0)
    s.towers.push(archer)
    const before = calcStats(archer).fireRate
    s.towers.push(createTower(6, 5, 'obelisk', 0))
    tick(s, 1 / 60, noop)
    expect(calcStats(archer).fireRate).toBeGreaterThan(before)
  })

  it('never let a support tower shoot', () => {
    const map = generateMap(4242)
    const s = makeGameState(map, 1)
    towerBesideRoad(s, map, 'obelisk', 4)
    const victim = parkEnemy(s, map, 'grunt', 4)
    const hp = victim.hp
    run(s, 3)
    expect(victim.hp).toBe(hp)
    expect(s.projectiles.length).toBe(0)
  })
})

describe('boss abilities', () => {
  it('let the Dread Lord shield its escort, but only in radius', () => {
    const map = generateMap(4242)
    const s = makeGameState(map, 1)
    const boss = parkEnemy(s, map, 'boss', 6, 20)
    const near = parkEnemy(s, map, 'grunt', 6, 20)
    near.x = boss.x + 1
    const far = parkEnemy(s, map, 'grunt', 6, 20)
    far.x = boss.x + 9
    run(s, 4)
    expect(near.shield).toBeGreaterThan(0)
    expect(far.shield).toBe(0)
  })

  it('let the Void Overlord heal and silence a tower', () => {
    const map = generateMap(4242)
    const s = makeGameState(map, 1)
    const tower = towerBesideRoad(s, map, 'archer', 6)
    const ov = parkEnemy(s, map, 'overlord', 6, 20)
    ov.hp = ov.maxHp * 0.5
    const hp = ov.hp
    run(s, 5)
    expect(ov.hp).toBeGreaterThan(hp)
    expect(tower.disabledT).toBeGreaterThan(0)
  })

  it('stop a silenced tower from firing', () => {
    const map = generateMap(4242)
    const s = makeGameState(map, 1)
    const tower = towerBesideRoad(s, map, 'archer', 4)
    tower.disabledT = 5
    const victim = parkEnemy(s, map, 'grunt', 4)
    const hp = victim.hp
    run(s, 2)
    expect(victim.hp).toBe(hp)
  })
})

describe('enemies', () => {
  it('split when a Brood Mother dies', () => {
    const map = generateMap(4242)
    const s = makeGameState(map, 1)
    const brood = parkEnemy(s, map, 'brood', 5, 10)
    brood.hp = 1
    brood.takeDamage(999, { armorPen: 1 })
    tick(s, 1 / 60, noop)
    expect(s.enemies.length).toBe(3)
    expect(s.enemies.every((e) => e.type === 'swarm')).toBe(true)
  })

  it('cannot be chilled if they are chill-immune', () => {
    const map = generateMap(4242)
    const s = makeGameState(map, 1)
    const wisp = parkEnemy(s, map, 'wisp', 5)
    expect(wisp.applySlow(0.4, 2)).toBe(false)
    expect(wisp.applyFreeze(2)).toBe(false)
    const grunt = parkEnemy(s, map, 'grunt', 5)
    expect(grunt.applySlow(0.4, 2)).toBe(true)
  })

  it('regenerate shields only after being left alone', () => {
    const map = generateMap(4242)
    const s = makeGameState(map, 1)
    const warden = parkEnemy(s, map, 'warden', 5, 10)
    warden.takeDamage(40, {})
    const dented = warden.shield
    expect(dented).toBeLessThan(warden.maxShield)
    warden.updateStatus(0.5) // still inside the regen delay
    expect(warden.shield).toBeCloseTo(dented)
    for (let i = 0; i < 300; i++) warden.updateStatus(1 / 60)
    expect(warden.shield).toBeGreaterThan(dented)
  })

  it('reach the keep and cost a life', () => {
    const map = generateMap(4242)
    const s = makeGameState(map, 1)
    let lost = 0
    startWave(s)
    let guard = 0
    while (s.waveActive && guard++ < 60 * 400) {
      tick(s, 1 / 60, { ...noop, onLeak: (e) => { lost += e.liveDmg } })
    }
    expect(lost).toBeGreaterThan(0)
  })
})

describe('branching maps', () => {
  it('spawn enemies down every lane', () => {
    const seed = Array.from({ length: 200 }, (_, i) => i + 1)
      .find((s) => generateMap(s).branching)
    const map = generateMap(seed)
    const s = makeGameState(map, seed)
    startWave(s)
    run(s, 12)
    const lanesUsed = new Set(s.enemies.map((e) => e.path))
    expect(pathsOf(map).length).toBe(2)
    expect(lanesUsed.size).toBe(2)
  })
})

describe('building rules', () => {
  it('refuses the path, occupied tiles and water', () => {
    const map = generateMap(1)
    const s = makeGameState(map, 1)
    const [pc, pr] = map.path[5]
    expect(buildCheck(s, pc, pr).ok).toBe(false)
    expect(buildCheck(s, -1, 0).ok).toBe(false)
    expect(buildCheck(s, map.cols, 0).ok).toBe(false)

    const t = towerBesideRoad(s, map, 'archer', 5)
    expect(buildCheck(s, t.col, t.row).ok).toBe(false)

    const water = Object.entries(map.terrain).find(([, v]) => v === 'water')
    if (water) {
      const [c, r] = water[0].split(',').map(Number)
      expect(buildCheck(s, c, r).ok).toBe(false)
    }
  })
})
