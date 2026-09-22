// ─── Tower data ───────────────────────────────────────────────────────────────
// All distances are in TILES, all rates per-second. Nothing here knows about
// pixels — the renderer is the only place tiles become screen space.

export const MAX_UPGRADE = 6
export const EVOLVE_REQUIREMENT = 4 // total upgrade levels before evolving
export const EVOLVE_COST = 120
export const SELL_RATIO = 0.65

export function upgradeCost(level) {
  return 20 + level * 12
}

export const TOWER_DEFS = {
  archer: {
    id: 'archer',
    name: 'Archer', emoji: '🏹', color: '#4a9bd4',
    baseCost: 50, costStep: 20,
    dmg: 14, fireRate: 1.5, range: 3.6, splash: 0, projSpeed: 13,
    desc: 'Single target · fast',
    art: { shape: 'turret', accent: '#9fd4f5' },
    upg: { dmg: 5.5, spd: 0.16, rng: 0.42 },
  },
  mage: {
    id: 'mage',
    name: 'Mage', emoji: '🔮', color: '#9b5ad4',
    baseCost: 85, costStep: 28,
    dmg: 30, fireRate: 0.8, range: 3.2, splash: 1.1, projSpeed: 8,
    desc: 'Arcane splash damage',
    art: { shape: 'orb', accent: '#dcb0ff' },
    upg: { dmg: 10, spd: 0.1, rng: 0.38 },
  },
  frost: {
    id: 'frost',
    name: 'Frost', emoji: '❄️', color: '#43a8c8',
    baseCost: 70, costStep: 24,
    dmg: 9, fireRate: 1.1, range: 3.2, splash: 0, projSpeed: 10,
    desc: 'Chills · slows enemies',
    slow: { factor: 0.55, dur: 1.6 },
    art: { shape: 'crystal', accent: '#b6ecff' },
    upg: { dmg: 3.5, spd: 0.14, rng: 0.42 },
  },
  obelisk: {
    id: 'obelisk',
    name: 'Obelisk', emoji: '🗿', color: '#3fa88a',
    baseCost: 95, costStep: 30,
    dmg: 0, fireRate: 0, range: 2.6, splash: 0, projSpeed: 0,
    desc: 'Support · buffs nearby towers',
    // A support tower never fires. `support` is the multiplier it grants to
    // every non-support tower inside `radius`.
    support: { dmg: 1, fireRate: 1.15, range: 1, radius: 2.6 },
    art: { shape: 'obelisk', accent: '#9ff0d8' },
    upg: { dmg: 0.025, spd: 0.03, rng: 0.35 },
  },
  cannon: {
    id: 'cannon',
    name: 'Cannon', emoji: '💣', color: '#b08a3a',
    baseCost: 110, costStep: 34,
    dmg: 52, fireRate: 0.45, range: 3.0, splash: 1.5, projSpeed: 7,
    desc: 'Heavy AOE · slow reload',
    art: { shape: 'mortar', accent: '#f0cd7a' },
    upg: { dmg: 18, spd: 0.055, rng: 0.34 },
  },
}

export const TOWER_ORDER = ['archer', 'mage', 'frost', 'cannon', 'obelisk']

// ─── Evolutions ───────────────────────────────────────────────────────────────
// Each evolution is a real mechanical change, not a recolour. `mult` scales the
// upgraded stats, `traits` switch on behaviour in the engine, `art` changes how
// the renderer draws the tower.

