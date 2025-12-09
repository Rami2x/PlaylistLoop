const dom = {
  openGenerator: document.getElementById("openGenerator"),
  openMyLists: document.getElementById("openMyLists"),
  generatorSection: document.getElementById("generator"),
  myListsSection: document.getElementById("myLists"),
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
  myListsContent: document.getElementById("myListsContent"),
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
  currentPlaylist: null,
  isLoginMode: true,
  currentUser: null,
};

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
});

dom.saveList?.addEventListener("click", async () => {
  if (!state.currentUser) {
    dom.authModal?.classList.remove("hidden");
    return;
  }
  
  if (!state.currentPlaylist || !state.currentPlaylist.tracks?.length) {
    alert("Generera en spellista först innan du sparar.");
    return;
  }
  
  try {
    dom.saveList.disabled = true;
    dom.saveList.textContent = "Sparar...";
    
    await savePlaylistToFirestore(state.currentPlaylist);
    
    dom.saveList.textContent = "Sparad!";
    
    // Ladda om listorna om användaren är på "Mina listor"-sidan
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
    if (dom.openMyLists) dom.openMyLists.style.display = "inline-block";
  } else {
    dom.authButton.textContent = "Logga in";
    if (dom.saveList) dom.saveList.disabled = true;
    if (dom.openMyLists) dom.openMyLists.style.display = "none";
    if (dom.myListsSection) dom.myListsSection.style.display = "none";
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

// Firestore-funktioner för att spara och hämta listor

async function savePlaylistToFirestore(playlistData) {
  if (!window.firebaseDb || !window.firebaseFirestoreHelpers || !state.currentUser) {
    throw new Error("Firebase eller användare inte tillgänglig");
  }
  
  const { collection, addDoc } = window.firebaseFirestoreHelpers;
  
  const playlistToSave = {
    userId: state.currentUser.uid,
    title: playlistData.meta?.title || "Namnlös spellista",
    genre: playlistData.meta?.genre || "N/A",
    tracks: playlistData.tracks || [],
    seedTrack: state.selectedTrack ? {
      id: state.selectedTrack.id,
      name: state.selectedTrack.name,
      artists: state.selectedTrack.artists,
    } : null,
    createdAt: new Date().toISOString(),
  };
  
  const playlistsRef = collection(window.firebaseDb, "playlists");
  await addDoc(playlistsRef, playlistToSave);
}

async function loadMyLists() {
  if (!window.firebaseDb || !window.firebaseFirestoreHelpers || !state.currentUser) {
    if (dom.myListsContent) {
      dom.myListsContent.innerHTML = '<p class="error-message">Du måste vara inloggad för att se dina listor.</p>';
    }
    return;
  }
  
  if (!dom.myListsContent) return;
  
  dom.myListsContent.innerHTML = '<p class="status-text">Laddar dina listor...</p>';
  
  try {
    const { collection, getDocs, query, where, orderBy } = window.firebaseFirestoreHelpers;
    const playlistsRef = collection(window.firebaseDb, "playlists");
    
    // Försök först med orderBy, om det misslyckas (pga saknad index) försök utan
    let querySnapshot;
    try {
      const q = query(
        playlistsRef,
        where("userId", "==", state.currentUser.uid),
        orderBy("createdAt", "desc")
      );
      querySnapshot = await getDocs(q);
    } catch (orderByError) {
      // Om orderBy misslyckas (t.ex. saknad index), hämta utan sortering
      console.warn("orderBy failed, fetching without sorting:", orderByError);
      const q = query(
        playlistsRef,
        where("userId", "==", state.currentUser.uid)
      );
      querySnapshot = await getDocs(q);
      // Sortera manuellt i JavaScript istället
      const docs = [];
      querySnapshot.forEach((doc) => docs.push(doc));
      docs.sort((a, b) => {
        const dateA = a.data().createdAt || "";
        const dateB = b.data().createdAt || "";
        return dateB.localeCompare(dateA); // Nyaste först
      });
      // Skapa en mock QuerySnapshot-liknande struktur
      querySnapshot = {
        empty: docs.length === 0,
        forEach: (callback) => docs.forEach(callback)
      };
    }
    
    if (querySnapshot.empty) {
      dom.myListsContent.innerHTML = '<p class="status-text">Du har inga sparade listor ännu. Generera och spara en lista först!</p>';
      return;
    }
    
    dom.myListsContent.innerHTML = "";
    const listsContainer = document.createElement("div");
    listsContainer.className = "saved-lists";
    
    querySnapshot.forEach((docSnapshot) => {
      const playlist = docSnapshot.data();
      const listItem = document.createElement("div");
      listItem.className = "saved-list-item";
      listItem.innerHTML = `
        <div class="saved-list-header">
          <div>
            <h4>${playlist.title}</h4>
            <p class="saved-list-meta">Genre: ${playlist.genre} · ${playlist.tracks?.length || 0} låtar</p>
            <p class="saved-list-date">Sparad: ${new Date(playlist.createdAt).toLocaleDateString("sv-SE")}</p>
          </div>
          <button class="btn btn--ghost btn--small delete-list-btn" data-list-id="${docSnapshot.id}">Ta bort</button>
        </div>
        <ol class="saved-list-tracks">
          ${playlist.tracks?.slice(0, 10).map((track, index) => `
            <li>
              <strong>${track.name}</strong>
              <div class="track-meta">${track.artists} · ${track.album}</div>
            </li>
          `).join("") || ""}
          ${playlist.tracks?.length > 10 ? `<li class="more-tracks">... och ${playlist.tracks.length - 10} fler låtar</li>` : ""}
        </ol>
      `;
      
      const deleteBtn = listItem.querySelector(".delete-list-btn");
      deleteBtn.addEventListener("click", () => deletePlaylist(docSnapshot.id));
      
      listsContainer.appendChild(listItem);
    });
    
    dom.myListsContent.appendChild(listsContainer);
  } catch (error) {
    console.error("Error loading playlists:", error);
    dom.myListsContent.innerHTML = '<p class="error-message">Kunde inte ladda dina listor. Försök igen senare.</p>';
  }
}

async function deletePlaylist(listId) {
  if (!window.firebaseDb || !window.firebaseFirestoreHelpers || !state.currentUser) {
    return;
  }
  
  if (!confirm("Är du säker på att du vill ta bort denna lista?")) {
    return;
  }
  
  try {
    const { deleteDoc, doc } = window.firebaseFirestoreHelpers;
    const playlistRef = doc(window.firebaseDb, "playlists", listId);
    await deleteDoc(playlistRef);
    loadMyLists();
  } catch (error) {
    console.error("Error deleting playlist:", error);
    alert("Kunde inte ta bort listan. Försök igen.");
  }
}
