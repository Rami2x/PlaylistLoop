// Hanterar Spotify tokens i Firestore med Firebase Admin SDK
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

let db = null;
let firestoreAvailable = false;

// Initiera Firebase Admin SDK
try {
  if (!admin.apps.length) {
    // Om credentials finns i env, använd dem
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        db = admin.firestore();
        firestoreAvailable = true;
        console.log("Firebase Admin SDK initierad med service account");
      } catch (error) {
        console.warn("Kunde inte initiera Firebase Admin SDK med service account:", error.message);
      }
    } else {
      // Försök med applicationDefault (fungerar på Railway med Google Cloud integration)
      try {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: "playlistloop-11055",
        });
        db = admin.firestore();
        firestoreAvailable = true;
        console.log("Firebase Admin SDK initierad med applicationDefault");
      } catch (error) {
        console.warn("Firebase Admin SDK kunde inte initieras:", error.message);
        console.warn("Tokens kommer endast sparas i minnet. Lägg till FIREBASE_SERVICE_ACCOUNT i env för permanent lagring.");
      }
    }
  } else {
    db = admin.firestore();
    firestoreAvailable = true;
  }
} catch (error) {
  console.warn("Firebase Admin SDK initiering misslyckades:", error.message);
}

// Spara Spotify tokens för en användare
export async function saveSpotifyTokens(userId, tokens) {
  if (!firestoreAvailable || !db) {
    // Firestore inte tillgänglig, returnera false (fallback till in-memory)
    return false;
  }

  try {
    await db.collection("spotifyTokens").doc(userId).set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`Tokens sparade i Firestore för userId: ${userId}`);
    return true;
  } catch (error) {
    console.error("Fel i saveSpotifyTokens:", error.message);
    return false; // Returnera false vid fel, så vi inte kraschar
  }
}

// Hämta Spotify tokens för en användare
export async function getSpotifyTokens(userId) {
  if (!firestoreAvailable || !db) {
    return null; // Firestore inte tillgänglig
  }

  try {
    const doc = await db.collection("spotifyTokens").doc(userId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    
    // Se till att expiresAt är ett nummer
    let expiresAt = data.expiresAt;
    if (expiresAt && typeof expiresAt !== 'number') {
      // Om det är ett Firestore Timestamp, konvertera till number
      if (expiresAt.toMillis) {
        expiresAt = expiresAt.toMillis();
      } else if (expiresAt.seconds) {
        expiresAt = expiresAt.seconds * 1000;
      } else {
        expiresAt = parseInt(expiresAt) || 0;
      }
    }
    
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: expiresAt || 0,
    };
  } catch (error) {
    console.error("Fel i getSpotifyTokens:", error.message);
    return null;
  }
}

// Ta bort Spotify tokens för en användare
export async function deleteSpotifyTokens(userId) {
  if (!firestoreAvailable || !db) {
    return false; // Firestore inte tillgänglig
  }

  try {
    await db.collection("spotifyTokens").doc(userId).delete();
    console.log(`Tokens borttagna från Firestore för userId: ${userId}`);
    return true;
  } catch (error) {
    console.error("Fel i deleteSpotifyTokens:", error.message);
    return false;
  }
}

