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
  toggleEra: document.getElementById("toggleEra"),
  playlistTitle: document.getElementById("playlistTitle"),
  playlistMeta: document.getElementById("playlistMeta"),
  playlistItems: document.getElementById("playlistItems"),
  saveList: document.getElementById("saveList"),
  authButton: document.getElementById("authButton"),
  authModal: document.getElementById("authModal"),
  closeAuthModal: document.getElementById("closeAuthModal"),
  authForm: document.getElementById("authForm"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  authSubmit: document.getElementById("authSubmit"),
  toggleAuthMode: document.getElementById("toggleAuthMode"),
  authModalTitle: document.getElementById("authModalTitle"),
  authError: document.getElementById("authError"),
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
  isLoginMode: true,
  currentUser: null,
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
  
  if (!state.selectedTrack || !state.selectedTrack.id) {
    setPlaylistError("Ingen låt är vald. Välj en låt från sökresultaten först.");
    return;
  }

  try {
    const params = new URLSearchParams({
      seedTrackId: state.selectedTrack.id,
      limitEra: dom.toggleEra.checked ? "1" : "0",
      limit: "45",
    });
    
    const url = `/api/recommendations?${params.toString()}`;
    console.log("Fetching recommendations:", url);
    
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
        // Ignore JSON parse errors
      }
      throw new Error(errorMessage);
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
    `;
    dom.playlistItems.appendChild(li);
  });
}

function initAuth() {
  if (!window.firebaseAuth || !window.firebaseAuthHelpers) {
    console.warn("Firebase not initialized. Make sure to update Firebase config in index.html");
    return;
  }

  const { onAuthStateChanged } = window.firebaseAuthHelpers;

  onAuthStateChanged(window.firebaseAuth, (user) => {
    state.currentUser = user;
    updateAuthUI();
  });

  dom.authButton?.addEventListener("click", async (e) => {
    if (state.currentUser) {
      const { signOut } = window.firebaseAuthHelpers;
      await signOut(window.firebaseAuth);
      state.currentUser = null;
      updateAuthUI();
    } else {
      dom.authModal?.classList.remove("hidden");
    }
  });

  dom.closeAuthModal?.addEventListener("click", () => {
    dom.authModal?.classList.add("hidden");
    clearAuthError();
  });

  dom.toggleAuthMode?.addEventListener("click", () => {
    state.isLoginMode = !state.isLoginMode;
    updateAuthForm();
  });

  dom.authForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = dom.authEmail.value.trim();
    const password = dom.authPassword.value.trim();

    if (!email || !password) {
      showAuthError("Vänligen fyll i både e-post och lösenord.");
      return;
    }

    try {
      dom.authSubmit.disabled = true;
      dom.authSubmit.textContent = state.isLoginMode ? "Loggar in..." : "Registrerar...";
      clearAuthError();

      const {
        signInWithEmailAndPassword,
        createUserWithEmailAndPassword,
      } = window.firebaseAuthHelpers;

      if (state.isLoginMode) {
        await signInWithEmailAndPassword(window.firebaseAuth, email, password);
        dom.authModal?.classList.add("hidden");
      } else {
        await createUserWithEmailAndPassword(window.firebaseAuth, email, password);
        dom.authModal?.classList.add("hidden");
      }
    } catch (error) {
      console.error("Auth error:", error);
      let errorMessage = "Ett fel inträffade. Försök igen.";
      if (error.code === "auth/user-not-found") {
        errorMessage = "Ingen användare hittades med den e-posten.";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Fel lösenord.";
      } else if (error.code === "auth/email-already-in-use") {
        errorMessage = "Denna e-post används redan. Logga in istället.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Lösenordet är för svagt. Använd minst 6 tecken.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Ogiltig e-postadress.";
      }
      showAuthError(errorMessage);
    } finally {
      dom.authSubmit.disabled = false;
      dom.authSubmit.textContent = state.isLoginMode ? "Logga in" : "Registrera";
    }
  });
}

function updateAuthUI() {
  if (state.currentUser) {
    dom.authButton.textContent = "Logga ut";
    if (dom.saveList) dom.saveList.disabled = false;
  } else {
    dom.authButton.textContent = "Logga in";
    if (dom.saveList) dom.saveList.disabled = true;
  }
}

function updateAuthForm() {
  if (state.isLoginMode) {
    dom.authModalTitle.textContent = "Logga in";
    dom.authSubmit.textContent = "Logga in";
    dom.toggleAuthMode.textContent = "Har du inget konto? Registrera dig";
  } else {
    dom.authModalTitle.textContent = "Registrera dig";
    dom.authSubmit.textContent = "Registrera";
    dom.toggleAuthMode.textContent = "Har du redan ett konto? Logga in";
  }
  clearAuthError();
}

function showAuthError(message) {
  if (dom.authError) {
    dom.authError.textContent = message;
    dom.authError.classList.remove("hidden");
  }
}

function clearAuthError() {
  if (dom.authError) {
    dom.authError.textContent = "";
    dom.authError.classList.add("hidden");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAuth);
} else {
  initAuth();
}
