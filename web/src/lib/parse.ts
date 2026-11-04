import type { HistoryKind, Play, RawEntry, SpotifyBasicEntry, SpotifyExtendedEntry } from './types'
import { estimateDurations } from './stats'

/** Spotify solo cuenta una reproducción si duró al menos 30 segundos. */
export const MIN_SPOTIFY_MS = 30_000

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

/** Clave para comparar nombres: sin tildes, mayúsculas, espacios ni signos. */
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
  kind: HistoryKind
  plays: Play[]
  /** entradas descartadas (anuncios, podcasts, reproducciones de menos de 30 s, etc.) */
  skipped: number
  total: number
}

function basePlay(p: Partial<Play> & Pick<Play, 't' | 'title' | 'artist' | 'platform'>): Play {
  return { videoId: null, url: null, fromMusicApp: false, isTopic: false, ms: 0, songKey: '', ...p }
}

/** Detecta el formato mirando las primeras entradas del array. */
export function detectKind(raw: unknown): HistoryKind | null {
  if (!Array.isArray(raw)) return null
  for (const e of raw.slice(0, 20)) {
    if (!e || typeof e !== 'object') continue
    if ('ts' in e && 'ms_played' in e) return 'spotify-extended'
    if ('endTime' in e && 'msPlayed' in e) return 'episodeName' in e || 'podcastName' in e ? 'spotify-podcast' : 'spotify'
    if ('header' in e || 'titleUrl' in e) return 'youtube'
  }
  return null
}

/** Parsea un archivo de cualquiera de los formatos soportados (sin unificar ni ordenar). */
export function parseFile(raw: unknown): ParseResult {
  const kind = detectKind(raw)
  if (!kind) {
    throw new Error(
      'No reconozco el formato. Se aceptan el historial de YouTube de Google Takeout (JSON) y el historial de Spotify (StreamingHistory*.json o Streaming_History_Audio_*.json).',
    )
  }
  const entries = raw as unknown[]
  if (kind === 'spotify-podcast') return { kind, plays: [], skipped: entries.length, total: entries.length }
  const plays =
    kind === 'youtube' ? parseYouTube(entries as RawEntry[])
    : kind === 'spotify' ? parseSpotifyBasic(entries as SpotifyBasicEntry[])
    : parseSpotifyExtended(entries as SpotifyExtendedEntry[])
  return { kind, plays, skipped: entries.length - plays.length, total: entries.length }
}

