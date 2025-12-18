// Funktioner för att söka låtar och skapa spellistor
import { dom } from "../utils/dom.js";
import { state } from "../utils/state.js";

export async function handleSearch() {
  const query = dom.searchInput.value.trim();
  if (!query) {
    dom.searchStatus.textContent = "Ange en låttitel först.";
    return;
  }
  dom.searchStatus.innerHTML = '<span class="spinner"></span>Söker...';
  dom.searchButton.disabled = true;
  dom.searchResults.innerHTML = "";
  state.searchResults = [];
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Spotify-autentisering misslyckades. Kontrollera API-nycklar.");
      }
      if (response.status >= 500) {
        throw new Error("Spotify API:t svarar inte. Försök igen om en stund.");
      }
      throw new Error("Sökning misslyckades");
    }
    const data = await response.json();
    state.searchResults = data.tracks;
    renderSearchResults();
    dom.searchStatus.textContent =
      data.tracks.length > 0 ? "Välj en låt nedan." : "Inga träffar hittades. Prova en annan sökning.";
  } catch (error) {
    console.error(error);
    dom.searchStatus.innerHTML = `<span class="error-message">${error.message || "Tekniskt fel vid sökning."}</span>`;
  } finally {
    dom.searchButton.disabled = false;
  }
}

export function renderSearchResults() {
  dom.searchResults.innerHTML = "";
  state.searchResults.forEach((track) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `
      <strong>${track.name}</strong>
      <div class="track-meta">${track.artists} · ${track.album} (${track.year || "—"})</div>
    `;
    button.addEventListener("click", () => {
      state.selectedTrack = track;
      dom.selectedTrackId.value = track.id;
      dom.selectedTrackBox.innerHTML = `
        <h4>Vald låt</h4>
        <span>${track.name} · ${track.artists}</span>
      `;
      dom.selectedTrackBox.classList.remove("hidden");
    });
    const li = document.createElement("li");
    li.appendChild(button);
    dom.searchResults.appendChild(li);
  });
}

// Exporterar funktioner som behövs i app.js
export { setPlaylistLoading, setPlaylistError, renderPlaylist };

function setPlaylistLoading(isLoading) {
  if (isLoading) {
    dom.playlistTitle.innerHTML = '<span class="spinner"></span>Skapar spellista...';
    dom.playlistItems.innerHTML = '<li><span class="spinner"></span>Hämtar rekommendationer från Spotify...</li>';
    if (dom.saveList) dom.saveList.disabled = true;
  } else {
    if (dom.saveList) dom.saveList.disabled = false;
  }
}

function setPlaylistError(message) {
  dom.playlistTitle.textContent = "Fel vid generering";
  dom.playlistItems.innerHTML = `<li class="error-message">${message}</li>`;
  if (dom.saveList) dom.saveList.disabled = true;
}

function renderPlaylist(data) {
  const { meta, tracks } = data;
  dom.playlistTitle.textContent =
    meta?.title || `Spellista inspirerad av ${state.selectedTrack?.name || "din låt"}`;
  dom.playlistMeta.innerHTML = ``;

  if (!tracks?.length) {
    dom.playlistItems.innerHTML = "<li>Inga förslag från API:t. Prova en annan låt.</li>";
    return;
  }

  dom.playlistItems.innerHTML = "";
  tracks.forEach((track) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>${track.name}</strong>
        <div class="track-meta">${track.artists} · ${track.album}</div>
      </div>
    `;
    dom.playlistItems.appendChild(li);
  });
}

export async function generatePlaylist() {
  if (!state.selectedTrack || !state.selectedTrack.id) {
    setPlaylistError("Ingen låt är vald. Välj en låt från sökresultaten först.");
    return;
  }

  try {
    const params = new URLSearchParams({
      seedTrackId: state.selectedTrack.id,
      limit: "45",
    });

    const url = `/api/recommendations?${params.toString()}`;
    console.log("Hämtar rekommendationer:", url);

    setPlaylistLoading(true);
    const response = await fetch(url);
    if (!response.ok) {
      let errorMessage = "Kunde inte hämta rekommendationer.";
      try {
        const errorData = await response.json();
        if (errorData.details) {
          errorMessage = `Fel: ${errorData.details}`;
        }
      } catch (e) {
        // Ignorera JSON parse-fel
      }
      throw new Error(errorMessage);
    }
    const data = await response.json();
    state.currentPlaylist = data;
    renderPlaylist(data);
  } catch (error) {
    console.error(error);
    let errorMessage = "Ett fel inträffade när spellistan skulle skapas.";
    if (error.message) {
      errorMessage = error.message;
    } else if (error instanceof TypeError && error.message.includes("fetch")) {
      errorMessage = "Kunde inte ansluta till servern. Kontrollera att servern körs.";
    }
    setPlaylistError(errorMessage);
  } finally {
    setPlaylistLoading(false);
  }
}

