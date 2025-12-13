// API-endpoints för sökning och rekommendationer
import express from "express";
import { spotifyFetch } from "../utils/spotify.js";
import { getRecommendationsFallback } from "../utils/recommendations.js";

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

  console.log(`Fetching recommendations for track: ${seedTrackId}`);

  try {
    console.log("Fetching track info for:", seedTrackId);
    const seedTrack = await spotifyFetch(`tracks/${seedTrackId}`);

    if (!seedTrack || !seedTrack.id) {
      throw new Error("Ogiltigt track-ID. Kunde inte hämta låtinformation.");
    }

    console.log(`Track found: "${seedTrack.name}" by ${seedTrack.artists[0]?.name || "Unknown"}`);

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
      console.log(`Got ${tracks.length} tracks from Recommendations API`);
    } catch (recError) {
      console.warn("Recommendations API failed, using fallback method:", recError.message);
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
    console.error("=== RECOMMENDATIONS ERROR ===");
    console.error("Error:", error);
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
    console.error("===========================");
    res.status(500).json({
      error: "Misslyckades att hämta rekommendationer.",
      details: error.message,
    });
  }
});

export default router;

