import { TOWER_DEFS, EVOLUTIONS } from './towers.js'

// The end-of-run breakdown. Everything here is derived from state the engine
// already tracks (per-tower damage and kills, the gold ledger, lives per wave),
// so the report costs nothing while the run is being played.

export function buildReport(state) {
  const towers = state.towers
    .filter((t) => t.damageDealt > 0 || t.killCount > 0)
    .map((t) => {
      const evo = t.evolved ? EVOLUTIONS[t.baseType][t.evolveStat] : null
      const def = TOWER_DEFS[t.baseType]
      return {
        id: t.id,
        name: evo ? evo.name : def.name,
        emoji: evo ? evo.emoji : def.emoji,
        damage: Math.round(t.damageDealt),
        kills: t.killCount,
      }
    })
    .sort((a, b) => b.damage - a.damage)

  // The wave that cost the most lives is the one worth learning from.
  let worst = null
  for (const [wave, lost] of Object.entries(state.stats.leaks)) {
    if (!worst || lost > worst.lost) worst = { wave: Number(wave), lost }
  }

  // Early-sent waves merge, so a cleared entry can skip wave numbers — each
  // point carries its own label rather than assuming one point per wave.
  const lives = [
    { v: 20, label: 'Start' },
    ...state.stats.waves.map((w) => ({ v: w.lives, label: `After wave ${w.wave}` })),
    { v: state.lives, label: `End (wave ${state.wave})` },
  ]
  return {
    towers,
    earned: Math.round(state.stats.earned),
    spent: Math.round(state.stats.spent),
    refunded: Math.round(state.stats.refunded),
    worst,
    lives,
  }
}
