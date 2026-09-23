import { useCallback, useEffect, useRef, useState } from 'react'
import '../styles/global.css'
import GameCanvas from './GameCanvas.jsx'
import HUD from './HUD.jsx'
import BottomPanel from './BottomPanel.jsx'
import MapSelect from './MapSelect.jsx'
import Toast from './Toast.jsx'
import EvolveModal from './EvolveModal.jsx'
import AbilityBar from './AbilityBar.jsx'
import GameOver from './GameOver.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import {
  makeGameState, createTower, startWave, evolveTower, spawnEvolveParticles,
  pendingEarlyBonus, buildCheck, castAbility, abilityReady,
  earnGold, spendGold, serializeRun, restoreRun, canSaveRun,
} from '../game/engine.js'
import {
  TOWER_DEFS, TOWER_ORDER, EVOLUTIONS, getTowerCost, upgradeCost, nextTargeting,
  MAX_UPGRADE, EVOLVE_REQUIREMENT, EVOLVE_COST, SELL_RATIO,
} from '../game/towers.js'
import { randomSeed } from '../game/rng.js'
import { buildReport } from '../game/report.js'
import { audio } from '../game/audio.js'
import { ABILITY_BY_ID, ABILITIES } from '../game/abilities.js'
import {
  loadSave, saveSettings, recordRun, rememberSeed, saveRun, loadRun, clearRun,
} from '../game/storage.js'
import styles from './App.module.css'

// The simulation lives in a ref and runs at 60fps. React only ever sees a small
// snapshot of it, pushed when something meaningful changes, so the UI never
// re-renders per frame.
function snapshot(s) {
  const sel = s.towers.find((t) => t.id === s.selectedTowerId) ?? null
  return {
    seed: s.seed,
    dailyKey: s.dailyKey,
    mapId: s.currentMap.id,
    phase: s.phase,
    paused: s.paused,
    // Only built once the keep has fallen — nothing reads it before then.
    report: s.phase === 'gameover' ? buildReport(s) : null,
    gold: Math.floor(s.gold),
    lives: s.lives,
    wave: s.wave,
    kills: s.kills,
    gameSpeed: s.gameSpeed,
    waveActive: s.waveActive,
    enemiesLeft: s.enemies.length + s.spawnQueue.length,
    earlyBonus: pendingEarlyBonus(s),
    abilityCd: { ...s.abilityCd },
    pendingAbility: s.pendingAbility,
    rallyT: s.rallyT,
    modifier: s.waveData?.modifier ?? null,
    selectedBuild: s.selectedBuild,
    selectedTowerId: s.selectedTowerId,
    selectedTower: sel ? { ...sel, upgrades: { ...sel.upgrades } } : null,
    towerCounts: { ...s.towerCounts },
    towers: s.towers.map((t) => ({
      id: t.id, baseType: t.baseType, evolved: t.evolved, evolveStat: t.evolveStat,
      upgrades: { ...t.upgrades }, killCount: t.killCount, damageDealt: t.damageDealt,
      col: t.col, row: t.row, targeting: t.targeting,
      terrain: t.terrain, disabledT: t.disabledT,
      buffed: Boolean(t.auraBuff),
    })),
  }
}

// Cheap change detector so we do not setState on identical data.
function fingerprint(s) {
  return [
    s.phase, s.paused, Math.floor(s.gold), s.lives, s.wave, s.kills, s.gameSpeed,
    s.waveActive, s.enemies.length + s.spawnQueue.length, s.towers.length,
    s.selectedTowerId, s.selectedBuild, s.pendingAbility,
    Math.ceil(s.rallyT),
    ABILITIES.map((a) => Math.ceil(s.abilityCd[a.id] ?? 0)).join(','),
    s.towers.reduce(
      (a, t) => a + t.upgrades.dmg + t.upgrades.spd + t.upgrades.rng
        + (t.evolved ? 100 : 0) + t.killCount + t.targeting.length,
      0,
    ),
    // Aura and silence state change a tower's live stats without changing
    // anything else, so they have to be part of the change detector or the
    // panel keeps showing pre-buff numbers.
    s.towers.reduce(
      (a, t) => a + (t.auraBuff ? t.auraBuff.dmg + t.auraBuff.fireRate + t.auraBuff.range : 0)
        + (t.disabledT > 0 ? 7 : 0),
      0,
    ).toFixed(2),
  ].join('|')
}

