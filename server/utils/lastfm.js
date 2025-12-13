// Last.fm API-integration
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";

// Hämtar liknande låtar från Last.fm
export async function getSimilarTracks(artistName, trackName) {
  if (!LASTFM_API_KEY) {
    console.log("Last.fm API key not configured - skipping Last.fm recommendations");
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
    console.log(`Last.fm API Request: track.getSimilar for "${trackName}" by "${artistName}"`);
    
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
    console.log(`Last.fm found ${similarTracks.length} similar tracks`);
    
    return similarTracks.map(track => ({
      artist: track.artist?.name || "",
      name: track.name || "",
      match: parseFloat(track.match) || 0, // Similarity score 0-1
    })).filter(t => t.artist && t.name); // Filter out invalid entries

  } catch (error) {
    console.warn("Last.fm API request failed:", error.message);
    return [];
  }
}


