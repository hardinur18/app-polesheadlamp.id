import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import { ErrorBoundary } from './app/components/ErrorBoundary'
import { registerPwaUpdateService } from './app/services/pwaUpdateService'
import {
  DOM_MUTATION_RELOAD_MARKER,
  STALE_CHUNK_RELOAD_MARKER,
  installReactDomMutationGuard,
  isReactDomRemovalError,
  reloadOnce,
} from './app/errors/recoverableErrors'
import './styles/theme.css'
import './styles/fonts.css'
import './styles/globals.css'
import './styles/foundation.css'

if (typeof window !== 'undefined') {
  const hostname = window.location.hostname
  const isLocalDev =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0'
  const themeResetMarker = 'rhi-system-theme-reset-v1'

  installReactDomMutationGuard()

  document.documentElement.classList.add('notranslate')
  document.documentElement.setAttribute('translate', 'no')
  document.body.classList.add('notranslate')
  document.body.setAttribute('translate', 'no')
  document.getElementById('root')?.setAttribute('translate', 'no')

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    reloadOnce(STALE_CHUNK_RELOAD_MARKER)
  })

  window.addEventListener('error', (event) => {
    if (!isReactDomRemovalError(event.error || event.message)) return

    event.preventDefault()
    reloadOnce(DOM_MUTATION_RELOAD_MARKER)
  })

  window.addEventListener('unhandledrejection', (event) => {
    if (!isReactDomRemovalError(event.reason)) return

    event.preventDefault()
    reloadOnce(DOM_MUTATION_RELOAD_MARKER)
  })

  if (isLocalDev && 'serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister()
      })
    })
  }

  if (isLocalDev && 'caches' in window) {
    void window.caches.keys().then((keys) => {
      keys.forEach((key) => {
        void window.caches.delete(key)
      })
    })
  }

  if (!isLocalDev && import.meta.env.PROD) {
    registerPwaUpdateService()
  }

  if (isLocalDev && !window.localStorage.getItem(themeResetMarker)) {
    window.localStorage.removeItem('theme')
    window.localStorage.removeItem('rhi-system-theme')
    window.localStorage.setItem(themeResetMarker, 'done')
    document.documentElement.classList.remove('dark')
    document.body.classList.remove('dark')
    document.documentElement.style.colorScheme = 'light'
    document.body.style.colorScheme = 'light'
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
