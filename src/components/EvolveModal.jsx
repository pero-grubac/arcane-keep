import { useId, useRef } from 'react'
import { useDialog } from './useDialog.js'
import {
  TOWER_DEFS, EVOLUTIONS, STAT_META, calcStats, dpsOf, getDominant, EVOLVE_COST,
} from '../game/towers.js'
import styles from './EvolveModal.module.css'

// Evolving is a branch choice, not an automatic consequence of the upgrade
// spread — the player picks, and sees exactly what changes before committing.
export default function EvolveModal({ tower, gold, onPick, onClose }) {
  const def = TOWER_DEFS[tower.baseType]
  const now = calcStats(tower)
  const suggested = getDominant(tower.upgrades)
  const ref = useRef(null)
  const titleId = useId()
  useDialog(ref, onClose)

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={ref}
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.head}>
          <span className={styles.title} id={titleId}>
            Evolve {def.emoji} {def.name}
          </span>
          <span className={styles.sub}>
            Choose a path · {EVOLVE_COST}g · upgrades are kept
          </span>
        </div>

        <div className={styles.cards}>
          {['dmg', 'spd', 'rng'].map((stat) => {
            const v = EVOLUTIONS[tower.baseType][stat]
            const after = calcStats({ ...tower, evolved: true, evolveStat: stat })
            const isSuggested = stat === suggested
            return (
              <button
                key={stat}
                className={`${styles.card} ${isSuggested ? styles.suggested : ''}`}
                style={{ '--ev': v.color }}
                onClick={() => onPick(stat)}
                disabled={gold < EVOLVE_COST}
                data-autofocus={isSuggested ? '' : undefined}
              >
                {isSuggested && <span className={styles.tag}>your build</span>}
                <span className={styles.emoji}>{v.emoji}</span>
                <span className={styles.name}>{v.name}</span>
                <span className={styles.path}>{STAT_META[stat].label} path</span>
                <span className={styles.desc}>{v.desc}</span>
                <div className={styles.deltas}>
                  <Delta label="DPS" from={dpsOf(now)} to={dpsOf(after)} />
                  <Delta label="Range" from={now.range} to={after.range} suffix="t" />
                  <Delta label="Rate" from={now.fireRate} to={after.fireRate} suffix="/s" />
                </div>
              </button>
            )
          })}
        </div>

        <button className={styles.cancel} onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

function Delta({ label, from, to, suffix = '' }) {
  const pct = from > 0 ? Math.round(((to - from) / from) * 100) : 0
  const cls = pct > 0 ? styles.up : pct < 0 ? styles.down : styles.flat
  return (
    <div className={styles.delta}>
      <span className={styles.dLabel}>{label}</span>
      <span className={styles.dVal}>{to.toFixed(1)}{suffix}</span>
      <span className={cls}>{pct > 0 ? `+${pct}%` : pct < 0 ? `${pct}%` : '—'}</span>
    </div>
  )
}
