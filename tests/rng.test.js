import { describe, it, expect } from 'vitest'
import { mulberry32, hashSeed, randomSeed, shuffle, intRange } from '../src/game/rng.js'

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 50; i++) expect(a()).toBe(b())
  })

  it('differs between seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    expect(Array.from({ length: 10 }, a)).not.toEqual(Array.from({ length: 10 }, b))
  })

  it('stays inside [0, 1)', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 5000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is roughly uniform', () => {
    const rng = mulberry32(99)
    const buckets = new Array(10).fill(0)
    const n = 50000
    for (let i = 0; i < n; i++) buckets[Math.floor(rng() * 10)]++
    for (const b of buckets) {
      expect(b).toBeGreaterThan(n / 10 * 0.9)
      expect(b).toBeLessThan(n / 10 * 1.1)
    }
  })
})

describe('hashSeed', () => {
  it('separates neighbouring wave numbers', () => {
    const seen = new Set()
    for (let wave = 1; wave <= 200; wave++) seen.add(hashSeed(1234, wave))
    expect(seen.size).toBe(200)
  })

  it('separates neighbouring run seeds', () => {
    const seen = new Set()
    for (let seed = 1; seed <= 200; seed++) seen.add(hashSeed(seed, 5))
    expect(seen.size).toBe(200)
  })
})

describe('helpers', () => {
  it('shuffles without losing or duplicating elements', () => {
    const rng = mulberry32(3)
    const input = Array.from({ length: 50 }, (_, i) => i)
    const out = shuffle(rng, input.slice())
    expect(out.slice().sort((a, b) => a - b)).toEqual(input)
  })

  it('produces integers inside the requested range', () => {
    const rng = mulberry32(5)
    for (let i = 0; i < 1000; i++) {
      const v = intRange(rng, 3, 7)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(7)
    }
  })

  it('returns a usable 32-bit seed', () => {
    for (let i = 0; i < 100; i++) {
      const s = randomSeed()
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(0xffffffff)
    }
  })
})
