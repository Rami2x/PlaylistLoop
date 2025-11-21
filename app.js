const dom = {
  openGenerator: document.getElementById("openGenerator"),
  generatorSection: document.getElementById("generator"),
  generatorForm: document.getElementById("generatorForm"),
  searchInput: document.getElementById("searchInput"),
  searchButton: document.getElementById("searchButton"),
  searchStatus: document.getElementById("searchStatus"),
  searchResults: document.getElementById("searchResults"),
  selectedTrackId: document.getElementById("selectedTrackId"),
  selectedTrackBox: document.getElementById("selectedTrack"),
  toggleEnergy: document.getElementById("toggleEnergy"),
  toggleEra: document.getElementById("toggleEra"),
  playlistTitle: document.getElementById("playlistTitle"),
  playlistMeta: document.getElementById("playlistMeta"),
  playlistItems: document.getElementById("playlistItems"),
  saveList: document.getElementById("saveList"),
  dailyTrackTitle: document.getElementById("dailyTrackTitle"),
  dailyTrackGenre: document.getElementById("dailyTrackGenre"),
  dailyTrackMood: document.getElementById("dailyTrackMood"),
  dailyTrackBpm: document.getElementById("dailyTrackBpm"),
  dailyTrackNote: document.getElementById("dailyTrackNote"),
  dailyTrackSource: document.getElementById("dailyTrackSource"),
};

const state = {
  searchResults: [],
  selectedTrack: null,
};

if (dom.openGenerator && dom.generatorSection) {
  dom.openGenerator.addEventListener("click", () => {
    dom.generatorSection.scrollIntoView({ behavior: "smooth" });
  });
}

initDailyTrackCard();

dom.searchButton?.addEventListener("click", handleSearch);
dom.searchInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleSearch();
  }
});

dom.generatorForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedTrack) {
    dom.searchStatus.textContent = "Välj en låt innan du genererar listan.";
    return;
  }

  try {
    const params = new URLSearchParams({
      seedTrackId: state.selectedTrack.id,
      matchEnergy: dom.toggleEnergy.checked ? "1" : "0",
      limitEra: dom.toggleEra.checked ? "1" : "0",
      limit: "45",
    });
    setPlaylistLoading(true);
    const response = await fetch(`/api/recommendations?${params.toString()}`);
    if (!response.ok) {
      throw new Error("Kunde inte hämta rekommendationer.");
    }
    const data = await response.json();
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
});

dom.saveList?.addEventListener("click", () => {
  if (!state.selectedTrack) {
    alert("Generera en spellista först innan du sparar.");
    return;
  }
  alert("Den här funktionen kommer exportera listan till ditt Spotify-konto när OAuth är implementerat.");
});

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

async function handleSearch() {
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

function renderSearchResults() {
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
  dom.playlistMeta.innerHTML = `
    <span>Genre: ${meta?.genre || "–"}</span>
    <span>Energi: ${meta?.energyLabel || "–"}</span>
    <span>BPM-snittsiffra: ${meta?.avgBpm ? Math.round(meta.avgBpm) : "–"}</span>
  `;

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
      <div class="track-meta">${track.bpm ? `${Math.round(track.bpm)} BPM` : ""}</div>
    `;
    dom.playlistItems.appendChild(li);
  });
}

