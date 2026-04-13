'use client'

import { useState, useEffect, useRef } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'food-radar-no-install'

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [isIOSDevice, setIsIOSDevice] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Already installed or dismissed
    if (isStandalone()) return
    if (localStorage.getItem(DISMISS_KEY)) return

    const ios = isIOS()
    setIsIOSDevice(ios)

    if (ios) {
      // iOS: no beforeinstallprompt, show manual guide after short delay
      const timer = setTimeout(() => setShow(true), 2000)
      return () => clearTimeout(timer)
    }

    // Android/Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setTimeout(() => setShow(true), 1500)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt()
      const { outcome } = await deferredPrompt.current.userChoice
      if (outcome === 'accepted') {
        setShow(false)
      }
      deferredPrompt.current = null
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up">
      <div className="max-w-md mx-auto rounded-2xl p-4 shadow-xl border" style={{ background: '#f6f3ef', borderColor: '#e8e2d9', boxShadow: '0 8px 32px rgba(61,53,41,0.15)' }}>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center overflow-hidden border border-white/80 shadow-sm" style={{ background: 'linear-gradient(135deg, #b8734a, #c9956e)' }}>
            <svg width="28" height="28" viewBox="0 0 512 512" fill="none">
              <path d="M256,256 m-180,0 a180,180 0 1,1 360,0" stroke="white" strokeWidth="32" strokeLinecap="round" opacity="0.35"/>
              <path d="M256,256 m-120,0 a120,120 0 1,1 240,0" stroke="white" strokeWidth="32" strokeLinecap="round" opacity="0.55"/>
              <path d="M256,256 m-60,0 a60,60 0 1,1 120,0" stroke="white" strokeWidth="32" strokeLinecap="round" opacity="0.75"/>
              <circle cx="256" cy="260" r="35" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm mb-0.5" style={{ color: '#3d3529' }}>加入主畫面</h3>
            {isIOSDevice ? (
              <p className="text-[11px] leading-relaxed" style={{ color: '#8a7e6e' }}>
                點下方
                <span className="inline-flex items-center mx-0.5">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#b8734a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                </span>
                分享 → 「加入主畫面」，像 App 一樣快速開啟
              </p>
            ) : (
              <p className="text-[11px] leading-relaxed" style={{ color: '#8a7e6e' }}>
                加到主畫面，像 App 一樣快速開啟外送雷達
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          {!isIOSDevice && (
            <button
              onClick={handleInstall}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #b8734a, #c9956e)', boxShadow: '0 2px 8px rgba(184,115,74,0.25)' }}
            >
              立即加入
            </button>
          )}
          <button
            onClick={handleDismiss}
            className={`py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-95 ${isIOSDevice ? 'flex-1' : ''}`}
            style={isIOSDevice
              ? { background: '#e8e2d9', color: '#8a7e6e', minWidth: '100%' }
              : { background: '#e8e2d9', color: '#8a7e6e', minWidth: '5rem' }
            }
          >
            不再提醒
          </button>
        </div>
      </div>
    </div>
  )
}
