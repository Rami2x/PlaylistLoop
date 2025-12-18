// API-endpoints för Spotify-inloggning och att skapa spellistor
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { userTokens, getUserAccessToken, getTokensForUser } from "../utils/spotify.js";
import { saveSpotifyTokens, deleteSpotifyTokens } from "../utils/firestore-tokens.js";

dotenv.config();

const router = express.Router();
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || "http://127.0.0.1:3000/api/spotify/callback";

// Startar Spotify-inloggning
router.get("/auth", (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: "userId krävs" });
  }

  const redirectUri = REDIRECT_URI.trim();


  const scopes = "playlist-modify-public playlist-modify-private user-read-private";
  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  res.json({ authUrl: authUrl.toString() });
});

// Hanterar när användaren loggat in på Spotify
router.get("/callback", async (req, res) => {
  console.log("=== SPOTIFY OAUTH CALLBACK STARTAR ===");
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`/?spotify_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.redirect("/?spotify_error=missing_params");
  }

  try {
    const { userId } = JSON.parse(Buffer.from(state, "base64").toString());

    const redirectUri = REDIRECT_URI.trim();

    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token-utbyte misslyckades:", errorText);
      return res.redirect(`/?spotify_error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();

    const tokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
    };

    // Spara i både in-memory och Firestore
    userTokens.set(userId, tokens);
    const savedToFirestore = await saveSpotifyTokens(userId, tokens).catch(err => {
      console.error("Kunde inte spara tokens i Firestore:", err.message);
      return false;
    });
    
    if (savedToFirestore) {
      console.log(`✅ OAuth callback: Tokens sparade permanent för userId: ${userId}`);
    } else {
      console.warn(`⚠️ OAuth callback: Tokens sparade endast i minnet för userId: ${userId} (försvinner vid omstart)`);
    }

    res.redirect("/?spotify_connected=true");
  } catch (error) {
    console.error("OAuth callback-fel:", error);
    res.redirect("/?spotify_error=callback_error");
  }
});

// Hämta användarens Spotify-profil
router.get("/me", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: "userId krävs" });
  }

  const tokens = userTokens.get(userId);
  if (!tokens) {
    return res.status(401).json({ error: "Inte ansluten till Spotify" });
  }

  try {
    const userToken = await getUserAccessToken(userId);
    const response = await fetch("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Spotify API-fel: ${response.status}`);
    }

    const userData = await response.json();
    res.json(userData);
  } catch (error) {
    console.error("Fel vid hämtning av användarprofil:", error);
    res.status(500).json({ error: "Kunde inte hämta användarprofil" });
  }
});

// Skapa spellista i användarens Spotify-konto
router.post("/create-playlist", async (req, res) => {
  const { userId, name, description, trackIds } = req.body;

  if (!userId || !name || !trackIds || !Array.isArray(trackIds)) {
    return res.status(400).json({ error: "userId, name och trackIds (array) krävs" });
  }

  // Hämta tokens från Firestore eller in-memory
  console.log(`🔍 create-playlist: Försöker hämta tokens för userId: ${userId}`);
  const tokens = await getTokensForUser(userId);
  if (!tokens) {
    console.error(`❌ create-playlist: Inga tokens hittades för userId: ${userId}`);
    return res.status(401).json({ error: "Inte ansluten till Spotify. Logga in med Spotify först." });
  }

  console.log(`✅ create-playlist: Tokens hittade för userId: ${userId} (har refreshToken: ${!!tokens.refreshToken})`);

  try {
    const userToken = await getUserAccessToken(userId);
    console.log(`✅ create-playlist: Access token hämtad för userId: ${userId} (token börjar med: ${userToken.substring(0, 20)}...)`);

    console.log(`🔍 create-playlist: Försöker anropa Spotify /me API för userId: ${userId}`);
    const meResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    if (!meResponse.ok) {
      const errorText = await meResponse.text();
      console.error(`❌ Spotify /me API-fel (${meResponse.status}):`, errorText);
      
      // Om 403, kan det betyda att token är ogiltig eller saknar scope
      // Radera tokens så användaren måste ansluta igen med rätt scopes
      if (meResponse.status === 403 || meResponse.status === 401) {
        console.error(`⚠️ Token saknar behörighet för userId: ${userId} - Raderar tokens`);
        userTokens.delete(userId);
        await deleteSpotifyTokens(userId).catch(err => {
          console.warn("Kunde inte radera tokens från Firestore:", err.message);
        });
        throw new Error("Token saknar behörighet. Anslut till Spotify igen.");
      }
      
      throw new Error(`Kunde inte hämta användarprofil: ${meResponse.status}`);
    }

    const meData = await meResponse.json();
    const spotifyUserId = meData.id;

    const createResponse = await fetch(`https://api.spotify.com/v1/users/${spotifyUserId}/playlists`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        description: description || `Skapad med PlaylistLoop`,
        public: false,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Skapande av spellista misslyckades:", errorText);
      throw new Error(`Kunde inte skapa spellista: ${createResponse.status}`);
    }

    const playlistData = await createResponse.json();
    const playlistId = playlistData.id;

    const trackUris = trackIds.map((id) => `spotify:track:${id}`);
    const chunks = [];
    for (let i = 0; i < trackUris.length; i += 100) {
      chunks.push(trackUris.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      const addTracksResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: chunk,
        }),
      });

      if (!addTracksResponse.ok) {
        const errorText = await addTracksResponse.text();
        console.error("Lägga till låtar misslyckades:", errorText);
        throw new Error(`Kunde inte lägga till låtar: ${addTracksResponse.status}`);
      }
    }

    res.json({
      success: true,
      playlistId,
      playlistUrl: playlistData.external_urls?.spotify,
      name: playlistData.name,
    });
  } catch (error) {
    console.error("=== FEL VID SKAPANDE AV SPELLISTA ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("================================");
    
    // Om tokens saknas, refresh misslyckas, eller token saknar behörighet, returnera 401
    if (error.message.includes("inte ansluten") || 
        error.message.includes("Ingen refresh token") || 
        error.message.includes("uppdatera Spotify-token") ||
        error.message.includes("saknar behörighet")) {
      console.error("Token-problem upptäckt, returnerar 401");
      return res.status(401).json({ 
        error: "Spotify-anslutning har gått ut eller saknar behörighet. Anslut till Spotify igen." 
      });
    }
    
    res.status(500).json({
      error: "Kunde inte skapa spellista i Spotify",
      details: error.message,
    });
  }
});

export default router;

