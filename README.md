# Music Stats

Dashboard para explorar tu historial de reproducciones de **YouTube / YouTube Music** (Google Takeout)
y de **Spotify**, por separado o combinados.

Por ahora es solo frontend (Vite + React + TypeScript): el JSON se procesa en el navegador
y se guarda en IndexedDB para no tener que volver a cargarlo. Queda lugar en el repo para un
`server/` (Node + PostgreSQL) más adelante.

## Uso

```bash
cd web
npm install
npm run dev
```

Abrí http://localhost:5173 y arrastrá uno o varios archivos. Con **+ Agregar archivos** sumás más
fuentes a lo ya cargado (por ejemplo, YouTube y después Spotify).

### Formatos soportados

| Fuente | Archivo | Cómo pedirlo |
|---|---|---|
| YouTube / YT Music | `historial/historial-de-reproducciones.json` (o `watch-history.json`) | [Google Takeout](https://takeout.google.com) → YouTube y YouTube Music → historial en formato JSON |
| Spotify, historial ampliado | `Streaming_History_Audio_*.json` (todos) | [Privacidad de la cuenta](https://www.spotify.com/account/privacy/) → *Historial de reproducción ampliado* (toda la historia) |
| Spotify, datos de la cuenta | `StreamingHistory_music_*.json` | Misma página → *Datos de la cuenta* (solo el último año) |

El formato se detecta solo. Los archivos de podcasts de Spotify se ignoran.

En desarrollo también podés copiar el archivo a `web/public/historial.json` y se carga solo
(ese archivo está en `.gitignore`, así que no se versiona).

## Qué muestra

- **KPIs**: reproducciones, tiempo escuchado estimado, canciones y artistas distintos, días con música.
- **Rankings** de artistas y canciones, con búsqueda y paginado.
- **Detalle por artista**: tocá un artista para ver su evolución, sus canciones y su primera/última escucha.
- **Línea de tiempo** por día / semana / mes.
- **Mapa de calor** día de la semana × hora, reproducciones por hora y calendario anual.
- **Datos curiosos**: día récord, racha más larga, sesión más larga, canción en loop, hora pico,
  música de madrugada, concentración en el top 10, artistas de una sola canción, etc.
- **Artistas nuevos por mes** y **fanatismo** (artistas con más plays por canción).

Filtros: plataforma (todas / YouTube / Spotify), contenido de YouTube (*Solo música* = YouTube Music +
canales "Artista - Topic"; *Solo app YT Music*; *Incluir videos*) y período (todo, últimos 30/90 días,
12 meses, por año o rango personalizado).

## Notas sobre los datos

- **Spotify** informa la duración real de cada reproducción; como hace Spotify, solo se cuentan las de 30 s o más.
  Se descartan podcasts y audiolibros.
- **YouTube** no trae la duración: el tiempo escuchado se estima con el hueco entre reproducciones
  consecutivas (tope de 10 min, 3,5 min si no hay siguiente).
- Si cargás el mismo archivo dos veces, las reproducciones repetidas se descartan.
- Artistas y canciones se unifican entre plataformas (sin importar tildes o mayúsculas).
- Los nombres de artista se normalizan (`Artista - Topic`, `ArtistaVEVO`, `… Oficial`) y se unifican
  variantes con/sin tildes. Las canciones se agrupan por artista + título sin sufijos tipo
  "(Official Video)", "(Remastered)" o " - Remastered 2011".
- Se descartan anuncios y entradas sin video.
