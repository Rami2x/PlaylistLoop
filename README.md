# PlaylistLoop
Webbapp som genererar en spellista (40–50 låtar) baserad på en favoritlåt via Spotify Web API och Last.fm.

## Funktioner
- **Spellistgenerering**: Skapa en lista med 40–50 låtar som matchar känslan i din favoritlåt
- **Dagens låt**: Visa en populär låt från Last.fm Charts som uppdateras var 24:e timme
- **Spara listor**: Logga in med Firebase Auth och spara dina spellistor
- **Exportera till Spotify**: Exportera spellistor direkt till ditt Spotify-konto
- **Rekommendationsmotor**: Använder Spotify Web API och Last.fm för bästa matchningar

## Teknologier
- **Frontend**: HTML, CSS, JavaScript (ES6 modules)
- **Backend**: Node.js, Express
- **APIs**: Spotify Web API, Last.fm API
- **Databas**: Firebase Firestore
- **Autentisering**: Firebase Auth (Email/Password)

## Kom igång

### Förutsättningar
- Node.js (v14 eller senare)
- Spotify Developer-konto
- Last.fm API-nyckel
- Firebase-projekt

### Installation
1. `git clone <repository-url>`
2. `cd <project-folder> && npm install`
3. Skapa `.env` utifrån `env.sample` och fyll i:
   - `SPOTIFY_CLIENT_ID` – Din Spotify Client ID
   - `SPOTIFY_CLIENT_SECRET` – Din Spotify Client Secret
   - `SPOTIFY_REDIRECT_URI` – OAuth redirect URI (standard: `http://127.0.0.1:3000/api/spotify/callback`)
   - `LASTFM_API_KEY` – Din Last.fm API-nyckel
   - `PORT` – Serverport (standard: 3000)
4. Uppdatera Firebase-konfiguration i `index.html` med dina egna Firebase-uppgifter
5. `npm start`
6. Öppna `http://localhost:3000`

### Hämta API-nycklar
- **Spotify**: https://developer.spotify.com/dashboard
- **Last.fm**: https://www.last.fm/api/account/create

## Projektstruktur
```
├── app.js                 # Huvudapplikation och event handlers
├── index.html             # HTML-struktur
├── styles.css             # Styling
├── server.js              # Express-server
├── server/
│   ├── routes/
│   │   ├── api.js         # API-endpoints för sökning och rekommendationer
│   │   └── spotify.js     # Spotify OAuth och playlist-export
│   └── utils/
│       ├── spotify.js     # Spotify API-hjälpfunktioner
│       ├── lastfm.js      # Last.fm API-integration
│       └── recommendations.js  # Rekommendationslogik
└── js/
    ├── auth/              # Firebase-autentisering
    ├── playlist/          # Spellistgenerering
    ├── spotify/           # Spotify-export
    ├── firestore/         # Databas-operationer
    └── utils/             # Hjälpfunktioner
```

## Användning
1. Sök efter en låt i sökfältet
2. Välj en låt från resultaten
3. Klicka på "Skapa spellista" för att generera en lista
4. Logga in för att spara listor eller exportera till Spotify
5. Exportera till Spotify genom att ansluta ditt Spotify-konto

