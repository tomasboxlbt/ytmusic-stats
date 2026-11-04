import { useEffect, useRef, useSyncExternalStore } from 'react'

// Configuración por variables de entorno (ver .env.example). Sin client, no se muestra ningún anuncio.
const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined
const SLOTS = {
  left: import.meta.env.VITE_ADSENSE_SLOT_LEFT as string | undefined,
  right: import.meta.env.VITE_ADSENSE_SLOT_RIGHT as string | undefined,
}
/** En desarrollo muestra un recuadro gris en lugar del anuncio, para ver el layout. */
const PREVIEW = import.meta.env.VITE_ADSENSE_PREVIEW === 'true'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

let scriptLoaded = false
function loadScript() {
  if (scriptLoaded || !CLIENT) return
  scriptLoaded = true
  const s = document.createElement('script')
  s.async = true
  s.crossOrigin = 'anonymous'
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CLIENT)}`
  document.head.appendChild(s)
}

/** Ancho mínimo para mostrar los laterales sin achicar el dashboard (1240 + 2×(160 + 24) + márgenes). */
const WIDE = '(min-width: 1640px)'
function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(WIDE)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(WIDE).matches,
  )
}

/**
 * Los anuncios solo se montan cuando hay lugar: pedir un anuncio en un contenedor oculto
 * va contra las políticas de AdSense.
 */
export function AdRail({ side }: { side: 'left' | 'right' }) {
  const wide = useWide()
  return wide ? <AdRailInner side={side} /> : null
}

/** Bloque vertical (160×600 "skyscraper") que se queda fijo al hacer scroll. */
function AdRailInner({ side }: { side: 'left' | 'right' }) {
  const ref = useRef<HTMLModElement>(null)
  const slot = SLOTS[side]

  useEffect(() => {
    if (!CLIENT || !slot || !ref.current) return
    // Evita pedir dos veces el mismo bloque (StrictMode monta los efectos dos veces).
    if (ref.current.dataset.adsbygoogleStatus || ref.current.dataset.requested) return
    ref.current.dataset.requested = '1'
    loadScript()
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      /* bloqueador de anuncios u otro error: no rompe la app */
    }
  }, [slot])

  if (!CLIENT || !slot) {
    return PREVIEW ? <aside className={`ad-rail ad-${side}`}><div className="ad-preview">Anuncio 160×600</div></aside> : null
  }

  return (
    <aside className={`ad-rail ad-${side}`} aria-label="Publicidad">
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block', width: 160, height: 600 }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
      />
    </aside>
  )
}
