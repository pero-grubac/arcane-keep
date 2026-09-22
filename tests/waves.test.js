import { describe, it, expect } from 'vitest'
import { buildWave, clearBonus, earlyBonus, threatLevel, MODIFIERS, MAX_ENEMIES } from '../src/game/waves.js'
import { ENEMY_DEFS, waveScaling, scaledEnemy, applyArmor } from '../src/game/enemies.js'

describe('wave composition', () => {
  it('is a pure function of (seed, wave)', () => {
    // The Intel panel previews the wave by calling buildWave again. If this is
    // not stable the preview is a lie, which is exactly what the old build did.
    for (const wave of [1, 5, 12, 25]) {
      const a = buildWave(wave, 999)
      const b = buildWave(wave, 999)
      expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    }
  })

  it('differs between seeds', () => {
    const a = JSON.stringify(buildWave(8, 1))
    const b = JSON.stringify(buildWave(8, 2))
    expect(a).not.toBe(b)
  })

  it('grows in size while under the cap', () => {
    // Counts can only rise until the entity cap binds; past that the wave gets
    // stronger instead of bigger, so this only asserts the uncapped stretch.
    const counts = [1, 4, 8, 12].map((w) => buildWave(w, 7).totalCount)
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThan(counts[i - 1])
    }
  })

  it('grows in total strength and reward at every stage', () => {
    const totalHp = (w) => buildWave(w, 7).queue.reduce((a, q) => a + q.spec.hp, 0)
    const hp = [1, 5, 10, 15, 20, 30, 45].map(totalHp)
    for (let i = 1; i < hp.length; i++) {
      expect(hp[i], `wave strength dipped at index ${i}`).toBeGreaterThan(hp[i - 1])
    }
    const rewards = [1, 10, 20, 30].map((w) => buildWave(w, 7).reward)
    for (let i = 1; i < rewards.length; i++) {
      expect(rewards[i]).toBeGreaterThan(rewards[i - 1])
    }
  })

  it('caps the enemy count and converts the rest into strength', () => {
    // Past the cap the wave must keep getting harder without spawning an
    // unreadable swarm.
    const late = [30, 40, 50].map((w) => buildWave(w, 7))
    for (const d of late) expect(d.totalCount).toBeLessThanOrEqual(MAX_ENEMIES)
    expect(late[0].elite).toBeGreaterThan(1)
    expect(late[2].elite).toBeGreaterThan(late[0].elite)

    const hp30 = buildWave(30, 7).queue[0].spec.hp
    const hp50 = buildWave(50, 7).queue[0].spec.hp
    expect(hp50).toBeGreaterThan(hp30)
  })

  it('never exceeds the entity cap on any wave or seed', () => {
    for (let seed = 1; seed <= 12; seed++) {
      for (let w = 1; w <= 60; w++) {
        expect(buildWave(w, seed).totalCount, `seed ${seed} wave ${w}`)
          .toBeLessThanOrEqual(MAX_ENEMIES)
      }
    }
  })

  it('does not mark early waves as elite', () => {
    // Leftover budget from indivisible enemy costs is not an elite wave.
    for (const w of [1, 2, 3, 4, 5]) {
      expect(buildWave(w, 7).elite, `wave ${w}`).toBeFalsy()
    }
  })

  it('spawns bosses on cadence', () => {
    const hasBoss = (w, seed = 7) =>
      Object.keys(buildWave(w, seed).composition).some((t) => ENEMY_DEFS[t].tags.includes('boss'))
    for (const w of [5, 10, 15, 20, 25, 30]) expect(hasBoss(w), `wave ${w}`).toBe(true)
    for (const w of [1, 2, 3, 4, 6, 7]) expect(hasBoss(w), `wave ${w}`).toBe(false)
    expect(buildWave(20, 7).composition.overlord).toBeGreaterThan(0)
  })

  it('only uses enemy types that have unlocked', () => {
    expect(Object.keys(buildWave(1, 7).composition)).toEqual(['grunt'])
    for (let w = 1; w <= 5; w++) {
      expect(buildWave(w, 7).composition.warden).toBeUndefined()
    }
  })

  it('orders the spawn queue by delay', () => {
    for (const w of [3, 11, 28]) {
      const { queue } = buildWave(w, 7)
      for (let i = 1; i < queue.length; i++) {
        expect(queue[i].delay).toBeGreaterThanOrEqual(queue[i - 1].delay)
      }
    }
  })

  it('applies modifiers from wave 6 only', () => {
    for (let w = 1; w < 6; w++) {
      for (let seed = 1; seed < 30; seed++) {
        expect(buildWave(w, seed).modifier, `wave ${w}`).toBeNull()
      }
    }
    let seen = 0
    for (let seed = 1; seed < 60; seed++) if (buildWave(9, seed).modifier) seen++
    expect(seen).toBeGreaterThan(0)
    for (const m of MODIFIERS) expect(m.desc.length).toBeGreaterThan(5)
  })
})

describe('gold payouts', () => {
  it('pays more for clearing later waves', () => {
    expect(clearBonus(10)).toBeGreaterThan(clearBonus(1))
  })

  it('pays an early-send bonus proportional to what is still standing', () => {
    const full = earlyBonus(10, 20, 20)
    const half = earlyBonus(10, 10, 20)
    expect(full).toBeGreaterThan(half)
    expect(earlyBonus(10, 0, 20)).toBe(0)
    // Never more than the wave was worth to clear.
    expect(full).toBeLessThan(clearBonus(10))
  })
})

describe('enemy scaling', () => {
  it('grows health quadratically and caps the speed ramp', () => {
    const s1 = waveScaling(1)
    const s20 = waveScaling(20)
    const s40 = waveScaling(40)
    expect(s1.hp).toBe(1)
    expect(s20.hp).toBeGreaterThan(s1.hp * 4)
    expect(s40.hp).toBeGreaterThan(s20.hp * 1.8)
    expect(s40.spd).toBeLessThanOrEqual(1.5)
  })

  it('never lets armour fully negate damage', () => {
    // Armour blunts chip damage; it must never make an enemy immune.
    expect(applyArmor(10, 1000)).toBeCloseTo(1.2)
    expect(applyArmor(100, 20)).toBe(80)
    expect(applyArmor(100, 20, 1)).toBe(100)
    expect(applyArmor(100, 20, 0.5)).toBe(90)
  })

  it('scales shields with health', () => {
    const w1 = scaledEnemy('warden', 1, null)
    const w20 = scaledEnemy('warden', 20, null)
    expect(w20.shield).toBeGreaterThan(w1.shield)
  })
})

describe('threat labels', () => {
  it('escalate with the wave number', () => {
    const order = [1, 5, 8, 14, 20, 30].map((w) => threatLevel(w).label)
    expect(new Set(order).size).toBe(order.length)
  })
})
