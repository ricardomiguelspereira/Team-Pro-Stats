import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

let currentUserId = null;
let activeGameId = localStorage.getItem("activeGameId");

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

export async function initializeFirebase(){
  if(currentUserId) return currentUserId;
  return new Promise((resolve,reject)=>{
    const unsub = auth.onAuthStateChanged(async user=>{
      if(user){ currentUserId = user.uid; unsub(); resolve(currentUserId); }
      else {
        await signInAnonymously(auth);
        currentUserId = auth.currentUser.uid;
        unsub();
        resolve(currentUserId);
      }
    });
  });
}

function userPath(...parts){ return ["users", currentUserId, ...parts]; }
function gamePath(...parts){ return ["users", currentUserId, "games", activeGameId, ...parts]; }

export async function getAllGameIds(){
  await initializeFirebase();
  const col = collection(db, ...userPath("games"));
  const snaps = await getDocs(col);
  const games = [];
  for(const docSnap of snaps.docs){
    const id = docSnap.id;
    const dataSnap = await getDoc(doc(db, ...userPath("games", id, "config","jogoFormData")));
    games.push({id, data: dataSnap.exists() ? dataSnap.data() : {}});
  }
  return games.sort((a,b)=> (b.data.data||"").localeCompare(a.data.data||""));
}

export async function setActiveGameId(id){
  activeGameId = id;
  localStorage.setItem("activeGameId", id);
}

export async function getGameData(){
  if(!activeGameId) return null;
  const snap = await getDoc(doc(db, ...gamePath("config","jogoFormData")));
  return snap.exists() ? snap.data() : null;
}

export async function deleteGameById(id){
  const snap = await getDoc(doc(db, ...userPath("games", id)));
  if(!snap.exists()) return;
  await deleteDoc(doc(db, ...userPath("games", id)));
  if(activeGameId === id){ activeGameId = null; localStorage.removeItem("activeGameId"); }
}

export async function createNewGame(){
  await initializeFirebase();
  const colRef = collection(db, ...userPath("games"));
  const newDocRef = doc(colRef);
  activeGameId = newDocRef.id;
  localStorage.setItem("activeGameId", activeGameId);
  await setDoc(doc(db, ...gamePath("config","jogoFormData")), {
    adversario: "Novo Jogo",
    data: new Date().toISOString().slice(0,10)
  });
}
