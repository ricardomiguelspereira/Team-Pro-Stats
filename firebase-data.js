// firebase-data.js
// Firebase Configuration (keep yours)
const firebaseConfig = {
  apiKey: "AIzaSyCD8a60aGbdXdYFKKKrV-z0mCDZx9yKWqI",
  authDomain: "team-pro-stats.firebaseapp.com",
  projectId: "team-pro-stats",
  storageBucket: "team-pro-stats.firebasestorage.app",
  messagingSenderId: "758444286089",
  appId: "1:758444286089:web:fcd8fba3a5d705de01e658",
  measurementId: "G-D1GDDBPD55"
};

// Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  deleteDoc,
  collection, // Added for listing games
  getDocs // Added for listing games
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUserId = null;
let activeGameId = null; // New: to store the currently selected game ID

// Base paths that are GLOBAL (not game-specific)
export const FB_PATHS_GLOBAL = {
  fieldPlayers: 'players/fieldPlayers',
  goalKeepers: 'players/goalKeepers',
  teamLogo: 'config/teamLogo'
};

// Paths that are GAME-SPECIFIC
export const FB_PATHS_GAME = {
  jogoFormData: 'config/jogoFormData',
  estatisticasParte1: 'stats/estatisticasParte1',
  estatisticasParte2: 'stats/estatisticasParte2',
  estatisticasValores: 'stats/estatisticasValores', // This is the old 'estatisticas.js' storage
  estatisticasExtraTime: 'stats/estatisticasExtraTime', // This is the old 'extra-time.html' storage
  estatisticasSeparadasExtra: 'stats/estatisticasSeparadasExtra', // This is the old 'entradassaidasextratime.html' storage
  pseData: 'pse/pseData'
};

// Combined FB_PATHS for external use, but internally we distinguish
export const FB_PATHS = { ...FB_PATHS_GLOBAL, ...FB_PATHS_GAME };


// Function to set the active game ID
export function setActiveGameId(gameId) {
  activeGameId = gameId;
  localStorage.setItem('activeGameId', gameId); // Persist active game ID
  console.log("Active Game ID set to:", activeGameId);
}

// Function to get the active game ID
export function getActiveGameId() {
  if (!activeGameId) {
    activeGameId = localStorage.getItem('activeGameId'); // Try to load from persistence
  }
  return activeGameId;
}

// Ensure auth (anonymous) and set currentUserId
export async function ensureAuth() {
  if (currentUserId) return currentUserId;
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUserId = user.uid;
        unsub();
        resolve(currentUserId);
      } else {
        signInAnonymously(auth)
          .then((cred) => {
            currentUserId = cred.user.uid;
            unsub();
            resolve(currentUserId);
          })
          .catch((err) => {
            unsub();
            reject(err);
          });
      }
    });
  });
}

// Build a doc ref under users/{uid}/<path parts...>
function getUserDocRef(path) {
  if (!currentUserId) throw new Error("User not authenticated");

  let fullPathParts = ['users', currentUserId];

  if (Object.values(FB_PATHS_GLOBAL).includes(path)) {
    // Global path
    fullPathParts.push(...path.split('/').filter(p => p.length));
  } else if (Object.values(FB_PATHS_GAME).includes(path)) {
    // Game-specific path
    if (!activeGameId) throw new Error("No active game ID set for game-specific path: " + path);
    fullPathParts.push('games', activeGameId, ...path.split('/').filter(p => p.length));
  } else {
    // Fallback for any other path (e.g., 'games/{gameId}')
    fullPathParts.push(...path.split('/').filter(p => p.length));
  }

  return doc(db, ...fullPathParts);
}

// Basic helpers
export async function setFirebaseData(path, data) {
  await ensureAuth();
  const ref = getUserDocRef(path);
  return setDoc(ref, data, { merge: true });
}

export async function getFirebaseData(path) {
  await ensureAuth();
  const ref = getUserDocRef(path);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// Subscribes to document changes and returns unsubscribe function
export async function onFirebaseDataChange(path, callback) {
  await ensureAuth();
  const ref = getUserDocRef(path);
  const unsubscribe = onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data() : null);
  }, (err) => {
    console.error("onSnapshot error for", path, err);
    callback(null);
  });
  return unsubscribe;
}

export async function deleteFirebaseData(path) {
  await ensureAuth();
  const ref = getUserDocRef(path);
  return deleteDoc(ref);
}

// New function to get all game IDs for the current user
export async function getAllGameIds() {
  await ensureAuth();
  const gamesCollectionRef = collection(db, 'users', currentUserId, 'games');
  const gamesSnapshot = await getDocs(gamesCollectionRef);
  return gamesSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
}

