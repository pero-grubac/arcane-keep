import { describe, it, expect } from 'vitest'
import {
  TOWER_DEFS, TOWER_ORDER, EVOLUTIONS, EVOLUTION_BY_KEY, PROJ_COLORS,
  calcStats, dpsOf, supportAura, isSupport, getDominant, getTowerCost,
  upgradeCost, nextTargeting, TARGETING_MODES, MAX_UPGRADE, EVOLVE_REQUIREMENT,
} from '../src/game/towers.js'

const bare = (baseType, upgrades = { dmg: 0, spd: 0, rng: 0 }) => ({
  baseType, upgrades, evolved: false, evolveStat: null,
})

describe('tower data', () => {
  it('has three evolutions for every base tower', () => {
    for (const type of TOWER_ORDER) {
      expect(Object.keys(EVOLUTIONS[type]).sort()).toEqual(['dmg', 'rng', 'spd'])
    }
  })

  it('gives every evolution a unique key, name and projectile colour', () => {
    const keys = Object.keys(EVOLUTION_BY_KEY)
    expect(keys.length).toBe(TOWER_ORDER.length * 3)
    expect(new Set(keys).size).toBe(keys.length)
    const names = keys.map((k) => EVOLUTION_BY_KEY[k].name)
    expect(new Set(names).size).toBe(names.length)
    for (const k of keys) expect(PROJ_COLORS[k]).toMatch(/^#[0-9a-f]{6}$/i)
    for (const t of TOWER_ORDER) expect(PROJ_COLORS[t]).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('describes every evolution', () => {
    for (const type of TOWER_ORDER) {
      for (const stat of ['dmg', 'spd', 'rng']) {
        const ev = EVOLUTIONS[type][stat]
        expect(ev.desc.length, `${ev.name} has no description`).toBeGreaterThan(10)
        expect(ev.art.shape).toBeTruthy()
      }
    }
  })

  it('charges more for each tower of the same type', () => {
    const counts = { archer: 0 }
    const first = getTowerCost('archer', counts)
    counts.archer = 3
    expect(getTowerCost('archer', counts)).toBeGreaterThan(first)
  })

  it('charges more for each upgrade level', () => {
    for (let l = 1; l < MAX_UPGRADE; l++) {
      expect(upgradeCost(l)).toBeGreaterThan(upgradeCost(l - 1))
    }
  })
})

describe('calcStats', () => {
  it('increases with upgrades', () => {
    const base = calcStats(bare('archer'))
    const up = calcStats(bare('archer', { dmg: 3, spd: 3, rng: 3 }))
    expect(up.dmg).toBeGreaterThan(base.dmg)
    expect(up.fireRate).toBeGreaterThan(base.fireRate)
    expect(up.range).toBeGreaterThan(base.range)
  })

  it('keeps upgrades when a tower evolves, so evolving is never a downgrade', () => {
    // The original build wiped upgrades on evolve, which made a 4-upgrade tower
    // strictly weaker afterwards.
    for (const type of TOWER_ORDER) {
      if (TOWER_DEFS[type].support) continue
      const upgrades = { dmg: 4, spd: 4, rng: 4 }
      const before = dpsOf(calcStats({ ...bare(type, upgrades) }))
      const best = ['dmg', 'spd', 'rng']
        .map((stat) => dpsOf(calcStats({ ...bare(type, upgrades), evolved: true, evolveStat: stat })))
        .reduce((a, b) => Math.max(a, b))
      expect(best, `${type} loses power on evolve`).toBeGreaterThan(before)
    }
  })

  it('applies support auras and high ground', () => {
    const plain = calcStats(bare('archer'))
    const buffed = calcStats({ ...bare('archer'), auraBuff: { dmg: 1.3, fireRate: 1.45, range: 1.1 } })
    expect(buffed.dmg).toBeCloseTo(plain.dmg * 1.3)
    expect(buffed.fireRate).toBeCloseTo(plain.fireRate * 1.45)
    expect(buffed.buffed).toBe(true)

    const high = calcStats({ ...bare('archer'), terrain: 'high' })
    expect(high.range).toBeCloseTo(plain.range * 1.15)
    expect(calcStats({ ...bare('archer'), terrain: 'rubble' }).range).toBeCloseTo(plain.range)
  })

  it('applies the Rally multiplier', () => {
    const plain = calcStats(bare('archer'))
    const rallied = calcStats({ ...bare('archer'), rallyMult: 1.5 })
    expect(rallied.fireRate).toBeCloseTo(plain.fireRate * 1.5)
  })

  it('folds Gatling spin-up into fire rate', () => {
    const cold = calcStats({ ...bare('cannon'), evolved: true, evolveStat: 'spd', spin: 0 })
    const hot = calcStats({ ...bare('cannon'), evolved: true, evolveStat: 'spd', spin: 1 })
    expect(hot.fireRate).toBeGreaterThan(cold.fireRate * 1.7)
  })
})

describe('support towers', () => {
  it('project a buff and deal no damage', () => {
    const ob = bare('obelisk')
    expect(isSupport(ob)).toBe(true)
    expect(dpsOf(calcStats(ob))).toBe(0)
    const aura = supportAura(ob)
    expect(aura.radius).toBeGreaterThan(0)
    expect(aura.fireRate).toBeGreaterThan(1)
  })

  it('has an evolution for each stat that actually projects something', () => {
    for (const stat of ['dmg', 'spd', 'rng']) {
      const aura = supportAura({ ...bare('obelisk'), evolved: true, evolveStat: stat })
      expect(aura.dmg > 1 || aura.fireRate > 1 || aura.range > 1, stat).toBe(true)
    }
  })

  it('grows its radius with range upgrades', () => {
    const small = supportAura(bare('obelisk')).radius
    const big = supportAura(bare('obelisk', { dmg: 0, spd: 0, rng: 4 })).radius
    expect(big).toBeGreaterThan(small)
  })

  it('is the only tower type flagged as support', () => {
    const supports = TOWER_ORDER.filter((t) => isSupport(bare(t)))
    expect(supports).toEqual(['obelisk'])
  })
})

describe('evolution hints', () => {
  it('suggests the dominant stat, and nothing on a tie', () => {
    expect(getDominant({ dmg: 3, spd: 1, rng: 0 })).toBe('dmg')
    expect(getDominant({ dmg: 0, spd: 2, rng: 5 })).toBe('rng')
    // A genuine tie must not claim a path the player has not committed to.
    expect(getDominant({ dmg: 2, spd: 2, rng: 0 })).toBeNull()
    expect(getDominant({ dmg: 0, spd: 0, rng: 0 })).toBeNull()
  })

  it('requires a sensible number of upgrades before evolving', () => {
    expect(EVOLVE_REQUIREMENT).toBeGreaterThan(0)
    expect(EVOLVE_REQUIREMENT).toBeLessThanOrEqual(MAX_UPGRADE * 3)
  })
})

describe('targeting modes', () => {
  it('cycles through every mode and wraps', () => {
    let mode = TARGETING_MODES[0].id
    const seen = new Set()
    for (let i = 0; i < TARGETING_MODES.length; i++) {
      seen.add(mode)
      mode = nextTargeting(mode)
    }
    expect(seen.size).toBe(TARGETING_MODES.length)
    expect(mode).toBe(TARGETING_MODES[0].id)
  })
})
