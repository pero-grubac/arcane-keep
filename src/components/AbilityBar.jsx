import { ABILITIES } from '../game/abilities.js'
import styles from './AbilityBar.module.css'

// Floats over the board. Targeted abilities arm on click and fire on the next
// canvas click; the rest fire immediately.
export default function AbilityBar({ cooldowns, pending, rallyLeft, phase, onCast }) {
  return (
    <div className={styles.bar}>
      {ABILITIES.map((a) => {
        const cd = cooldowns[a.id] ?? 0
        const ready = cd <= 0 && phase === 'playing'
        const armed = pending === a.id
        const pct = ready ? 0 : cd / a.cooldown
        return (
          <button
            key={a.id}
            className={`${styles.ability} ${ready ? styles.ready : ''} ${armed ? styles.armed : ''}`}
            onClick={() => onCast(a.id)}
            disabled={!ready}
            title={`${a.name} (${a.hotkey.toUpperCase()}) — ${a.desc}`}
          >
            <span className={styles.emoji}>{a.emoji}</span>
            <span className={styles.meta}>
              <span className={styles.name}>{a.name}</span>
              <span className={styles.key}>{a.hotkey.toUpperCase()}</span>
            </span>
            {!ready && (
              <>
                <span className={styles.cooldownFill} style={{ height: `${pct * 100}%` }} />
                <span className={styles.cooldownText}>{Math.ceil(cd)}</span>
              </>
            )}
            {a.id === 'rally' && rallyLeft > 0 && (
              <span className={styles.active}>{rallyLeft.toFixed(1)}s</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
