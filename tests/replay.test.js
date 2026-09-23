import { describe, it, expect } from 'vitest'
import { playRun } from './bot.js'
import { serializeRun, restoreRun, tick } from '../src/game/engine.js'
import { dispatch, act } from '../src/game/actions.js'
import {
  recordingOf, runHeadless, makeReplayState, replayFinished, encodeRecording, decodeRecording,
  resolveMap, mapRef,
} from '../src/game/replay.js'
import { HANDCRAFTED_MAPS } from '../src/game/maps/index.js'

// The whole promise of a replay: the recorded actions, fed back in at the
// recorded steps, reproduce the run exactly — at a different frame rate, at a
// different speed, through a share link, and across a save and resume.

const summary = (s) => ({
  phase: s.phase,
  wave: s.wave,
  kills: s.kills,
  lives: s.lives,
  leaked: s.leaked,
  gold: Math.round(s.gold * 1000),
  towers: s.towers.map((t) => [t.col, t.row, t.baseType, t.evolveStat, t.targeting,
    Math.round(t.damageDealt * 1000), t.killCount]),
})

// Uneven on purpose: a replay must not care how the frames fell.
const JITTER = [1 / 60, 1 / 30, 1 / 144, 1 / 60, 1 / 45, 1 / 90]

describe('replays', () => {
  it('reproduce a varied run exactly, at a different frame rate and speed', () => {
    const live = playRun(1234, 24, { frames: JITTER, variety: true }).state
    const log = live.log.map(([, code]) => code)
    // The run really did exercise the rarer actions.
    for (const code of ['p', 'u', 'e', 's', 't', 'w', 'c']) expect(log).toContain(code)

    const replay = runHeadless(recordingOf(live))
    expect(replay.replay.desync).toBe(false)
    expect(summary(replay)).toEqual(summary(live))
  })

  it('reproduce a run that ends with the keep falling', () => {
    const live = playRun(7, 80, { variety: true }).state
    expect(live.phase).toBe('gameover')
    const replay = runHeadless(recordingOf(live))
    expect(replay.phase).toBe('gameover')
    expect(summary(replay)).toEqual(summary(live))
  })

  it('survive the share-link round trip', async () => {
    const live = playRun(1234, 10, { variety: true }).state
    const rec = recordingOf(live)
    const code = await encodeRecording(rec)
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    // Short enough for a URL.
    expect(code.length).toBeLessThan(4000)
    const back = await decodeRecording(code)
    expect(back).toEqual(rec)
    expect(summary(runHeadless(back))).toEqual(summary(live))
  })

  it('still cover the whole run after a save and resume', () => {
    let saved = null
    const live = playRun(99, 12, {
      variety: true,
      onWave: (s, w) => { if (w === 6) saved = JSON.parse(JSON.stringify(serializeRun(s))) },
    }).state

    // Resume from wave 6 and play the rest again with the same inputs.
    const resumed = restoreRun(saved)
    resumed.paused = false
    const rest = live.log.slice(saved.log.length)
    for (const [step, code, ...args] of rest) {
      while (resumed.steps < step) tick(resumed, 1 / 60)
      dispatch(resumed, [code, ...args])
    }
    while (resumed.waveActive) tick(resumed, 1 / 60)
    expect(summary(resumed)).toEqual(summary(live))

    // And the log carried through the save replays from wave 1.
    expect(summary(runHeadless(recordingOf(resumed)))).toEqual(summary(live))
  })

  it('flag a recording that no longer matches the game', () => {
    const live = playRun(4242, 6).state
    const rec = recordingOf(live)
    // Build a tower on the path — impossible, so the replay knows it diverged.
    const [c, r] = resolveMap(rec.map).path[3]
    const bad = { ...rec, log: [[0, ...act.place(c, r, 'archer')], ...rec.log] }
    const replay = runHeadless(bad)
    expect(replay.replay.desync).toBe(true)
  })

  it('finish once every action is applied and the field is clear', () => {
    const state = makeReplayState({ v: 1, map: mapRef(HANDCRAFTED_MAPS[0]), seed: 5, log: [] })
    expect(replayFinished(state)).toBe(true)
  })

  it('reject links they cannot read', async () => {
    expect(await decodeRecording('not-a-replay')).toBeNull()
    expect(await decodeRecording('')).toBeNull()
  })
})
