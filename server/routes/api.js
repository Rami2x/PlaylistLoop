// API-endpoints för sökning och rekommendationer
import express from "express";
import { spotifyFetch } from "../utils/spotify.js";
import { getRecommendationsFallback } from "../utils/recommendations.js";
import { getTopTracks } from "../utils/lastfm.js";

const router = express.Router();

// Sök efter låtar
router.get("/search", async (req, res) => {
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
router.get("/recommendations", async (req, res) => {
  const seedTrackId = req.query.seedTrackId;
  if (!seedTrackId) {
    return res.status(400).json({ error: "seedTrackId krävs." });
  }
  const limit = Math.min(parseInt(req.query.limit, 10) || 45, 50);

  console.log(`Hämtar rekommendationer för låt: ${seedTrackId}`);

  try {
    console.log("Hämtar låtinfo för:", seedTrackId);
    const seedTrack = await spotifyFetch(`tracks/${seedTrackId}`);

    if (!seedTrack || !seedTrack.id) {
      throw new Error("Ogiltigt track-ID. Kunde inte hämta låtinformation.");
    }

    console.log(`Låt hittad: "${seedTrack.name}" av ${seedTrack.artists[0]?.name || "Okänd"}`);

    const params = {};
    if (seedTrack.id) {
      params.seed_tracks = seedTrack.id;
    }
    if (seedTrack.artists?.[0]?.id) {
      params.seed_artists = seedTrack.artists[0].id;
    }
    params.limit = limit;

    let tracks = [];
    let recommendationData = null;

    try {
      recommendationData = await spotifyFetch("recommendations", params);
      tracks = recommendationData.tracks || [];
      console.log(`Fick ${tracks.length} låtar från Recommendations API`);
    } catch (recError) {
      console.warn("Recommendations API misslyckades, använder fallback-metod:", recError.message);
      const seedTrackForFallback = seedTrack;
      tracks = await getRecommendationsFallback(seedTrackForFallback, limit);
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

    const title = seedTrack
      ? `Lista inspirerad av ${seedTrack.name}`
      : `Lista inspirerad av ${seedTrack.artists?.[0]?.name || "artisten"}`;

    res.json({
      meta: {
        title,
      },
      tracks: enrichedTracks,
    });
  } catch (error) {
    console.error("=== REKOMMENDATIONS-FEL ===");
    console.error("Fel:", error);
    console.error("Meddelande:", error.message);
    console.error("Stack:", error.stack);
    console.error("===========================");
    res.status(500).json({
      error: "Kunde inte hämta rekommendationer.",
      details: error.message,
    });
  }
});

// Cache för dagens låt (uppdateras var 24:e timme)
let dailyTrackCache = {
  track: null,
  date: null,
  timestamp: null,
};

// Hämta dagens låt
router.get("/daily-track", async (req, res) => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Kontrollera om det finns en cachad låt från idag (mindre än 24 timmar gammal)
    if (
      dailyTrackCache.track &&
      dailyTrackCache.date === today &&
      dailyTrackCache.timestamp &&
      (now.getTime() - dailyTrackCache.timestamp) < 24 * 60 * 60 * 1000
    ) {
      console.log("Använder cachad dagens låt");
      return res.json(dailyTrackCache.track);
    }
    
    console.log("Hämtar ny dagens låt från Last.fm Charts...");
    
    let selectedTrack = null;
    
    // Använd dagens datum som seed för att välja olika låt varje dag
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    
    // Hämta populära låtar från Last.fm Charts (realtid)
    try {
      const lastfmTracks = await getTopTracks(50);
      
      if (lastfmTracks.length > 0) {
        // Välj en låt baserat på dagens datum (samma låt hela dagen, olika varje dag)
        const index = dayOfYear % lastfmTracks.length;
        const selectedLastfmTrack = lastfmTracks[index];
        console.log(`Valde låt #${index + 1} från Last.fm Charts (dag ${dayOfYear}): "${selectedLastfmTrack.name}" av "${selectedLastfmTrack.artist}"`);
        
        // Sök efter låten på Spotify för att få full information
        try {
          const searchQuery = `artist:${selectedLastfmTrack.artist} track:${selectedLastfmTrack.name}`;
          const searchResults = await spotifyFetch("search", {
            q: searchQuery,
            type: "track",
            limit: "1",
          });
          
          const foundTrack = searchResults.tracks?.items?.[0];
          if (foundTrack) {
            selectedTrack = foundTrack;
            console.log(`✅ Hittade låten på Spotify: "${selectedTrack.name}"`);
          } else {
            console.warn(`Kunde inte hitta "${selectedLastfmTrack.name}" av "${selectedLastfmTrack.artist}" på Spotify`);
          }
        } catch (spotifyError) {
          console.warn("Kunde inte söka på Spotify:", spotifyError.message);
        }
      }
    } catch (lastfmError) {
      console.error("Last.fm Charts misslyckades:", lastfmError.message);
    }
    
    // Fallback om Last.fm inte fungerade
    if (!selectedTrack) {
      console.log("Använder Spotify Search som fallback...");
      try {
        const searchResults = await spotifyFetch("search", {
          q: "tag:new",
          type: "track",
          limit: "50",
        });
        
        const tracks = searchResults.tracks?.items || [];
        if (tracks.length > 0) {
          const index = dayOfYear % tracks.length;
          selectedTrack = tracks[index];
          console.log(`Hämtade fallback-låt: "${selectedTrack.name}"`);
        }
      } catch (fallbackError) {
        console.error("Fallback misslyckades:", fallbackError.message);
      }
    }
    
    if (!selectedTrack) {
      throw new Error("Kunde inte hämta dagens låt");
    }
    
    // Hämta genre från artist
    let trackGenre = null;
    try {
      const artistId = selectedTrack.artists[0]?.id;
      if (artistId) {
        const artist = await spotifyFetch(`artists/${artistId}`);
        trackGenre = artist.genres?.[0] || null;
      }
    } catch (e) {
      // Ignorera om genre inte är tillgängligt
    }
    
    const trackData = {
      title: selectedTrack.name,
      artists: selectedTrack.artists.map((a) => a.name).join(", "),
      genre: trackGenre || "Populär musik",
      url: selectedTrack.external_urls?.spotify,
      preview: selectedTrack.preview_url,
      image: selectedTrack.album?.images?.[1]?.url,
      date: today,
    };
    
    // Uppdatera cache
    dailyTrackCache = {
      track: trackData,
      date: today,
      timestamp: now.getTime(),
    };
    
    res.json(trackData);
  } catch (error) {
    console.error("Error fetching daily track:", error);
    
    // Använd gammal cache som fallback om den finns
    if (dailyTrackCache.track) {
      console.log("Använder gammal cache som fallback");
      return res.json(dailyTrackCache.track);
    }
    
    res.status(500).json({
      error: "Kunde inte hämta dagens låt",
      details: error.message,
    });
  }
});

export default router;

