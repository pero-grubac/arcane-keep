import { useMemo } from 'react'
import { ENEMY_DEFS, TAG_META } from '../game/enemies.js'
import { buildWave, threatLevel } from '../game/waves.js'
import { TOWER_DEFS, TOWER_ORDER, EVOLUTIONS, calcStats, dpsOf } from '../game/towers.js'
import styles from './Tabs.module.css'

// ─── Wave intel ───────────────────────────────────────────────────────────────
// buildWave is a pure function of (seed, wave), so this preview is exactly the
// wave that will spawn — not a fresh roll like the old build did on every
// render.
export function IntelTab({ wave, seed, live }) {
  const data = useMemo(() => buildWave(wave, seed), [wave, seed])
  const threat = threatLevel(wave)
  const types = Object.keys(data.composition).sort(
    (a, b) => data.composition[b] - data.composition[a],
  )

  return (
    <div className={styles.intelTab}>
      <div className={styles.intelHeader}>
        <div className={styles.intelTitle}>
          {live ? 'Current wave' : 'Next wave'}
        </div>
        <div className={styles.intelMeta}>
          <span>Wave <b>{wave}</b></span>
          <span>Enemies <b>{data.totalCount}</b></span>
          <span>Bounty <b>≈{data.reward}g</b></span>
          <span>Threat <b style={{ color: threat.color }}>{threat.label}</b></span>
          {data.elite && <span>Elite <b style={{ color: '#e0308a' }}>×{data.elite.toFixed(1)} HP</b></span>}
        </div>
        {data.modifier && (
          <div className={styles.modBanner}>
            <b>{data.modifier.icon} {data.modifier.name}</b>
            <span>{data.modifier.desc}</span>
          </div>
        )}
      </div>

      <div className={styles.intelCards}>
        {types.map((type) => {
          const def = ENEMY_DEFS[type]
          const sample = data.queue.find((q) => q.type === type)?.spec
          if (!sample) return null
          return (
            <div key={type} className={styles.intelCard}>
              <span className={styles.icEmoji}>{def.emoji}</span>
              <span className={styles.icName}>{def.name} ×{data.composition[type]}</span>
              <Row label="HP" val={sample.hp.toLocaleString()} />
              {sample.shield > 0 && <Row label="Shield" val={sample.shield} />}
              {sample.armor > 0 && <Row label="Armour" val={sample.armor} />}
              <Row label="Speed" val={sample.spd.toFixed(1)} />
              <Row label="Bounty" val={`${sample.reward}g`} />
              <span className={styles.icBlurb}>{def.blurb}</span>
              <div className={styles.tags}>
                {def.tags.map((t) => (
                  <span key={t} className={`${styles.warn} ${styles[TAG_META[t].cls]}`}>
                    {TAG_META[t].label}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Row({ label, val }) {
  return (
    <div className={styles.icRow}>
      <span className={styles.icL}>{label}</span>
      <span className={styles.icV}>{val}</span>
    </div>
  )
}

// ─── Placed towers ────────────────────────────────────────────────────────────
export function TowersTab({ towers, selectedTowerId, onSelectTower }) {
  if (!towers || towers.length === 0) {
    return <div className={styles.empty}>No towers placed yet.</div>
  }

  const sorted = [...towers].sort((a, b) => (b.damageDealt ?? 0) - (a.damageDealt ?? 0))

  return (
    <div className={styles.towersTab}>
      {sorted.map((t) => {
        const def = TOWER_DEFS[t.baseType]
        const ev = t.evolved ? EVOLUTIONS[t.baseType][t.evolveStat] : null
        const stats = calcStats(t)
        const total = t.upgrades.dmg + t.upgrades.spd + t.upgrades.rng
        const color = ev ? ev.color : def.color

        return (
          <div
            key={t.id}
            className={`${styles.placedCard} ${t.id === selectedTowerId ? styles.sel : ''}`}
            style={{ '--tc': color }}
            onClick={() => onSelectTower(t.id)}
          >
            <div className={styles.pcTop}>
              <span className={styles.pcEmoji}>{ev ? ev.emoji : def.emoji}</span>
              <span className={styles.pcName}>{ev ? ev.name : def.name}</span>
              {ev && <span className={styles.pcEv}>EV</span>}
            </div>
            <div className={styles.pcStat}>DPS <b>{dpsOf(stats).toFixed(1)}</b></div>
            <div className={styles.pcStat}>
              Kills <b>{t.killCount ?? 0}</b> · Dmg <b>{Math.round(t.damageDealt ?? 0).toLocaleString()}</b>
            </div>
            <div className={styles.pcPips}>
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className={styles.pcPip}
                  style={{ background: i < total ? color : '#1a1a24' }}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Codex ────────────────────────────────────────────────────────────────────
// Every evolution branch in one place, so players can plan a build instead of
// discovering them by accident.
export function CodexTab() {
  return (
    <div className={styles.codex}>
      {TOWER_ORDER.map((type) => {
        const def = TOWER_DEFS[type]
        return (
          <div key={type} className={styles.codexRow}>
            <div className={styles.codexBase} style={{ '--tc': def.color }}>
              <span className={styles.cbEmoji}>{def.emoji}</span>
              <span className={styles.cbName}>{def.name}</span>
              <span className={styles.cbDesc}>{def.desc}</span>
            </div>
            <span className={styles.codexArrow}>→</span>
            <div className={styles.codexEvos}>
              {['dmg', 'spd', 'rng'].map((stat) => {
                const v = EVOLUTIONS[type][stat]
                return (
                  <div key={stat} className={styles.codexEvo} style={{ '--tc': v.color }}>
                    <span className={styles.ceTop}>
                      <span className={styles.ceEmoji}>{v.emoji}</span>
                      <span className={styles.ceName}>{v.name}</span>
                      <span className={styles.ceLabel}>{v.label}</span>
                    </span>
                    <span className={styles.ceDesc}>{v.desc}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
