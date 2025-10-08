// firebase-data.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

/* ----------------------- FIREBASE CONFIG ----------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyCD8a60aGbdXdYFKKKrV-z0mCDZx9yKWqI",
  authDomain: "team-pro-stats.firebaseapp.com",
  projectId: "team-pro-stats",
  storageBucket: "team-pro-stats.firebasestorage.app",
  messagingSenderId: "758444286089",
  appId: "1:758444286089:web:fcd8fba3a5d705de01e658"
};

/* ----------------------- GLOBALS ----------------------- */
let app, db, auth;
let currentUserId = null;

/* ----------------------- INITIALIZATION ----------------------- */
export async function initializeFirebase() {
  if (app) return;
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  // Anonymous auth
  const result = await signInAnonymously(auth);
  currentUserId = result.user.uid;
  localStorage.setItem("userId", currentUserId);
  console.log("✅ Firebase initialized as user:", currentUserId);
}

/* ----------------------- PATH HELPERS ----------------------- */
function getUserId() {
  return currentUserId || localStorage.getItem("userId");
}

function getActiveGamePath(...sub) {
  const uid = getUserId();
  const gid = localStorage.getItem("activeGameId");
  if (!uid || !gid) throw new Error("Missing userId or activeGameId");
  return ["users", uid, "games", gid, ...sub];
}

/* ----------------------- PATH CONSTANTS ----------------------- */
export const FB_PATHS_GLOBAL = {
  fieldPlayers: "players", // collection (same for GR)
  goalKeepers: "players"
};

export const FB_PATHS_GAME = {
  estatisticasParte1: "stats/parte1",
  estatisticasParte2: "stats/parte2"
};

/* ----------------------- FIRESTORE HELPERS ----------------------- */

// Save single stat
export async function saveSingleStat(part, category, playerNum, statKey, value) {
  if (!part || !category || !playerNum || !statKey)
    throw new Error("Missing parameters for saveSingleStat");

  const statDocRef = doc(db, ...getActiveGamePath("stats", `parte${part}`));
  const statSnap = await getDoc(statDocRef);
  const currentData = statSnap.exists() ? statSnap.data() : { campo: {}, gr: {} };

  if (!currentData[category]) currentData[category] = {};
  if (!currentData[category][playerNum]) currentData[category][playerNum] = {};
  currentData[category][playerNum][statKey] = value;

  await setDoc(statDocRef, currentData, { merge: true });
}

// Subscribe to real-time updates (document or collection)
export function onFirebaseDataChange(path, callback) {
  const parts = path.split("/");
  if (parts.length > 1) {
    // document (e.g. stats/parte1)
    const ref = doc(db, ...getActiveGamePath(...parts));
    return onSnapshot(ref, (snap) => callback(snap.exists() ? snap.data() : null));
  } else {
    // collection (e.g. players)
    const ref = collection(db, ...getActiveGamePath(path));
    return onSnapshot(ref, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(data);
    });
  }
}

// Get data once
export async function getFirebaseData(path) {
  const parts = path.split("/");
  if (parts.length > 1) {
    const ref = doc(db, ...getActiveGamePath(...parts));
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } else {
    const ref = collection(db, ...getActiveGamePath(path));
    const snap = await getDocs(ref);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

// Game ID helpers
export function getActiveGameId() {
  return localStorage.getItem("activeGameId");
}
export function setActiveGameId(gameId) {
  localStorage.setItem("activeGameId", gameId);
}
