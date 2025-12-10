// Playlist recommendation fallback logic
import { spotifyFetch, getFirstGenre } from "./spotify.js";

export async function getRecommendationsFallback(seedTrack, limit) {
  console.log("Using fallback method: Related Artists + Search");
  const allTracks = new Map();

  try {
    const genre = await getFirstGenre(seedTrack);
    const artistId = seedTrack?.artists?.[0]?.id;
    const artistName = seedTrack?.artists?.[0]?.name;

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

