// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCD8a60aGbdXdYFKKKrV-z0mCDZx9yKWqI",
  authDomain: "team-pro-stats.firebaseapp.com",
  projectId: "team-pro-stats",
  storageBucket: "team-pro-stats.firebasestorage.app",
  messagingSenderId: "758444286089",
  appId: "1:758444286089:web:fcd8fba3a5d705de01e658",
  measurementId: "G-D1GDDBPD55"
};

// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let currentUserId = null;

// ---- PATHS ----
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

// ---- AUTH ----
async function ensureAuth() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUserId = user.uid;
        resolve(user);
      } else {
        signInAnonymously(auth)
          .then((cred) => {
            currentUserId = cred.user.uid;
            resolve(cred.user);
          })
          .catch((err) => reject(err));
      }
    });
  });
}

// ---- FIRESTORE HELPERS ----
function getUserDocRef(path) {
  if (!currentUserId) return null;
  return doc(db, `users/${currentUserId}/${path}`);
}

export async function setFirebaseData(path, data) {
  await ensureAuth();
  const ref = getUserDocRef(path);
  if (ref) await setDoc(ref, data, { merge: true });
}

export async function getFirebaseData(path) {
  await ensureAuth();
  const ref = getUserDocRef(path);
  if (!ref) return null;
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function onFirebaseDataChange(path, callback) {
  await ensureAuth();
  const ref = getUserDocRef(path);
  if (!ref) return () => {};
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data() : null);
  }, (error) => {
    console.error("Snapshot error:", error);
    callback(null);
  });
}

export async function deleteFirebaseData(path) {
  await ensureAuth();
  const ref = getUserDocRef(path);
  if (ref) await deleteDoc(ref);
}

// ---- MIGRATION ----
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

  console.log("Migrating localStorage data → Firebase...");
  for (const { lsKey, fbPath } of migrationKeys) {
    const data = localStorage.getItem(lsKey);
    if (!data) continue;
    try {
      const parsed = JSON.parse(data);
      if (lsKey === 'teamLogoBase64') {
        await setFirebaseData(fbPath, { logo: parsed });
      } else {
        await setFirebaseData(fbPath, parsed);
      }
      localStorage.removeItem(lsKey);
      console.log(`Migrated ${lsKey} → ${fbPath}`);
    } catch (err) {
      console.error(`Error migrating ${lsKey}:`, err);
    }
  }
  console.log("Migration complete.");
}

// ---- Initialize ----
ensureAuth().then(() => migrateLocalStorageToFirebase());
