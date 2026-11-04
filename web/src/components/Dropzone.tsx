import { useRef, useState } from 'react'

interface Props {
  onFiles: (files: File[]) => void
  error: string | null
  loading: boolean
}

export function Dropzone({ onFiles, error, loading }: Props) {
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return (
    <div
      className={`drop ${over ? 'over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const files = [...e.dataTransfer.files]
        if (files.length) onFiles(files)
      }}
    >
      <div style={{ fontSize: 44 }}>🎧</div>
      <h2>{loading ? 'Procesando tu historial…' : 'Cargá tu historial de YouTube o Spotify'}</h2>
      <p>Arrastrá acá uno o varios archivos <code>.json</code>. Podés combinar YouTube y Spotify.</p>
      <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Todo se procesa en tu navegador; los archivos no se suben a ningún servidor.</p>
      <div style={{ marginTop: 18 }}>
        <button className="btn primary" disabled={loading} onClick={() => input.current?.click()}>Elegir archivos</button>
        <FileInput ref={input} onFiles={onFiles} />
      </div>
      {error && <div className="error">{error}</div>}
      <div className="sources">
        <div>
          <h3>YouTube / YouTube Music</h3>
          <ol className="steps">
            <li>Entrá a <a href="https://takeout.google.com" target="_blank" rel="noreferrer">Google Takeout</a> y seleccioná solo <b>YouTube y YouTube Music</b>.</li>
            <li>En “Formatos múltiples”, elegí <b>JSON</b> para el historial.</li>
            <li>En “Todos los datos de YouTube incluidos”, dejá solo <b>historial</b>.</li>
            <li>Usá <code>historial/historial-de-reproducciones.json</code>.</li>
          </ol>
        </div>
        <div>
          <h3>Spotify</h3>
          <ol className="steps">
            <li>Entrá a <a href="https://www.spotify.com/account/privacy/" target="_blank" rel="noreferrer">Privacidad de la cuenta</a> en Spotify.</li>
            <li>Pedí el <b>Historial de reproducción ampliado</b> (toda tu historia, con más detalle) o los <b>Datos de la cuenta</b> (solo el último año).</li>
            <li>Cuando llegue el mail, descomprimí el zip.</li>
            <li>Usá todos los <code>Streaming_History_Audio_*.json</code> o <code>StreamingHistory_music_*.json</code>.</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export function FileInput({ ref, onFiles }: { ref: React.Ref<HTMLInputElement>; onFiles: (files: File[]) => void }) {
  return (
    <input
      ref={ref}
      type="file"
      accept="application/json,.json"
      multiple
      hidden
      onChange={(e) => {
        const files = [...(e.target.files ?? [])]
        e.target.value = ''
        if (files.length) onFiles(files)
      }}
    />
  )
}
