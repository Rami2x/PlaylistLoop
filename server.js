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

app.get("/api/recommendations", async (req, res) => {
  const seedTrackId = req.query.seedTrackId;
  if (!seedTrackId) {
    return res.status(400).json({ error: "seedTrackId krävs." });
  }
  const limit = Math.min(parseInt(req.query.limit, 10) || 45, 50);
  const matchEnergy = req.query.matchEnergy === "1";
  const limitEra = req.query.limitEra === "1";

  try {
    const [seedTrack, seedFeatures] = await Promise.all([
      spotifyFetch(`tracks/${seedTrackId}`),
      spotifyFetch(`audio-features/${seedTrackId}`),
    ]);

    const params = {
      seed_tracks: seedTrackId,
      limit: String(Math.min(limit + 5, 50)), // extra buffert om vi filtrerar bort låtar senare
    };

    if (matchEnergy && seedFeatures?.energy) {
      params.target_energy = seedFeatures.energy.toFixed(2);
      params.min_energy = Math.max(seedFeatures.energy - 0.15, 0).toFixed(2);
      params.max_energy = Math.min(seedFeatures.energy + 0.15, 1).toFixed(2);
      params.min_tempo = Math.max(seedFeatures.tempo - 15, 0).toFixed(0);
      params.max_tempo = Math.round(seedFeatures.tempo + 15);
    }

    const recommendationData = await spotifyFetch("recommendations", params);
    let tracks = recommendationData.tracks || [];

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

    const trackIds = tracks.map((track) => track.id);
    const featureMap = await fetchAudioFeaturesMap(trackIds);
    const enrichedTracks = tracks.map((track) => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map((artist) => artist.name).join(", "),
      album: track.album.name,
      year: track.album.release_date?.slice(0, 4),
      url: track.external_urls?.spotify,
      preview: track.preview_url,
      bpm: featureMap.get(track.id)?.tempo,
    }));

    const avgBpm =
      enrichedTracks.reduce((acc, track) => acc + (track.bpm || 0), 0) /
      Math.max(enrichedTracks.length, 1);

    const genre = await getFirstGenre(seedTrack);

    res.json({
      meta: {
        title: `Lista inspirerad av ${seedTrack?.name}`,
        genre: genre || "N/A",
        energyLabel: matchEnergy ? describeEnergy(seedFeatures?.energy) : "Mix",
        avgBpm: Number.isFinite(avgBpm) ? avgBpm : null,
      },
      tracks: enrichedTracks,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Misslyckades att hämta rekommendationer." });
  }
});

app.listen(PORT, () => {
  console.log(`LoopWave server körs på http://localhost:${PORT}`);
});

async function spotifyFetch(path, params = {}) {
  const token = await getAccessToken();
  const url = new URL(`https://api.spotify.com/v1/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Spotify error (${response.status} ${response.statusText}) for ${url}: ${body}`
    );
  }
  return response.json();
}

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Spotify credentials saknas.");
  }
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!response.ok) {
    throw new Error(`Kunde inte hämta access token (${response.status})`);
  }
  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000 - 15_000;
  return accessToken;
}

async function fetchAudioFeaturesMap(trackIds) {
  const map = new Map();
  if (!trackIds.length) return map;
  const chunks = [];
  for (let i = 0; i < trackIds.length; i += 100) {
    chunks.push(trackIds.slice(i, i + 100));
  }
  for (const chunk of chunks) {
    const data = await spotifyFetch("audio-features", { ids: chunk.join(",") });
    (data.audio_features || []).forEach((feature) => {
      if (feature && feature.id) {
        map.set(feature.id, feature);
      }
    });
  }
  return map;
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

function describeEnergy(value) {
  if (typeof value !== "number") return "Mix";
  if (value > 0.75) return "Hög energi";
  if (value > 0.55) return "Mellan";
  if (value > 0.35) return "Lugn";
  return "Chill";
}

