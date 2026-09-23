import {
  buildCheck, createTower, startWave, evolveTower, castAbility,
  earnGold, spendGold,
} from './engine.js'
import {
  TOWER_ORDER, TARGETING_MODES, getTowerCost, upgradeCost,
  MAX_UPGRADE, EVOLVE_REQUIREMENT, EVOLVE_COST, SELL_RATIO,
} from './towers.js'
import { ABILITIES } from './abilities.js'

// ─── Player actions ───────────────────────────────────────────────────────────
// Everything a player can do that changes the fight goes through dispatch().
// It applies the action and appends it to state.log against the current
// substep, which is all a replay needs: the same map, the same seed and the same
// actions at the same steps reproduce the whole run.
//
// Towers are addressed by tile, never by id. A tile holds at most one tower,
// and ids come from a module counter that a replay would not reproduce.
//
// Log entries are compact arrays, since they end up inside share links:
//   [step, code, ...args]

const STATS = ['dmg', 'spd', 'rng']
const MODES = TARGETING_MODES.map((m) => m.id)
const ABILITY_IDS = ABILITIES.map((a) => a.id)

const fail = (reason) => ({ ok: false, reason })
const towerAt = (state, col, row) => state.towers.find((t) => t.col === col && t.row === row)

const HANDLERS = {
  // Place a tower.
  p(state, col, row, typeIdx) {
    const type = TOWER_ORDER[typeIdx]
    if (!type) return fail('Unknown tower')
    const check = buildCheck(state, col, row)
    if (!check.ok) return fail(check.reason)
    // Rubble has to be cleared before anything can stand on it.
    const cost = getTowerCost(type, state.towerCounts) + check.extraCost
    if (state.gold < cost) {
      return fail(check.extraCost
        ? `Not enough gold — ${cost}g with rubble clearing`
        : `Not enough gold — need ${cost}g`)
    }
    spendGold(state, cost)
    state.towerCounts[type]++
    const tower = createTower(col, row, type, cost, check.terrain)
    state.towers.push(tower)
    return { ok: true, tower }
  },

  // Upgrade one stat.
  u(state, col, row, statIdx) {
    const t = towerAt(state, col, row)
    const stat = STATS[statIdx]
    if (!t || !stat) return fail('No tower there')
    const lvl = t.upgrades[stat]
    if (lvl >= MAX_UPGRADE) return fail('Already at max level')
    const cost = upgradeCost(lvl)
    if (state.gold < cost) return fail(`Not enough gold — need ${cost}g`)
    spendGold(state, cost)
    t.invested += cost
    t.upgrades[stat]++
    return { ok: true, tower: t }
  },

  // Evolve down one branch.
  e(state, col, row, statIdx) {
    const t = towerAt(state, col, row)
    const stat = STATS[statIdx]
    if (!t || !stat) return fail('No tower there')
    if (t.evolved) return fail('Already evolved')
    const total = t.upgrades.dmg + t.upgrades.spd + t.upgrades.rng
    if (total < EVOLVE_REQUIREMENT) {
      return fail(`Needs ${EVOLVE_REQUIREMENT} upgrade levels to evolve (${total}/${EVOLVE_REQUIREMENT})`)
    }
    if (state.gold < EVOLVE_COST) return fail(`Not enough gold — evolving costs ${EVOLVE_COST}g`)
    spendGold(state, EVOLVE_COST)
    t.invested += EVOLVE_COST
    evolveTower(t, stat)
    return { ok: true, tower: t }
  },

  // Sell. The refund is based on what was actually spent on this tower, not on
  // what the next one of its type would cost.
  s(state, col, row) {
    const t = towerAt(state, col, row)
    if (!t) return fail('No tower there')
    const refund = Math.floor(t.invested * SELL_RATIO)
    earnGold(state, refund, 'refunded')
    state.towerCounts[t.baseType] = Math.max(0, state.towerCounts[t.baseType] - 1)
    state.towers = state.towers.filter((x) => x !== t)
    state.projectiles = state.projectiles.filter((p) => p.towerId !== t.id)
    return { ok: true, tower: t, refund }
  },

  // Target priority.
  t(state, col, row, modeIdx) {
    const t = towerAt(state, col, row)
    const mode = MODES[modeIdx]
    if (!t || !mode) return fail('No tower there')
    t.targeting = mode
    return { ok: true, tower: t }
  },

  // Send the next wave, early or not.
  w(state) {
    const early = state.waveActive
    const { data, bonus } = startWave(state)
    earnGold(state, bonus)
    return { ok: true, data, bonus, early }
  },

  // Cast an ability; targeted ones carry their tile.
  c(state, abilityIdx, col, row) {
    const id = ABILITY_IDS[abilityIdx]
    if (!id) return fail('Unknown ability')
    const tile = col === undefined ? undefined : { col, row }
    return castAbility(state, id, tile) ? { ok: true, id } : fail('Not ready')
  },
}

// Applies an action. Successful actions are logged; failed ones change nothing
// and are not, so the log only ever holds what actually happened.
export function dispatch(state, action) {
  if (state.phase !== 'playing') return fail('The run is over')
  const [code, ...args] = action
  const handler = HANDLERS[code]
  if (!handler) return fail('Unknown action')
  const result = handler(state, ...args)
  if (result.ok && state.log) state.log.push([state.steps, code, ...args])
  return result
}

// Friendly constructors, so callers never spell out the compact codes.
export const act = {
  place: (col, row, type) => ['p', col, row, TOWER_ORDER.indexOf(type)],
  upgrade: (tower, stat) => ['u', tower.col, tower.row, STATS.indexOf(stat)],
  evolve: (tower, stat) => ['e', tower.col, tower.row, STATS.indexOf(stat)],
  sell: (tower) => ['s', tower.col, tower.row],
  target: (tower, mode) => ['t', tower.col, tower.row, MODES.indexOf(mode)],
  sendWave: () => ['w'],
  cast: (id, tile) => (tile
    ? ['c', ABILITY_IDS.indexOf(id), tile.col, tile.row]
    : ['c', ABILITY_IDS.indexOf(id)]),
}
