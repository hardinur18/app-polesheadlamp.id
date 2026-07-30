import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import { ErrorBoundary } from './app/components/ErrorBoundary'
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
