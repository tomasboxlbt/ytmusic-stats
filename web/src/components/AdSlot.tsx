import { useEffect, useRef, useSyncExternalStore } from 'react'

// Configuración por variables de entorno (ver .env.example). Sin client, no se muestra ningún anuncio.
const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined
const SLOTS = {
  left: import.meta.env.VITE_ADSENSE_SLOT_LEFT as string | undefined,
  right: import.meta.env.VITE_ADSENSE_SLOT_RIGHT as string | undefined,
  banner: import.meta.env.VITE_ADSENSE_SLOT_BANNER as string | undefined,
}
/** En desarrollo muestra recuadros grises en lugar de anuncios, para ver el layout. */
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

/**
 * Ancho mínimo para mostrar los laterales sin achicar el dashboard (1240 + 2×(160 + 24) + márgenes).
 * Por debajo se muestra un único banner horizontal.
 */
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

/** Pide el anuncio una sola vez por bloque (StrictMode monta los efectos dos veces). */
function useAdRequest(slot: string | undefined) {
  const ref = useRef<HTMLModElement>(null)
  useEffect(() => {
    if (!CLIENT || !slot || !ref.current) return
    if (ref.current.dataset.adsbygoogleStatus || ref.current.dataset.requested) return
    ref.current.dataset.requested = '1'
    loadScript()
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      /* bloqueador de anuncios u otro error: no rompe la app */
    }
  }, [slot])
  return ref
}

// Cada formato se monta solo cuando corresponde a la pantalla: pedir un anuncio en un
// contenedor oculto con CSS va contra las políticas de AdSense.

/** Bloque vertical 160×600 a un costado (pantallas anchas). */
export function AdRail({ side }: { side: 'left' | 'right' }) {
  return useWide() ? <AdRailInner side={side} /> : null
}

/** Banner horizontal responsive bajo el encabezado (celulares, tablets y pantallas medianas). */
export function AdBanner() {
  return useWide() ? null : <AdBannerInner />
}

function AdRailInner({ side }: { side: 'left' | 'right' }) {
  const slot = SLOTS[side]
  const ref = useAdRequest(slot)
  if (!CLIENT || !slot) {
    return PREVIEW ? <aside className="ad-rail"><div className="ad-preview">Anuncio 160×600</div></aside> : null
  }
  return (
    <aside className="ad-rail" aria-label="Publicidad">
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

function AdBannerInner() {
  const slot = SLOTS.banner
  const ref = useAdRequest(slot)
  if (!CLIENT || !slot) {
    return PREVIEW ? <aside className="ad-banner"><div className="ad-preview">Anuncio banner</div></aside> : null
  }
  return (
    <aside className="ad-banner" aria-label="Publicidad">
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format="horizontal"
        data-full-width-responsive="true"
      />
    </aside>
  )
}
