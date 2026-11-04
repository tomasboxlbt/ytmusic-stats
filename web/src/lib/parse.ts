import type { Play, RawEntry } from './types'
import { estimateDurations } from './stats'

const TITLE_PREFIXES = ['Has visto ', 'Viste ', 'Watched ', 'Assistiu a ', 'Hai guardato ', 'Vous avez regardé ']

function stripPrefix(title: string): string {
  for (const p of TITLE_PREFIXES) if (title.startsWith(p)) return title.slice(p.length)
  return title
}

function videoIdFrom(url?: string): string | null {
  if (!url) return null
  const m = url.match(/[?&]v(?:=|\\u003d)([\w-]{6,})/)
  return m ? m[1] : null
}

/** Clave para comparar nombres de artistas: sin tildes, mayúsculas, espacios ni signos. */
export function looseKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** Limpia el nombre del canal para obtener un nombre de artista razonable. */
function cleanArtist(channel: string): { name: string; isTopic: boolean } {
  let name = channel.trim()
  const isTopic = / - (Topic|Tema)$/.test(name)
  if (isTopic) return { name: name.replace(/ - (Topic|Tema)$/, ''), isTopic }
  if (/VEVO$/i.test(name) && name.length > 4) {
    // "SeruGiranVEVO" -> "Seru Giran"
    name = name.replace(/VEVO$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim()
  }
  name = name.replace(/\s+(Oficial|Official|Official Channel|Canal Oficial)$/i, '').trim()
  return { name, isTopic }
}

export interface ParseResult {
  plays: Play[]
  skipped: number
  total: number
}

export function parseHistory(raw: unknown): ParseResult {
  if (!Array.isArray(raw)) throw new Error('El archivo no parece un historial de YouTube (se esperaba un array JSON).')
  const entries = raw as RawEntry[]
  const plays: Play[] = []
  let skipped = 0

  for (const e of entries) {
    if (!e || typeof e.title !== 'string' || !e.time) { skipped++; continue }
    // Anuncios y otras actividades que no son reproducciones
    if (e.details?.some((d) => /anuncios|ads/i.test(d.name ?? ''))) { skipped++; continue }
    if (!e.titleUrl) { skipped++; continue }
    const t = Date.parse(e.time)
    if (Number.isNaN(t)) { skipped++; continue }

    let title = stripPrefix(e.title)
    const removed = /^https?:\/\//.test(title)
    if (removed) title = 'Video no disponible'

    const channel = e.subtitles?.[0]?.name
    const { name: artist, isTopic } = channel ? cleanArtist(channel) : { name: null, isTopic: false }
    const videoId = videoIdFrom(e.titleUrl)

    plays.push({
      t,
      title,
      artist,
      videoId,
      url: e.titleUrl.replace('\\u003d', '='),
      fromMusicApp: e.header === 'YouTube Music',
      isTopic,
      ms: 0,
      songKey: '',
    })
  }

  unifyArtists(plays)
  for (const p of plays) {
    p.songKey = p.artist ? `${looseKey(p.artist)}|${looseKey(cleanTitle(p.title))}` : `?|${p.videoId ?? p.title}`
  }
  unifyTitles(plays)
  plays.sort((a, b) => a.t - b.t)
  // Se estima sobre el historial completo para que el valor no cambie según el filtro.
  estimateDurations(plays).forEach((ms, i) => (plays[i].ms = ms))
  return { plays, skipped, total: entries.length }
}

const NOISE = /\s*[([](?:[^)\]]*\b(?:official|oficial|video|audio|lyrics?|letra|visualizer|hd|4k|remaster(?:ed)?|remasterizad[oa]|remasterizaci[oó]n)\b[^)\]]*)[)\]]/gi

/** Quita "(Official Video)", "[Lyrics]", etc. para agrupar versiones de la misma canción. */
function cleanTitle(title: string): string {
  const c = title.replace(NOISE, '').trim()
  return c || title
}

/** Para cada canción usa como título visible la variante más frecuente. */
function unifyTitles(plays: Play[]) {
  const counts = new Map<string, Map<string, number>>()
  for (const p of plays) {
    let m = counts.get(p.songKey)
    if (!m) counts.set(p.songKey, (m = new Map()))
    m.set(p.title, (m.get(p.title) ?? 0) + 1)
  }
  const best = new Map<string, string>()
  for (const [k, m] of counts) best.set(k, [...m].sort((a, b) => b[1] - a[1])[0][0])
  for (const p of plays) p.title = best.get(p.songKey) ?? p.title
}

/**
 * Unifica variantes del mismo artista ("Andrés Calamaro" y "AndresCalamaroVEVO"),
 * prefiriendo el nombre del canal Topic y, si no, el más frecuente.
 */
function unifyArtists(plays: Play[]) {
  const variants = new Map<string, Map<string, { n: number; topic: boolean }>>()
  for (const p of plays) {
    if (!p.artist) continue
    const k = looseKey(p.artist)
    if (!k) continue
    let m = variants.get(k)
    if (!m) variants.set(k, (m = new Map()))
    const v = m.get(p.artist) ?? { n: 0, topic: false }
    v.n++
    v.topic ||= p.isTopic
    m.set(p.artist, v)
  }
  const canonical = new Map<string, string>()
  for (const [k, m] of variants) {
    let best = ''
    let score = -1
    for (const [name, v] of m) {
      const s = v.n + (v.topic ? 1e9 : 0)
      if (s > score) { score = s; best = name }
    }
    canonical.set(k, best)
  }
  for (const p of plays) if (p.artist) p.artist = canonical.get(looseKey(p.artist)) ?? p.artist
}
