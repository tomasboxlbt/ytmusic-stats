/** Entrada cruda del export de Google Takeout (historial de reproducciones). */
export interface RawEntry {
  header?: string
  title?: string
  titleUrl?: string
  subtitles?: { name?: string; url?: string }[]
  time?: string
  products?: string[]
  details?: { name?: string }[]
}

export type Source = 'music' | 'youtube'

/** Reproducción normalizada. */
export interface Play {
  /** epoch ms */
  t: number
  title: string
  artist: string | null
  videoId: string | null
  url: string | null
  /** header === "YouTube Music" */
  fromMusicApp: boolean
  /** canal autogenerado "Artista - Topic" */
  isTopic: boolean
  /** duración estimada en ms (hueco hasta la siguiente reproducción, con tope) */
  ms: number
  /** clave canónica de canción (artista + título) */
  songKey: string
}

export type SourceFilter = 'music' | 'ytmusic' | 'all'

export interface Filters {
  source: SourceFilter
  from: number | null
  to: number | null
}
