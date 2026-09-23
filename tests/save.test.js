import { describe, it, expect } from 'vitest'
import {
  makeGameState, createTower, startWave, tick, evolveTower, buildCheck,
  serializeRun, restoreRun, canSaveRun, earnGold,
} from '../src/game/engine.js'
import { generateMap } from '../src/game/maps/generator.js'
import { mulberry32 } from '../src/game/rng.js'
import { buildReport } from '../src/game/report.js'

// A saved run has to carry on as if it had never been closed. These tests play
// a run, save it between waves, restore it through JSON, and then play the next
// waves on both copies side by side.

function callbacksFor(state) {
  return {
    onLeak: (e) => {
      state.lives = Math.max(0, state.lives - e.liveDmg)
      if (state.lives <= 0) state.phase = 'gameover'
    },
    onKill: (e) => earnGold(state, e.reward),
    onWaveCleared: (_w, bonus) => earnGold(state, bonus),
  }
}

function playWave(state) {
  const cb = callbacksFor(state)
  startWave(state)
  let guard = 0
  while (state.waveActive && state.phase === 'playing' && guard++ < 60 * 600) {
    tick(state, 1 / 60, cb)
  }
}

function setUp() {
  const map = generateMap(9001)
  const state = makeGameState(map, 77)
  let placed = 0
  for (const [c, r] of map.path) {
    for (const [dc, dr] of [[0, -1], [0, 1]]) {
      if (placed >= 6) break
      if (!buildCheck(state, c + dc, r + dr).ok) continue
      const type = placed % 3 === 2 ? 'frost' : 'archer'
      const t = createTower(c + dc, r + dr, type, 100)
      t.upgrades.dmg = 3
      t.upgrades.spd = 1
      state.towers.push(t)
      placed++
    }
  }
  // An evolved Deadeye rolls crits from state.rng, so the RNG position matters.
  evolveTower(state.towers[0], 'dmg')
  return state
}

const summary = (s) => ({
  wave: s.wave, kills: s.kills, lives: s.lives, leaked: s.leaked,
  gold: Math.round(s.gold * 1000),
  dmg: s.towers.map((t) => Math.round(t.damageDealt * 1000)),
})

describe('saving a run', () => {
  it('is only possible between waves', () => {
    const s = setUp()
    expect(canSaveRun(s)).toBe(true)
    startWave(s)
    expect(canSaveRun(s)).toBe(false)
    expect(serializeRun(s)).toBeNull()
  })

  it('survives a JSON round trip and plays on identically', () => {
    const a = setUp()
    for (let i = 0; i < 4; i++) playWave(a)
    expect(a.phase).toBe('playing')

    const b = restoreRun(JSON.parse(JSON.stringify(serializeRun(a))))
    b.paused = false
    expect(summary(b)).toEqual(summary(a))

    for (let i = 0; i < 3; i++) {
      playWave(a)
      playWave(b)
    }
    expect(summary(b)).toEqual(summary(a))
  })

  it('keeps tower ids unique after a restore', () => {
    const a = setUp()
    const b = restoreRun(JSON.parse(JSON.stringify(serializeRun(a))))
    const fresh = createTower(0, 0, 'archer', 0)
    expect(b.towers.map((t) => t.id)).not.toContain(fresh.id)
  })

  it('rejects snapshots it does not understand', () => {
    expect(restoreRun(null)).toBeNull()
    expect(restoreRun({ v: 999 })).toBeNull()
  })

  it('restores the combat RNG position exactly', () => {
    const r = mulberry32(123)
    r(); r(); r()
    const saved = r.getState()
    const next = [r(), r()]
    const r2 = mulberry32(1)
    r2.setState(saved)
    expect([r2(), r2()]).toEqual(next)
  })
})

describe('run statistics', () => {
  it('track income, spending and lives per wave', () => {
    const s = setUp()
    for (let i = 0; i < 3; i++) playWave(s)
    expect(s.stats.earned).toBeGreaterThan(0)
    expect(s.stats.waves.map((w) => w.wave)).toEqual([1, 2, 3])
    expect(s.stats.waves.at(-1).lives).toBe(s.lives)
  })

  it('build a report ranked by damage, with a labelled lives series', () => {
    const s = setUp()
    for (let i = 0; i < 3; i++) playWave(s)
    const r = buildReport(s)
    expect(r.towers.length).toBeGreaterThan(0)
    const dmg = r.towers.map((t) => t.damage)
    expect(dmg).toEqual([...dmg].sort((a, b) => b - a))
    expect(r.towers[0].name).toBe('Deadeye')
    expect(r.lives[0]).toEqual({ v: 20, label: 'Start' })
    expect(r.lives.at(-1).label).toBe('End (wave 3)')
    expect(r.earned).toBe(Math.round(s.stats.earned))
  })
})
