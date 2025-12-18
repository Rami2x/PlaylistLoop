// Funktioner för inloggning och registrering
import { dom } from "../utils/dom.js";
import { state } from "../utils/state.js";
import { checkSpotifyConnection, updateSpotifyUI } from "../spotify/spotify.js";

export function initAuth() {
  if (!window.firebaseAuth || !window.firebaseAuthHelpers) {
    console.warn("Firebase inte initierat. Kontrollera Firebase-konfiguration i index.html");
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
      console.error("Autentiseringsfel:", error);
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

export function updateAuthUI() {
  if (state.currentUser) {
    dom.authButton.textContent = "Logga ut";
    if (dom.saveList) dom.saveList.disabled = false;
    if (dom.openMyLists) dom.openMyLists.style.display = "inline-block";
    checkSpotifyConnection();
  } else {
    dom.authButton.textContent = "Logga in";
    if (dom.saveList) dom.saveList.disabled = true;
    if (dom.openMyLists) dom.openMyLists.style.display = "none";
    if (dom.myListsSection) dom.myListsSection.style.display = "none";
    state.spotifyConnected = false;
    updateSpotifyUI();
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

