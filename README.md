# PlaylistLoop
Webbapp som genererar en spellista (40–50 låtar) baserad på en favoritlåt via Spotify Web API.

## Kom igång
1. `git clone https://github.com/Rami2x/PlaylistLoop.git`
2. `cd PlaylistLoop && npm install`
3. Skapa `.env` utifrån `env.sample` och fyll i Spotify‑nycklar.
4. `npm start`
5. Öppna `http://localhost:3000`

## Struktur
- `index.html`, `styles.css`, `app.js` – UI och logik.
- `server.js` – Express-proxy (sök + rekommendationer).
- `env.sample` – vilka miljövariabler som krävs.

## Nästa steg
- Firebase-inloggning och sparade listor.
- Exportera spellistan till Spotify‑kontot.
- Deploy: Netlify (frontend) + Railway (backend).