function parseYouTube(entries: RawEntry[]): Play[] {
  const plays: Play[] = []
  for (const e of entries) {
    if (!e || typeof e.title !== 'string' || !e.time || !e.titleUrl) continue
    // Anuncios y otras actividades que no son reproducciones
    if (e.details?.some((d) => /anuncios|ads/i.test(d.name ?? ''))) continue
    const t = Date.parse(e.time)
    if (Number.isNaN(t)) continue

    let title = stripPrefix(e.title)
    if (/^https?:\/\//.test(title)) title = 'Video no disponible'

    const channel = e.subtitles?.[0]?.name
    const { name: artist, isTopic } = channel ? cleanArtist(channel) : { name: null, isTopic: false }

    plays.push(
      basePlay({
        platform: 'youtube',
        t,
        title,
        artist,
        videoId: videoIdFrom(e.titleUrl),
        url: e.titleUrl.replace('\\u003d', '='),
        fromMusicApp: e.header === 'YouTube Music',
        isTopic,
      }),
    )
  }
  return plays
}

/** "Datos de la cuenta": endTime está en UTC con formato "2024-01-31 23:59" y marca el FIN de la escucha. */
function parseSpotifyBasic(entries: SpotifyBasicEntry[]): Play[] {
  const plays: Play[] = []
  for (const e of entries) {
    if (!e?.trackName || !e.endTime || typeof e.msPlayed !== 'number') continue
    if (e.msPlayed < MIN_SPOTIFY_MS) continue
    const end = Date.parse(e.endTime.replace(' ', 'T') + (e.endTime.length <= 16 ? ':00Z' : 'Z'))
    if (Number.isNaN(end)) continue
    plays.push(
      basePlay({
        platform: 'spotify',
        t: end - e.msPlayed,
        title: e.trackName,
        artist: e.artistName?.trim() || null,
        ms: e.msPlayed,
      }),
    )
  }
  return plays
}

/** "Historial de reproducción ampliado": ts (UTC, ISO) también marca el fin de la escucha. */
function parseSpotifyExtended(entries: SpotifyExtendedEntry[]): Play[] {
  const plays: Play[] = []
  for (const e of entries) {
    // Podcasts, audiolibros y pistas locales sin metadatos no tienen nombre de canción
    if (!e?.master_metadata_track_name || !e.ts || typeof e.ms_played !== 'number') continue
    if (e.ms_played < MIN_SPOTIFY_MS) continue
    const end = Date.parse(e.ts)
    if (Number.isNaN(end)) continue
    const id = e.spotify_track_uri?.startsWith('spotify:track:') ? e.spotify_track_uri.slice(14) : null
    plays.push(
      basePlay({
        platform: 'spotify',
        t: end - e.ms_played,
        title: e.master_metadata_track_name,
        artist: e.master_metadata_album_artist_name?.trim() || null,
        url: id ? `https://open.spotify.com/track/${id}` : null,
        ms: e.ms_played,
      }),
    )
  }
  return plays
}

/**
 * Une reproducciones de uno o varios archivos: elimina duplicados (mismo archivo cargado dos veces),
 * unifica artistas y canciones entre plataformas, ordena y estima la duración de lo de YouTube.
 */
export function finalize(all: Play[]): Play[] {
  const seen = new Set<string>()
  const plays: Play[] = []
  for (const p of all) {
    const k = `${p.platform}|${Math.round(p.t / 1000)}|${p.videoId ?? p.title}`
    if (seen.has(k)) continue
    seen.add(k)
    plays.push(p)
  }

  unifyArtists(plays)
  for (const p of plays) {
    p.songKey = p.artist ? `${looseKey(p.artist)}|${looseKey(cleanTitle(p.title)) || p.title}` : `?|${p.videoId ?? p.title}`
  }
  unifyTitles(plays)
  plays.sort((a, b) => a.t - b.t)

  // YouTube no informa duración: se estima con el hueco entre reproducciones de YouTube
  // (sobre el historial completo, para que el valor no cambie según el filtro).
  const yt = plays.filter((p) => p.platform === 'youtube')
  estimateDurations(yt).forEach((ms, i) => (yt[i].ms = ms))
  return plays
}

const NOISE = /\s*[([](?:[^)\]]*\b(?:official|oficial|video|audio|lyrics?|letra|visualizer|hd|4k|remaster(?:ed)?|remasterizad[oa]|remasterizaci[oó]n)\b[^)\]]*)[)\]]/gi
/** Sufijos estilo Spotify: "Canción - Remastered 2011", "Canción - 2019 Remaster" */
const DASH_NOISE = /\s+-\s+(?:[^-]*\b(?:remaster(?:ed)?|remasterizad[oa]|remasterizaci[oó]n|mono|stereo|single version|radio edit)\b[^-]*)$/i

/** Quita "(Official Video)", "[Lyrics]", " - Remastered 2011", etc. para agrupar versiones de la misma canción. */
function cleanTitle(title: string): string {
  const c = title.replace(NOISE, '').replace(DASH_NOISE, '').trim()
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
 * Unifica variantes del mismo artista ("Andrés Calamaro", "AndresCalamaroVEVO", "Andres Calamaro"),
 * prefiriendo nombres "oficiales" (canal Topic o Spotify) y, si no, el más frecuente.
 */
function unifyArtists(plays: Play[]) {
  const variants = new Map<string, Map<string, { n: number; official: boolean }>>()
  for (const p of plays) {
    if (!p.artist) continue
    const k = looseKey(p.artist)
    if (!k) continue
    let m = variants.get(k)
    if (!m) variants.set(k, (m = new Map()))
    const v = m.get(p.artist) ?? { n: 0, official: false }
    v.n++
    v.official ||= p.isTopic || p.platform === 'spotify'
    m.set(p.artist, v)
  }
  const canonical = new Map<string, string>()
  for (const [k, m] of variants) {
    let best = ''
    let score = -1
    for (const [name, v] of m) {
      const s = v.n + (v.official ? 1e9 : 0)
      if (s > score) { score = s; best = name }
    }
    canonical.set(k, best)
  }
  for (const p of plays) if (p.artist) p.artist = canonical.get(looseKey(p.artist)) ?? p.artist
}
