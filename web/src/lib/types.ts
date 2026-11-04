/** Entrada cruda del export de Google Takeout (historial de reproducciones de YouTube). */
export interface RawEntry {
  header?: string
  title?: string
  titleUrl?: string
  subtitles?: { name?: string; url?: string }[]
  time?: string
  products?: string[]
  details?: { name?: string }[]
}

/** Spotify, "Datos de la cuenta": StreamingHistory_music_N.json */
export interface SpotifyBasicEntry {
  endTime?: string
  artistName?: string
  trackName?: string
  msPlayed?: number
}

/** Spotify, "Historial de reproducción ampliado": Streaming_History_Audio_*.json */
export interface SpotifyExtendedEntry {
  ts?: string
  ms_played?: number
  master_metadata_track_name?: string | null
  master_metadata_album_artist_name?: string | null
  master_metadata_album_album_name?: string | null
  spotify_track_uri?: string | null
  skipped?: boolean | null
}

export type HistoryKind = 'youtube' | 'spotify' | 'spotify-extended' | 'spotify-podcast'

export type Platform = 'youtube' | 'spotify'

/** Reproducción normalizada. */
export interface Play {
  platform: Platform
  /** inicio de la reproducción, epoch ms */
  t: number
  title: string
  artist: string | null
  videoId: string | null
  url: string | null
  /** YouTube: header === "YouTube Music" */
  fromMusicApp: boolean
  /** YouTube: canal autogenerado "Artista - Topic" */
  isTopic: boolean
  /** duración en ms (real en Spotify; estimada en YouTube) */
  ms: number
  /** clave canónica de canción (artista + título) */
  songKey: string
}

export type PlatformFilter = 'all' | Platform
/** Qué se considera de YouTube: solo música, solo la app YT Music o todo (incluye videos). */
export type YouTubeContent = 'music' | 'ytmusic' | 'all'

export interface Filters {
  platform: PlatformFilter
  youtube: YouTubeContent
  from: number | null
  to: number | null
}

export const DEFAULT_FILTERS: Filters = { platform: 'all', youtube: 'music', from: null, to: null }
