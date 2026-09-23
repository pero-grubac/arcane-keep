import { useId, useRef } from 'react'
import RunReport from './RunReport.jsx'
import { useDialog } from './useDialog.js'
import styles from './App.module.css'

export default function GameOver({ ui, result, onRetry, onMenu }) {
  const ref = useRef(null)
  const titleId = useId()
  // No Escape-to-close: the run is over, and the choices are the two buttons.
  useDialog(ref, null)

  return (
    <div className={styles.gameoverOverlay}>
      <div
        ref={ref}
        className={styles.gameoverBox}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className={styles.gameoverTitle}>Fortress Fallen</h2>
        <div className={styles.gameoverStats}>
          <span>Reached wave <b>{ui.wave}</b></span>
          <span aria-hidden="true">·</span>
          <span><b>{ui.kills}</b> kills</span>
          <span aria-hidden="true">·</span>
          <span><b>{ui.towers.length}</b> towers</span>
        </div>
        {result?.isBestWave && (
          <div className={styles.newBest}>★ New best on this map</div>
        )}
        {result && !result.isBestWave && (
          <div className={styles.prevBest}>
            Best on this map: wave {result.record.bestWave} · {result.record.runs} runs
          </div>
        )}
        {result?.isBestDaily && ui.dailyKey && (
          <div className={styles.newBest}>★ New daily best</div>
        )}
        <RunReport report={ui.report} />
        <div className={styles.gameoverBtns}>
          <button className={styles.restartBtn} onClick={onRetry} data-autofocus>
            Retry Map
          </button>
          <button className={styles.ghostBtn} onClick={onMenu}>
            Choose Map
          </button>
        </div>
      </div>
    </div>
  )
}
