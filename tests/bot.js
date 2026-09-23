import { makeGameState, tick, buildCheck, pathsOf } from '../src/game/engine.js'
import { dispatch, act } from '../src/game/actions.js'
import { generateMap } from '../src/game/maps/generator.js'

// A simple bot that plays real waves on a real map through the same dispatch()
// the UI uses, so every run it plays is also a replayable recording.

const MIX = ['archer', 'frost', 'archer', 'mage', 'obelisk', 'cannon', 'archer', 'frost']
const LEAN = { archer: 'dmg', frost: 'rng', mage: 'dmg', cannon: 'dmg', obelisk: 'spd' }

// Rank buildable tiles: spots covering every lane first (the merge on a
// branching map), then proximity to the road.
function rankSpots(state, map) {
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
  return spots.sort((a, b) => (b.covered - a.covered) || (a.d - b.d))
}

// `frames` is a list of frame lengths cycled through, so a run can be played at
// an uneven frame rate. `variety` mixes in the rarer actions a replay has to
// get right: targeting, selling, abilities and calling waves in early.
export function playRun(seed, waves, { frames = [1 / 60], variety = false, onWave } = {}) {
  const map = generateMap(seed)
  const state = makeGameState(map, seed)
  const spots = rankSpots(state, map)
  let spotIdx = 0
  let frameIdx = 0
  const step = () => tick(state, frames[frameIdx++ % frames.length])

  const spend = (wave) => {
    const want = Math.min(spots.length, 3 + Math.floor(wave * 0.9))
    let acted = true
    let guard = 0
    while (acted && guard++ < 80) {
      acted = false
      if (state.towers.length < want && spotIdx < spots.length) {
        const sp = spots[spotIdx]
        const type = MIX[state.towers.length % MIX.length]
        if (!buildCheck(state, sp.c, sp.r).ok) { spotIdx++; acted = true; continue }
        if (dispatch(state, act.place(sp.c, sp.r, type)).ok) {
          spotIdx++
          acted = true
          continue
        }
      }
      for (const t of state.towers) {
        if (!t.evolved && dispatch(state, act.evolve(t, LEAN[t.baseType])).ok) acted = true
      }
      if (acted) continue
      for (const t of state.towers) {
        if (dispatch(state, act.upgrade(t, LEAN[t.baseType])).ok) acted = true
      }
    }
  }

  const report = { seed, wavesPlayed: 0, stalled: false, peak: 0 }
  for (let w = 1; w <= waves; w++) {
    if (state.phase !== 'playing') break
    spend(w)
    if (variety && state.towers.length > 1) {
      if (w % 3 === 0) dispatch(state, act.target(state.towers[w % state.towers.length], 'strong'))
      if (w === 7) dispatch(state, act.sell(state.towers[0]))
    }
    dispatch(state, act.sendWave())
    let n = 0
    let calledEarly = false
    while (state.waveActive && n < 60 * 240) {
      step()
      n++
      if (variety) {
        if (n === 90) dispatch(state, act.cast('rally'))
        const target = state.enemies.find((e) => !e.dead)
        if (n === 150 && target) {
          dispatch(state, act.cast('meteor', { col: Math.floor(target.x), row: Math.floor(target.y) }))
        }
        if (n === 200 && w % 4 === 0) dispatch(state, act.cast('freeze'))
        // Calling a wave in early merges two spawn queues mid-fight.
        if (w % 5 === 0 && n === 240 && !calledEarly && w < waves) {
          dispatch(state, act.sendWave())
          calledEarly = true
          w++
        }
      }
      report.peak = Math.max(
        report.peak,
        state.enemies.length + state.projectiles.length + state.particles.length
          + state.effects.length + state.dmgNums.length + state.hazards.length,
      )
      if (state.phase !== 'playing') break
    }
    if (n >= 60 * 240) { report.stalled = true; break }
    report.wavesPlayed = w
    onWave?.(state, w)
  }

  report.state = state
  return report
}
