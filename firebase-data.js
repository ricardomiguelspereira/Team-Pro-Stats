// firebase-data.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs,
  deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// ✅ Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCD8a60aGbdXdYFKKKrV-z0mCDZx9yKWqI",
  authDomain: "team-pro-stats.firebaseapp.com",
  projectId: "team-pro-stats",
  storageBucket: "team-pro-stats.firebasestorage.app",
  messagingSenderId: "758444286089",
  appId: "1:758444286089:web:fcd8fba3a5d705de01e658",
  measurementId: "G-D1GDDBPD55"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// 🔹 Helpers
export async function getFirebaseDoc(path) {
  const ref = doc(db, path);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function setFirebaseDoc(path, data) {
  await setDoc(doc(db, path), data, { merge: true });
}

export async function deleteFirebaseDoc(path) {
  await deleteDoc(doc(db, path));
}

export async function getFirebaseCollection(path) {
  const ref = collection(db, path);
  const snap = await getDocs(ref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function onFirebaseDocChange(path, callback) {
  const ref = doc(db, path);
  return onSnapshot(ref, snap => callback(snap.exists() ? snap.data() : null));
}

export function onFirebaseCollectionChange(path, callback) {
  const ref = collection(db, path);
  return onSnapshot(ref, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}
