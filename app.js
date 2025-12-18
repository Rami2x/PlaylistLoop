// Huvudapplikationens ingångspunkt
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
    loadMyLists();
  });
}

// Sökfunktionalitet
dom.searchButton?.addEventListener("click", handleSearch);
dom.searchInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleSearch();
  }
});

// Spellistgenerering
dom.generatorForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await generatePlaylist();
});

// Spara spellista-knapp
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
      console.error("Fel vid sparande av spellista:", error);
      alert("Kunde inte spara listan. Försök igen.");
      dom.saveList.textContent = "Spara i Spotify";
      dom.saveList.disabled = false;
    }
  }
});

// Dagens låt-kort
async function initDailyTrackCard() {
  if (!dom.dailyTrackTitle) return;
  
  try {
    const response = await fetch("/api/daily-track");
    if (!response.ok) {
      throw new Error("Kunde inte hämta dagens låt");
    }
    const track = await response.json();
    
    updateDailyTrackCard({
      title: track.title,
      artists: track.artists,
      genre: track.genre,
    });
  } catch (error) {
    console.error("Fel vid laddning av dagens låt:", error);
    // Visa placeholder om API:t misslyckas
    updateDailyTrackCard({
      title: "Midnight Static",
      artists: "Unknown Artist",
      genre: "Synthwave",
    });
  }
}

function updateDailyTrackCard(track) {
  if (!dom.dailyTrackTitle) return;
  dom.dailyTrackTitle.textContent = `"${track.title}"`;
  
  // Visa artistnamn
  if (dom.dailyTrackArtist) {
    dom.dailyTrackArtist.textContent = `Artist: ${track.artists || "–"}`;
  }
  
  // Visa genre
  if (dom.dailyTrackGenre) {
    dom.dailyTrackGenre.textContent = `Genre: ${track.genre || "–"}`;
  }
  
}

// Initialize
initDailyTrackCard();

// Initiera autentisering
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAuth);
} else {
  initAuth();
}

// Hantera Spotify OAuth callback
handleSpotifyCallback();

// Event listener för Spotify-anslutning
dom.connectSpotify?.addEventListener("click", connectToSpotify);
