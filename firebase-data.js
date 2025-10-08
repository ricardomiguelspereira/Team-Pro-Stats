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
  getDocs,
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
function getRefFromPath(path) {
  const segments = path.split("/").filter(s => s);
  if (!segments.length) throw new Error("Invalid path");
  return segments.length % 2 === 0 ? doc(db, ...segments) : collection(db, ...segments);
}

// Get single document
export async function getFirebaseData(path) {
  const ref = doc(db, path);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// Real-time document listener
export function onFirebaseDataChange(path, callback) {
  const ref = doc(db, path);
  return onSnapshot(ref, snap => callback(snap.exists() ? snap.data() : null));
}

// Get collection documents as array
export async function getDocsFromCollection(path) {
  const ref = collection(db, path);
  const snap = await getDocs(ref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Real-time listener for collections
export function onCollectionChange(path, callback) {
  const ref = collection(db, path);
  return onSnapshot(ref, snapshot => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/* ----------------------- SAVE STAT ----------------------- */
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

/* ----------------------- DELETE HELPERS ----------------------- */
export async function deleteDocByPath(path) {
  const ref = getRefFromPath(path);
  if (!("delete" in ref)) throw new Error("Path is not a document");
  await deleteDoc(ref);
}

/* ----------------------- CONSTANTS ----------------------- */
export const FB_PATHS_GAME = {
  estatisticasParte1: "users/{uid}/games/{gameId}/stats/parte1",
  estatisticasParte2: "users/{uid}/games/{gameId}/stats/parte2"
};
