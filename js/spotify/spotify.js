// Spotify OAuth and export functionality
import { dom } from "../utils/dom.js";
import { state } from "../utils/state.js";
import { savePlaylistToFirestore, loadMyLists } from "../firestore/firestore.js";

export async function checkSpotifyConnection() {
  if (!state.currentUser) {
    state.spotifyConnected = false;
    updateSpotifyUI();
    return;
  }

  try {
    const response = await fetch(`/api/spotify/me?userId=${state.currentUser.uid}`);
    if (response.ok) {
      state.spotifyConnected = true;
    } else {
      state.spotifyConnected = false;
    }
  } catch (error) {
    state.spotifyConnected = false;
  }
  updateSpotifyUI();
}

export function updateSpotifyUI() {
  if (dom.saveList) {
    if (state.spotifyConnected) {
      dom.saveList.textContent = "Spara i Spotify";
      dom.saveList.title = "Exportera spellistan till ditt Spotify-konto";
      if (dom.connectSpotify) dom.connectSpotify.style.display = "none";
    } else {
      dom.saveList.textContent = "Spara lokalt";
      dom.saveList.title = "Spara i Firestore (anslut till Spotify för att exportera)";
      if (dom.connectSpotify && state.currentUser) {
        dom.connectSpotify.style.display = "inline-block";
      }
    }
  }
}

export async function connectToSpotify() {
  if (!state.currentUser) {
    alert("Du måste vara inloggad först.");
    return;
  }

  try {
    const response = await fetch(`/api/spotify/auth?userId=${state.currentUser.uid}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Okänt fel" }));
      throw new Error(errorData.error || `Serverfel: ${response.status}`);
    }
    const data = await response.json();
    if (!data.authUrl) {
      throw new Error("Ingen auth URL returnerades från servern");
    }
    window.location.href = data.authUrl;
  } catch (error) {
    console.error("Error connecting to Spotify:", error);
    let errorMessage = "Kunde inte ansluta till Spotify. ";
    if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
      errorMessage += "Kontrollera att servern körs (npm start).";
    } else {
      errorMessage += error.message;
    }
    alert(errorMessage);
  }
}

export function handleSpotifyCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const spotifyConnected = urlParams.get("spotify_connected");
  const spotifyError = urlParams.get("spotify_error");

  if (spotifyConnected === "true") {
    state.spotifyConnected = true;
    updateSpotifyUI();
    window.history.replaceState({}, document.title, window.location.pathname);
    setTimeout(() => {
      alert("Ansluten till Spotify! Du kan nu exportera spellistor till ditt Spotify-konto.");
    }, 500);
  } else if (spotifyError) {
    window.history.replaceState({}, document.title, window.location.pathname);
    alert(`Spotify-anslutning misslyckades: ${spotifyError}`);
  }
}

export async function exportPlaylistToSpotify() {
  if (!state.currentUser) {
    return;
  }

  if (!state.currentPlaylist || !state.currentPlaylist.tracks?.length) {
    alert("Generera en spellista först innan du sparar.");
    return;
  }

  try {
    dom.saveList.disabled = true;
    dom.saveList.textContent = "Exporterar till Spotify...";

    const trackIds = state.currentPlaylist.tracks.map(track => track.id);
    const response = await fetch("/api/spotify/create-playlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: state.currentUser.uid,
        name: state.currentPlaylist.meta?.title || "Spellista från PlaylistLoop",
        description: `Skapad med PlaylistLoop - ${state.currentPlaylist.meta?.genre || ""}`,
        trackIds: trackIds,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Kunde inte exportera till Spotify");
    }

    const result = await response.json();

    // Spara också i Firestore
    await savePlaylistToFirestore(state.currentPlaylist);

    dom.saveList.textContent = "Exporterad!";

    if (result.playlistUrl) {
      setTimeout(() => {
        if (confirm(`Spellistan har skapats i ditt Spotify-konto!\n\nVill du öppna den i Spotify?`)) {
          window.open(result.playlistUrl, "_blank");
        }
        dom.saveList.textContent = "Spara i Spotify";
        dom.saveList.disabled = false;
      }, 1000);
    } else {
      setTimeout(() => {
        dom.saveList.textContent = "Spara i Spotify";
        dom.saveList.disabled = false;
      }, 2000);
    }

    if (dom.myListsSection && dom.myListsSection.style.display !== "none") {
      await loadMyLists();
    }
  } catch (error) {
    console.error("Error exporting to Spotify:", error);
    alert(`Kunde inte exportera till Spotify: ${error.message}`);
    dom.saveList.textContent = "Spara i Spotify";
    dom.saveList.disabled = false;
  }
}

