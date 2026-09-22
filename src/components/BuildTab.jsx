import {
  TOWER_DEFS, TOWER_ORDER, EVOLUTIONS, STAT_META, calcStats, dpsOf,
  getTowerCost, upgradeCost, getDominant, TARGETING_MODES,
  MAX_UPGRADE, EVOLVE_REQUIREMENT, EVOLVE_COST, SELL_RATIO,
} from '../game/towers.js'
import styles from './BuildTab.module.css'

export default function BuildTab({ ui, onSelectBuild, onUpgrade, onEvolve, onSell, onSetTargeting }) {
  const { gold, towerCounts, selectedBuild, selectedTower } = ui
  const buffedCount = ui.towers.filter((t) => t.buffed).length

  return (
    <div className={styles.buildTab}>
      <div className={styles.towerRow}>
        {TOWER_ORDER.map((type, i) => {
          const def = TOWER_DEFS[type]
          const cost = getTowerCost(type, towerCounts)
          const affordable = gold >= cost
          return (
            <button
              key={type}
              className={`${styles.tc} ${type === selectedBuild ? styles.selected : ''} ${!affordable ? styles.cantAfford : ''}`}
              style={{ '--tc': def.color }}
              onClick={() => onSelectBuild(type)}
              title={`${def.name} — ${def.desc}`}
            >
              <span className={styles.hotkey}>{i + 1}</span>
              <span className={styles.tcEmoji}>{def.emoji}</span>
              <span className={styles.tcLabel}>
                <span className={styles.tcName}>{def.name}</span>
                <span className={styles.tcDesc}>{def.desc}</span>
              </span>
              <span className={styles.tcCost}>{cost}g</span>
            </button>
          )
        })}
      </div>

      {selectedTower
        ? (
          <UpgradePanel
            tower={selectedTower}
            gold={gold}
            onUpgrade={onUpgrade}
            onEvolve={onEvolve}
            onSell={onSell}
            onSetTargeting={onSetTargeting}
            buffedCount={buffedCount}
          />
        )
        : <Placeholder selectedBuild={selectedBuild} />}
    </div>
  )
}

function Placeholder({ selectedBuild }) {
  const def = selectedBuild ? TOWER_DEFS[selectedBuild] : null
  return (
    <div className={styles.placeholder}>
      {def ? (
        <>
          <b style={{ color: def.color }}>{def.emoji} {def.name}</b> selected —
          click a buildable tile to place it. Click a placed tower to upgrade it.
        </>
      ) : (
        <>Pick a tower above (or press <b>1</b>–<b>5</b>), then click a tile. Click a placed tower to upgrade or evolve it.</>
      )}
    </div>
  )
}

function UpgradePanel({ tower, gold, onUpgrade, onEvolve, onSell, onSetTargeting, buffedCount = 0 }) {
  const def = TOWER_DEFS[tower.baseType]
  const ev = tower.evolved ? EVOLUTIONS[tower.baseType][tower.evolveStat] : null
  const stats = calcStats(tower)
  const total = tower.upgrades.dmg + tower.upgrades.spd + tower.upgrades.rng
  const color = ev ? ev.color : def.color

  const canEvolve = !tower.evolved && total >= EVOLVE_REQUIREMENT && gold >= EVOLVE_COST
  const suggested = getDominant(tower.upgrades)
  const refund = Math.floor((tower.invested ?? 0) * SELL_RATIO)

  let hint
  if (tower.evolved) hint = ev.desc
  else if (total < EVOLVE_REQUIREMENT) {
    hint = `${total}/${EVOLVE_REQUIREMENT} upgrades toward evolution`
  } else if (suggested) {
    hint = `Ready → suggests ${EVOLUTIONS[tower.baseType][suggested].name}`
  } else {
    hint = 'Ready to evolve — pick any path'
  }

  return (
    <div className={styles.upgradePanel} style={{ '--tc': color }}>
      <div className={styles.upgHeader}>
        <span className={styles.upgName} style={{ color }}>
          {ev ? `${ev.emoji} ${ev.name}` : `${def.emoji} ${def.name}`}
          {ev && <span className={styles.evolveBadge}>{ev.label} path</span>}
        </span>
        <span className={styles.pathHint}>{hint}</span>
      </div>

      <div className={styles.upgBody}>
        <div className={styles.statCols}>
          {['dmg', 'spd', 'rng'].map((key) => {
            const lvl = tower.upgrades[key]
            const cost = upgradeCost(lvl)
            const maxed = lvl >= MAX_UPGRADE
            return (
              <StatRow
                key={key}
                label={STAT_META[key].short}
                level={lvl}
                color={color}
                cost={cost}
                maxed={maxed}
                canBuy={!maxed && gold >= cost}
                onUpgrade={() => onUpgrade(key)}
              />
            )
          })}

          <div className={styles.actions}>
            <button
              className={styles.evolveBtn}
              onClick={onEvolve}
              disabled={tower.evolved || total < EVOLVE_REQUIREMENT}
              title={tower.evolved ? 'Already evolved' : `Evolve for ${EVOLVE_COST}g`}
              style={canEvolve ? { borderColor: '#d4a853', color: '#d4a853' } : undefined}
            >
              {tower.evolved
                ? '✦ Evolved'
                : `✦ Evolve (${total}/${EVOLVE_REQUIREMENT}) — ${EVOLVE_COST}g`}
            </button>
            <button className={styles.sellBtn} onClick={onSell}>
              Sell +{refund}g
            </button>
          </div>

          {!stats.support && (
          <div className={styles.targetRow} title="Who this tower shoots first (Tab)">
            <span className={styles.targetLabel}>Target</span>
            {TARGETING_MODES.map((m) => (
              <button
                key={m.id}
                className={`${styles.targetBtn} ${tower.targeting === m.id ? styles.targetOn : ''}`}
                onClick={() => onSetTargeting(m.id)}
                title={m.hint}
              >
                {m.label}
              </button>
            ))}
          </div>
          )}
        </div>

        <div className={styles.liveStats}>
          <div className={styles.liveTitle}>
            {stats.support ? 'Projects' : 'Current stats'}
          </div>
          {stats.support ? (
            <>
              <LiveRow label="Radius" value={`${stats.support.radius.toFixed(1)}t`} strong />
              {stats.support.dmg > 1 && (
                <LiveRow label="Damage" value={`+${Math.round((stats.support.dmg - 1) * 100)}%`} />
              )}
              {stats.support.fireRate > 1 && (
                <LiveRow label="Fire rate" value={`+${Math.round((stats.support.fireRate - 1) * 100)}%`} />
              )}
              {stats.support.range > 1 && (
                <LiveRow label="Range" value={`+${Math.round((stats.support.range - 1) * 100)}%`} />
              )}
              <LiveRow label="Buffing" value={`${buffedCount} towers`} />
            </>
          ) : (
            <>
              <LiveRow label="DPS" value={dpsOf(stats).toFixed(1)} strong />
              <LiveRow label="Damage" value={Math.round(stats.dmg)} />
              <LiveRow label="Fire rate" value={`${stats.fireRate.toFixed(2)}/s`} />
              <LiveRow label="Range" value={`${stats.range.toFixed(1)}t`} />
              {stats.splash > 0 && <LiveRow label="Splash" value={`${stats.splash.toFixed(1)}t`} />}
              <LiveRow label="Kills" value={tower.killCount ?? 0} />
              <LiveRow label="Damage done" value={Math.round(tower.damageDealt ?? 0)} />
            </>
          )}
        </div>

        <div className={styles.traits}>
          <div className={styles.liveTitle}>Abilities</div>
          {stats.support
            ? <div className={styles.traitNone}>Buffs every non-support tower inside its radius. Obelisks do not buff each other.</div>
            : <TraitList traits={stats.traits} />}
        </div>
      </div>
    </div>
  )
}

