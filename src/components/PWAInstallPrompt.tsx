import { useEffect, useState } from 'react'

const DISMISS_KEY = 'pwa-install-dismissed'
const DISMISS_DAYS = 7

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}

function isMobileDevice() {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.matchMedia('(max-width: 768px)').matches
}

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export default function PWAInstallPrompt() {
  const [visible, setVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<{ prompt: () => Promise<{ outcome: string }> } | null>(null)
  const [isIOSDevice, setIsIOSDevice] = useState(false)
  const [installHint, setInstallHint] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    if (!isMobileDevice()) return

    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed) {
      const t = parseInt(dismissed, 10)
      if (Date.now() - t < DISMISS_DAYS * 24 * 60 * 60 * 1000) return
    }

    setIsIOSDevice(isIOS())

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as unknown as { prompt: () => Promise<{ outcome: string }> })
    }
    window.addEventListener('beforeinstallprompt', handler)

    const timer = setTimeout(() => setVisible(true), 1500)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      clearTimeout(timer)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      setVisible(false)
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
      return
    }
    setInstallHint(true)
    setTimeout(() => setInstallHint(false), 5000)
  }

  const handleDismiss = () => {
    setVisible(false)
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-pb px-4 pb-4 pt-2 bg-gradient-to-t from-slate-900 to-slate-900/95 border-t border-slate-700 shadow-lg">
      <div className="max-w-md mx-auto">
        {installHint && !deferredPrompt && (
          <p className="text-xs text-amber-300 mb-2">
            Use your browser menu (⋮ or ⋯) → &quot;Install app&quot; or &quot;Add to Home screen&quot;. Or browse a bit longer and try Install again.
          </p>
        )}
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">Install The Patch</p>
            {isIOSDevice ? (
              <p className="text-xs text-slate-400 mt-0.5">Tap Share in Safari, then &quot;Add to Home Screen&quot;</p>
            ) : (
              <p className="text-xs text-slate-400 mt-0.5">Add to your home screen for quick access</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isIOSDevice && (
              <button
                type="button"
                onClick={handleInstall}
                className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-500"
              >
                Install
              </button>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
