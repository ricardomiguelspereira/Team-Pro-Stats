// firebase-data.js
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Firebase paths (adjust if needed)
export const FB_PATHS_GLOBAL = {
  fieldPlayers: "players",       // collection or doc containing all players
  goalKeepers: "goalKeepers",    // collection or doc containing all goalkeepers
};

export const FB_PATHS_GAME = {
  estatisticasParte1: "stats/parte1",
  estatisticasParte2: "stats/parte2",
};

// Firestore reference
const db = getFirestore();

// Save a single stat for a player
export async function saveSingleStat(part, category, playerNum, statKey, value) {
  if (!part || !category || !playerNum || !statKey) throw new Error("Missing parameters for saveSingleStat");

  const statDocRef = doc(db, "users", localStorage.getItem("userId"), "games", localStorage.getItem("activeGameId"), "stats", `parte${part}`);
  const statDocSnap = await getDoc(statDocRef);
  const currentData = statDocSnap.exists() ? statDocSnap.data() : { campo: {}, gr: {} };

  if (!currentData[category]) currentData[category] = {};
  if (!currentData[category][playerNum]) currentData[category][playerNum] = {};
  currentData[category][playerNum][statKey] = value;

  await setDoc(statDocRef, currentData);
}

// Subscribe to real-time updates for a collection or document
export function onFirebaseDataChange(path, callback) {
  let ref;
  if (path.includes("/")) {
    ref = doc(db, "users", localStorage.getItem("userId"), "games", localStorage.getItem("activeGameId"), path);
  } else {
    ref = collection(db, "users", localStorage.getItem("userId"), path);
  }

  return onSnapshot(ref, snapshot => {
    if (snapshot.docs) {
      // Collection
      const data = snapshot.docs.map(d => d.data());
      callback(data);
    } else {
      // Document
      callback(snapshot.exists() ? snapshot.data() : null);
    }
  });
}

// Get data once from Firestore
export async function getFirebaseData(path) {
  let ref;
  if (path.includes("/")) {
    ref = doc(db, "users", localStorage.getItem("userId"), "games", localStorage.getItem("activeGameId"), path);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } else {
    ref = collection(db, "users", localStorage.getItem("userId"), path);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  }
}

// Active game helper
export function getActiveGameId() {
  return localStorage.getItem("activeGameId");
}

export function setActiveGameId(gameId) {
  localStorage.setItem("activeGameId", gameId);
}

// Initialize Firebase placeholder
export async function initializeFirebase() {
  // You can place any auth initialization here if needed
  // Currently just resolves immediately
  return Promise.resolve();
}
