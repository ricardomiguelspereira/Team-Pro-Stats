<script type="module">
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
let activeGameId = localStorage.getItem("activeGameId");

const n = msg => { 
  const el=document.getElementById("notification"); 
  el.textContent=msg; 
  el.className="show"; 
  setTimeout(()=>el.classList.remove("show"),3000); 
};

const gameList = document.getElementById("gameList");
const form = document.getElementById("jogoForm");
const saveBtn = document.getElementById("saveBtn");
const deleteBtn = document.getElementById("deleteBtn");
const newBtn = document.getElementById("newGameBtn");

async function ensureAuth() {
  if (currentUserId) return currentUserId;
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) { currentUserId = user.uid; unsub(); resolve(currentUserId); }
      else { 
        signInAnonymously(auth).then(cred => { currentUserId = cred.user.uid; unsub(); resolve(currentUserId); })
        .catch(e=>{console.error(e); reject(e);});
      }
    });
  });
}

function userPath(...parts){ return ["users", currentUserId, ...parts]; }
function gamePath(...parts){ return ["users", currentUserId, "games", activeGameId, ...parts]; }

async function renderGames() {
  await ensureAuth();
  const col = collection(db, ...userPath("games"));
  const snaps = await getDocs(col);

  const gamesWithData = [];
  for (const docSnap of snaps.docs) {
    const id = docSnap.id;
    const dataSnap = await getDoc(doc(db, "users", currentUserId, "games", id, "config", "jogoFormData"));
    const data = dataSnap.data() || { adversario: "Sem Adversário", competicao: "N/A", data: "" };
    gamesWithData.push({ id, data });
  }

  // Sort by date descending (latest first)
  gamesWithData.sort((a, b) => {
    const dateA = a.data.data || "";
    const dateB = b.data.data || "";
    return dateB.localeCompare(dateA);
  });

  gameList.innerHTML = "";
  if (!gamesWithData.length) {
    gameList.innerHTML = '<div class="no-games">Nenhum jogo encontrado</div>'; 
    return;
  }

  for (const {id, data} of gamesWithData) {
    const item = document.createElement("div");
    item.className="game-list-item"+(id===activeGameId?" active":"");
    item.innerHTML=`<div><strong>${data.adversario||"Sem Adversário"}</strong> (${data.competicao||"N/A"}) - ${data.data||"N/A"}</div>
    <div class="game-actions">
      <button class="load-btn" data-id="${id}">Carregar</button>
      <button class="delete-btn" data-id="${id}">Eliminar</button>
    </div>`;
    gameList.appendChild(item);
  }

  document.querySelectorAll(".load-btn").forEach(b=>b.onclick=e=>loadGame(e.target.dataset.id));
  document.querySelectorAll(".delete-btn").forEach(b=>b.onclick=e=>deleteGame(e.target.dataset.id));
}

async function createGame(){
  await ensureAuth();
  const newId = doc(collection(db, ...userPath("games"))).id;
  activeGameId = newId;
  localStorage.setItem("activeGameId", newId);
  await setDoc(doc(db, ...gamePath("config","jogoFormData")), {
    adversario:"Novo Jogo", data:new Date().toISOString().slice(0,10)
  });
  n("Novo jogo criado");
  loadGame(newId);
}

async function saveGame(){
  if(!activeGameId) return n("Nenhum jogo ativo");
  await ensureAuth();
  const data={}; for(const el of form.elements) if(el.name) data[el.name]=el.value;
  await setDoc(doc(db, ...gamePath("config","jogoFormData")), data, {merge:true});
  n("Jogo guardado");
  renderGames();
}

async function loadGame(id){
  await ensureAuth();
  activeGameId = id;
  localStorage.setItem("activeGameId",id);
  const snap = await getDoc(doc(db,...gamePath("config","jogoFormData")));
  if(snap.exists()){
    const data = snap.data();
    for(const [k,v] of Object.entries(data)) if(form[k]) form[k].value=v;
    n("Jogo carregado");
  } else {
    form.reset();
    n("Jogo sem dados");
  }
  saveBtn.disabled = deleteBtn.disabled = false;
  renderGames();
}

async function deleteGame(id){
  if(!confirm("Eliminar este jogo?")) return;
  await ensureAuth();
  activeGameId = id;
  await deleteDoc(doc(db, ...gamePath()));
  n("Jogo eliminado");
  if(activeGameId === id) { activeGameId=null; localStorage.removeItem("activeGameId"); form.reset(); saveBtn.disabled=true; deleteBtn.disabled=true; }
  renderGames();
}

newBtn.onclick = createGame;
saveBtn.onclick = saveGame;
deleteBtn.onclick = ()=>{ if(activeGameId) deleteGame(activeGameId); };

// Real-time updates
ensureAuth().then(() => {
  onSnapshot(collection(db, ...userPath("games")), renderGames);
  if(activeGameId) loadGame(activeGameId);
  else renderGames();
});
</script>