export const EVOLUTIONS = {
  archer: {
    dmg: {
      key: 'deadeye', name: 'Deadeye', emoji: '🎯', label: 'Damage', color: '#e8452c',
      desc: 'Crits for 2.6× and ignores all armour',
      mult: { dmg: 1.9, fireRate: 0.9, range: 1.15, projSpeed: 1.6 },
      traits: { crit: { chance: 0.32, mult: 2.6 }, armorPen: 1 },
      art: { shape: 'turret', accent: '#ff9a7a', orbiters: 2, glow: 0.7, barrel: 'long' },
    },
    spd: {
      key: 'ranger', name: 'Ranger', emoji: '🦅', label: 'Speed', color: '#2fb765',
      desc: 'Fires on 3 separate targets each volley',
      mult: { dmg: 0.78, fireRate: 2.0, range: 1.05, projSpeed: 1.35 },
      traits: { multishot: 3 },
      art: { shape: 'turret', accent: '#9bf0bd', orbiters: 3, glow: 0.5, barrel: 'triple' },
    },
    rng: {
      key: 'warden', name: 'Warden', emoji: '🌿', label: 'Range', color: '#4a90e2',
      desc: 'Enormous reach · arrows pierce 3 enemies',
      mult: { dmg: 1.25, fireRate: 0.85, range: 2.1, projSpeed: 1.5 },
      traits: { pierce: 3 },
      art: { shape: 'turret', accent: '#a8cff5', orbiters: 1, glow: 0.9, barrel: 'long' },
    },
  },
  mage: {
    dmg: {
      key: 'destroyer', name: 'Destroyer', emoji: '💥', label: 'Damage', color: '#e03a1c',
      desc: 'Huge blast · arcs to 3 nearby foes',
      mult: { dmg: 2.0, fireRate: 0.85, range: 1.1, splash: 1.6 },
      traits: { chain: { jumps: 3, falloff: 0.6, range: 2.4 } },
      art: { shape: 'orb', accent: '#ff9060', orbiters: 3, glow: 1, spin: 2.4 },
    },
    spd: {
      key: 'archmage', name: 'Archmage', emoji: '🌟', label: 'Speed', color: '#c25ce8',
      desc: 'Relentless bolts · marked foes take +25%',
      mult: { dmg: 0.85, fireRate: 2.4, range: 1.05, splash: 0.7, projSpeed: 1.6 },
      traits: { mark: { mult: 1.25, dur: 2.5 } },
      art: { shape: 'orb', accent: '#f0c0ff', orbiters: 4, glow: 0.8, spin: 5 },
    },
    rng: {
      key: 'seer', name: 'Seer', emoji: '🔭', label: 'Range', color: '#38b0e0',
      desc: 'Sees the whole map · marks for +40%',
      mult: { dmg: 1.3, fireRate: 0.9, range: 2.6, splash: 1.2 },
      traits: { mark: { mult: 1.4, dur: 3 } },
      art: { shape: 'orb', accent: '#a8e8ff', orbiters: 2, glow: 1.2, spin: 1.2 },
    },
  },
  frost: {
    dmg: {
      key: 'rime', name: 'Rime', emoji: '🧊', label: 'Damage', color: '#7fc8ff',
      desc: 'Shatters chilled foes for 2.2× · freezes',
      mult: { dmg: 2.6, fireRate: 1.0, range: 1.1 },
      traits: {
        shatter: 2.2,
        freeze: { chance: 0.18, dur: 0.9 },
        slow: { factor: 0.55, dur: 1.6 },
      },
      art: { shape: 'crystal', accent: '#e0f4ff', orbiters: 3, glow: 0.9, spin: 1.6 },
    },
    spd: {
      key: 'blizzard', name: 'Blizzard', emoji: '🌪️', label: 'Speed', color: '#2ec0d8',
      desc: 'Permanent storm — no shots, hits all in range',
      mult: { dmg: 0.55, fireRate: 3.2, range: 0.9 },
      traits: { aura: true, slow: { factor: 0.62, dur: 0.9 } },
      art: { shape: 'crystal', accent: '#b0f0ff', orbiters: 4, glow: 1.1, spin: 4 },
    },
    rng: {
      key: 'glacier', name: 'Glacier', emoji: '🏔', label: 'Range', color: '#5878c0',
      desc: 'Vast cold field · slows to a crawl',
      mult: { dmg: 1.4, fireRate: 0.85, range: 2.2 },
      traits: { slow: { factor: 0.3, dur: 2.6 }, slowSplash: 1.6 },
      art: { shape: 'crystal', accent: '#a0b8f0', orbiters: 2, glow: 1.3, spin: 0.8 },
    },
  },
  cannon: {
    dmg: {
      key: 'siege', name: 'Siege', emoji: '🔥', label: 'Damage', color: '#e85a10',
      desc: 'Devastating shells leave burning ground',
      mult: { dmg: 2.0, fireRate: 0.85, range: 1.1, splash: 1.35 },
      traits: { groundFire: { dps: 22, dur: 3.5, radius: 1.5 } },
      art: { shape: 'mortar', accent: '#ffb060', orbiters: 2, glow: 1, barrel: 'wide' },
    },
    spd: {
      key: 'gatling', name: 'Gatling', emoji: '⚙️', label: 'Speed', color: '#d0a020',
      desc: 'Spins up to a relentless barrage',
      mult: { dmg: 0.55, fireRate: 3.6, range: 1.0, splash: 0.55, projSpeed: 1.8 },
      traits: { spinup: { max: 1.8, rate: 0.55 } },
      art: { shape: 'mortar', accent: '#ffe08a', orbiters: 3, glow: 0.6, barrel: 'triple', spin: 6 },
    },
    rng: {
      key: 'mortar', name: 'Mortar', emoji: '💫', label: 'Range', color: '#8a62d0',
      desc: 'Lobbed shells rain from across the map',
      mult: { dmg: 1.5, fireRate: 0.8, range: 2.4, splash: 1.5, projSpeed: 0.85 },
      traits: { arc: true, stun: { chance: 0.15, dur: 0.6 } },
      art: { shape: 'mortar', accent: '#c0a0ff', orbiters: 2, glow: 1.1, barrel: 'wide' },
    },
  },
  obelisk: {
    dmg: {
      key: 'warstone', name: 'Warstone', emoji: '🔺', label: 'Damage', color: '#d05a3a',
      desc: 'Nearby towers hit 30% harder',
      mult: { range: 1.05 },
      traits: {},
      support: { dmg: 1.3, fireRate: 1.05, range: 1, radius: 2.8 },
      art: { shape: 'obelisk', accent: '#ffb090', orbiters: 3, glow: 0.9, spin: 1.1 },
    },
    spd: {
      key: 'metronome', name: 'Metronome', emoji: '⏱', label: 'Speed', color: '#d0b028',
      desc: 'Nearby towers fire 45% faster',
      mult: { range: 1.05 },
      traits: {},
      support: { dmg: 1, fireRate: 1.45, range: 1, radius: 2.8 },
      art: { shape: 'obelisk', accent: '#ffe89a', orbiters: 4, glow: 0.8, spin: 4.5 },
    },
    rng: {
      key: 'farseer', name: 'Farseer', emoji: '🗼', label: 'Range', color: '#4a8ad0',
      desc: 'Nearby towers reach 28% further, over a wide field',
      mult: { range: 1.6 },
      traits: {},
      support: { dmg: 1.05, fireRate: 1.05, range: 1.28, radius: 4.2 },
      art: { shape: 'obelisk', accent: '#a8d0ff', orbiters: 2, glow: 1.2, spin: 0.7 },
    },
  },
}

