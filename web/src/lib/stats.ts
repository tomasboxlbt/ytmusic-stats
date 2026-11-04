import type { Filters, Play } from './types'

export const DAY = 86_400_000
/** Si dos reproducciones están separadas por más de esto, se considera otra sesión. */
const SESSION_GAP = 30 * 60_000
/** Tope para estimar la duración de una reproducción a partir del hueco con la siguiente. */
const MAX_PLAY = 10 * 60_000
/** Duración asumida cuando no hay una reproducción posterior cercana. */
const DEFAULT_PLAY = 3.5 * 60_000

export function isMusic(p: Play): boolean {
  return p.fromMusicApp || p.isTopic
}

export function applyFilters(plays: Play[], f: Filters): Play[] {
  return plays.filter((p) => {
    if (f.source === 'music' && !isMusic(p)) return false
    if (f.source === 'ytmusic' && !p.fromMusicApp) return false
    if (f.from != null && p.t < f.from) return false
    if (f.to != null && p.t >= f.to) return false
    return true
  })
}

export interface ArtistStat {
  name: string
  plays: number
  songs: number
  ms: number
  first: number
  last: number
}

export interface SongStat {
  key: string
  title: string
  artist: string | null
  url: string | null
  plays: number
  first: number
  last: number
}

export interface Stats {
  plays: number
  uniqueSongs: number
  uniqueArtists: number
  listenMs: number
  activeDays: number
  spanDays: number
  first: Play | null
  last: Play | null
  artists: ArtistStat[]
  songs: SongStat[]
  /** clave yyyy-mm-dd local -> reproducciones */
  byDay: Map<string, number>
  /** [weekday 0=lunes][hour] */
  weekHour: number[][]
  byHour: number[]
  byWeekday: number[]
  topDay: { day: string; plays: number } | null
  longestStreak: { days: number; start: string; end: string }
  currentStreak: number
  sessions: number
  longestSession: { ms: number; plays: number; start: number } | null
  onRepeat: { song: SongStat; times: number; start: number } | null
  nightShare: number
  top10Share: number
  oneSongArtists: number
  newArtistsByMonth: { month: string; count: number }[]
  /** artistas por los que más se repite cada canción (plays / canciones) */
  deepCuts: ArtistStat[]
}

