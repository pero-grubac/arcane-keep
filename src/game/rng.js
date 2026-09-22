// Seeded RNG. Every random decision in the game funnels through here so the
// Intel panel can preview exactly the wave that will spawn.

export function mulberry32(seed) {
  let a = seed >>> 0
  return function rng() {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Mixes two integers into a well-distributed seed (run seed + wave number).
export function hashSeed(a, b = 0) {
  let h = (a ^ 0x9e3779b9) >>> 0
  h = Math.imul(h ^ (b + 0x85ebca6b), 0xcc9e2d51) >>> 0
  h ^= h >>> 13
  h = Math.imul(h, 0x1b873593) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0
}

export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function intRange(rng, min, max) {
  return Math.floor(min + rng() * (max - min + 1))
}
