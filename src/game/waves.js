import { ENEMY_DEFS, scaledEnemy } from './enemies.js'
import { mulberry32, hashSeed, shuffle } from './rng.js'

// Waves are a pure function of (runSeed, waveNumber). That is what lets the
// Intel panel preview exactly the wave that will spawn — the old build rolled
// fresh randomness on every React render, so the preview was always a lie.

const UNLOCK = {
  grunt: 1,
  swift: 3,
  swarm: 6,
  brute: 7,
  wisp: 9,
  brood: 11,
  warden: 14,
}

// Rough "budget cost" of one enemy, used to fill a wave to a target strength.
const COST = {
  grunt: 4,
  swift: 4.5,
  swarm: 2.4,
  brute: 13,
  wisp: 9,
  brood: 13,
  warden: 12,
}

const SPAWN_GAP = {
  swarm: 0.32,
  swift: 0.6,
  grunt: 0.75,
  wisp: 0.8,
  warden: 0.95,
  brood: 1.1,
  brute: 1.15,
  boss: 2.2,
  overlord: 2.8,
}

export const MODIFIERS = [
  {
    id: 'swift', name: 'Swift Tide', icon: '💨',
    desc: 'Every enemy moves 25% faster',
    enemy: { spd: 1.25 }, countMult: 1, goldMult: 1.15,
  },
  {
    id: 'hardened', name: 'Hardened', icon: '🛡',
    desc: 'Enemies have 35% more health',
    enemy: { hp: 1.35 }, countMult: 1, goldMult: 1.2,
  },
  {
    id: 'horde', name: 'Horde', icon: '👥',
    desc: 'Twice the numbers, but frailer',
    enemy: { hp: 0.7 }, countMult: 1.9, goldMult: 1.1,
  },
  {
    id: 'elite', name: 'Elite Guard', icon: '⭐',
    desc: 'Fewer enemies, far tougher',
    enemy: { hp: 1.9, spd: 0.9 }, countMult: 0.6, goldMult: 1.35,
  },
]

// Deliberately gentle for the first few waves — the player needs room to get a
// second and third tower up before the counts start climbing.
function budgetFor(wave) {
  return 12 + 4.5 * wave + Math.pow(wave, 1.75)
}

function unlockedTypes(wave) {
  return Object.keys(UNLOCK).filter((t) => wave >= UNLOCK[t])
}

function pickModifier(rng, wave) {
  if (wave < 6) return null
  if (rng() > 0.42) return null
  return MODIFIERS[Math.floor(rng() * MODIFIERS.length) % MODIFIERS.length]
}

// Waves are capped at MAX_ENEMIES so the screen stays readable. Any budget that
// does not fit becomes per-enemy strength instead, which is what keeps the late
// game scaling after the entity count plateaus.
export const MAX_ENEMIES = 52

export function buildWave(waveNum, runSeed = 1) {
  const wave = Math.max(1, waveNum)
  const rng = mulberry32(hashSeed(runSeed, wave))
  const modifier = pickModifier(rng, wave)

  const composition = {}
  const add = (type, n = 1) => {
    composition[type] = (composition[type] || 0) + n
  }

  // Boss cadence: a Dread Lord every 5 waves, a Void Overlord every 10 from 20.
  if (wave >= 20 && wave % 10 === 0) add('overlord')
  else if (wave % 5 === 0) add('boss')

  const pool = unlockedTypes(wave)
  const fullBudget = budgetFor(wave) * (modifier?.countMult ?? 1)
  let budget = fullBudget
  let guard = 0
  let cappedOut = false

  while (budget > 0 && guard++ < 400) {
    const affordable = pool.filter((t) => COST[t] <= budget + 2)
    if (affordable.length === 0) break
    const placed = Object.values(composition).reduce((a, b) => a + b, 0)
    const room = MAX_ENEMIES - placed
    if (room <= 0) {
      cappedOut = true
      break
    }
    const type = affordable[Math.floor(rng() * affordable.length) % affordable.length]
    // Imps only ever show up as a pack, clamped to the room left so the cap is
    // a hard limit rather than something a pack can overshoot.
    const n = Math.min(room, type === 'swarm' ? 3 + Math.floor(rng() * 3) : 1)
    add(type, n)
    budget -= COST[type] * n
    if (placed + n >= MAX_ENEMIES) {
      cappedOut = true
      break
    }
  }

  if (Object.keys(composition).length === 0) add('grunt', 5)

  // Only budget left over because the wave hit the entity cap becomes raw
  // strength. Small change left over because enemy costs do not divide evenly
  // is not an elite wave.
  const overflow = cappedOut ? Math.max(0, budget) / fullBudget : 0
  const elite = 1 + overflow * 2.4
  const effective = {
    enemy: {
      hp: (modifier?.enemy?.hp ?? 1) * elite,
      spd: modifier?.enemy?.spd ?? 1,
    },
    reward: 1 + (elite - 1) * 0.55,
  }

  // Flatten into a spawn list, bosses first, the rest interleaved so a wave
  // does not arrive as neat same-type blocks.
  const bosses = []
  const rest = []
  for (const [type, count] of Object.entries(composition)) {
    for (let i = 0; i < count; i++) {
      ;(ENEMY_DEFS[type].tags.includes('boss') ? bosses : rest).push(type)
    }
  }
  shuffle(rng, rest)

  const pace = Math.max(0.5, 1.1 - wave * 0.014)
  const queue = []
  let delay = 0
  for (const type of [...bosses, ...rest]) {
    queue.push({ type, delay, spec: scaledEnemy(type, wave, effective) })
    delay += (SPAWN_GAP[type] ?? 0.8) * pace
  }

  const totalCount = queue.length
  const reward = Math.round(
    queue.reduce((sum, q) => sum + q.spec.reward, 0) * (modifier?.goldMult ?? 1),
  )

  return {
    wave, queue, composition, totalCount, modifier, reward,
    duration: delay,
    elite: elite > 1.05 ? elite : null,
  }
}

// Gold handed out for surviving the wave itself, on top of kill rewards.
export function clearBonus(wave) {
  return 25 + wave * 5
}

// Calling in the next wave early pays out in proportion to how much of the
// current one is still standing — the more danger you stack up, the better it
// pays.
export function earlyBonus(wave, remaining, total) {
  if (!total || remaining <= 0) return 0
  const frac = Math.min(1, remaining / total)
  return Math.max(5, Math.round(clearBonus(wave) * 0.85 * frac))
}

export function threatLevel(waveNum) {
  if (waveNum >= 25) return { label: 'Nightmare', color: '#e0308a' }
  if (waveNum >= 18) return { label: 'Extreme', color: '#c030c0' }
  if (waveNum >= 12) return { label: 'Severe', color: '#e04020' }
  if (waveNum >= 7) return { label: 'High', color: '#e08020' }
  if (waveNum >= 4) return { label: 'Medium', color: '#c0a020' }
  return { label: 'Low', color: '#4a8a3a' }
}
