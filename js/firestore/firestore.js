// Firestore database operations
import { dom } from "../utils/dom.js";
import { state } from "../utils/state.js";

export async function savePlaylistToFirestore(playlistData) {
  if (!window.firebaseDb || !window.firebaseFirestoreHelpers || !state.currentUser) {
    throw new Error("Firebase eller användare inte tillgänglig");
  }

  const { collection, addDoc } = window.firebaseFirestoreHelpers;

  const playlistToSave = {
    userId: state.currentUser.uid,
    title: playlistData.meta?.title || "Namnlös spellista",
    genre: playlistData.meta?.genre || "N/A",
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
      console.warn("orderBy failed, fetching without sorting:", orderByError);
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
            <p class="saved-list-meta">Genre: ${playlist.genre} · ${playlist.tracks?.length || 0} låtar</p>
            <p class="saved-list-date">Sparad: ${new Date(playlist.createdAt).toLocaleDateString("sv-SE")}</p>
          </div>
          <button class="btn btn--ghost btn--small delete-list-btn" data-list-id="${docSnapshot.id}">Ta bort</button>
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

      listsContainer.appendChild(listItem);
    });

    dom.myListsContent.appendChild(listsContainer);
  } catch (error) {
    console.error("Error loading playlists:", error);
    dom.myListsContent.innerHTML =
      '<p class="error-message">Kunde inte ladda dina listor. Försök igen senare.</p>';
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
    console.error("Error deleting playlist:", error);
    alert("Kunde inte ta bort listan. Försök igen.");
  }
}