export function dayKey(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function monthKey(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function parseDay(k: string): number {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/** Duración estimada de cada reproducción (las plays deben venir ordenadas por tiempo). */
export function estimateDurations(plays: Play[]): number[] {
  return plays.map((p, i) => {
    const next = plays[i + 1]
    if (!next) return DEFAULT_PLAY
    const gap = next.t - p.t
    return gap > 0 && gap <= MAX_PLAY ? gap : DEFAULT_PLAY
  })
}

export function computeStats(plays: Play[]): Stats {
  const durations = plays.map((p) => p.ms)
  const artistMap = new Map<string, ArtistStat & { songSet: Set<string> }>()
  const songMap = new Map<string, SongStat>()
  const byDay = new Map<string, number>()
  const weekHour = Array.from({ length: 7 }, () => new Array(24).fill(0) as number[])
  const byHour = new Array(24).fill(0) as number[]
  const byWeekday = new Array(7).fill(0) as number[]
  const firstArtistMonth = new Map<string, string>()
  let listenMs = 0
  let night = 0

  plays.forEach((p, i) => {
    const ms = durations[i]
    listenMs += ms
    const d = new Date(p.t)
    const wd = (d.getDay() + 6) % 7
    const h = d.getHours()
    weekHour[wd][h]++
    byHour[h]++
    byWeekday[wd]++
    if (h < 6) night++
    const dk = dayKey(p.t)
    byDay.set(dk, (byDay.get(dk) ?? 0) + 1)

    let s = songMap.get(p.songKey)
    if (!s) songMap.set(p.songKey, (s = { key: p.songKey, title: p.title, artist: p.artist, url: p.url, plays: 0, first: p.t, last: p.t }))
    s.plays++
    s.last = p.t

    if (p.artist) {
      let a = artistMap.get(p.artist)
      if (!a) {
        artistMap.set(p.artist, (a = { name: p.artist, plays: 0, songs: 0, ms: 0, first: p.t, last: p.t, songSet: new Set() }))
        firstArtistMonth.set(p.artist, monthKey(p.t))
      }
      a.plays++
      a.ms += ms
      a.last = p.t
      a.songSet.add(p.songKey)
    }
  })

  const artists: ArtistStat[] = [...artistMap.values()]
    .map(({ songSet, ...a }) => ({ ...a, songs: songSet.size }))
    .sort((a, b) => b.plays - a.plays)
  const songs = [...songMap.values()].filter((s) => s.title !== 'Video no disponible').sort((a, b) => b.plays - a.plays)

  // Día récord
  let topDay: Stats['topDay'] = null
  for (const [day, n] of byDay) if (!topDay || n > topDay.plays) topDay = { day, plays: n }

  // Rachas de días consecutivos
  const days = [...byDay.keys()].sort()
  let longestStreak = { days: 0, start: '', end: '' }
  let run = 0
  let runStart = ''
  for (let i = 0; i < days.length; i++) {
    const consecutive = i > 0 && Math.round((parseDay(days[i]) - parseDay(days[i - 1])) / DAY) === 1
    run = consecutive ? run + 1 : 1
    if (!consecutive) runStart = days[i]
    if (run > longestStreak.days) longestStreak = { days: run, start: runStart, end: days[i] }
  }
  let currentStreak = 0
  if (days.length) {
    const lastDay = parseDay(days[days.length - 1])
    const today = parseDay(dayKey(Date.now()))
    if (Math.round((today - lastDay) / DAY) <= 1) {
      currentStreak = 1
      for (let i = days.length - 1; i > 0; i--) {
        if (Math.round((parseDay(days[i]) - parseDay(days[i - 1])) / DAY) === 1) currentStreak++
        else break
      }
    }
  }

  // Sesiones
  let sessions = 0
  let longestSession: Stats['longestSession'] = null
  let sStart = 0
  let sCount = 0
  let sMs = 0
  plays.forEach((p, i) => {
    if (i === 0 || p.t - plays[i - 1].t > SESSION_GAP) {
      sessions++
      sStart = p.t
      sCount = 0
      sMs = 0
    }
    sCount++
    sMs += durations[i]
    if (!longestSession || sMs > longestSession.ms) longestSession = { ms: sMs, plays: sCount, start: sStart }
  })

  // Canción en loop: más repeticiones seguidas
  let onRepeat: Stats['onRepeat'] = null
  let rep = 0
  let repStart = 0
  plays.forEach((p, i) => {
    if (i > 0 && plays[i - 1].songKey === p.songKey) rep++
    else { rep = 1; repStart = p.t }
    if (rep > 1 && (!onRepeat || rep > onRepeat.times)) {
      const song = songMap.get(p.songKey)!
      onRepeat = { song, times: rep, start: repStart }
    }
  })

  // Descubrimientos por mes
  const discovered = new Map<string, number>()
  for (const m of firstArtistMonth.values()) discovered.set(m, (discovered.get(m) ?? 0) + 1)
  const newArtistsByMonth = [...discovered].sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }))

  const top10 = artists.slice(0, 10).reduce((s, a) => s + a.plays, 0)
  const withArtist = artists.reduce((s, a) => s + a.plays, 0)

  const deepCuts = artists
    .filter((a) => a.plays >= 15)
    .sort((a, b) => b.plays / b.songs - a.plays / a.songs)
    .slice(0, 8)

  return {
    plays: plays.length,
    uniqueSongs: songs.length,
    uniqueArtists: artists.length,
    listenMs,
    activeDays: byDay.size,
    spanDays: plays.length ? Math.max(1, Math.round((plays[plays.length - 1].t - plays[0].t) / DAY) + 1) : 0,
    first: plays[0] ?? null,
    last: plays[plays.length - 1] ?? null,
    artists,
    songs,
    byDay,
    weekHour,
    byHour,
    byWeekday,
    topDay,
    longestStreak,
    currentStreak,
    sessions,
    longestSession,
    onRepeat,
    nightShare: plays.length ? night / plays.length : 0,
    top10Share: withArtist ? top10 / withArtist : 0,
    oneSongArtists: artists.filter((a) => a.songs === 1).length,
    newArtistsByMonth,
    deepCuts,
  }
}

export type Bucket = 'day' | 'week' | 'month'

/** Serie temporal continua (rellena los períodos sin reproducciones con 0). */
export function timeline(plays: Play[], bucket: Bucket): { start: number; label: string; plays: number }[] {
  if (!plays.length) return []
  const floor = (t: number) => {
    const d = new Date(t)
    if (bucket === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    if (bucket === 'week') day.setDate(day.getDate() - ((day.getDay() + 6) % 7))
    return day.getTime()
  }
  const step = (t: number) => {
    const d = new Date(t)
    if (bucket === 'month') return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (bucket === 'week' ? 7 : 1)).getTime()
  }
  const counts = new Map<number, number>()
  for (const p of plays) {
    const k = floor(p.t)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const out: { start: number; label: string; plays: number }[] = []
  const end = floor(plays[plays.length - 1].t)
  for (let t = floor(plays[0].t); t <= end; t = step(t)) {
    out.push({ start: t, label: formatBucket(t, bucket), plays: counts.get(t) ?? 0 })
  }
  return out
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function formatBucket(t: number, bucket: Bucket): string {
  const d = new Date(t)
  if (bucket === 'month') return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  const label = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  return bucket === 'week' ? `Semana del ${label}` : label
}

export function formatDate(t: number | string, withTime = false): string {
  const d = typeof t === 'string' ? new Date(parseDay(t)) : new Date(t)
  const s = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  return withTime ? `${s}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : s
}

export function formatMonth(k: string): string {
  const [y, m] = k.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

export function formatDuration(ms: number): string {
  const h = ms / 3_600_000
  if (h >= 48) return `${Math.round(h / 24).toLocaleString('es-AR')} días`
  if (h >= 1) return `${Math.round(h).toLocaleString('es-AR')} h`
  return `${Math.round(ms / 60_000)} min`
}

export function formatHours(ms: number): string {
  const h = ms / 3_600_000
  return h >= 10 ? `${Math.round(h).toLocaleString('es-AR')} h` : `${h.toFixed(1).replace('.', ',')} h`
}

export const nf = new Intl.NumberFormat('es-AR')
export const pct = (x: number) => `${Math.round(x * 100)}%`
