// Fallback om Spotify Recommendations inte fungerar
import { spotifyFetch, getFirstGenre } from "./spotify.js";
import { getSimilarTracks } from "./lastfm.js";

export async function getRecommendationsFallback(seedTrack, limit) {
  console.log("Använder fallback-metod: Last.fm + Relaterade Artister + Sökning");
  const allTracks = new Map();

  try {
    const genre = await getFirstGenre(seedTrack);
    const artistId = seedTrack?.artists?.[0]?.id;
    const artistName = seedTrack?.artists?.[0]?.name;
    const trackName = seedTrack?.name;
    const market = seedTrack?.album?.available_markets?.[0] || "SE";

    // 1. Försök hämta låtar från Last.fm först
    if (artistName && trackName) {
      try {
        console.log(`Hämtar liknande låtar från Last.fm för "${trackName}" av "${artistName}"...`);
        const lastfmTracks = await getSimilarTracks(artistName, trackName);
        
        if (lastfmTracks.length > 0) {
          console.log(`✅ Fick ${lastfmTracks.length} liknande låtar från Last.fm`);
          
          // Söker efter låten på Spotify
          for (const lastfmTrack of lastfmTracks.slice(0, 50)) {
            try {
              const searchQuery = `artist:${lastfmTrack.artist} track:${lastfmTrack.name}`;
              const searchResults = await spotifyFetch("search", {
                q: searchQuery,
                type: "track",
                limit: "1",
                market: market,
              });
              
              const foundTrack = searchResults.tracks?.items?.[0];
              if (foundTrack && foundTrack.id !== seedTrack.id) {
                allTracks.set(foundTrack.id, foundTrack);
              }
              
              // Om det finns tillräckligt många låtar, returnera direkt
              if (allTracks.size >= limit) {
                console.log(`Fick tillräckligt många låtar från Last.fm (${allTracks.size}), returnerar`);
                const tracksArray = Array.from(allTracks.values()).slice(0, limit);
                return tracksArray;
              }
            } catch (err) {
              // Låten hittades inte på Spotify, hoppa över
            }
          }
          
          console.log(`Hittade ${allTracks.size} Last.fm-låtar på Spotify`);
        }
      } catch (err) {
        console.warn("Last.fm-förfrågan misslyckades:", err.message);
      }
    }

    // 2. Om det behövs fler låtar, hämta från relaterade artister och genre

    if (artistId) {
      try {
        const relatedArtists = await spotifyFetch(`artists/${artistId}/related-artists`);
        const artistIds = [artistId, ...(relatedArtists.artists?.slice(0, 5).map((a) => a.id) || [])];

        for (const id of artistIds.slice(0, 3)) {
          try {
            const artist = await spotifyFetch(`artists/${id}`);
            const searchQuery = `artist:${artist.name}`;
            const searchResults = await spotifyFetch("search", {
              q: searchQuery,
              type: "track",
              limit: "10",
            });

            (searchResults.tracks?.items || []).forEach((track) => {
              if (track.id !== seedTrack.id && !allTracks.has(track.id)) {
                allTracks.set(track.id, track);
              }
            });
          } catch (err) {
            console.warn(`Kunde inte hämta låtar för artist ${id}:`, err.message);
          }
        }
      } catch (err) {
        console.warn("Kunde inte hämta relaterade artister:", err.message);
      }
    }

    if (genre) {
      try {
        const searchResults = await spotifyFetch("search", {
          q: `genre:${genre}`,
          type: "track",
          limit: "20",
        });

        (searchResults.tracks?.items || []).forEach((track) => {
          if (track.id !== seedTrack.id && !allTracks.has(track.id)) {
            allTracks.set(track.id, track);
          }
        });
      } catch (err) {
        console.warn("Kunde inte söka efter genre:", err.message);
      }
    }

    if (artistName) {
      try {
        const searchResults = await spotifyFetch("search", {
          q: artistName,
          type: "track",
          limit: "20",
        });

        (searchResults.tracks?.items || []).forEach((track) => {
          if (track.id !== seedTrack.id && !allTracks.has(track.id)) {
            allTracks.set(track.id, track);
          }
        });
      } catch (err) {
        console.warn("Kunde inte söka efter artistnamn:", err.message);
      }
    }

    const tracksArray = Array.from(allTracks.values()).slice(0, limit);
    console.log(`Fallback-metoden returnerade ${tracksArray.length} låtar`);
    return tracksArray;
  } catch (error) {
    console.error("Fallback-metoden misslyckades:", error);
    return [];
  }
}

