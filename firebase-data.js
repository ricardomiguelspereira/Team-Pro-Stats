// Firebase Configuration (keep your config)
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
  deleteDoc
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

/**
 * Exported paths that map to documents under:
 * users/{uid}/<collection>/<doc>
 */
export const FB_PATHS = {
  fieldPlayers: 'players/fieldPlayers',
  goalKeepers: 'players/goalKeepers',
  jogoFormData: 'config/jogoFormData',
  estatisticasParte1: 'stats/estatisticasParte1',
  estatisticasParte2: 'stats/estatisticasParte2',
  estatisticasValores: 'stats/estatisticasValores',
  estatisticasExtraTime: 'stats/estatisticasExtraTime',
  estatisticasSeparadasExtra: 'stats/estatisticasSeparadasExtra',
  pseData: 'pse/pseData',
  teamLogo: 'config/teamLogo'
};

// --- Authentication ---
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

/**
 * Build a Firestore doc reference under users/{uid}/...
 * path: a string like 'stats/estatisticasParte1' or 'players/fieldPlayers'
 */
function getUserDocRef(path) {
  if (!currentUserId) throw new Error("User not authenticated");
  const parts = path.split('/').filter(p => p.length);
  // Prepend 'users' and currentUserId
  const fullPath = ['users', currentUserId, ...parts];
  return doc(db, ...fullPath);
}

// --- Basic CRUD functions (guarantee auth) ---
export async function setFirebaseData(path, data) {
  await ensureAuth();
  const ref = getUserDocRef(path);
  await setDoc(ref, data, { merge: true });
}

export async function getFirebaseData(path) {
  await ensureAuth();
  const ref = getUserDocRef(path);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * Subscribe to document changes.
 * callback receives either the document data object or null if missing.
 * Returns an unsubscribe function.
 */
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
  await deleteDoc(ref);
}

// --- Helpers for saving stats with the exact structure expected by estatisticas.html ---

/**
 * Save the whole stats object for a given part.
 * statsObj should be { campo: { "7": {...}}, gr: { "1": {...} } }
 */
export async function saveFullStats(part, statsObj) {
  const path = (part === '1') ? FB_PATHS.estatisticasParte1 : FB_PATHS.estatisticasParte2;
  await setFirebaseData(path, statsObj);
}

/**
 * Save a single stat for one player (safe: reads existing doc, merges, writes).
 * Ensures final document shape: { campo: { "7": { grPostes: 1, ... } }, gr: { "1": { ... } } }
 *
 * - part: '1' or '2'
 * - category: 'campo' or 'gr'
 * - playerNumber: number OR string
 * - statKey: string (e.g. 'golos', 'defesas')
 * - value: number (stat value)
 */
export async function saveSingleStat(part, category, playerNumber, statKey, value) {
  await ensureAuth();
  const path = (part === '1') ? FB_PATHS.estatisticasParte1 : FB_PATHS.estatisticasParte2;
  const ref = getUserDocRef(path);
  const snap = await getDoc(ref);
  const current = snap.exists() ? snap.data() : { campo: {}, gr: {} };

  if (!current[category]) current[category] = {};
  const key = String(playerNumber);
  if (!current[category][key]) current[category][key] = {};

  // Assign the specific stat (keep any existing sibling stats)
  current[category][key][statKey] = Number(value) || 0;

  // Persist full merged object (merge:true to be safe)
  await setDoc(ref, current, { merge: true });

  // Return the updated sub-object for convenience/debugging
  return current;
}

// --- Migration from localStorage to Firebase (keeps the existing behaviour) ---
export async function migrateLocalStorageToFirebase() {
  await ensureAuth();

  const migrationKeys = [
    { lsKey: 'fieldPlayers', fbPath: FB_PATHS.fieldPlayers },
    { lsKey: 'goalKeepers', fbPath: FB_PATHS.goalKeepers },
    { lsKey: 'jogo_form_data', fbPath: FB_PATHS.jogoFormData },
    { lsKey: 'estatisticas_parte1', fbPath: FB_PATHS.estatisticasParte1 },
    { lsKey: 'estatisticas_parte2', fbPath: FB_PATHS.estatisticasParte2 },
    { lsKey: 'estatisticas_valores', fbPath: FB_PATHS.estatisticasValores },
    { lsKey: 'estatisticas_extra_time', fbPath: FB_PATHS.estatisticasExtraTime },
    { lsKey: 'estatisticas_separadas_extra', fbPath: FB_PATHS.estatisticasSeparadasExtra },
    { lsKey: 'pseData', fbPath: FB_PATHS.pseData },
    { lsKey: 'teamLogoBase64', fbPath: FB_PATHS.teamLogo }
  ];

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
      console.log(`Migrated ${lsKey} -> ${fbPath}`);
    } catch (err) {
      console.warn(`Failed migrating ${lsKey}:`, err);
    }
  }
}

/**
 * Convenience initializer to make sure auth & one-time migration are done.
 * Returns the authenticated uid.
 */
export async function initializeFirebase() {
  const uid = await ensureAuth();
  // run migration in background but wait so data exists for immediate reads
  await migrateLocalStorageToFirebase();
  return uid;
}

// Auto-run auth & migration if this module is loaded (non-blocking)
ensureAuth().then(() => migrateLocalStorageToFirebase()).catch((e) => {
  // ignore here; callers can call initializeFirebase() if required
  console.debug("Initial auth/migration attempt:", e?.message || e);
});
