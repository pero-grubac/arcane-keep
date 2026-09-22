// ─── Enemy data ───────────────────────────────────────────────────────────────
// Positions and radii are in TILES. Speed is tiles/second. The old build stored
// pixels here, which desynced from the grid on every window resize.

export const ENEMY_DEFS = {
  grunt: {
    id: 'grunt', name: 'Wraith', emoji: '💀', color: '#9b5252',
    hp: 60, spd: 1.55, armor: 0, r: 0.28, reward: 8, liveDmg: 1,
    tags: [], blurb: 'Rank and file.',
  },
  swift: {
    id: 'swift', name: 'Viper', emoji: '🐍', color: '#5fa04a',
    hp: 34, spd: 2.9, armor: 0, r: 0.22, reward: 11, liveDmg: 1,
    tags: ['fast'], blurb: 'Outruns slow towers.',
  },
  swarm: {
    id: 'swarm', name: 'Imp', emoji: '👺', color: '#c07030',
    hp: 18, spd: 2.15, armor: 0, r: 0.16, reward: 4, liveDmg: 1,
    tags: ['fast'], blurb: 'Arrives in packs.',
  },
  brute: {
    id: 'brute', name: 'Sentinel', emoji: '🛡', color: '#4a7aa8',
    hp: 230, spd: 0.95, armor: 5, r: 0.38, reward: 24, liveDmg: 2,
    tags: ['armored'], blurb: 'Flat armour blunts small hits.',
  },
  wisp: {
    id: 'wisp', name: 'Wisp', emoji: '👻', color: '#7ac0c8',
    hp: 78, spd: 2.05, armor: 0, r: 0.24, reward: 16, liveDmg: 1,
    tags: ['unchillable'], blurb: 'Cannot be slowed or frozen.',
  },
  brood: {
    id: 'brood', name: 'Brood Mother', emoji: '🕷', color: '#8a5ac0',
    hp: 150, spd: 1.2, armor: 2, r: 0.34, reward: 20, liveDmg: 2,
    tags: ['splits'], blurb: 'Bursts into 3 Imps when killed.',
    splitInto: { type: 'swarm', count: 3 },
  },
  warden: {
    id: 'warden', name: 'Warded One', emoji: '🔰', color: '#3f9a7a',
    hp: 110, spd: 1.3, armor: 2, r: 0.32, reward: 22, liveDmg: 2,
    tags: ['shielded'], blurb: 'Shield regenerates if left alone.',
    shield: 90, shieldRegen: 22, shieldDelay: 2.5,
  },
  boss: {
    id: 'boss', name: 'Dread Lord', emoji: '👹', color: '#a04aa0',
    hp: 900, spd: 1.0, armor: 9, r: 0.46, reward: 70, liveDmg: 4,
    tags: ['boss', 'armored', 'warded'], blurb: 'Shields its escort every few seconds.',
    ability: { kind: 'shieldAllies', every: 6, radius: 3.2, amount: 0.3 },
  },
  overlord: {
    id: 'overlord', name: 'Void Overlord', emoji: '🐉', color: '#d03a70',
    hp: 2800, spd: 0.9, armor: 16, r: 0.54, reward: 180, liveDmg: 8,
    tags: ['boss', 'armored', 'unchillable', 'siphon'],
    blurb: 'Immune to chill. Heals itself and silences your towers.',
    ability: { kind: 'siphon', every: 7, healPct: 0.05, radius: 4.5, disableDur: 3 },
  },
}

export const TAG_META = {
  fast: { label: '⚡ Fast', cls: 'warnFast' },
  armored: { label: '🛡 Armoured', cls: 'warnArm' },
  boss: { label: '☠ BOSS', cls: 'warnBoss' },
  splits: { label: '🕷 Splits', cls: 'warnSplit' },
  shielded: { label: '🔰 Shielded', cls: 'warnShield' },
  unchillable: { label: '❄ Chill-immune', cls: 'warnImmune' },
  warded: { label: '🔆 Shields allies', cls: 'warnWard' },
  siphon: { label: '🌀 Silences towers', cls: 'warnSiphon' },
}

// ─── Wave scaling ─────────────────────────────────────────────────────────────
// Quadratic HP growth with a capped speed ramp, so late waves get genuinely
// dangerous without becoming unhittable.

export function waveScaling(wave) {
  const w = Math.max(0, wave - 1)
  return {
    hp: 1 + 0.16 * w + 0.012 * w * w,
    spd: 1 + Math.min(0.5, 0.013 * w),
    armor: Math.floor(wave / 4),
    reward: 1 + 0.03 * w,
  }
}

export function scaledEnemy(type, wave, modifier) {
  const def = ENEMY_DEFS[type]
  const s = waveScaling(wave)
  const mod = modifier?.enemy ?? {}
  return {
    type,
    hp: Math.round(def.hp * s.hp * (mod.hp ?? 1)),
    spd: def.spd * s.spd * (mod.spd ?? 1),
    armor: def.armor + (def.armor > 0 ? s.armor : Math.floor(s.armor / 2)),
    shield: def.shield ? Math.round(def.shield * s.hp) : 0,
    reward: Math.max(1, Math.round(def.reward * s.reward * (modifier?.reward ?? 1))),
  }
}

