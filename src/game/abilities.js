// ─── Active abilities ─────────────────────────────────────────────────────────
// Between waves you build; during a wave you used to just watch. These give the
// player something to do when a wave goes wrong.
//
// Cooldowns tick on simulation time, so they recover four times faster in real
// seconds at 4× speed — consistent with everything else in the game.

export const ABILITIES = [
  {
    id: 'meteor',
    name: 'Meteor',
    emoji: '☄️',
    hotkey: 'q',
    cooldown: 24,
    targeted: true,
    radius: 2.4,
    armorPen: 0.5,
    burn: { dps: 45, dur: 3 },
    desc: 'Call a meteor down on a tile. Heavy splash, sets the ground alight.',
    // Scales with the wave so it stays relevant deep into a run.
    damage: (wave) => 220 + wave * 55,
  },
  {
    id: 'freeze',
    name: 'Deep Freeze',
    emoji: '🧊',
    hotkey: 'w',
    cooldown: 34,
    targeted: false,
    duration: 2.5,
    desc: 'Freeze every enemy on the map solid. Chill-immune foes shrug it off.',
  },
  {
    id: 'rally',
    name: 'Rally',
    emoji: '📯',
    hotkey: 'r',
    cooldown: 42,
    targeted: false,
    duration: 8,
    mult: 1.5,
    desc: 'Every tower fires 50% faster for 8 seconds.',
  },
]

export const ABILITY_BY_ID = Object.fromEntries(ABILITIES.map((a) => [a.id, a]))

export function makeAbilityState() {
  return Object.fromEntries(ABILITIES.map((a) => [a.id, 0]))
}
