// Firebase Configuration (replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyCD8a60aGbdXdYFKKKrV-z0mCDZx9yKWqI",
  authDomain: "team-pro-stats.firebaseapp.com",
  projectId: "team-pro-stats",
  storageBucket: "team-pro-stats.firebasestorage.app",
  messagingSenderId: "758444286089",
  appId: "1:758444286089:web:fcd8fba3a5d705de01e658",
  measurementId: "G-D1GDDBPD55"
};

// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUserId = null; // To store the anonymous user's UID

// Define paths for different data types
export const FB_PATHS = {
  fieldPlayers: 'players/fieldPlayers',
  goalKeepers: 'players/goalKeepers',
  jogoFormData: 'config/jogoFormData',
  estatisticasValores: 'stats/estatisticasValores', // For statsData and inOutData
  estatisticasExtraTime: 'stats/estatisticasExtraTime', // For extra-time stats
  estatisticasSeparadasExtra: 'stats/estatisticasSeparadasExtra', // For extra-time in/out
  pseData: 'pse/pseData',
  teamLogo: 'config/teamLogo'
};

// --- Authentication ---
async function ensureAuth() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUserId = user.uid;
        resolve(user);
      } else {
        signInAnonymously(auth)
          .then((userCredential) => {
            currentUserId = userCredential.user.uid;
            resolve(userCredential.user);
          })
          .catch((error) => {
            console.error("Anonymous sign-in failed:", error);
            reject(error);
          });
      }
    });
  });
}

// --- Helper Functions for Firestore ---

// Get a document reference for the current user
function getUserDocRef(path) {
  if (!currentUserId) {
    console.error("User not authenticated. Cannot get document reference.");
    return null;
  }
  // For simplicity, all data is stored under a single document per path.
  // If you need multiple documents in a collection, adjust this.
  return doc(db, `users/${currentUserId}/${path}`);
}

// Set data to Firestore
export async function setFirebaseData(path, data) {
  await ensureAuth();
  const docRef = getUserDocRef(path);
  if (docRef) {
    await setDoc(docRef, data, { merge: true }); // Use merge to update specific fields
  }
}

// Get data from Firestore once
export async function getFirebaseData(path) {
  await ensureAuth();
  const docRef = getUserDocRef(path);
  if (docRef) {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  }
  return null;
}

// Listen for real-time changes
export async function onFirebaseDataChange(path, callback) {
  await ensureAuth();
  const docRef = getUserDocRef(path);
  if (docRef) {
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data());
      } else {
        callback(null); // Document doesn't exist
      }
    }, (error) => {
      console.error("Error listening to data:", error);
      callback(null);
    });
  }
  return () => {}; // Return an empty unsubscribe function
}

// Delete data
export async function deleteFirebaseData(path) {
  await ensureAuth();
  const docRef = getUserDocRef(path);
  if (docRef) {
    await deleteDoc(docRef);
  }
}

// --- Migration from localStorage to Firebase ---
export async function migrateLocalStorageToFirebase() {
  await ensureAuth(); // Ensure user is authenticated before migration

  const migrationKeys = [
    { lsKey: 'fieldPlayers', fbPath: FB_PATHS.fieldPlayers },
    { lsKey: 'goalKeepers', fbPath: FB_PATHS.goalKeepers },
    { lsKey: 'jogo_form_data', fbPath: FB_PATHS.jogoFormData },
    { lsKey: 'estatisticas_valores', fbPath: FB_PATHS.estatisticasValores },
    { lsKey: 'estatisticas_extra_time', fbPath: FB_PATHS.estatisticasExtraTime },
    { lsKey: 'estatisticas_separadas_extra', fbPath: FB_PATHS.estatisticasSeparadasExtra },
    { lsKey: 'pseData', fbPath: FB_PATHS.pseData },
    { lsKey: 'estatisticas_separadas', fbPath: FB_PATHS.teamLogo }, // This key holds the logo
    { lsKey: 'teamLogoBase64', fbPath: FB_PATHS.teamLogo }, // Also check this for logo
  ];

  console.log("Starting localStorage to Firebase migration...");

  for (const { lsKey, fbPath } of migrationKeys) {
    const lsData = localStorage.getItem(lsKey);
    if (lsData) {
      try {
        let parsedData = JSON.parse(lsData);
        
        // Special handling for logo, which might be directly in 'teamLogoBase64' or 'estatisticas_separadas.logo'
        if (lsKey === 'estatisticas_separadas' && parsedData.logo) {
            await setFirebaseData(fbPath, { logo: parsedData.logo });
            console.log(`Migrated ${lsKey} (logo) to Firebase.`);
        } else if (lsKey === 'teamLogoBase64') {
            await setFirebaseData(fbPath, { logo: parsedData }); // Store directly as logo
            console.log(`Migrated ${lsKey} (logo) to Firebase.`);
        }
        else {
            await setFirebaseData(fbPath, parsedData);
            console.log(`Migrated ${lsKey} to Firebase.`);
        }
        localStorage.removeItem(lsKey); // Remove from localStorage after successful migration
      } catch (e) {
        console.error(`Error migrating ${lsKey}:`, e);
      }
    }
  }
  console.log("localStorage migration complete.");
}

// Ensure authentication and run migration on load
ensureAuth().then(() => {
  migrateLocalStorageToFirebase();
}).catch(error => {
  console.error("Failed to authenticate for migration:", error);
});
