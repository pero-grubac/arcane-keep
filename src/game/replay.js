import { makeGameState, tick, spawnEvolveParticles } from './engine.js'
import { dispatch } from './actions.js'
import { EVOLUTIONS } from './towers.js'
import { HANDCRAFTED_MAPS, generateMap } from './maps/index.js'

// ─── Replays ──────────────────────────────────────────────────────────────────
// A replay is the map, the seed and the action log — nothing else. Waves are a
// pure function of the seed, combat rolls come from the seeded state.rng, the
// engine integrates on a fixed substep, and every player action is logged
// against the substep it happened on. Feed the same actions in at the same
// steps and the whole run plays out again, whatever the frame rate or speed.

const REPLAY_VERSION = 1
const STATS = ['dmg', 'spd', 'rng']

// Maps are referenced rather than embedded: handcrafted ones by id, generated
// ones by the seed that builds them. That keeps a share link short.
export function mapRef(map) {
  if (map.isRandom) return { gen: map.seed, id: map.id, name: map.name }
  return { hand: map.id }
}

export function resolveMap(ref) {
  if (!ref) return null
  if (ref.hand) return HANDCRAFTED_MAPS.find((m) => m.id === ref.hand) ?? null
  if (typeof ref.gen === 'number') {
    const map = generateMap(ref.gen)
    return { ...map, id: ref.id ?? map.id, name: ref.name ?? map.name }
  }
  return null
}

// A replay being watched shares the recording it came from.
export function recordingOf(state) {
  if (state.replay) return state.replay.rec
  if (!Array.isArray(state.log)) return null
  return {
    v: REPLAY_VERSION,
    map: mapRef(state.currentMap),
    seed: state.seed,
    daily: state.dailyKey ?? null,
    log: state.log.map((a) => a.slice()),
    // What the run achieved, so a link can say so before anyone watches it.
    result: { wave: state.wave, kills: state.kills },
  }
}

// A fresh run on the recorded map and seed, with the log wired into the
// engine's per-substep hook.
export function makeReplayState(rec) {
  if (!rec || rec.v !== REPLAY_VERSION || !Array.isArray(rec.log)) return null
  const map = resolveMap(rec.map)
  if (!map) return null
  const state = makeGameState(map, rec.seed)
  state.dailyKey = rec.daily ?? null
  state.selectedBuild = null
  // A watcher can crank the speed well past what live play allows.
  state.maxSubsteps = 64
  state.replay = { rec, log: rec.log, idx: 0, desync: false }
  state.beforeStep = applyDueActions
  return state
}

function applyDueActions(state) {
  const r = state.replay
  while (r.idx < r.log.length && r.log[r.idx][0] <= state.steps) {
    const [, code, ...args] = r.log[r.idx++]
    const res = dispatch(state, [code, ...args])
    // A failed action means the run no longer matches the recording — a
    // balance change since it was made, most likely. Keep going, but say so.
    if (!res.ok) r.desync = true
    else if (code === 'e') {
      const v = EVOLUTIONS[res.tower.baseType][STATS[args[2]]]
      spawnEvolveParticles(state, res.tower, v.color)
    }
  }
}

// Every recorded action applied, and nothing left on the field: from here the
// run would only continue with input nobody gave.
export function replayFinished(state) {
  if (!state.replay) return false
  if (state.phase !== 'playing') return true
  return state.replay.idx >= state.replay.log.length && !state.waveActive
}

// Plays a recording to its end without rendering. Used by the tests, and
// cheap enough to verify a link before showing it.
export function runHeadless(rec, { frame = 1 / 60, maxSeconds = 60 * 60 } = {}) {
  const state = makeReplayState(rec)
  if (!state) return null
  state.gameSpeed = 16
  const frames = Math.ceil(maxSeconds / (frame * state.gameSpeed))
  for (let i = 0; i < frames && !replayFinished(state); i++) tick(state, frame)
  return state
}

// ─── Share links ──────────────────────────────────────────────────────────────
// JSON → deflate → base64url. A 40-wave run is typically a couple of KB.

async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function toBase64Url(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export async function encodeRecording(rec) {
  return toBase64Url(await deflate(new TextEncoder().encode(JSON.stringify(rec))))
}

// Returns null for anything that is not a recording this build understands.
export async function decodeRecording(str) {
  try {
    const rec = JSON.parse(new TextDecoder().decode(await inflate(fromBase64Url(str))))
    return rec?.v === REPLAY_VERSION && Array.isArray(rec.log) && resolveMap(rec.map) ? rec : null
  } catch {
    return null
  }
}

export function shareUrl(params) {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url.toString()
}
