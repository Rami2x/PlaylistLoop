// Funktioner för att spara och ladda spellistor från Firestore
import { dom } from "../utils/dom.js";
import { state } from "../utils/state.js";
import { exportPlaylistToSpotifyFromSaved } from "../spotify/spotify.js";

export async function savePlaylistToFirestore(playlistData) {
  if (!window.firebaseDb || !window.firebaseFirestoreHelpers || !state.currentUser) {
    throw new Error("Firebase eller användare inte tillgänglig");
  }

  const { collection, addDoc } = window.firebaseFirestoreHelpers;

  const playlistToSave = {
    userId: state.currentUser.uid,
    title: playlistData.meta?.title || "Namnlös spellista",
    tracks: playlistData.tracks || [],
    seedTrack: state.selectedTrack
      ? {
          id: state.selectedTrack.id,
          name: state.selectedTrack.name,
          artists: state.selectedTrack.artists,
        }
      : null,
    createdAt: new Date().toISOString(),
  };

  const playlistsRef = collection(window.firebaseDb, "playlists");
  await addDoc(playlistsRef, playlistToSave);
}

export async function loadMyLists() {
  if (!window.firebaseDb || !window.firebaseFirestoreHelpers || !state.currentUser) {
    if (dom.myListsContent) {
      dom.myListsContent.innerHTML =
        '<p class="error-message">Du måste vara inloggad för att se dina listor.</p>';
    }
    return;
  }

  if (!dom.myListsContent) return;

  dom.myListsContent.innerHTML = '<p class="status-text">Laddar dina listor...</p>';

  try {
    const { collection, getDocs, query, where, orderBy } = window.firebaseFirestoreHelpers;
    const playlistsRef = collection(window.firebaseDb, "playlists");

    let querySnapshot;
    try {
      const q = query(
        playlistsRef,
        where("userId", "==", state.currentUser.uid),
        orderBy("createdAt", "desc")
      );
      querySnapshot = await getDocs(q);
    } catch (orderByError) {
      console.warn("orderBy misslyckades, hämtar utan sortering:", orderByError);
      const q = query(playlistsRef, where("userId", "==", state.currentUser.uid));
      querySnapshot = await getDocs(q);
      const docs = [];
      querySnapshot.forEach((doc) => docs.push(doc));
      docs.sort((a, b) => {
        const dateA = a.data().createdAt || "";
        const dateB = b.data().createdAt || "";
        return dateB.localeCompare(dateA);
      });
      querySnapshot = {
        empty: docs.length === 0,
        forEach: (callback) => docs.forEach(callback),
      };
    }

    if (querySnapshot.empty) {
      dom.myListsContent.innerHTML =
        '<p class="status-text">Du har inga sparade listor ännu. Generera och spara en lista först!</p>';
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
            <p class="saved-list-meta">${playlist.tracks?.length || 0} låtar</p>
            <p class="saved-list-date">Sparad: ${new Date(playlist.createdAt).toLocaleDateString("sv-SE")}</p>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn--ghost btn--small export-list-btn" data-list-id="${docSnapshot.id}">Exportera till Spotify</button>
            <button class="btn btn--ghost btn--small delete-list-btn" data-list-id="${docSnapshot.id}">Ta bort</button>
          </div>
        </div>
        <ol class="saved-list-tracks">
          ${playlist.tracks?.slice(0, 10).map(
            (track, index) => `
            <li>
              <strong>${track.name}</strong>
              <div class="track-meta">${track.artists} · ${track.album}</div>
            </li>
          `
          ).join("") || ""}
          ${playlist.tracks?.length > 10 ? `<li class="more-tracks">... och ${playlist.tracks.length - 10} fler låtar</li>` : ""}
        </ol>
      `;

      const deleteBtn = listItem.querySelector(".delete-list-btn");
      deleteBtn.addEventListener("click", () => deletePlaylist(docSnapshot.id));
      
      const exportBtn = listItem.querySelector(".export-list-btn");
      exportBtn.addEventListener("click", (event) => exportPlaylistToSpotify(playlist, docSnapshot.id, event));

      listsContainer.appendChild(listItem);
    });

    dom.myListsContent.appendChild(listsContainer);
  } catch (error) {
    console.error("Fel vid laddning av spellistor:", error);
    dom.myListsContent.innerHTML =
      '<p class="error-message">Kunde inte ladda dina listor. Försök igen senare.</p>';
  }
}

async function exportPlaylistToSpotify(playlistData, listId, event) {
  const exportBtn = event?.target;
  
  try {
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.textContent = "Exporterar...";
    }
    
    await exportPlaylistToSpotifyFromSaved(playlistData);
    
    if (exportBtn) {
      exportBtn.textContent = "Exporterad!";
      setTimeout(() => {
        exportBtn.textContent = "Exportera till Spotify";
        exportBtn.disabled = false;
      }, 2000);
    }
  } catch (error) {
    console.error("Fel vid export av spellista:", error);
    let errorMessage = error.message || "Kunde inte exportera till Spotify";
    
    // Visa mer specifikt felmeddelande
    if (errorMessage.includes("ansluten")) {
      alert("Du måste vara ansluten till Spotify. Klicka på 'Anslut Spotify' först.");
    } else {
      alert(`Kunde inte exportera till Spotify: ${errorMessage}`);
    }
    
    if (exportBtn) {
      exportBtn.textContent = "Exportera till Spotify";
      exportBtn.disabled = false;
    }
  }
}

export async function deletePlaylist(listId) {
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
    console.error("Fel vid radering av spellista:", error);
    alert("Kunde inte ta bort listan. Försök igen.");
  }
}

