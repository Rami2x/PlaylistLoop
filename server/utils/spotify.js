// Funktioner för att prata med Spotify API
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Token för att använda Spotify API (för sökning och rekommendationer)
let accessToken = null;
let tokenExpiry = 0;

// Sparar användarnas tokens när de loggar in med Spotify
export const userTokens = new Map();

export async function spotifyFetch(path, params = {}) {
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
    console.error("=== SPOTIFY API-FEL ===");
    console.error(`Status: ${response.status} ${response.statusText}`);
    console.error(`URL: ${url}`);
    console.error(`Response body: ${body.substring(0, 1000)}`);
    console.error("========================");

    let errorMsg = `Spotify-fel (${response.status} ${response.statusText})`;
    if (response.status === 403) {
      errorMsg += " - Förbjuden. Kontrollera att din Spotify-app har rätt behörigheter.";
    } else if (response.status === 401) {
      errorMsg += " - Autentisering misslyckades. Kontrollera API-nycklarna.";
    } else if (response.status === 404) {
      errorMsg += " - Resursen hittades inte. Kontrollera att ID:t är korrekt och att seed-parametrarna är giltiga.";
    }

    let errorDetails = body.substring(0, 200);
    try {
      const errorJson = JSON.parse(body);
      if (errorJson.error) {
        errorDetails = errorJson.error.message || errorJson.error;
      }
    } catch (e) {
      // Ignorera parse-fel
    }

    throw new Error(`${errorMsg} för ${path}: ${errorDetails}`);
  }
  return response.json();
}

export async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    console.log("Använder cachad access token");
    return accessToken;
  }
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Spotify-uppgifter saknas.");
  }
  console.log("Hämtar ny access token...");
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
  console.log("Access token hämtad, giltig i:", data.expires_in, "sekunder");
  return accessToken;
}

export async function getUserAccessToken(userId) {
  const tokens = userTokens.get(userId);
  if (!tokens) {
    throw new Error("Användare inte ansluten till Spotify");
  }

  if (Date.now() < tokens.expiresAt) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    throw new Error("Ingen refresh token tillgänglig");
  }

  console.log(`Refreshing token for user ${userId}`);
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Token refresh failed:", errorText);
    userTokens.delete(userId);
    throw new Error("Kunde inte uppdatera Spotify-token. Logga in igen.");
  }

  const tokenData = await response.json();

  tokens.accessToken = tokenData.access_token;
  if (tokenData.refresh_token) {
    tokens.refreshToken = tokenData.refresh_token;
  }
  tokens.expiresAt = Date.now() + tokenData.expires_in * 1000 - 15_000;

  return tokens.accessToken;
}

export async function getFirstGenre(track) {
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

