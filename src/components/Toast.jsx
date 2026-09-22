import styles from './Toast.module.css'

// Remounted by a changing `key` in App, so the CSS animation replays for each
// message. No state, no timers.
export default function Toast({ message }) {
  if (!message) return null
  return <div className={styles.toast}>{message}</div>
}
