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

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

let currentUserId = null;
let activeGameId = localStorage.getItem("activeGameId");

// Ensure user is authenticated
export async function ensureAuth() {
  if (currentUserId) return currentUserId;
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) { currentUserId = user.uid; unsub(); resolve(currentUserId); }
      else {
        signInAnonymously(auth)
          .then(cred => { currentUserId = cred.user.uid; unsub(); resolve(currentUserId); })
          .catch(e => { console.error(e); reject(e); });
      }
    });
  });
}

// Paths
export function userPath(...parts) { return ["users", currentUserId, ...parts]; }
export function gamePath(...parts) { return ["users", currentUserId, "games", activeGameId, ...parts]; }

// Active game ID
export function getActiveGameId() { return activeGameId; }
export function setActiveGameId(id) { activeGameId = id; localStorage.setItem("activeGameId", id); }

// Show notification
export function showNotification(msg, isError = false) {
  const el = document.getElementById("notification");
  el.textContent = msg;
  el.className = isError ? "notification error" : "notification";
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 2000);
}

// Create new game
export async function createGame() {
  await ensureAuth();
  const newId = doc(collection(db, ...userPath("games"))).id;
  activeGameId = newId;
  localStorage.setItem("activeGameId", newId);
  await setDoc(doc(db, ...gamePath("config", "jogoFormData")), {
    adversario: "Novo Jogo",
    data: new Date().toISOString().slice(0, 10)
  });
  showNotification("Novo jogo criado");
  return newId;
}

// Save game data
export async function saveGame(formData) {
  if (!activeGameId) return showNotification("Nenhum jogo ativo", true);
  await ensureAuth();
  await setDoc(doc(db, ...gamePath("config", "jogoFormData")), formData, { merge: true });
  showNotification("Jogo guardado");
}

// Load game data
export async function loadGame(id, form) {
  await ensureAuth();
  activeGameId = id;
  localStorage.setItem("activeGameId", id);
  const snap = await getDoc(doc(db, ...gamePath("config", "jogoFormData")));
  if (snap.exists()) {
    const data = snap.data();
    for (const [k, v] of Object.entries(data)) if (form[k]) form[k].value = v;
    showNotification("Jogo carregado");
  } else {
    form.reset();
    showNotification("Jogo sem dados");
  }
}

// Delete game
export async function deleteGame(id) {
  await ensureAuth();
  activeGameId = id;
  await deleteDoc(doc(db, ...gamePath()));
  if (activeGameId === id) { activeGameId = null; localStorage.removeItem("activeGameId"); }
  showNotification("Jogo eliminado");
}

// List all games
export async function getAllGameIds() {
  await ensureAuth();
  const col = collection(db, ...userPath("games"));
  const snaps = await getDocs(col);
  const gamesWithData = [];
  for (const docSnap of snaps.docs) {
    const id = docSnap.id;
    const dataSnap = await getDoc(doc(db, ...userPath("games", id, "config", "jogoFormData")));
    const data = dataSnap.data() || { adversario: "Sem Adversário", competicao: "N/A", data: "" };
    gamesWithData.push({ id, data });
  }
  // Sort by date descending
  gamesWithData.sort((a, b) => (b.data.data || "").localeCompare(a.data.data || ""));
  return gamesWithData;
}

// Real-time updates listener
export async function subscribeToGames(renderCallback) {
  await ensureAuth();
  return onSnapshot(collection(db, ...userPath("games")), renderCallback);
}