function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => window.matchMedia?.(query).matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export default function App() {
  const [screen, setScreen] = useState('menu')
  const [ui, setUi] = useState(null)
  const [toast, setToast] = useState({ msg: null, key: 0 })
  const [evolveOpen, setEvolveOpen] = useState(false)
  const [soundOn, setSoundOn] = useState(() => loadSave().settings.sound !== false)
  const [settings, setSettings] = useState(() => loadSave().settings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [result, setResult] = useState(null)
  const systemReduced = usePrefersReducedMotion()

  const gameRef = useRef(null)
  const fpRef = useRef('')

  // Apply the saved sound preference once on mount.
  useEffect(() => {
    audio.setEnabled(soundOn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    audio.setVolumes({ sfx: settings.sfxVolume, ambient: settings.ambientVolume })
  }, [settings.sfxVolume, settings.ambientVolume])

  // Display preferences reach the render loop through a ref, so changing one
  // never restarts the loop.
  const reducedMotion = settings.motion === 'reduced'
    || (settings.motion === 'system' && systemReduced)
  const displayRef = useRef({})
  useEffect(() => {
    displayRef.current = { reducedMotion, statusIcons: settings.statusShapes }
    // CSS animations (toasts, pulses) key off this too.
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full'
  }, [reducedMotion, settings.statusShapes])

  const updateSettings = useCallback((patch) => {
    setSettings(saveSettings(patch))
  }, [])

  // The low bed plays only while a wave is actually on the field, and climbs
  // with the wave number.
  const waveLive = screen === 'game' && ui?.waveActive && ui?.phase === 'playing'
  useEffect(() => {
    audio.setAmbient(Boolean(waveLive), ui?.wave ?? 1)
  }, [waveLive, ui?.wave])

  useEffect(() => () => audio.setAmbient(false), [])

  const pushToast = useCallback((msg) => {
    setToast((t) => ({ msg, key: t.key + 1 }))
  }, [])

  // Between waves, every meaningful change is written straight to storage, so
  // closing the tab or reloading never costs more than the wave in progress.
  const persist = useCallback((s) => {
    if (canSaveRun(s)) saveRun(serializeRun(s))
  }, [])

  const sync = useCallback(() => {
    const s = gameRef.current
    if (!s) return
    fpRef.current = fingerprint(s)
    setUi(snapshot(s))
    persist(s)
  }, [persist])

  // Called from the render loop; only pushes when something actually changed.
  const handleFrame = useCallback(() => {
    const s = gameRef.current
    if (!s) return
    const fp = fingerprint(s)
    if (fp === fpRef.current) return
    fpRef.current = fp
    setUi(snapshot(s))
    persist(s)
  }, [persist])

  // A hidden tab should never cost the keep. Browsers throttle or stop
  // requestAnimationFrame in the background anyway; pausing makes it explicit
  // and waits for the player to come back.
  useEffect(() => {
    if (screen !== 'game') return
    const onVisibility = () => {
      const s = gameRef.current
      if (!document.hidden || !s || s.phase !== 'playing' || s.paused) return
      s.paused = true
      sync()
      pushToast('⏸ Paused while you were away — Space to resume')
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [screen, sync, pushToast])

  // ── Start a run ────────────────────────────────────────────────────────────
  const startRun = useCallback((map, opts = {}) => {
    const seed = map.seed ?? randomSeed()
    const s = makeGameState(map, seed)
    s.dailyKey = opts.dailyKey ?? null
    // Starting a fresh run abandons any saved one.
    clearRun()
    gameRef.current = s
    fpRef.current = ''
    rememberSeed(seed)
    setEvolveOpen(false)
    setResult(null)
    setToast({ msg: null, key: 0 })
    setScreen('game')
    audio.play('ui')
    sync()
  }, [sync])

  const resumeRun = useCallback(() => {
    const s = restoreRun(loadRun())
    if (!s) {
      clearRun()
      return
    }
    gameRef.current = s
    fpRef.current = ''
    setEvolveOpen(false)
    setResult(null)
    setScreen('game')
    audio.play('ui')
    sync()
    setToast({ msg: `Resumed before wave ${s.wave + 1} — Space to unpause`, key: 1 })
  }, [sync])

  const quitToMenu = useCallback(() => {
    audio.setAmbient(false)
    gameRef.current = null
    setScreen('menu')
    setUi(null)
    setResult(null)
  }, [])

  const restartSameMap = useCallback(() => {
    const s = gameRef.current
    if (!s) return
    startRun(s.currentMap, { dailyKey: s.dailyKey })
  }, [startRun])

  // ── Build / select ─────────────────────────────────────────────────────────
  const selectBuild = useCallback((type) => {
    const s = gameRef.current
    if (!s) return
    s.selectedBuild = s.selectedBuild === type ? null : type
    s.selectedTowerId = null
    audio.play('ui')
    sync()
  }, [sync])

  const selectTower = useCallback((id) => {
    const s = gameRef.current
    if (!s) return
    s.selectedTowerId = id
    s.selectedBuild = null
    audio.play('ui')
    sync()
  }, [sync])

  const deselect = useCallback(() => {
    const s = gameRef.current
    if (!s) return
    s.selectedTowerId = null
    s.selectedBuild = null
    setEvolveOpen(false)
    sync()
  }, [sync])

  const placeTower = useCallback((col, row) => {
    const s = gameRef.current
    if (!s || s.phase !== 'playing') return
    if (s.pendingAbility) return
    const type = s.selectedBuild
    if (!type) return

    const check = buildCheck(s, col, row)
    if (!check.ok) {
      pushToast(check.reason)
      return
    }
    // Rubble has to be cleared before anything can stand on it.
    const cost = getTowerCost(type, s.towerCounts) + check.extraCost
    if (s.gold < cost) {
      pushToast(check.extraCost
        ? `Not enough gold — ${cost}g with rubble clearing`
        : `Not enough gold — need ${cost}g`)
      return
    }
    spendGold(s, cost)
    s.towerCounts[type]++
    const tower = createTower(col, row, type, cost, check.terrain)
    s.towers.push(tower)
    s.selectedTowerId = tower.id
    s.selectedBuild = type
    audio.play('build')
    sync()
  }, [pushToast, sync])

  // ── Upgrade / evolve / sell / targeting ────────────────────────────────────
  const upgrade = useCallback((stat) => {
    const s = gameRef.current
    if (!s) return
    const t = s.towers.find((x) => x.id === s.selectedTowerId)
    if (!t) return
    const lvl = t.upgrades[stat]
    if (lvl >= MAX_UPGRADE) return
    const cost = upgradeCost(lvl)
    if (s.gold < cost) {
      pushToast(`Not enough gold — need ${cost}g`)
      return
    }
    spendGold(s, cost)
    t.invested += cost
    t.upgrades[stat]++
    audio.play('gold')
    sync()
  }, [pushToast, sync])

  const cycleTargeting = useCallback(() => {
    const s = gameRef.current
    if (!s) return
    const t = s.towers.find((x) => x.id === s.selectedTowerId)
    if (!t) return
    t.targeting = nextTargeting(t.targeting)
    audio.play('ui')
    sync()
  }, [sync])

  const setTargeting = useCallback((mode) => {
    const s = gameRef.current
    if (!s) return
    const t = s.towers.find((x) => x.id === s.selectedTowerId)
    if (!t) return
    t.targeting = mode
    audio.play('ui')
    sync()
  }, [sync])

  // Targeted abilities arm first and fire on the next click on the board.
  const requestAbility = useCallback((id) => {
    const s = gameRef.current
    if (!s || s.phase !== 'playing') return
    if (!abilityReady(s, id)) return
    const def = ABILITY_BY_ID[id]
    if (def.targeted) {
      s.pendingAbility = s.pendingAbility === id ? null : id
      if (s.pendingAbility) pushToast(`${def.emoji} ${def.name} — click a tile`)
      audio.play('ui')
      sync()
      return
    }
    if (castAbility(s, id)) {
      audio.play(id)
      pushToast(`${def.emoji} ${def.name}`)
      sync()
    }
  }, [pushToast, sync])

  const castAtTile = useCallback((col, row) => {
    const s = gameRef.current
    if (!s || !s.pendingAbility) return false
    const id = s.pendingAbility
    const fired = castAbility(s, id, { col, row })
    s.pendingAbility = null
    if (fired) {
      audio.play(id)
      pushToast(`${ABILITY_BY_ID[id].emoji} ${ABILITY_BY_ID[id].name}!`)
    }
    sync()
    return true
  }, [pushToast, sync])

  const openEvolve = useCallback(() => {
    const s = gameRef.current
    if (!s) return
    const t = s.towers.find((x) => x.id === s.selectedTowerId)
    if (!t || t.evolved) return
    const total = t.upgrades.dmg + t.upgrades.spd + t.upgrades.rng
    if (total < EVOLVE_REQUIREMENT) {
      pushToast(`Needs ${EVOLVE_REQUIREMENT} upgrade levels to evolve (${total}/${EVOLVE_REQUIREMENT})`)
      return
    }
    if (s.gold < EVOLVE_COST) {
      pushToast(`Not enough gold — evolving costs ${EVOLVE_COST}g`)
      return
    }
    setEvolveOpen(true)
  }, [pushToast])

  const confirmEvolve = useCallback((stat) => {
    const s = gameRef.current
    if (!s) return
    const t = s.towers.find((x) => x.id === s.selectedTowerId)
    if (!t || t.evolved || s.gold < EVOLVE_COST) return
    spendGold(s, EVOLVE_COST)
    t.invested += EVOLVE_COST
    evolveTower(t, stat)
    const v = EVOLUTIONS[t.baseType][stat]
    spawnEvolveParticles(s, t, v.color)
    setEvolveOpen(false)
    audio.play('evolve')
    pushToast(`✦ ${TOWER_DEFS[t.baseType].name} became ${v.name}`)
    sync()
  }, [pushToast, sync])

  const sellTower = useCallback(() => {
    const s = gameRef.current
    if (!s) return
    const t = s.towers.find((x) => x.id === s.selectedTowerId)
    if (!t) return
    // Refund is based on what was actually spent on this tower, not on what the
    // next one of its type would cost.
    const refund = Math.floor(t.invested * SELL_RATIO)
    earnGold(s, refund, 'refunded')
    s.towerCounts[t.baseType] = Math.max(0, s.towerCounts[t.baseType] - 1)
    s.towers = s.towers.filter((x) => x.id !== t.id)
    s.projectiles = s.projectiles.filter((p) => p.towerId !== t.id)
    s.selectedTowerId = null
    s.selectedBuild = t.baseType
    setEvolveOpen(false)
    audio.play('gold')
    pushToast(`Sold for ${refund}g`)
    sync()
  }, [pushToast, sync])

  // ── Wave / speed / pause / sound ───────────────────────────────────────────
  const sendWave = useCallback(() => {
    const s = gameRef.current
    if (!s || s.phase !== 'playing') return
    const early = s.waveActive
    const { data, bonus } = startWave(s)
    earnGold(s, bonus)
    const mod = data.modifier ? ` · ${data.modifier.icon} ${data.modifier.name}` : ''
    audio.play('wave')
    pushToast(
      early
        ? `⚡ Wave ${s.wave} called in early · +${bonus}g${mod}`
        : `⚔ Wave ${s.wave} — ${data.totalCount} enemies${mod}`,
    )
    sync()
  }, [pushToast, sync])

  const cycleSpeed = useCallback(() => {
    const s = gameRef.current
    if (!s) return
    s.gameSpeed = s.gameSpeed === 1 ? 2 : s.gameSpeed === 2 ? 4 : 1
    saveSettings({ speed: s.gameSpeed })
    audio.play('ui')
    sync()
  }, [sync])

  const togglePause = useCallback(() => {
    const s = gameRef.current
    if (!s || s.phase !== 'playing') return
    s.paused = !s.paused
    sync()
  }, [sync])

  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev
      audio.setEnabled(next)
      saveSettings({ sound: next })
      if (next) audio.play('ui')
      return next
    })
  }, [])

  // ── Game events from the loop ──────────────────────────────────────────────
  const callbacks = useRef({})
  useEffect(() => {
    callbacks.current = {
      onLeak: (e) => {
        const s = gameRef.current
        if (!s) return
        s.lives = Math.max(0, s.lives - e.liveDmg)
        if (s.lives <= 0 && s.phase === 'playing') {
          s.phase = 'gameover'
          s.waveActive = false
          clearRun()
          audio.play('gameover')
          // Runs are recorded once, the moment the keep falls.
          setResult(
            recordRun({
              mapId: s.currentMap.id,
              wave: s.wave,
              kills: s.kills,
              dailyKey: s.dailyKey,
            }),
          )
        }
      },
      onKill: (e) => {
        const s = gameRef.current
        if (s) earnGold(s, e.reward)
      },
      onWaveCleared: (wave, bonus) => {
        const s = gameRef.current
        if (!s) return
        earnGold(s, bonus)
        pushToast(`Wave ${wave} cleared · +${bonus}g`)
      },
    }
  }, [pushToast])

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'game') return
    const onKey = (ev) => {
      if (ev.target.tagName === 'INPUT') return
      // Overlays own the keyboard while they are open.
      if (ev.target.closest?.('[role="dialog"]')) return
      // Space and Enter on a focused button should press that button, not also
      // pause the game or send a wave.
      if (ev.target.tagName === 'BUTTON' && (ev.key === ' ' || ev.key === 'Enter')) return
      const k = ev.key.toLowerCase()
      if (k >= '1' && k <= '9' && Number(k) <= TOWER_ORDER.length) {
        selectBuild(TOWER_ORDER[Number(k) - 1])
      }
      else if (k === ' ') { ev.preventDefault(); togglePause() }
      else if (k === 'enter') sendWave()
      else if (k === 'escape') {
        const s = gameRef.current
        if (s?.pendingAbility) { s.pendingAbility = null; sync() }
        else deselect()
      }
      else if (k === 'f') cycleSpeed()
      else if (k === 'e') openEvolve()
      else if (k === 'm') toggleSound()
      else if (k === 'q' || k === 'w' || k === 'r') {
        const a = ABILITIES.find((x) => x.hotkey === k)
        if (a) requestAbility(a.id)
      }
      else if (ev.key === 'Tab') { ev.preventDefault(); cycleTargeting() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen, selectBuild, togglePause, sendWave, deselect, cycleSpeed, openEvolve,
    cycleTargeting, toggleSound, requestAbility, sync])

  const settingsPanel = (
    <SettingsPanel
      settings={settings}
      onChange={updateSettings}
      onClose={() => setSettingsOpen(false)}
    />
  )

  if (screen === 'menu' || !ui) {
    return (
      <>
        <MapSelect
          onStart={startRun}
          onResume={resumeRun}
          soundOn={soundOn}
          onToggleSound={toggleSound}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {settingsOpen && settingsPanel}
      </>
    )
  }

  const selected = ui.selectedTower

  return (
    <div className={styles.layout}>
      <HUD
        gold={ui.gold}
        lives={ui.lives}
        wave={ui.wave}
        kills={ui.kills}
        gameSpeed={ui.gameSpeed}
        paused={ui.paused}
        phase={ui.phase}
        enemiesLeft={ui.enemiesLeft}
        waveActive={ui.waveActive}
        modifier={ui.modifier}
        soundOn={soundOn}
        dailyKey={ui.dailyKey}
        onSpeedToggle={cycleSpeed}
        onPauseToggle={togglePause}
        onSoundToggle={toggleSound}
        onQuit={quitToMenu}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className={styles.gameArea}>
        <GameCanvas
          gameRef={gameRef}
          callbacks={callbacks}
          audio={audio}
          onFrame={handleFrame}
          onPlaceTower={placeTower}
          onSelectTower={selectTower}
          onDeselect={deselect}
          onCastAtTile={castAtTile}
          displayRef={displayRef}
        />

        <AbilityBar
          cooldowns={ui.abilityCd}
          pending={ui.pendingAbility}
          rallyLeft={ui.rallyT}
          phase={ui.phase}
          onCast={requestAbility}
        />
        <Toast key={toast.key} message={toast.msg} />
        {/* The visible toast remounts per message, which screen readers miss;
            this region stays put and announces each one. */}
        <div className="sr-only" role="status" aria-live="polite">{toast.msg}</div>

        {evolveOpen && selected && !selected.evolved && (
          <EvolveModal
            tower={selected}
            gold={ui.gold}
            onPick={confirmEvolve}
            onClose={() => setEvolveOpen(false)}
          />
        )}

        {ui.phase === 'gameover' && (
          <GameOver ui={ui} result={result} onRetry={restartSameMap} onMenu={quitToMenu} />
        )}
      </div>

      {settingsOpen && settingsPanel}

      <BottomPanel
        ui={ui}
        seed={ui.seed}
        onSelectBuild={selectBuild}
        onSelectTower={selectTower}
        onUpgrade={upgrade}
        onEvolve={openEvolve}
        onSell={sellTower}
        onSendWave={sendWave}
        onSetTargeting={setTargeting}
      />
    </div>
  )
}