// Flat lookup: 'deadeye' → evolution def, used by projectiles and the renderer.
export const EVOLUTION_BY_KEY = {}
for (const base of Object.keys(EVOLUTIONS)) {
  for (const stat of Object.keys(EVOLUTIONS[base])) {
    EVOLUTION_BY_KEY[EVOLUTIONS[base][stat].key] = { ...EVOLUTIONS[base][stat], base, stat }
  }
}

// Per-tower target priority. Cycled with Tab, or from the tower panel.
export const TARGETING_MODES = [
  { id: 'first', label: 'First', hint: 'Furthest along the path' },
  { id: 'last', label: 'Last', hint: 'Newest arrival, nearest the spawn' },
  { id: 'strong', label: 'Strongest', hint: 'Most remaining health' },
  { id: 'close', label: 'Closest', hint: 'Nearest to this tower' },
]
export const DEFAULT_TARGETING = 'first'

export function nextTargeting(mode) {
  const i = TARGETING_MODES.findIndex((m) => m.id === mode)
  return TARGETING_MODES[(i + 1) % TARGETING_MODES.length].id
}

export function targetingLabel(mode) {
  return TARGETING_MODES.find((m) => m.id === mode)?.label ?? 'First'
}

export const STAT_META = {
  dmg: { label: 'Damage', short: '⚔ Damage' },
  spd: { label: 'Speed', short: '⚡ Speed' },
  rng: { label: 'Range', short: '◎ Range' },
}

