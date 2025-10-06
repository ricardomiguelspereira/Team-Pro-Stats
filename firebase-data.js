// firebase-data.js
// ✅ Firebase Firestore + Anonymous Auth (Fully Fixed Version)

// ----------------------
// 🔧 Firebase Config
// ----------------------
const firebaseConfig = {
  apiKey: "AIzaSyCD8a60aGbdXdYFKKKrV-z0mCDZx9yKWqI",
  authDomain: "team-pro-stats.firebaseapp.com",
  projectId: "team-pro-stats",
  storageBucket: "team-pro-stats.firebasestorage.app",
  messagingSenderId: "758444286089",
  appId: "1:758444286089:web:fcd8fba3a5d705de01e658",
  measurementId: "G-D1GDDBPD55"
};

// ----------------------
// 🔥 Firebase Imports
// ----------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  deleteDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

// ----------------------
// ⚙️ Initialize Firebase
// ----------------------
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUserId = null;
let activeGameId = null;

// ----------------------
// 📁 Firebase Paths
// ----------------------
export const FB_PATHS_GLOBAL = {
  fieldPlayers: "players/fieldPlayers",
  goalKeepers: "players/goalKeepers",
  teamLogo: "config/teamLogo"
};

export const FB_PATHS_GAME = {
  jogoFormData: "config/jogoFormData",
  estatisticasParte1: "stats/estatisticasParte1",
  estatisticasParte2: "stats/estatisticasParte2",
  estatisticasValores: "stats/estatisticasValores",
  estatisticasExtraTime: "stats/estatisticasExtraTime",
  estatisticasSeparadasExtra: "stats/estatisticasSeparadasExtra",
  pseData: "pse/pseData"
};

export const FB_PATHS = { ...FB_PATHS_GLOBAL, ...FB_PATHS_GAME };

// ----------------------
// 🎮 Active Game Handling
// ----------------------
export function setActiveGameId(gameId) {
  activeGameId = gameId;
  if (gameId) localStorage.setItem("activeGameId", gameId);
  else localStorage.removeItem("activeGameId");
  console.log("Active Game ID set to:", activeGameId);
}

export function getActiveGameId() {
  if (!activeGameId) activeGameId = localStorage.getItem("activeGameId");
  return activeGameId;
}

// ----------------------
// 🔐 Auth Helpers
// ----------------------
export async function ensureAuth() {
  if (currentUserId) return currentUserId;

  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUserId = user.uid;
        console.log("User authenticated:", currentUserId);
        unsub();
        resolve(currentUserId);
      } else {
        signInAnonymously(auth)
          .then((cred) => {
            currentUserId = cred.user.uid;
            console.log("Anonymous user signed in:", currentUserId);
            unsub();
            resolve(currentUserId);
          })
          .catch((err) => {
            console.error("Auth error:", err);
            unsub();
            reject(err);
          });
      }
    });
  });
}

// ----------------------
// 🔗 Internal Doc Helper
// ----------------------
function getUserDocRef(path) {
  if (!currentUserId) throw new Error("User not authenticated");

  const fullPathParts = ["users", currentUserId];

  if (Object.values(FB_PATHS_GLOBAL).includes(path)) {
    fullPathParts.push(...path.split("/"));
  } else if (Object.values(FB_PATHS_GAME).includes(path)) {
    if (!activeGameId)
      throw new Error("No active game ID set for game-specific path: " + path);
    fullPathParts.push("games", activeGameId, ...path.split("/"));
  } else {
    fullPathParts.push(...path.split("/"));
  }

  return doc(db, ...fullPathParts);
}

// ----------------------
// 🧩 CRUD Helpers
// ----------------------
export async function setFirebaseData(path, data) {
  await ensureAuth();
  const ref = getUserDocRef(path);
  console.log("Setting data for path:", path);
  return setDoc(ref, data, { merge: true });
}

