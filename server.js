// Backend-server för Spotify API

import express from "express";
import path from "node:path";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn(
    "[LoopWave] SPOTIFY_CLIENT_ID och SPOTIFY_CLIENT_SECRET saknas. API-anrop kommer att misslyckas."
  );
}

let accessToken = null;
let tokenExpiry = 0;

app.use(express.static(path.resolve(".")));

// Sök efter låtar
app.get("/api/search", async (req, res) => {
  const query = (req.query.q || "").trim();
  if (!query) {
    return res.status(400).json({ error: "Parametern q krävs." });
  }
  try {
    const searchData = await spotifyFetch("search", {
      q: query,
      type: "track",
      limit: "6",
    });
    const tracks = (searchData.tracks?.items || []).map((item) => ({
      id: item.id,
      name: item.name,
      artists: item.artists.map((artist) => artist.name).join(", "),
      album: item.album.name,
      year: item.album.release_date?.slice(0, 4),
      preview: item.preview_url,
      image: item.album.images?.[1]?.url,
    }));
    res.json({ tracks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Spotify-sökning misslyckades." });
  }
});

// Hämta rekommendationer
app.get("/api/recommendations", async (req, res) => {
  const seedTrackId = req.query.seedTrackId;
  if (!seedTrackId) {
    return res.status(400).json({ error: "seedTrackId krävs." });
  }
  const limit = Math.min(parseInt(req.query.limit, 10) || 45, 50);
  const limitEra = req.query.limitEra === "1";

  console.log(`Fetching recommendations for track: ${seedTrackId}`);
  
  try {
    // Kontrollera först att track-ID:t är giltigt
    console.log("Fetching track info for:", seedTrackId);
    const seedTrack = await spotifyFetch(`tracks/${seedTrackId}`);
    
    if (!seedTrack || !seedTrack.id) {
      throw new Error("Ogiltigt track-ID. Kunde inte hämta låtinformation.");
    }
    
    console.log(`Track found: "${seedTrack.name}" by ${seedTrack.artists[0]?.name || "Unknown"}`);

    // Spotify Recommendations API kräver minst 1 seed (seed_tracks, seed_artists, eller seed_genres)
    // Vi använder både seed_tracks och seed_artists för bättre resultat
    const params = {};
    
    // Kontrollera seed_tracks
    if (seedTrackId && seedTrackId.trim() !== "") {
      params.seed_tracks = seedTrackId.trim();
    } else {
      throw new Error("seedTrackId är tom eller ogiltigt");
    }
    
    // Lägg till seed_artists om artist-ID finns
    const artistId = seedTrack?.artists?.[0]?.id;
    if (artistId && artistId.trim() !== "") {
      params.seed_artists = artistId.trim();
    }
    
    // Lägg till limit
    params.limit = String(Math.min(limit, 100));
    
    // Lägg till market för bättre kompatibilitet (SE = Sverige)
    params.market = "SE";
    
    // Logga exakt vad som skickas
    console.log("=== SPOTIFY RECOMMENDATIONS REQUEST ===");
    console.log("seed_tracks:", params.seed_tracks);
    console.log("seed_artists:", params.seed_artists || "(none)");
    console.log("limit:", params.limit);
    console.log("Full params object:", JSON.stringify(params, null, 2));
    console.log("=======================================");
    
    let tracks = [];
    let recommendationData = null;
    
    // Försök använda Recommendations API först
    try {
      recommendationData = await spotifyFetch("recommendations", params);
      tracks = recommendationData.tracks || [];
      console.log(`Got ${tracks.length} tracks from Recommendations API`);
    } catch (recError) {
      console.warn("Recommendations API failed, using fallback method:", recError.message);
      // Fallback: Använd Related Artists + Search API
      tracks = await getRecommendationsFallback(seedTrack, limit);
    }

    if (limitEra && seedTrack?.album?.release_date) {
      const seedYear = parseInt(seedTrack.album.release_date.slice(0, 4), 10);
      tracks = tracks.filter((track) => {
        const year = parseInt(track.album.release_date?.slice(0, 4), 10);
        if (Number.isNaN(year) || Number.isNaN(seedYear)) return true;
        return Math.abs(year - seedYear) <= 5;
      });
      if (tracks.length < limit / 2) {
        tracks = recommendationData.tracks || [];
      }
    }

    tracks = tracks.slice(0, limit);

    const enrichedTracks = tracks.map((track) => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map((artist) => artist.name).join(", "),
      album: track.album.name,
      year: track.album.release_date?.slice(0, 4),
      url: track.external_urls?.spotify,
      preview: track.preview_url,
    }));

    const genre = await getFirstGenre(seedTrack);
    res.json({
      meta: {
        title: `Lista inspirerad av ${seedTrack?.name}`,
        genre: genre || "N/A",
      },
      tracks: enrichedTracks,
    });
  } catch (error) {
    console.error("=== RECOMMENDATIONS ERROR ===");
    console.error("Error:", error);
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
    console.error("===========================");
    res.status(500).json({ 
      error: "Misslyckades att hämta rekommendationer.",
      details: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`LoopWave server körs på http://localhost:${PORT}`);
});

// Hjälpfunktioner

async function spotifyFetch(path, params = {}) {
  const token = await getAccessToken();
  const url = new URL(`https://api.spotify.com/v1/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });
  console.log(`Spotify API Request: ${url}`);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    console.error("=== SPOTIFY API ERROR ===");
    console.error(`Status: ${response.status} ${response.statusText}`);
    console.error(`URL: ${url}`);
    console.error(`Response body: ${body.substring(0, 1000)}`);
    console.error("=========================");
    
    let errorMsg = `Spotify error (${response.status} ${response.statusText})`;
    if (response.status === 403) {
      errorMsg += " - Förbjuden. Kontrollera att din Spotify-app har rätt behörigheter.";
    } else if (response.status === 401) {
      errorMsg += " - Autentisering misslyckades. Kontrollera API-nycklarna.";
    } else if (response.status === 404) {
      errorMsg += " - Resursen hittades inte. Kontrollera att ID:t är korrekt och att seed-parametrarna är giltiga.";
    }
    
    // Parsa JSON om möjligt för bättre felmeddelande
    let errorDetails = body.substring(0, 200);
    try {
      const errorJson = JSON.parse(body);
      if (errorJson.error) {
        errorDetails = errorJson.error.message || errorJson.error;
      }
    } catch (e) {
      // Ignorera parse errors
    }
    
    throw new Error(`${errorMsg} for ${path}: ${errorDetails}`);
  }
  return response.json();
}

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    console.log("Using cached access token");
    return accessToken;
  }
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Spotify credentials saknas.");
  }
  console.log("Fetching new access token...");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Token fetch error:", errorBody);
    throw new Error(`Kunde inte hämta access token (${response.status}): ${errorBody.substring(0, 200)}`);
  }
  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000 - 15_000;
  console.log("Access token fetched successfully, expires in:", data.expires_in, "seconds");
  return accessToken;
}

async function getFirstGenre(track) {
  const artistId = track?.artists?.[0]?.id;
  if (!artistId) return null;
  try {
    const artist = await spotifyFetch(`artists/${artistId}`);
    return artist.genres?.[0] || null;
  } catch (error) {
    console.warn("Kunde inte hämta artistgenre:", error.message);
    return null;
  }
}

// Fallback-metod när Recommendations API inte fungerar
async function getRecommendationsFallback(seedTrack, limit) {
  console.log("Using fallback method: Related Artists + Search");
  const allTracks = new Map(); // Använd Map för att undvika duplicer
  
  try {
    // Hämta genre från seed-track
    const genre = await getFirstGenre(seedTrack);
    const artistId = seedTrack?.artists?.[0]?.id;
    const artistName = seedTrack?.artists?.[0]?.name;
    
    // 1. Hämta relaterade artister
    if (artistId) {
      try {
        const relatedArtists = await spotifyFetch(`artists/${artistId}/related-artists`);
        const artistIds = [artistId, ...(relatedArtists.artists?.slice(0, 5).map(a => a.id) || [])];
        
        // 2. Sök efter låtar från dessa artister
        for (const id of artistIds.slice(0, 3)) {
          try {
            const artist = await spotifyFetch(`artists/${id}`);
            const searchQuery = `artist:${artist.name}`;
            const searchResults = await spotifyFetch("search", {
              q: searchQuery,
              type: "track",
              limit: "10",
            });
            
            (searchResults.tracks?.items || []).forEach(track => {
              if (track.id !== seedTrack.id && !allTracks.has(track.id)) {
                allTracks.set(track.id, track);
              }
            });
          } catch (err) {
            console.warn(`Failed to fetch tracks for artist ${id}:`, err.message);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch related artists:", err.message);
      }
    }
    
    // 3. Sök efter låtar med samma genre
    if (genre) {
      try {
        const searchResults = await spotifyFetch("search", {
          q: `genre:${genre}`,
          type: "track",
          limit: "20",
        });
        
        (searchResults.tracks?.items || []).forEach(track => {
          if (track.id !== seedTrack.id && !allTracks.has(track.id)) {
            allTracks.set(track.id, track);
          }
        });
      } catch (err) {
        console.warn("Failed to search by genre:", err.message);
      }
    }
    
    // 4. Sök efter låtar med liknande namn/artist
    if (artistName) {
      try {
        const searchResults = await spotifyFetch("search", {
          q: artistName,
          type: "track",
          limit: "20",
        });
        
        (searchResults.tracks?.items || []).forEach(track => {
          if (track.id !== seedTrack.id && !allTracks.has(track.id)) {
            allTracks.set(track.id, track);
          }
        });
      } catch (err) {
        console.warn("Failed to search by artist name:", err.message);
      }
    }
    
    const tracksArray = Array.from(allTracks.values()).slice(0, limit);
    console.log(`Fallback method returned ${tracksArray.length} tracks`);
    return tracksArray;
    
  } catch (error) {
    console.error("Fallback method failed:", error);
    return [];
  }
}


