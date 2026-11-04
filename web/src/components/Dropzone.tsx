import { useRef, useState } from 'react'

interface Props {
  onFile: (file: File) => void
  error: string | null
  loading: boolean
}

export function Dropzone({ onFile, error, loading }: Props) {
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
        const f = e.dataTransfer.files[0]
        if (f) onFile(f)
      }}
    >
      <div style={{ fontSize: 44 }}>🎧</div>
      <h2>{loading ? 'Procesando tu historial…' : 'Cargá tu historial de YouTube'}</h2>
      <p>Arrastrá acá el archivo <code>historial-de-reproducciones.json</code> (o <code>watch-history.json</code>).</p>
      <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Todo se procesa en tu navegador; el archivo no se sube a ningún servidor.</p>
      <div style={{ marginTop: 18 }}>
        <button className="btn primary" disabled={loading} onClick={() => input.current?.click()}>Elegir archivo</button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
        />
      </div>
      {error && <div className="error">{error}</div>}
      <ol className="steps">
        <li>Entrá a <a href="https://takeout.google.com" target="_blank" rel="noreferrer">Google Takeout</a> y seleccioná solo <b>YouTube y YouTube Music</b>.</li>
        <li>En “Formatos múltiples”, elegí <b>JSON</b> para el historial.</li>
        <li>En “Todos los datos de YouTube incluidos”, dejá marcado solo <b>historial</b>.</li>
        <li>Descomprimí y buscá <code>Takeout/YouTube y YouTube Music/historial/historial-de-reproducciones.json</code>.</li>
      </ol>
    </div>
  )
}
