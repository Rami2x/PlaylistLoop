// Fallback om Spotify Recommendations inte fungerar
import { spotifyFetch, getFirstGenre } from "./spotify.js";
import { getSimilarTracks } from "./lastfm.js";

export async function getRecommendationsFallback(seedTrack, limit) {
  console.log("Using fallback method: Last.fm + Related Artists + Search");
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
        console.log(`Fetching similar tracks from Last.fm for "${trackName}" by "${artistName}"...`);
        const lastfmTracks = await getSimilarTracks(artistName, trackName);
        
        if (lastfmTracks.length > 0) {
          console.log(`✅ Got ${lastfmTracks.length} similar tracks from Last.fm`);
          
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
              
              // Om vi har tillräckligt många låtar, returnera direkt
              if (allTracks.size >= limit) {
                console.log(`Got enough tracks from Last.fm (${allTracks.size}), returning early`);
                const tracksArray = Array.from(allTracks.values()).slice(0, limit);
                return tracksArray;
              }
            } catch (err) {
              // Låten hittades inte på Spotify, hoppa över
            }
          }
          
          console.log(`Found ${allTracks.size} Last.fm tracks on Spotify`);
        }
      } catch (err) {
        console.warn("Last.fm request failed:", err.message);
      }
    }

    // 2. Om vi behöver fler låtar, hämta från relaterade artister och genre

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
            console.warn(`Failed to fetch tracks for artist ${id}:`, err.message);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch related artists:", err.message);
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
        console.warn("Failed to search by genre:", err.message);
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

