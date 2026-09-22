import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HANDCRAFTED_MAPS, generateMap } from '../game/maps/index.js'
import { randomSeed } from '../game/rng.js'
import { dailyKey, dailySeed, getDailyBest, loadSave } from '../game/storage.js'
import styles from './MapSelect.module.css'

// Small canvas showing the actual generated path, so "Random Realm" is no
// longer a blind pick.
function MapPreview({ map, width = 210, height = 124 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !map) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const cell = Math.min(width / map.cols, height / map.rows)
    const ox = (width - cell * map.cols) / 2
    const oy = (height - cell * map.rows) / 2

    ctx.fillStyle = map.theme.cellBg
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = map.theme.cellAlt
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        if ((c + r) % 2) ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell)
      }
    }
    // Terrain, so water and high ground are visible before you commit.
    if (map.terrain) {
      for (const [key, kind] of Object.entries(map.terrain)) {
        const [c, r] = key.split(',').map(Number)
        ctx.fillStyle = kind === 'water' ? '#16304e'
          : kind === 'high' ? '#232a35' : '#2a251d'
        ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell)
      }
    }

    const lanes = map.paths ?? [map.path]
    ctx.fillStyle = map.theme.pathEdge
    for (const [c, r] of lanes.flat()) ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell)
    ctx.fillStyle = map.theme.pathFg
    for (const [c, r] of lanes.flat()) {
      ctx.fillRect(ox + c * cell + cell * 0.18, oy + r * cell + cell * 0.18, cell * 0.64, cell * 0.64)
    }

    ctx.fillStyle = '#40d070'
    for (const p of lanes) {
      const [sc, sr] = p[0]
      ctx.fillRect(ox + sc * cell, oy + sr * cell, cell, cell)
    }
    const main = lanes[0]
    const [ec, er] = main[main.length - 1]
    ctx.fillStyle = '#e0a040'
    ctx.fillRect(ox + ec * cell, oy + er * cell, cell, cell)
  }, [map, width, height])

  return <canvas ref={ref} className={styles.preview} style={{ width, height }} />
}

export default function MapSelect({ onStart, soundOn, onToggleSound }) {
  const saved = useMemo(() => loadSave(), [])
  // Offer the last seed played first, so reloading the page still lets you
  // retry the exact map you were on.
  const [seed, setSeed] = useState(() => saved.lastSeed ?? randomSeed())
  const [seedInput, setSeedInput] = useState('')
  const randomMap = useMemo(() => generateMap(seed), [seed])

  // Same map and same waves for everyone, every day.
  const today = useMemo(() => dailyKey(), [])
  const dailyMap = useMemo(() => {
    const m = generateMap(dailySeed())
    return { ...m, id: `daily_${today}`, name: 'Daily Challenge' }
  }, [today])

  const save = saved
  const dailyBest = useMemo(() => getDailyBest(today), [today])
  const recordFor = (id) => save.records[id] ?? null

  const reroll = useCallback((e) => {
    e.stopPropagation()
    setSeed(randomSeed())
    setSeedInput('')
  }, [])

  const applySeed = useCallback((e) => {
    e.stopPropagation()
    const n = Number(seedInput)
    if (Number.isFinite(n) && seedInput.trim() !== '') setSeed(n >>> 0)
  }, [seedInput])

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>⚔ ARCANE KEEP</h1>
      <p className={styles.sub}>Choose your battleground</p>

      <button className={styles.soundToggle} onClick={onToggleSound} title="Sound (M)">
        {soundOn ? '🔊 Sound on' : '🔇 Muted'}
      </button>

      <div className={`${styles.cards} ${styles.dailyRow}`}>
        <div
          className={`${styles.card} ${styles.dailyCard}`}
          role="button"
          tabIndex={0}
          onClick={() => onStart(dailyMap, { dailyKey: today })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onStart(dailyMap, { dailyKey: today })
            }
          }}
        >
          <MapPreview map={dailyMap} />
          <span className={styles.cardName}>☀ Daily Challenge</span>
          <span className={styles.cardDesc}>
            {today} · same map and waves for everyone today
          </span>
          <span className={styles.meta}>
            {dailyMap.branching ? '⑂ two lanes · ' : ''}
            {dailyBest > 0 ? `best today: wave ${dailyBest}` : 'not attempted yet'}
          </span>
        </div>
      </div>

      <div className={styles.cards}>
        {HANDCRAFTED_MAPS.map((map) => (
          <button key={map.id} className={styles.card} onClick={() => onStart(map)}>
            <MapPreview map={map} />
            <span className={styles.cardName}>{map.emoji} {map.name}</span>
            <span className={styles.cardDesc}>{map.blurb}</span>
            <span className={styles.meta}>
              {map.path.length} tiles
              {recordFor(map.id) ? ` · best wave ${recordFor(map.id).bestWave}` : ''}
            </span>
          </button>
        ))}

        {/* A div, not a button: the reroll and seed controls live inside it and
            buttons cannot legally nest. */}
        <div
          className={`${styles.card} ${styles.randomCard}`}
          role="button"
          tabIndex={0}
          onClick={() => onStart(randomMap)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onStart(randomMap)
            }
          }}
        >
          <MapPreview map={randomMap} />
          <span className={styles.cardName}>
            {randomMap.theme.emoji} {randomMap.name}
          </span>
          <span className={styles.cardDesc}>{randomMap.theme.name} · procedurally generated</span>
          <span className={styles.meta}>
            {randomMap.branching ? '⑂ two lanes · ' : ''}
            {randomMap.path.length} tiles · seed {randomMap.seed}
            {saved.lastSeed === randomMap.seed ? ' · last played' : ''}
          </span>

          <div className={styles.seedRow} onClick={(e) => e.stopPropagation()}>
            <button className={styles.rerollBtn} onClick={reroll}>🎲 Reroll</button>
            <input
              className={styles.seedInput}
              value={seedInput}
              placeholder="seed"
              onChange={(e) => setSeedInput(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') applySeed(e)
              }}
            />
            <button className={styles.rerollBtn} onClick={applySeed}>Use</button>
          </div>
        </div>
      </div>

      <p className={styles.footer}>
        Build · Upgrade · Evolve · Survive endless waves
        <span className={styles.keys}>
          1–5 towers · Q/W/R abilities · Enter send wave · Tab targeting · Space pause · F speed · E evolve · M mute
        </span>
        {save.totals.runs > 0 && (
          <span className={styles.keys}>
            {save.totals.runs} runs · {save.totals.kills.toLocaleString()} total kills
          </span>
        )}
      </p>
    </div>
  )
}