export const PROJ_COLORS = {
  archer: '#e0c070', mage: '#c080f0', frost: '#80d8f8', cannon: '#f0b840',
  obelisk: '#7fe0c0',
}
for (const key of Object.keys(EVOLUTION_BY_KEY)) {
  const ev = EVOLUTION_BY_KEY[key]
  PROJ_COLORS[key] = ev.art.accent || ev.color
}

// ─── Derived values ───────────────────────────────────────────────────────────

export function getEvolution(tower) {
  if (!tower.evolved || !tower.evolveStat) return null
  return EVOLUTIONS[tower.baseType][tower.evolveStat]
}

export function towerColor(tower) {
  return getEvolution(tower)?.color ?? TOWER_DEFS[tower.baseType].color
}

export function towerArt(tower) {
  const ev = getEvolution(tower)
  return { ...TOWER_DEFS[tower.baseType].art, ...(ev ? ev.art : {}) }
}

export function getTowerCost(type, counts) {
  const d = TOWER_DEFS[type]
  return d.baseCost + (counts[type] || 0) * d.costStep
}

// The single source of truth for what a tower actually does right now.
// What a support tower projects onto its neighbours.
export function supportAura(tower) {
  const d = TOWER_DEFS[tower.baseType]
  const ev = getEvolution(tower)
  const base = ev?.support ?? d.support
  if (!base) return null
  const u = tower.upgrades
  return {
    radius: base.radius + u.rng * d.upg.rng,
    dmg: base.dmg + u.dmg * d.upg.dmg,
    fireRate: base.fireRate + u.spd * d.upg.spd,
    range: base.range,
  }
}

export function isSupport(tower) {
  return Boolean(TOWER_DEFS[tower.baseType].support)
}

export function calcStats(tower) {
  const d = TOWER_DEFS[tower.baseType]
  const u = tower.upgrades
  const ev = getEvolution(tower)
  const m = ev ? ev.mult : {}
  // Buffs projected by nearby Obelisks, recomputed once per frame by the engine.
  const aura = tower.auraBuff
  // High ground is worth a little extra reach.
  const terrainRange = tower.terrain === 'high' ? 1.15 : 1

  const stats = {
    dmg: (d.dmg + u.dmg * d.upg.dmg) * (m.dmg ?? 1) * (aura?.dmg ?? 1),
    fireRate: (d.fireRate + u.spd * d.upg.spd) * (m.fireRate ?? 1) * (aura?.fireRate ?? 1),
    range: (d.range + u.rng * d.upg.rng) * (m.range ?? 1) * (aura?.range ?? 1) * terrainRange,
    splash: d.splash * (m.splash ?? 1),
    projSpeed: d.projSpeed * (m.projSpeed ?? 1),
    traits: { ...(d.slow ? { slow: d.slow } : {}), ...(ev ? ev.traits : {}) },
    projKey: ev ? ev.key : tower.baseType,
    color: ev ? ev.color : d.color,
    support: d.support ? supportAura(tower) : null,
    buffed: Boolean(aura && (aura.dmg > 1 || aura.fireRate > 1 || aura.range > 1)),
  }

  // Gatling's spin-up is a live multiplier, not a static stat.
  if (stats.traits.spinup) {
    stats.fireRate *= 1 + (tower.spin ?? 0) * (stats.traits.spinup.max - 1)
  }
  // Rally is a temporary global buff from the player's ability bar.
  if (tower.rallyMult) stats.fireRate *= tower.rallyMult
  return stats
}

export function dpsOf(stats) {
  if (stats.support) return 0
  let dps = stats.dmg * stats.fireRate
  const t = stats.traits
  if (t.crit) dps *= 1 + t.crit.chance * (t.crit.mult - 1)
  if (t.multishot) dps *= t.multishot
  return dps
}

// Which evolution the current upgrade spread points at. A genuine tie picks
// nothing, so the hint never claims a path the player has not committed to.
export function getDominant(upgrades) {
  const entries = [
    ['dmg', upgrades.dmg],
    ['spd', upgrades.spd],
    ['rng', upgrades.rng],
  ].sort((a, b) => b[1] - a[1])
  if (entries[0][1] === 0) return null
  if (entries[0][1] === entries[1][1]) return null
  return entries[0][0]
}