// Turns the raw trait object into something a player can read.
function TraitList({ traits }) {
  const items = []
  if (traits.crit) items.push(`${Math.round(traits.crit.chance * 100)}% crit for ${traits.crit.mult}×`)
  if (traits.armorPen) items.push(`Ignores ${Math.round(traits.armorPen * 100)}% armour`)
  if (traits.multishot) items.push(`Fires at ${traits.multishot} targets`)
  if (traits.pierce) items.push(`Pierces ${traits.pierce} enemies`)
  if (traits.chain) items.push(`Chains to ${traits.chain.jumps} foes`)
  if (traits.slow) items.push(`Slows to ${Math.round(traits.slow.factor * 100)}% for ${traits.slow.dur}s`)
  if (traits.slowSplash) items.push(`Chills ${traits.slowSplash}t around impact`)
  if (traits.freeze) items.push(`${Math.round(traits.freeze.chance * 100)}% freeze`)
  if (traits.stun) items.push(`${Math.round(traits.stun.chance * 100)}% stun`)
  if (traits.shatter) items.push(`${traits.shatter}× vs chilled`)
  if (traits.mark) items.push(`Marks: +${Math.round((traits.mark.mult - 1) * 100)}% damage taken`)
  if (traits.aura) items.push('Continuous aura — no projectiles')
  if (traits.groundFire) items.push(`Burning ground: ${traits.groundFire.dps}/s`)
  if (traits.spinup) items.push(`Spins up to ${traits.spinup.max}× fire rate`)
  if (traits.arc) items.push('Lobbed arcing shells')

  if (items.length === 0) return <div className={styles.traitNone}>No special abilities yet — evolve to gain one.</div>
  return (
    <ul className={styles.traitList}>
      {items.map((t) => <li key={t}>{t}</li>)}
    </ul>
  )
}

function StatRow({ label, level, color, cost, maxed, canBuy, onUpgrade }) {
  return (
    <div className={styles.statRow}>
      <div className={styles.statLabel}>
        <span>{label}</span>
        <span>Lv{level}</span>
      </div>
      <div className={styles.pipBar}>
        {Array.from({ length: MAX_UPGRADE }, (_, i) => (
          <div
            key={i}
            className={styles.pip}
            style={{ background: i < level ? color : '#1a1a24' }}
          />
        ))}
      </div>
      <button className={styles.upgBtn} disabled={!canBuy} onClick={onUpgrade}>
        {maxed ? 'MAX' : `▲ ${cost}g`}
      </button>
    </div>
  )
}

function LiveRow({ label, value, strong }) {
  return (
    <div className={styles.liveRow}>
      <span className={styles.liveLabel}>{label}</span>
      <span className={strong ? styles.liveValStrong : styles.liveVal}>{value}</span>
    </div>
  )
}
