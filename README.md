# PlaylistLoop
Webbapp som genererar en spellista (40–50 låtar) baserad på en favoritlåt via Spotify Web API.

## Kom igång
1. `git clone <repository-url>`
2. `cd <project-folder> && npm install`
3. Skapa `.env` utifrån `env.sample` och fyll i Spotify‑nycklar.
4. `npm start`
5. Öppna `http://localhost:3000`

## Struktur
- `index.html`, `styles.css`, `app.js` – UI och logik.
- `server.js` – Express-proxy (sök + rekommendationer).
- `env.sample` – vilka miljövariabler som krävs.


