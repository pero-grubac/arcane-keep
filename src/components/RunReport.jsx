import styles from './RunReport.module.css'

// The end-of-run breakdown. The numbers come from buildReport in game/report.js.

const MAX_BARS = 6

export default function RunReport({ report }) {
  if (!report) return null
  const top = report.towers.slice(0, MAX_BARS)
  const rest = report.towers.length - top.length
  const maxDmg = top[0]?.damage || 1

  return (
    <div className={styles.report}>
      {top.length > 0 && (
        <section aria-label="Damage by tower">
          <h3 className={styles.heading}>Damage by tower</h3>
          <ol className={styles.bars}>
            {top.map((t, i) => (
              <li
                key={t.id}
                className={styles.row}
                title={`${t.name}: ${t.damage.toLocaleString()} damage, ${t.kills} kills`}
              >
                <span className={styles.label}>
                  {i === 0 && <span className={styles.mvp}>MVP</span>}
                  {t.emoji} {t.name}
                </span>
                <span className={styles.track}>
                  <span className={styles.fill} style={{ width: `${(t.damage / maxDmg) * 100}%` }} />
                </span>
                <span className={styles.value}>{compact(t.damage)}</span>
              </li>
            ))}
          </ol>
          {rest > 0 && <div className={styles.more}>+{rest} more towers</div>}
        </section>
      )}

      <div className={styles.facts}>
        <Fact label="Gold earned" value={report.earned} />
        <Fact label="Gold spent" value={report.spent} />
        {report.refunded > 0 && <Fact label="Refunded" value={report.refunded} />}
        {report.worst && (
          <Fact label="Costliest wave" value={`${report.worst.wave} (−${report.worst.lost}❤)`} />
        )}
      </div>

      {report.lives.length > 2 && <LivesLine lives={report.lives} />}
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div className={styles.fact}>
      <span className={styles.factLabel}>{label}</span>
      <b>{typeof value === 'number' ? value.toLocaleString() : value}</b>
    </div>
  )
}

// Lives at the start, after each cleared wave, and at the end.
function LivesLine({ lives }) {
  const W = 260
  const H = 44
  const pad = 4
  const max = Math.max(20, ...lives.map((p) => p.v))
  const x = (i) => pad + (i / (lives.length - 1)) * (W - pad * 2)
  const y = (v) => pad + (1 - v / max) * (H - pad * 2)
  const d = lives.map(({ v }, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const last = lives.length - 1

  return (
    <section aria-label="Lives over the run">
      <h3 className={styles.heading}>Lives over the run</h3>
      <svg
        className={styles.spark}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Lives went from ${lives[0].v} to ${lives[last].v}`}
      >
        <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} className={styles.base} />
        <path d={d} className={styles.line} />
        {lives.map(({ v, label }, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={6} className={styles.hit}>
            <title>{`${label}: ${v} lives`}</title>
          </circle>
        ))}
        <circle cx={x(last)} cy={y(lives[last].v)} r={3} className={styles.dot} />
      </svg>
    </section>
  )
}

function compact(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`
  return n.toLocaleString()
}
