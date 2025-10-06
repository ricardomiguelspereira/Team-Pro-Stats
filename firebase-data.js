// firebase-data.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

// Firebase config
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

// Helpers for paths
function userPath(...parts){ return ["users", currentUserId, ...parts]; }
function gamePath(gameId, ...parts){ return ["users", currentUserId, "games", gameId, ...parts]; }

// Active game
export function getActiveGameId(){ return activeGameId; }
export function setActiveGameId(id){ activeGameId = id; localStorage.setItem("activeGameId", id); }

// Fetch all saved games
export async function getAllGames() {
  await ensureAuth();
  const col = collection(db, ...userPath("games"));
  const snap = await getDocs(col);
  const games = [];

  for (const docSnap of snap.docs) {
    const configSnap = await getDoc(doc(db, ...gamePath(docSnap.id, "config", "jogoFormData")));
    const data = configSnap.exists() ? configSnap.data() : { adversario: "Sem Adversário", competicao: "N/A", data: "" };
    games.push({ id: docSnap.id, data });
  }

  // Sort by date descending
  games.sort((a,b) => (b.data.data||"").localeCompare(a.data.data||""));
  return games;
}

// Delete a game
export async function deleteGame(id){
  await ensureAuth();
  await deleteDoc(doc(db, ...gamePath(id)));
  if(activeGameId === id){ activeGameId=null; localStorage.removeItem("activeGameId"); }
}

// Save jogoFormData for active game
export async function saveGameData(data){
  if(!activeGameId) return;
  await ensureAuth();
  await setDoc(doc(db, ...gamePath(activeGameId, "config", "jogoFormData")), data, {merge:true});
}

// Load jogoFormData
export async function loadGameData(gameId){
  await ensureAuth();
  const snap = await getDoc(doc(db, ...gamePath(gameId, "config", "jogoFormData")));
  return snap.exists() ? snap.data() : {};
}

// Create new game
export async function createNewGame() {
  await ensureAuth();
  const newId = doc(collection(db, ...userPath("games"))).id;
  activeGameId = newId;
  localStorage.setItem("activeGameId", newId);
  await setDoc(doc(db, ...gamePath(newId, "config", "jogoFormData")), {
    adversario:"Novo Jogo",
    data:new Date().toISOString().slice(0,10)
  });
  return newId;
}

// Real-time listener for games collection
export async function onGamesSnapshot(callback){
  await ensureAuth();
  const col = collection(db, ...userPath("games"));
  return onSnapshot(col, async ()=>{ 
    const games = await getAllGames(); 
    callback(games); 
  });
}
