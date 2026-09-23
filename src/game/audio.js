// ─── Audio ────────────────────────────────────────────────────────────────────
// Everything is synthesised with WebAudio oscillators and generated noise, so
// the game ships with zero audio files.
//
// The engine never calls in here. It queues events on `state.sfx` and the
// canvas drains them each frame, which keeps the simulation headless and lets
// the balance sim run with no audio stack at all.

const MASTER = 0.18

// Per-event throttles. Forty towers firing would otherwise stack hundreds of
// oscillators a second and turn into a wall of noise (and a CPU sink).
const THROTTLE_MS = {
  shoot: 55,
  hit: 70,
  kill: 45,
  bosskill: 200,
  leak: 120,
  evolve: 0,
  wave: 0,
  ui: 30,
  gameover: 0,
  meteor: 0,
  freeze: 0,
  rally: 0,
  boss: 400,
}

// Each tower family gets its own pitch so you can hear what is firing.
const SHOOT_TONE = {
  archer: { f: 880, type: 'square', dur: 0.05 },
  deadeye: { f: 660, type: 'sawtooth', dur: 0.08 },
  ranger: { f: 1040, type: 'square', dur: 0.04 },
  warden: { f: 760, type: 'triangle', dur: 0.09 },
  mage: { f: 520, type: 'sine', dur: 0.09 },
  destroyer: { f: 300, type: 'sawtooth', dur: 0.13 },
  archmage: { f: 700, type: 'sine', dur: 0.05 },
  seer: { f: 600, type: 'triangle', dur: 0.11 },
  frost: { f: 1180, type: 'sine', dur: 0.07 },
  rime: { f: 1320, type: 'triangle', dur: 0.09 },
  blizzard: { f: 240, type: 'sine', dur: 0.16 },
  glacier: { f: 980, type: 'sine', dur: 0.12 },
  cannon: { f: 150, type: 'square', dur: 0.14 },
  siege: { f: 110, type: 'sawtooth', dur: 0.18 },
  gatling: { f: 320, type: 'square', dur: 0.035 },
  mortar: { f: 190, type: 'triangle', dur: 0.15 },
}

