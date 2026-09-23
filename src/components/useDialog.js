import { useEffect } from 'react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

// Modal behaviour for an overlay: focus moves into it on open, Tab cycles
// inside it rather than escaping to the board behind, Escape closes it, and
// focus goes back to whatever opened it once it closes.
export function useDialog(ref, onClose) {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const opener = document.activeElement
    const items = () => [...root.querySelectorAll(FOCUSABLE)]
    ;(root.querySelector('[data-autofocus]') ?? items()[0])?.focus()

    const onKey = (ev) => {
      if (ev.key === 'Escape' && onClose) {
        ev.stopPropagation()
        onClose()
        return
      }
      if (ev.key !== 'Tab') return
      const list = items()
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      // Handled here so the game's own Tab shortcut never sees it.
      ev.stopPropagation()
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault()
        last.focus()
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault()
        first.focus()
      }
    }
    root.addEventListener('keydown', onKey)
    return () => {
      root.removeEventListener('keydown', onKey)
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [ref, onClose])
}
