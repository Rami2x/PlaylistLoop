// Last.fm API-integration
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";

// Hämtar liknande låtar från Last.fm
export async function getSimilarTracks(artistName, trackName) {
  if (!LASTFM_API_KEY) {
    console.log("Last.fm API-nyckel ej konfigurerad - hoppar över Last.fm rekommendationer");
    return [];
  }

  try {
    const params = new URLSearchParams({
      method: "track.getSimilar",
      artist: artistName,
      track: trackName,
      api_key: LASTFM_API_KEY,
      format: "json",
      limit: "50", // Get more to have selection
    });

    const url = `${LASTFM_API_URL}?${params.toString()}`;
    console.log(`Last.fm API-förfrågan: track.getSimilar för "${trackName}" av "${artistName}"`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Last.fm API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    if (data.error) {
      console.warn(`Last.fm API error: ${data.message}`);
      return [];
    }

    const similarTracks = data.similartracks?.track || [];
    console.log(`Last.fm hittade ${similarTracks.length} liknande låtar`);
    
    return similarTracks.map(track => ({
      artist: track.artist?.name || "",
      name: track.name || "",
      match: parseFloat(track.match) || 0, // Similarity score 0-1
    })).filter(t => t.artist && t.name); // Filter out invalid entries

  } catch (error) {
    console.warn("Last.fm API-förfrågan misslyckades:", error.message);
    return [];
  }
}

// Hämtar populära låtar från Last.fm Charts (realtid)
export async function getTopTracks(limit = 50) {
  if (!LASTFM_API_KEY) {
    console.log("Last.fm API-nyckel ej konfigurerad - hoppar över Last.fm Charts");
    return [];
  }

  try {
    const params = new URLSearchParams({
      method: "chart.getTopTracks",
      api_key: LASTFM_API_KEY,
      format: "json",
      limit: limit.toString(),
    });

    const url = `${LASTFM_API_URL}?${params.toString()}`;
    console.log(`Last.fm API-förfrågan: chart.getTopTracks`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Last.fm API-fel: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    if (data.error) {
      console.warn(`Last.fm API-fel: ${data.message}`);
      return [];
    }

    const tracks = data.tracks?.track || [];
    console.log(`Last.fm hittade ${tracks.length} populära låtar från Charts`);
    
    return tracks.map(track => ({
      artist: track.artist?.name || "",
      name: track.name || "",
      playcount: parseInt(track.playcount) || 0,
    })).filter(t => t.artist && t.name); // Filtrera bort ogiltiga poster

  } catch (error) {
    console.warn("Last.fm Chart API-förfrågan misslyckades:", error.message);
    return [];
  }
}

