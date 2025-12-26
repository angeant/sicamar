'use client'

import { useState, useEffect } from 'react'

/**
 * Detecta si el usuario está en un WebView (WhatsApp, Instagram, Facebook, etc.)
 * Estos navegadores embebidos no comparten cookies con el navegador principal.
 */
export function useIsWebView() {
  const [isWebView, setIsWebView] = useState(false)
  const [webViewType, setWebViewType] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const ua = navigator.userAgent || navigator.vendor || ''
    
    // Detectar WebViews comunes
    const webViews = [
      { name: 'WhatsApp', pattern: /WhatsApp/i },
      { name: 'Instagram', pattern: /Instagram/i },
      { name: 'Facebook', pattern: /FBAN|FBAV|FB_IAB/i },
      { name: 'Twitter', pattern: /Twitter/i },
      { name: 'LinkedIn', pattern: /LinkedInApp/i },
      { name: 'Telegram', pattern: /Telegram/i },
      { name: 'Line', pattern: /Line\//i },
      { name: 'Snapchat', pattern: /Snapchat/i },
      // iOS WebView genérico
      { name: 'iOS WebView', pattern: /\(iPhone.*AppleWebKit(?!.*Safari)/i },
      // Android WebView genérico
      { name: 'Android WebView', pattern: /wv\)|\.wv\b/i },
    ]

    for (const wv of webViews) {
      if (wv.pattern.test(ua)) {
        setIsWebView(true)
        setWebViewType(wv.name)
        return
      }
    }

    setIsWebView(false)
    setWebViewType(null)
  }, [])

  return { isWebView, webViewType }
}

interface WebViewWarningProps {
  className?: string
}

/**
 * Componente que muestra una advertencia cuando se detecta un WebView
 * con instrucciones para abrir en el navegador real.
 */
export function WebViewWarning({ className = '' }: WebViewWarningProps) {
  const { isWebView, webViewType } = useIsWebView()
  const [currentUrl, setCurrentUrl] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href)
    }
  }, [])

  if (!isWebView) return null

  const handleOpenInBrowser = () => {
    // Intentar abrir en navegador externo
    // En iOS, window.open con _system puede funcionar
    // En Android, algunos WebViews respetan intent://
    
    const url = currentUrl
    
    // Intentar con intent:// para Android
    if (navigator.userAgent.includes('Android')) {
      window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`
      return
    }
    
    // Para iOS, copiar al clipboard y mostrar instrucciones
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
    }
  }

  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
          <span className="text-amber-600 text-lg">⚠️</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800 mb-1">
            Navegador limitado detectado
          </p>
          <p className="text-xs text-amber-700 mb-3">
            Estás usando el navegador de {webViewType || 'una app'}. 
            Para acceder correctamente, abrí este link en Safari o Chrome.
          </p>
          
          <div className="space-y-2">
            {/* Instrucciones */}
            <div className="text-[11px] text-amber-600 space-y-1">
              <p>📱 <strong>En iPhone:</strong> Tocá los 3 puntos (...) → &quot;Abrir en Safari&quot;</p>
              <p>📱 <strong>En Android:</strong> Tocá los 3 puntos → &quot;Abrir en Chrome&quot;</p>
            </div>
            
            {/* Botón para copiar URL */}
            <button
              onClick={handleOpenInBrowser}
              className="w-full mt-2 py-2 px-3 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-medium rounded transition-colors"
            >
              Copiar link para abrir en navegador
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


