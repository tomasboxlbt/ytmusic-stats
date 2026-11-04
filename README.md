# YT Music Stats

Dashboard para explorar tu historial de reproducciones de YouTube / YouTube Music,
exportado desde Google Takeout en formato JSON.

Por ahora es solo frontend (Vite + React + TypeScript): el JSON se procesa en el navegador
y se guarda en IndexedDB para no tener que volver a cargarlo. Queda lugar en el repo para un
`server/` (Node + PostgreSQL) más adelante.

## Uso

```bash
cd web
npm install
npm run dev
```

Abrí http://localhost:5173 y arrastrá tu `historial-de-reproducciones.json`.

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

Filtros: fuente (*Música* = YouTube Music + canales "Artista - Topic"; *Solo YT Music*; *Todo YouTube*)
y período (todo, últimos 30/90 días, 12 meses, por año o rango personalizado).

## Notas sobre los datos

- El historial no trae la duración de cada tema: el tiempo escuchado se estima con el hueco entre
  reproducciones consecutivas (tope de 10 min, 3,5 min si no hay siguiente).
- Los nombres de artista se normalizan (`Artista - Topic`, `ArtistaVEVO`, `… Oficial`) y se unifican
  variantes con/sin tildes. Las canciones se agrupan por artista + título sin sufijos tipo
  "(Official Video)" o "(Remastered)".
- Se descartan anuncios y entradas sin video.
