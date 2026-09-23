import styles from './HUD.module.css'

export default function HUD({
  gold, lives, wave, kills, gameSpeed, paused, phase,
  enemiesLeft, waveActive, modifier, soundOn, dailyKey, replay,
  onSpeedToggle, onPauseToggle, onSoundToggle, onQuit, onOpenSettings,
}) {
  return (
    <div className={styles.hud}>
      <span className={styles.title}>⚔ ARCANE KEEP</span>
      {replay && (
        <span className={styles.daily} title="Watching a recorded run">
          ▶ REPLAY {replay.applied}/{replay.total}
        </span>
      )}
      {dailyKey && !replay && (
        <span className={styles.daily} title={`Daily challenge ${dailyKey}`}>☀ DAILY</span>
      )}

      <Stat icon="💰" value={gold} title="Gold" />
      <Stat icon="❤️" value={lives} warn={lives <= 5} title="Lives" />
      <Stat icon="🌊" value={wave} title="Wave" />
      <Stat icon="💀" value={kills} title="Kills" />
      {waveActive && <Stat icon="👹" value={enemiesLeft} title="Enemies remaining" />}

      {modifier && waveActive && (
        <span className={styles.modifier} title={modifier.desc}>
          {modifier.icon} {modifier.name}
        </span>
      )}
      {phase === 'gameover' && <span className={styles.gameover}>— FORTRESS FALLEN —</span>}

      <div className={styles.right}>
        <button
          className={`${styles.btn} ${paused ? styles.active : ''}`}
          onClick={onPauseToggle}
          title="Pause (space)"
          aria-label={paused ? 'Resume' : 'Pause'}
          aria-pressed={paused}
          disabled={phase !== 'playing'}
        >
          {paused ? '▶' : '⏸'}
        </button>
        <button
          className={`${styles.btn} ${gameSpeed > 1 ? styles.fast : ''} ${gameSpeed === 4 ? styles.faster : ''}`}
          onClick={onSpeedToggle}
          title="Game speed (F)"
          aria-label={`Game speed ${gameSpeed}×`}
        >
          ▶ {gameSpeed}×
        </button>
        <button
          className={`${styles.btn} ${soundOn ? '' : styles.muted}`}
          onClick={onSoundToggle}
          title="Sound (M)"
          aria-label="Sound"
          aria-pressed={soundOn}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
        <button
          className={styles.btn}
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
        >
          ⚙
        </button>
        <button
          className={styles.btn}
          onClick={onQuit}
          title="Back to map select"
          aria-label="Back to map select"
        >
          ⌂
        </button>
      </div>
    </div>
  )
}

function Stat({ icon, value, warn, title }) {
  return (
    <div
      className={`${styles.stat} ${warn ? styles.warn : ''}`}
      title={title}
      aria-label={`${title}: ${value}`}
    >
      <span aria-hidden="true">{icon}</span>
      <b>{value}</b>
    </div>
  )
}
