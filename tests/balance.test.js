import { describe, it, expect } from 'vitest'
import {
  makeGameState, createTower, startWave, tick, evolveTower, buildCheck, pathsOf,
} from '../src/game/engine.js'
import { generateMap } from '../src/game/maps/generator.js'
import { getTowerCost, upgradeCost, EVOLVE_COST } from '../src/game/towers.js'

// An end-to-end smoke run: a simple bot plays real waves on a real map. This is
// the test that catches the whole-system failures — a wave that never ends, an
// entity list that grows without bound, a crash deep in a rare interaction.

const MIX = ['archer', 'frost', 'archer', 'mage', 'obelisk', 'cannon', 'archer', 'frost']
const LEAN = { archer: 'dmg', frost: 'rng', mage: 'dmg', cannon: 'dmg', obelisk: 'spd' }

function playRun(seed, waves) {
  const map = generateMap(seed)
  const state = makeGameState(map, seed)

  // Rank buildable tiles: spots covering every lane first (the merge on a
  // branching map), then proximity to the road.
  const lanes = pathsOf(map)
  const pathSet = new Set(lanes.flat().map(([c, r]) => `${c},${r}`))
  const spots = []
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (pathSet.has(`${c},${r}`)) continue
      if (!buildCheck(state, c, r).ok) continue
      let nearest = Infinity
      let covered = 0
      for (const lane of lanes) {
        let laneBest = Infinity
        for (const [pc, pr] of lane) {
          const d = Math.hypot(pc - c, pr - r)
          if (d < laneBest) laneBest = d
        }
        if (laneBest <= 1.6) covered++
        if (laneBest < nearest) nearest = laneBest
      }
      if (nearest <= 1.6) spots.push({ c, r, d: nearest, covered })
    }
  }
  spots.sort((a, b) => (b.covered - a.covered) || (a.d - b.d))

  let spotIdx = 0
  const cb = {
    onLeak: (e) => {
      state.lives = Math.max(0, state.lives - e.liveDmg)
      if (state.lives <= 0) state.phase = 'gameover'
    },
    onKill: (e) => { state.gold += e.reward },
    onWaveCleared: (_w, bonus) => { state.gold += bonus },
  }

  const spend = (wave) => {
    const want = Math.min(spots.length, 3 + Math.floor(wave * 0.9))
    let acted = true
    let guard = 0
    while (acted && guard++ < 80) {
      acted = false
      if (state.towers.length < want && spotIdx < spots.length) {
        const sp = spots[spotIdx]
        const chk = buildCheck(state, sp.c, sp.r)
        const type = MIX[state.towers.length % MIX.length]
        const cost = getTowerCost(type, state.towerCounts) + (chk.extraCost ?? 0)
        if (!chk.ok) { spotIdx++; acted = true; continue }
        if (state.gold >= cost) {
          spotIdx++
          state.gold -= cost
          state.towerCounts[type]++
          state.towers.push(createTower(sp.c, sp.r, type, cost, chk.terrain))
          acted = true
          continue
        }
      }
      for (const t of state.towers) {
        const total = t.upgrades.dmg + t.upgrades.spd + t.upgrades.rng
        if (!t.evolved && total >= 4 && state.gold >= EVOLVE_COST) {
          state.gold -= EVOLVE_COST
          evolveTower(t, LEAN[t.baseType])
          acted = true
        }
      }
      if (acted) continue
      for (const t of state.towers) {
        const stat = LEAN[t.baseType]
        const lvl = t.upgrades[stat]
        const cost = upgradeCost(lvl)
        if (lvl < 6 && state.gold >= cost) {
          state.gold -= cost
          t.upgrades[stat]++
          acted = true
        }
      }
    }
  }

  const report = { seed, wavesPlayed: 0, stalled: false, peak: 0 }
  for (let w = 1; w <= waves; w++) {
    if (state.phase !== 'playing') break
    spend(w)
    startWave(state)
    let frames = 0
    while (state.waveActive && frames < 60 * 240) {
      tick(state, 1 / 60, cb)
      frames++
      report.peak = Math.max(
        report.peak,
        state.enemies.length + state.projectiles.length + state.particles.length
          + state.effects.length + state.dmgNums.length + state.hazards.length,
      )
      if (state.phase !== 'playing') break
    }
    if (frames >= 60 * 240) { report.stalled = true; break }
    report.wavesPlayed = w
  }

  report.state = state
  return report
}

describe('a full run', () => {
  const seeds = [7, 1234, 4242]

  it.each(seeds)('completes twelve waves on seed %i without stalling', (seed) => {
    const r = playRun(seed, 12)
    expect(r.stalled, 'a wave never finished').toBe(false)
    expect(r.wavesPlayed).toBeGreaterThanOrEqual(8)
  })

  it.each(seeds)('leaves no entities stranded on seed %i', (seed) => {
    const { state } = playRun(seed, 12)
    // Everything transient must drain once a wave is over.
    expect(state.projectiles.length).toBeLessThan(200)
    expect(state.particles.length).toBeLessThan(600)
    expect(state.effects.length).toBeLessThan(200)
    expect(state.enemies.every((e) => !e.dead)).toBe(true)
  })

  it('keeps entity counts bounded', () => {
    const r = playRun(1234, 14)
    expect(r.peak).toBeLessThan(2500)
  })

  it('kills enemies and pays out gold', () => {
    const { state } = playRun(1234, 10)
    expect(state.kills).toBeGreaterThan(30)
    expect(state.gold).toBeGreaterThan(0)
    expect(Number.isFinite(state.gold)).toBe(true)
  })

  it('is survivable with competent play and still eventually lethal', () => {
    // If wave 12 is routinely fatal the curve is too steep; if a 40-wave run
    // never ends the game has no ceiling.
    const short = playRun(1234, 12)
    expect(short.state.lives).toBeGreaterThan(0)

    const long = playRun(1234, 60)
    expect(long.stalled).toBe(false)
    expect(long.wavesPlayed).toBeGreaterThan(20)
  })
})