// Normalize stats object and write full object (keeps exact structure expected)
export async function saveFullStats(part, statsObj) {
  const path = (part === '1') ? FB_PATHS_GAME.estatisticasParte1 : FB_PATHS_GAME.estatisticasParte2;
  return setFirebaseData(path, statsObj);
}

/**
 * Save a single stat for a player while preserving other data.
 * part: '1' or '2'
 * category: 'campo' or 'gr'
 * playerNumber: number or string
 * statKey: e.g. 'golos' or 'defesas'
 * value: numeric
 */
export async function saveSingleStat(part, category, playerNumber, statKey, value) {
  await ensureAuth();
  const path = (part === '1') ? FB_PATHS_GAME.estatisticasParte1 : FB_PATHS_GAME.estatisticasParte2;
  const ref = getUserDocRef(path);

  const snap = await getDoc(ref);
  const current = snap.exists() ? snap.data() : { campo: {}, gr: {} };

  if (!current[category]) current[category] = {};
  const key = String(playerNumber);
  if (!current[category][key]) current[category][key] = {};

  current[category][key][statKey] = Number(value) || 0;

  await setDoc(ref, current, { merge: true });
  return current;
}

// Migration from localStorage (keeps original functionality)
export async function migrateLocalStorageToFirebase() {
  await ensureAuth();

  const migrationKeys = [
    { lsKey: 'fieldPlayers', fbPath: FB_PATHS_GLOBAL.fieldPlayers },
    { lsKey: 'goalKeepers', fbPath: FB_PATHS_GLOBAL.goalKeepers },
    { lsKey: 'teamLogoBase64', fbPath: FB_PATHS_GLOBAL.teamLogo }
  ];

  // Game-specific data will be migrated to a 'default_game'
  const gameSpecificLsKeys = [
    { lsKey: 'jogo_form_data', fbPath: FB_PATHS_GAME.jogoFormData },
    { lsKey: 'estatisticas_parte1', fbPath: FB_PATHS_GAME.estatisticasParte1 },
    { lsKey: 'estatisticas_parte2', fbPath: FB_PATHS_GAME.estatisticasParte2 },
    { lsKey: 'estatisticas_valores', fbPath: FB_PATHS_GAME.estatisticasValores },
    { lsKey: 'estatisticas_extra_time', fbPath: FB_PATHS_GAME.estatisticasExtraTime },
    { lsKey: 'estatisticas_separadas_extra', fbPath: FB_PATHS_GAME.estatisticasSeparadasExtra },
    { lsKey: 'pseData', fbPath: FB_PATHS_GAME.pseData }
  ];

  let hasGameSpecificDataToMigrate = false;
  for (const { lsKey } of gameSpecificLsKeys) {
    if (localStorage.getItem(lsKey)) {
      hasGameSpecificDataToMigrate = true;
      break;
    }
  }

  if (hasGameSpecificDataToMigrate) {
    const defaultGameId = 'default_game_migrated'; // Use a distinct ID for migrated data
    setActiveGameId(defaultGameId); // Set active game for migration
    console.log(`Migrating game-specific data to default game: ${defaultGameId}`);

    for (const { lsKey, fbPath } of gameSpecificLsKeys) {
      const raw = localStorage.getItem(lsKey);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        await setFirebaseData(fbPath, parsed);
        localStorage.removeItem(lsKey);
        console.log(`Migrated game-specific ${lsKey} -> ${fbPath}`);
      } catch (err) {
        console.warn(`Failed migrating game-specific ${lsKey}:`, err);
      }
    }
    // Store a placeholder for the default game config
    await setFirebaseData(FB_PATHS_GAME.jogoFormData, {
      escalao: "MIGRATED",
      competicao: "Default Game",
      data: new Date().toISOString().slice(0, 10),
      adversario: "Migrated Data"
    });
  }


  for (const { lsKey, fbPath } of migrationKeys) {
    const raw = localStorage.getItem(lsKey);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (lsKey === 'teamLogoBase64') {
        await setFirebaseData(fbPath, { logo: parsed });
      } else {
        await setFirebaseData(fbPath, parsed);
      }
      localStorage.removeItem(lsKey);
      console.log(`Migrated global ${lsKey} -> ${fbPath}`);
    } catch (err) {
      console.warn(`Failed migrating global ${lsKey}:`, err);
    }
  }
}

// Initialize helper
export async function initializeFirebase() {
  const uid = await ensureAuth();
  await migrateLocalStorageToFirebase();
  return uid;
}

// Auto-run auth+migration (non-blocking)
ensureAuth().then(() => migrateLocalStorageToFirebase()).catch(e => {
  console.debug("Initial auth/migration attempt failed:", e?.message || e);
});