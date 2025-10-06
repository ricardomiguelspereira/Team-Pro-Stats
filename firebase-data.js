// firebase-data.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCD8a60aGbdXdYFKKKrV-z0mCDZx9yKWqI",
  authDomain: "team-pro-stats.firebaseapp.com",
  projectId: "team-pro-stats",
  storageBucket: "team-pro-stats.firebasestorage.app",
  messagingSenderId: "758444286089",
  appId: "1:758444286089:web:fcd8fba3a5d705de01e658",
  measurementId: "G-D1GDDBPD55"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUserId = null;

export let activeGameId = localStorage.getItem("activeGameId") || null;

export async function ensureAuth() {
  if (currentUserId) return currentUserId;
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) { currentUserId = user.uid; unsub(); resolve(currentUserId); }
      else { 
        signInAnonymously(auth).then(cred => { currentUserId = cred.user.uid; unsub(); resolve(currentUserId); })
        .catch(e=>{console.error(e); reject(e); });
      }
    });
  });
}

function userPath(...parts) { return ["users", currentUserId, ...parts]; }
function gamePath(gameId, ...parts) { return ["users", currentUserId, "games", gameId, ...parts]; }

export async function getAllGameIds() {
  await ensureAuth();
  const col = collection(db, ...userPath("games"));
  const snaps = await getDocs(col);
  const games = [];
  for (const docSnap of snaps.docs) {
    const id = docSnap.id;
    const dataSnap = await getDoc(doc(db, ...gamePath(id, "config", "jogoFormData")));
    const data = dataSnap.data() || { adversario: "Sem Adversário", competicao: "N/A", data: "" };
    games.push({ id, data });
  }
  // sort by date descending
  games.sort((a,b)=> (b.data.data||"").localeCompare(a.data.data||""));
  return games;
}

export async function deleteFirebaseData(pathArray) {
  await ensureAuth();
  await deleteDoc(doc(db, ...pathArray));
}

export async function setActiveGame(id) {
  activeGameId = id;
  localStorage.setItem("activeGameId", id);
}

export async function getActiveGameData() {
  if (!activeGameId) return null;
  const snap = await getDoc(doc(db, ...gamePath(activeGameId, "config", "jogoFormData")));
  return snap.exists() ? snap.data() : null;
}
