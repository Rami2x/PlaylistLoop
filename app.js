// Main application entry point
import { dom } from "./js/utils/dom.js";
import { state } from "./js/utils/state.js";
import { initAuth, updateAuthUI } from "./js/auth/auth.js";
import { handleSearch, renderSearchResults, generatePlaylist, setPlaylistLoading, setPlaylistError, renderPlaylist } from "./js/playlist/playlist.js";
import { connectToSpotify, handleSpotifyCallback, exportPlaylistToSpotify, checkSpotifyConnection, updateSpotifyUI } from "./js/spotify/spotify.js";
import { savePlaylistToFirestore, loadMyLists } from "./js/firestore/firestore.js";

// Navigation
if (dom.openGenerator && dom.generatorSection) {
  dom.openGenerator.addEventListener("click", () => {
    dom.generatorSection.scrollIntoView({ behavior: "smooth" });
    dom.myListsSection.style.display = "none";
  });
}

if (dom.openMyLists && dom.myListsSection) {
  dom.openMyLists.addEventListener("click", () => {
    if (!state.currentUser) {
      dom.authModal?.classList.remove("hidden");
      return;
    }
    dom.myListsSection.style.display = "block";
    dom.myListsSection.scrollIntoView({ behavior: "smooth" });
    dom.generatorSection.scrollIntoView({ behavior: "smooth" });
    loadMyLists();
  });
}

// Search functionality
dom.searchButton?.addEventListener("click", handleSearch);
dom.searchInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleSearch();
  }
});

// Playlist generation
dom.generatorForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await generatePlaylist();
});

// Save playlist button
dom.saveList?.addEventListener("click", async () => {
  if (!state.currentUser) {
    dom.authModal?.classList.remove("hidden");
    return;
  }

  if (!state.currentPlaylist || !state.currentPlaylist.tracks?.length) {
    alert("Generera en spellista först innan du sparar.");
    return;
  }

  // Om användaren är ansluten till Spotify, exportera till Spotify
  if (state.spotifyConnected) {
    await exportPlaylistToSpotify();
  } else {
    // Inte ansluten till Spotify, spara bara i Firestore
    try {
      dom.saveList.disabled = true;
      dom.saveList.textContent = "Sparar...";

      await savePlaylistToFirestore(state.currentPlaylist);

      dom.saveList.textContent = "Sparad!";

      if (dom.myListsSection && dom.myListsSection.style.display !== "none") {
        await loadMyLists();
      }

      setTimeout(() => {
        dom.saveList.textContent = "Spara i Spotify";
        dom.saveList.disabled = false;
      }, 2000);
    } catch (error) {
      console.error("Error saving playlist:", error);
      alert("Kunde inte spara listan. Försök igen.");
      dom.saveList.textContent = "Spara i Spotify";
      dom.saveList.disabled = false;
    }
  }
});

// Daily track card (placeholder)
function initDailyTrackCard() {
  if (!dom.dailyTrackTitle) return;
  const placeholderTrack = {
    title: "Midnight Static",
    genre: "Synthwave",
    mood: "Neon Calm",
    bpm: 108,
    note: "Placeholder tills Spotify-endpointen är klar.",
    source: "Demo-data",
  };
  updateDailyTrackCard(placeholderTrack);
}

function updateDailyTrackCard(track) {
  if (!dom.dailyTrackTitle) return;
  dom.dailyTrackTitle.textContent = `"${track.title}"`;
  dom.dailyTrackGenre.textContent = `Genre: ${track.genre || "–"}`;
  dom.dailyTrackMood.textContent = `Stämning: ${track.mood || "–"}`;
  dom.dailyTrackBpm.textContent = `BPM: ${track.bpm ?? "–"}`;
  dom.dailyTrackNote.textContent = track.note || "Uppdateras automatiskt när API:t kopplas på.";
  dom.dailyTrackSource.textContent = track.source || "";
}

// Initialize
initDailyTrackCard();

// Initialize auth
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAuth);
} else {
  initAuth();
}

// Handle Spotify OAuth callback
handleSpotifyCallback();

// Event listener för Spotify-anslutning
dom.connectSpotify?.addEventListener("click", connectToSpotify);
