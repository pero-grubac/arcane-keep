import { useId, useRef } from 'react'
import { useDialog } from './useDialog.js'
import styles from './App.module.css'

// Shown once a replay has run out of recorded actions: the keep fell, or the
// player quit and there is nothing more to show.
export default function ReplayEnd({ ui, onWatchAgain, onPlayMap, onShare, onMenu }) {
  const ref = useRef(null)
  const titleId = useId()
  useDialog(ref, null)
  const fell = ui.phase === 'gameover'

  return (
    <div className={styles.gameoverOverlay}>
      <div
        ref={ref}
        className={styles.gameoverBox}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className={`${styles.gameoverTitle} ${styles.replayTitle}`}>
          {fell ? 'Replay finished' : 'End of recording'}
        </h2>
        <div className={styles.gameoverStats}>
          <span>{fell ? 'Fell on' : 'Stopped at'} wave <b>{ui.wave}</b></span>
          <span aria-hidden="true">·</span>
          <span><b>{ui.kills}</b> kills</span>
        </div>
        {ui.replay.desync && (
          <div className={styles.prevBest}>
            Some recorded actions no longer fit this version of the game, so the
            replay drifted from the original run.
          </div>
        )}
        <div className={styles.gameoverBtns}>
          <button className={styles.restartBtn} onClick={onPlayMap} data-autofocus>
            Play this map
          </button>
          <button className={styles.ghostBtn} onClick={onWatchAgain}>Watch again</button>
        </div>
        <div className={styles.gameoverBtns}>
          <button className={styles.ghostBtn} onClick={onShare}>🔗 Copy link</button>
          <button className={styles.ghostBtn} onClick={onMenu}>Menu</button>
        </div>
      </div>
    </div>
  )
}
