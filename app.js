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
  shareList: document.getElementById("shareList"),
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
    setPlaylistError("Ett fel inträffade när spellistan skulle skapas.");
  } finally {
    setPlaylistLoading(false);
  }
});

dom.saveList?.addEventListener("click", () => {
  alert("Den här knappen kommer exportera listan till Spotify när backend är klar.");
});

dom.shareList?.addEventListener("click", () => {
  alert("Här kan du senare generera en delbar länk.");
});

async function handleSearch() {
  const query = dom.searchInput.value.trim();
  if (!query) {
    dom.searchStatus.textContent = "Ange en låttitel först.";
    return;
  }
  dom.searchStatus.textContent = "Söker...";
  dom.searchResults.innerHTML = "";
  state.searchResults = [];
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error("Sökning misslyckades");
    const data = await response.json();
    state.searchResults = data.tracks;
    renderSearchResults();
    dom.searchStatus.textContent =
      data.tracks.length > 0 ? "Välj en låt nedan." : "Inga träffar just nu.";
  } catch (error) {
    console.error(error);
    dom.searchStatus.textContent = "Tekniskt fel vid sökning.";
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
    dom.playlistTitle.textContent = "Skapar spellista...";
    dom.playlistItems.innerHTML = "<li>Hämtar rekommendationer från Spotify...</li>";
  }
}

function setPlaylistError(message) {
  dom.playlistItems.innerHTML = `<li>${message}</li>`;
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

