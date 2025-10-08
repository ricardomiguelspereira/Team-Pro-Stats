// firebase-data.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
  deleteDoc
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
  console.log("✅ Firebase initialized:", currentUserId);
}

/* ----------------------- PATH HELPERS ----------------------- */
export function getUserId() {
  return currentUserId || localStorage.getItem("userId");
}

export function getActiveGameId() {
  return localStorage.getItem("activeGameId");
}

export function setActiveGameId(gameId) {
  localStorage.setItem("activeGameId", gameId);
}

/* ----------------------- FIRESTORE HELPERS ----------------------- */
// Fetch single document
export async function getFirebaseData(path) {
  const ref = doc(db, path);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// Real-time listener for single document
export function onFirebaseDataChange(path, callback) {
  const ref = doc(db, path);
  return onSnapshot(ref, snap => callback(snap.exists() ? snap.data() : null));
}

// Fetch collection
export async function getFirebaseCollection(path) {
  const ref = collection(db, path);
  const snap = await getDocs(ref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Real-time listener for collection
export function onFirebaseCollectionChange(path, callback) {
  const ref = collection(db, path);
  return onSnapshot(ref, snapshot => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// Save single stat
export async function saveSingleStat(part, category, playerNum, statKey, value) {
  if (!part || !category || !playerNum || !statKey)
    throw new Error("Missing parameters for saveSingleStat");

  const gameId = getActiveGameId();
  if (!gameId) throw new Error("No active game set");

  const statDocRef = doc(db, "users", getUserId(), "games", gameId, "stats", `parte${part}`);
  const statSnap = await getDoc(statDocRef);
  const currentData = statSnap.exists() ? statSnap.data() : { campo: {}, gr: {} };

  if (!currentData[category]) currentData[category] = {};
  if (!currentData[category][playerNum]) currentData[category][playerNum] = {};
  currentData[category][playerNum][statKey] = value;

  await setDoc(statDocRef, currentData, { merge: true });
}

// Delete document by path
export async function deleteDocByPath(path) {
  const ref = doc(db, path);
  await deleteDoc(ref);
}

/* ----------------------- CONSTANTS ----------------------- */
export const FB_PATHS_GAME = {
  estatisticasParte1: "users/{uid}/games/{gameId}/stats/parte1",
  estatisticasParte2: "users/{uid}/games/{gameId}/stats/parte2"
};