export async function getFirebaseData(path) {
  await ensureAuth();
  const ref = getUserDocRef(path);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function onFirebaseDataChange(path, callback) {
  await ensureAuth();
  const ref = getUserDocRef(path);
  const unsubscribe = onSnapshot(
    ref,
    (snap) => {
      callback(snap.exists() ? snap.data() : null);
    },
    (err) => {
      console.error("onSnapshot error for", path, err);
      callback(null);
    }
  );
  return unsubscribe;
}

export async function deleteFirebaseData(path) {
  await ensureAuth();
  const ref = getUserDocRef(path);
  console.log("Deleting data for path:", path);
  return deleteDoc(ref);
}

// ----------------------
// 🆔 Game Utilities
// ----------------------
export function generateGameId() {
  if (!currentUserId)
    throw new Error("User not authenticated - cannot generate game ID");
  const gamesCollectionRef = collection(db, "users", currentUserId, "games");
  const newId = doc(gamesCollectionRef).id;
  console.log("Generated new game ID:", newId);
  return newId;
}

export async function getAllGameIds() {
  await ensureAuth();
  const gamesCollectionRef = collection(db, "users", currentUserId, "games");
  const gamesSnapshot = await getDocs(gamesCollectionRef);
  const gameIds = gamesSnapshot.docs.map((doc) => doc.id);

  console.log("Found game IDs:", gameIds);

  const gamesWithData = [];
  const originalActiveGame = getActiveGameId();
  try {
    for (const gameId of gameIds) {
      setActiveGameId(gameId);
      const formData = await getFirebaseData(FB_PATHS_GAME.jogoFormData);
      gamesWithData.push({
        id: gameId,
        data: {
          config: {
            jogoFormData:
              formData || {
                data: "N/A",
                adversario: "Sem Dados",
                competicao: "N/A"
              }
          }
        }
      });
    }
  } finally {
    setActiveGameId(originalActiveGame);
  }

  gamesWithData.sort((a, b) => {
    const dateA = a.data?.config?.jogoFormData?.data || "";
    const dateB = b.data?.config?.jogoFormData?.data || "";
    return dateB.localeCompare(dateA);
  });

  console.log("Games with data:", gamesWithData);
  return gamesWithData;
}

export function onGamesCollectionChange(callback) {
  return ensureAuth()
    .then(() => {
      const gamesCollectionRef = collection(db, "users", currentUserId, "games");
      const unsubscribe = onSnapshot(
        gamesCollectionRef,
        () => {
          console.log("Games collection changed, refreshing...");
          getAllGameIds()
            .then(callback)
            .catch((err) => {
              console.error("Error fetching games:", err);
              callback([]);
            });
        },
        (err) => {
          console.error("Games collection listener error:", err);
        }
      );
      return unsubscribe;
    })
    .catch((err) => {
      console.error("Auth error in games listener:", err);
      return () => {};
    });
}

// ----------------------
// 📊 Stats Helpers
// ----------------------
export async function saveFullStats(part, statsObj) {
  const path =
    part === "1"
      ? FB_PATHS_GAME.estatisticasParte1
      : FB_PATHS_GAME.estatisticasParte2;
  return setFirebaseData(path, statsObj);
}

export async function saveSingleStat(part, category, playerNumber, statKey, value) {
  await ensureAuth();
  const path =
    part === "1"
      ? FB_PATHS_GAME.estatisticasParte1
      : FB_PATHS_GAME.estatisticasParte2;
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

// ----------------------
// 🔄 Migration from LocalStorage
// ----------------------
export async function migrateLocalStorageToFirebase() {
  await ensureAuth();

  const migrationKeys = [
    { lsKey: "fieldPlayers", fbPath: FB_PATHS_GLOBAL.fieldPlayers },
    { lsKey: "goalKeepers", fbPath: FB_PATHS_GLOBAL.goalKeepers },
    { lsKey: "teamLogoBase64", fbPath: FB_PATHS_GLOBAL.teamLogo }
  ];

  const gameSpecificLsKeys = [
    { lsKey: "jogo_form_data", fbPath: FB_PATHS_GAME.jogoFormData },
    { lsKey: "estatisticas_parte1", fbPath: FB_PATHS_GAME.estatisticasParte1 },
    { lsKey: "estatisticas_parte2", fbPath: FB_PATHS_GAME.estatisticasParte2 },
    { lsKey: "estatisticas_valores", fbPath: FB_PATHS_GAME.estatisticasValores },
    { lsKey: "estatisticas_extra_time", fbPath: FB_PATHS_GAME.estatisticasExtraTime },
    { lsKey: "estatisticas_separadas_extra", fbPath: FB_PATHS_GAME.estatisticasSeparadasExtra },
    { lsKey: "pseData", fbPath: FB_PATHS_GAME.pseData }
  ];

  let hasGameSpecificDataToMigrate = gameSpecificLsKeys.some(({ lsKey }) =>
    localStorage.getItem(lsKey)
  );

  if (hasGameSpecificDataToMigrate) {
    const defaultGameId = "default_game_migrated";
    setActiveGameId(defaultGameId);
    console.log(`Migrating data to default game: ${defaultGameId}`);

    for (const { lsKey, fbPath } of gameSpecificLsKeys) {
      const raw = localStorage.getItem(lsKey);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        await setFirebaseData(fbPath, parsed);
        localStorage.removeItem(lsKey);
        console.log(`Migrated ${lsKey} → ${fbPath}`);
      } catch (err) {
        console.warn(`Failed to migrate ${lsKey}:`, err);
      }
    }
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
      if (lsKey === "teamLogoBase64") await setFirebaseData(fbPath, { logo: parsed });
      else await setFirebaseData(fbPath, parsed);
      localStorage.removeItem(lsKey);
      console.log(`Migrated global ${lsKey} → ${fbPath}`);
    } catch (err) {
      console.warn(`Failed to migrate global ${lsKey}:`, err);
    }
  }
}

// ----------------------
// 🚀 Firebase Init
// ----------------------
export async function initializeFirebase() {
  const uid = await ensureAuth();
  await migrateLocalStorageToFirebase();
  return uid;
}

// Automatically initialize on load
ensureAuth()
  .then(() => migrateLocalStorageToFirebase())
  .catch((e) => {
    console.debug("Initial auth/migration failed:", e?.message || e);
  });
