import { describe, it, expect } from 'vitest'
import {
  makeGameState, createTower, tick, castAbility, abilityReady, recomputeAuras,
} from '../src/game/engine.js'
import { generateMap } from '../src/game/maps/generator.js'
import { Enemy, scaledEnemy } from '../src/game/enemies.js'
import { calcStats } from '../src/game/towers.js'
import { ABILITIES, ABILITY_BY_ID, makeAbilityState } from '../src/game/abilities.js'

const noop = { onLeak: () => {}, onKill: () => {}, onWaveCleared: () => {} }
const run = (s, seconds) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) tick(s, 1 / 60, noop)
}

function setup(wave = 12) {
  const map = generateMap(4242)
  const s = makeGameState(map, 1)
  s.wave = wave
  return { map, s }
}

function parkEnemy(s, map, type, at = 5, wave = 12) {
  const e = new Enemy(type, scaledEnemy(type, wave, null), map.path, wave)
  e.baseSpd = 0
  e.segment = at
  e.x = map.path[at][0] + 0.5
  e.y = map.path[at][1] + 0.5
  s.enemies.push(e)
  return e
}

describe('ability definitions', () => {
  it('all start off cooldown', () => {
    const state = makeAbilityState()
    for (const a of ABILITIES) expect(state[a.id]).toBe(0)
  })

  it('have unique ids and hotkeys', () => {
    expect(new Set(ABILITIES.map((a) => a.id)).size).toBe(ABILITIES.length)
    expect(new Set(ABILITIES.map((a) => a.hotkey)).size).toBe(ABILITIES.length)
    for (const a of ABILITIES) {
      expect(a.cooldown).toBeGreaterThan(0)
      expect(a.desc.length).toBeGreaterThan(10)
      expect(ABILITY_BY_ID[a.id]).toBe(a)
    }
  })
})

describe('meteor', () => {
  it('damages everything in its radius, through armour', () => {
    const { map, s } = setup()
    const hit = parkEnemy(s, map, 'brute')
    const before = hit.hp
    expect(castAbility(s, 'meteor', { col: Math.floor(hit.x), row: Math.floor(hit.y) })).toBe(true)
    expect(hit.hp).toBeLessThan(before)
    expect(hit.burns.length).toBeGreaterThan(0)
    expect(s.hazards.length).toBe(1)
  })

  it('scales its damage with the wave', () => {
    const early = ABILITY_BY_ID.meteor.damage(1)
    const late = ABILITY_BY_ID.meteor.damage(30)
    expect(late).toBeGreaterThan(early * 3)
  })

  it('goes on cooldown and cannot be double-cast', () => {
    const { map, s } = setup()
    parkEnemy(s, map, 'grunt')
    castAbility(s, 'meteor', { col: 3, row: 3 })
    expect(abilityReady(s, 'meteor')).toBe(false)
    expect(castAbility(s, 'meteor', { col: 4, row: 4 })).toBe(false)
  })

  it('refuses a target off the map, without burning the cooldown', () => {
    const { s } = setup()
    expect(castAbility(s, 'meteor', { col: -5, row: -5 })).toBe(false)
    expect(abilityReady(s, 'meteor')).toBe(true)
  })

  it('refuses to fire without a target at all', () => {
    const { s } = setup()
    expect(castAbility(s, 'meteor')).toBe(false)
    expect(abilityReady(s, 'meteor')).toBe(true)
  })
})

describe('deep freeze', () => {
  it('freezes every enemy that can be chilled', () => {
    const { map, s } = setup()
    const grunt = parkEnemy(s, map, 'grunt')
    const wisp = parkEnemy(s, map, 'wisp')
    castAbility(s, 'freeze')
    expect(grunt.freezeT).toBeGreaterThan(0)
    expect(grunt.speed).toBe(0)
    // Chill-immune foes must shrug it off, exactly as the description claims.
    expect(wisp.freezeT).toBeLessThanOrEqual(0)
  })
})

describe('rally', () => {
  it('speeds every tower up, then wears off', () => {
    const { s } = setup()
    const t = createTower(5, 5, 'archer', 0)
    s.towers.push(t)
    recomputeAuras(s)
    const before = calcStats(t).fireRate

    castAbility(s, 'rally')
    recomputeAuras(s)
    expect(calcStats(t).fireRate).toBeCloseTo(before * ABILITY_BY_ID.rally.mult)

    run(s, ABILITY_BY_ID.rally.duration + 1)
    recomputeAuras(s)
    expect(calcStats(t).fireRate).toBeCloseTo(before)
  })
})

describe('cooldowns', () => {
  it('tick down on simulation time and become ready again', () => {
    const { s } = setup()
    castAbility(s, 'rally')
    expect(abilityReady(s, 'rally')).toBe(false)
    run(s, ABILITY_BY_ID.rally.cooldown + 1)
    expect(abilityReady(s, 'rally')).toBe(true)
  })

  it('recover faster at higher game speed', () => {
    const a = setup().s
    const b = setup().s
    b.gameSpeed = 4
    castAbility(a, 'rally')
    castAbility(b, 'rally')
    run(a, 5)
    run(b, 5)
    expect(b.abilityCd.rally).toBeLessThan(a.abilityCd.rally)
  })

  it('cannot be cast once the run is over', () => {
    const { s } = setup()
    s.phase = 'gameover'
    expect(abilityReady(s, 'rally')).toBe(false)
    expect(castAbility(s, 'rally')).toBe(false)
  })
})