// Flat armour with a damage floor — armour blunts chip damage but never makes
// an enemy immune.
export function applyArmor(dmg, armor, armorPen = 0) {
  const effective = armor * (1 - armorPen)
  return Math.max(dmg * 0.12, dmg - effective)
}

let nextId = 1

export class Enemy {
  constructor(type, spec, path, wave) {
    this.id = nextId++
    this.type = type
    this.wave = wave
    const def = ENEMY_DEFS[type]
    this.def = def
    this.name = def.name
    this.emoji = def.emoji
    this.color = def.color
    this.r = def.r
    this.liveDmg = def.liveDmg
    this.tags = def.tags

    this.maxHp = spec.hp
    this.hp = spec.hp
    this.baseSpd = spec.spd
    this.armor = spec.armor
    this.reward = spec.reward
    this.maxShield = spec.shield ?? 0
    this.shield = this.maxShield
    this.shieldTimer = 0

    this.path = path
    this.segment = 0
    this.progress = 0 // tiles travelled along the path, used for targeting
    this.x = path[0][0] + 0.5
    this.y = path[0][1] + 0.5

    // Status effects. `slow` is a factor in (0,1]; 1 means unaffected.
    this.slowT = 0
    this.slowFactor = 1
    this.freezeT = 0
    this.stunT = 0
    this.markT = 0
    this.markMult = 1
    this.burns = []

    this.dead = false
    this.reached = false
    this.hitFlash = 0

    // Boss abilities fire on a timer; the first one lands a little early so a
    // boss does something before it has walked half the map.
    this.ability = def.ability ?? null
    this.abilityT = def.ability ? def.ability.every * 0.55 : 0
    this.castFlash = 0
  }

  // Grants a shield even to enemies that have none of their own.
  grantShield(amount) {
    this.maxShield = Math.max(this.maxShield, amount)
    this.shield = Math.min(this.maxShield, this.shield + amount)
    this.shieldTimer = 2.5
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount)
  }

  get chillImmune() {
    return this.tags.includes('unchillable')
  }

  get speed() {
    if (this.freezeT > 0 || this.stunT > 0) return 0
    return this.baseSpd * (this.slowT > 0 ? this.slowFactor : 1)
  }

  applySlow(factor, dur) {
    if (this.chillImmune) return false
    // Stronger chills override weaker ones; equal ones refresh the timer.
    if (factor <= this.slowFactor || this.slowT <= 0) this.slowFactor = factor
    this.slowT = Math.max(this.slowT, dur)
    return true
  }

  applyFreeze(dur) {
    if (this.chillImmune) return false
    this.freezeT = Math.max(this.freezeT, dur)
    return true
  }

  applyStun(dur) {
    this.stunT = Math.max(this.stunT, dur)
  }

  applyMark(mult, dur) {
    this.markMult = Math.max(this.markMult, mult)
    this.markT = Math.max(this.markT, dur)
  }

  addBurn(dps, dur) {
    this.burns.push({ dps, t: dur })
  }

  // Returns damage actually dealt, after shield, armour and marks.
  takeDamage(rawDmg, { armorPen = 0, ignoreShield = false } = {}) {
    if (this.dead) return 0
    let dmg = applyArmor(rawDmg, this.armor, armorPen)
    if (this.markT > 0) dmg *= this.markMult

    if (!ignoreShield && this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg)
      this.shield -= absorbed
      dmg -= absorbed
      this.shieldTimer = this.def.shieldDelay ?? 2.5
    }
    this.hp -= dmg
    this.hitFlash = 0.12
    if (this.hp <= 0) {
      this.hp = 0
      this.dead = true
    }
    return dmg
  }

  updateStatus(dt) {
    if (this.slowT > 0) {
      this.slowT -= dt
      if (this.slowT <= 0) this.slowFactor = 1
    }
    if (this.freezeT > 0) this.freezeT -= dt
    if (this.stunT > 0) this.stunT -= dt
    if (this.markT > 0) {
      this.markT -= dt
      if (this.markT <= 0) this.markMult = 1
    }
    if (this.hitFlash > 0) this.hitFlash -= dt
    if (this.castFlash > 0) this.castFlash -= dt

    for (const b of this.burns) {
      b.t -= dt
      // Burn bypasses armour — it is the counter to heavy armour.
      this.takeDamage(b.dps * dt, { armorPen: 1, ignoreShield: true })
    }
    if (this.burns.length) this.burns = this.burns.filter((b) => b.t > 0)

    if (this.maxShield > 0 && this.shield < this.maxShield && !this.dead) {
      if (this.shieldTimer > 0) this.shieldTimer -= dt
      else this.shield = Math.min(this.maxShield, this.shield + this.def.shieldRegen * dt)
    }
  }

  move(dt) {
    if (this.dead || this.reached) return
    let dist = this.speed * dt
    while (dist > 0 && this.segment < this.path.length - 1) {
      const tx = this.path[this.segment + 1][0] + 0.5
      const ty = this.path[this.segment + 1][1] + 0.5
      const dx = tx - this.x
      const dy = ty - this.y
      const d = Math.hypot(dx, dy)
      if (d <= dist || d < 1e-6) {
        this.x = tx
        this.y = ty
        this.progress += d
        dist -= d
        this.segment++
      } else {
        this.x += (dx / d) * dist
        this.y += (dy / d) * dist
        this.progress += dist
        dist = 0
      }
    }
    if (this.segment >= this.path.length - 1) this.reached = true
  }
}
