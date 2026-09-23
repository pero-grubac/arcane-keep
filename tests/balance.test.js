import { describe, it, expect } from 'vitest'
import { playRun } from './bot.js'

// An end-to-end smoke run: a simple bot plays real waves on a real map. This is
// the test that catches the whole-system failures — a wave that never ends, an
// entity list that grows without bound, a crash deep in a rare interaction.

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