function createAudio(enabled = true) {
  let ctx = null
  let master = null
  // Two buses under the master, so effects and the ambient bed have their own
  // volume sliders. Levels are kept even before the context exists, because the
  // context is only created on the first sound.
  let sfxBus = null
  let ambientBus = null
  const volume = { sfx: 1, ambient: 1 }
  let noiseBuffer = null
  let ambient = null
  let ambientWave = 0
  const lastPlayed = new Map()
  let on = enabled

  function ensure() {
    if (ctx) return ctx
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    try {
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = MASTER
      master.connect(ctx.destination)
      sfxBus = ctx.createGain()
      sfxBus.gain.value = volume.sfx
      sfxBus.connect(master)
      ambientBus = ctx.createGain()
      ambientBus.gain.value = volume.ambient
      ambientBus.connect(master)

      // One second of white noise, reused for every percussive sound.
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    } catch {
      ctx = null
    }
    return ctx
  }

  function tone(freq, type, dur, gain = 0.5, slideTo = null, delay = 0) {
    if (!ctx) return
    const t0 = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur)
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.012, dur * 0.3))
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur)
    osc.connect(g)
    g.connect(sfxBus)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  function noise(dur, gain = 0.4, freq = 1200, q = 1) {
    if (!ctx || !noiseBuffer) return
    const t0 = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(freq, t0)
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.3), t0 + dur)
    filter.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(sfxBus)
    src.start(t0)
    src.stop(t0 + dur + 0.02)
  }

  function play(kind, key) {
    if (!on) return
    if (!ensure()) return
    if (ctx.state === 'suspended') ctx.resume()

    const now = performance.now()
    const gap = THROTTLE_MS[kind] ?? 50
    if (gap > 0) {
      const last = lastPlayed.get(kind) ?? -Infinity
      if (now - last < gap) return
      lastPlayed.set(kind, now)
    }

    switch (kind) {
      case 'shoot': {
        const t = SHOOT_TONE[key] ?? SHOOT_TONE.archer
        tone(t.f, t.type, t.dur, 0.22, t.f * 0.55)
        break
      }
      case 'hit':
        noise(0.05, 0.12, 2200, 0.8)
        break
      case 'kill':
        noise(0.14, 0.3, 900, 1.2)
        break
      case 'bosskill':
        noise(0.5, 0.5, 500, 1.5)
        tone(180, 'sawtooth', 0.5, 0.35, 60)
        break
      case 'leak':
        tone(150, 'sine', 0.35, 0.5, 60)
        noise(0.2, 0.25, 300, 1)
        break
      case 'evolve':
        // Rising arpeggio — the reward sound.
        tone(523, 'triangle', 0.16, 0.34)
        tone(659, 'triangle', 0.16, 0.34, null, 0.08)
        tone(784, 'triangle', 0.3, 0.36, null, 0.16)
        tone(1047, 'sine', 0.42, 0.28, null, 0.24)
        break
      case 'wave':
        tone(392, 'square', 0.14, 0.3)
        tone(523, 'square', 0.22, 0.3, null, 0.12)
        break
      case 'build':
        tone(300, 'square', 0.07, 0.25, 460)
        break
      case 'ui':
        tone(760, 'square', 0.03, 0.14)
        break
      case 'gold':
        tone(1200, 'triangle', 0.06, 0.2, 1600)
        break
      case 'gameover':
        tone(392, 'sawtooth', 0.5, 0.4, 180)
        tone(262, 'sawtooth', 0.9, 0.4, 90, 0.25)
        break

      // ── Player abilities ──
      case 'meteor':
        // A long descending whistle into a heavy impact.
        tone(900, 'sawtooth', 0.45, 0.3, 90)
        noise(0.7, 0.6, 700, 0.8)
        tone(70, 'square', 0.6, 0.5, 35, 0.32)
        break
      case 'freeze':
        // Glassy shimmer sliding upward, then settling.
        tone(1600, 'sine', 0.5, 0.26, 2600)
        tone(2100, 'triangle', 0.4, 0.18, 3000, 0.06)
        noise(0.5, 0.16, 5000, 2.5)
        tone(400, 'sine', 0.6, 0.2, 260, 0.1)
        break
      case 'rally':
        // Horn call: a rising fourth, twice.
        tone(294, 'sawtooth', 0.2, 0.3)
        tone(392, 'sawtooth', 0.3, 0.32, null, 0.14)
        tone(392, 'sawtooth', 0.18, 0.24, null, 0.42)
        tone(587, 'sawtooth', 0.4, 0.3, null, 0.54)
        break

      // ── Boss casting ──
      case 'boss':
        tone(120, 'sawtooth', 0.55, 0.36, 200)
        tone(180, 'square', 0.4, 0.2, 120, 0.05)
        noise(0.35, 0.2, 400, 2)
        break
      default:
        break
    }
  }

  // A low bed that plays while a wave is live and climbs in pitch and weight as
  // the waves get worse. Started and stopped by the UI, not by the engine.
  function setAmbient(active, wave = 1) {
    if (!active) {
      if (ambient && ctx) {
        ambient.gain.gain.cancelScheduledValues(ctx.currentTime)
        ambient.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4)
      }
      return
    }
    if (!on || !ensure()) return
    if (ctx.state === 'suspended') ctx.resume()

    if (!ambient) {
      const osc = ctx.createOscillator()
      const sub = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 340
      osc.type = 'sawtooth'
      sub.type = 'sine'
      gain.gain.value = 0
      osc.connect(filter)
      sub.connect(filter)
      filter.connect(gain)
      gain.connect(ambientBus)
      osc.start()
      sub.start()
      ambient = { osc, sub, gain, filter }
    }

    ambientWave = wave
    const base = 44 + Math.min(wave, 40) * 1.6
    const t = ctx.currentTime
    ambient.osc.frequency.setTargetAtTime(base, t, 0.6)
    ambient.sub.frequency.setTargetAtTime(base / 2, t, 0.6)
    ambient.filter.frequency.setTargetAtTime(260 + Math.min(wave, 40) * 12, t, 0.8)
    // Grows from barely-there to a real presence by the late waves.
    const level = 0.05 + Math.min(wave, 30) * 0.0035
    ambient.gain.gain.setTargetAtTime(level, t, 0.8)
  }

  return {
    play,
    setAmbient,
    // Drains a frame's worth of engine events.
    drain(events) {
      if (!on || !events || events.length === 0) return
      for (const e of events) play(e.kind, e.key)
    },
    setEnabled(v) {
      on = v
      if (!v && ctx) {
        if (ambient) ambient.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
        try { ctx.suspend() } catch { /* ignore */ }
      } else if (v) {
        ensure()
        if (ctx?.state === 'suspended') ctx.resume()
        if (ambient && ambientWave) setAmbient(true, ambientWave)
      }
    },
    // Each level is 0–1 and scales that bus on top of the master level.
    setVolumes({ sfx, ambient } = {}) {
      if (typeof sfx === 'number') volume.sfx = Math.max(0, Math.min(1, sfx))
      if (typeof ambient === 'number') volume.ambient = Math.max(0, Math.min(1, ambient))
      if (!ctx) return
      sfxBus.gain.setTargetAtTime(volume.sfx, ctx.currentTime, 0.05)
      ambientBus.gain.setTargetAtTime(volume.ambient, ctx.currentTime, 0.05)
    },
    get enabled() {
      return on
    },
  }
}

// A single shared instance. Nothing touches `window` until the first sound is
// played, so importing this module is safe anywhere.
export const audio = createAudio()
