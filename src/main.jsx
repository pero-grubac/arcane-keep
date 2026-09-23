import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './components/App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Offline play. Only in production builds: in dev the worker would cache Vite's
// unbundled modules and serve stale code over hot reload. The path is relative
// so it resolves under the Pages subpath as well as at a domain root.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline is optional */ })
  })
}
