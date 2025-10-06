// ---------- Configuração ----------
import {
  FB_PATHS_GLOBAL,
  FB_PATHS_GAME,
  initializeFirebase,
  setFirebaseData,
  getFirebaseData,
  onFirebaseDataChange,
  getActiveGameId,
  setActiveGameId
} from './firebase-data.js';

const STORAGE_KEY = FB_PATHS_GAME.estatisticasValores; // Use game-specific path
const DEBOUNCE_MS = 500;

const STAT_KEYS_CAMPO = ['rem','interceptados','fora','golos','passesErrados','faltas']; // Changed 'grPostes' to 'rem' for consistency
const STAT_KEYS_GR = ['defesas','interceptados','golosSofridos','faltas'];

const LABELS = {
  rem:"Remates", interceptados:"Interceptados", fora:"Fora", golos:"Golos",
  passesErrados:"Passes Errados", faltas:"Faltas",
  defesas:"Defesas", golosSofridos:"Golos Sofridos" // Simplified for GR
};

let playersCampo = [], playersGR = [];
let autoSaveTimer, statsData = {}, inOutData = {}; // statsEnabled removed as it's always true after init
const intervals = [];

// Intervalos descendentes de 25:00 até 0:30
for(let t=25*60; t>=30; t-=30){
  const m = Math.floor(t/60), s = t%60;
  intervals.push(s===0 ? `${m}` : (m===0 ? '30' : `${m}'30`));
}

// Expose globals for other scripts that import this one
window.STAT_KEYS_CAMPO = STAT_KEYS_CAMPO;
window.STAT_KEYS_GR = STAT_KEYS_GR;
window.LABELS = LABELS;
window.playersCampo = playersCampo;
window.playersGR = playersGR;

// ---------- Helpers ----------
function buildPlayerStats(player, isGR){
  const obj = { id: player.numero, name: player.nome, type: isGR?'GR':'Campo' };
  const keys = isGR ? STAT_KEYS_GR : STAT_KEYS_CAMPO;
  keys.forEach(k => { obj[k+'1']=0; obj[k+'2']=0; });
  return obj;
}

async function loadPlayersFromConfig(){
  const fieldPlayersData = await getFirebaseData(FB_PATHS_GLOBAL.fieldPlayers);
  const goalKeepersData = await getFirebaseData(FB_PATHS_GLOBAL.goalKeepers);

  const fieldPlayers = fieldPlayersData ? fieldPlayersData.players : [];
  const goalKeepers = goalKeepersData ? goalKeepersData.players : [];

  const fieldWithStats = fieldPlayers.filter(p => p.estatisticas);
  const goalWithStats = goalKeepers.filter(p => p.estatisticas);

  // Ensure statsData has entries for all eligible players and update names/numbers
  const newStatsData = {};

  fieldWithStats.forEach(p => {
    newStatsData[p.numero] = statsData[p.numero] || buildPlayerStats(p, false);
    newStatsData[p.numero].name = p.nome;
    newStatsData[p.numero].id = p.numero;
  });
  goalWithStats.forEach(p => {
    newStatsData[p.numero] = statsData[p.numero] || buildPlayerStats(p, true);
    newStatsData[p.numero].name = p.nome;
    newStatsData[p.numero].id = p.numero;
  });

  statsData = newStatsData; // Update global statsData

  // Filter playersCampo and playersGR based on current statsData
  playersCampo = Object.values(statsData).filter(p => p.type === 'Campo' && fieldWithStats.some(fp => fp.numero === p.id));
  playersGR = Object.values(statsData).filter(p => p.type === 'GR' && goalWithStats.some(gp => gp.numero === p.id));

  // Update global window variables
  window.playersCampo = playersCampo;
  window.playersGR = playersGR;
}

// ---------- Salvamento ----------
async function saveToLocal(){
  const activeGame = getActiveGameId();
  if (!activeGame) {
    console.warn("No active game to save stats for.");
    return;
  }
  await setFirebaseData(STORAGE_KEY, { stats: statsData, inOut: inOutData });
  if(document.getElementById('lastSaved'))
    document.getElementById('lastSaved').textContent='Última gravação: '+new Date().toLocaleString('pt-PT');
}
function scheduleAutoSave(){ clearTimeout(autoSaveTimer); autoSaveTimer = setTimeout(saveToLocal, DEBOUNCE_MS); }
async function loadFromLocal(){
  const activeGame = getActiveGameId();
  if (!activeGame) {
    console.warn("No active game to load stats for.");
    return;
  }
  const data = await getFirebaseData(STORAGE_KEY);
  if(data){
    try{
      statsData = data.stats || {};
      inOutData = data.inOut || {};
    }catch(err){ console.warn('Erro a parsear estatísticas.', err); }
  }
}

// ---------- Totais ----------
function updateTotals(){
  if(!document.getElementById('totalsCampo')) return;
  const tbodyCampo = document.getElementById('totalsCampo').querySelector('tbody');
  const tbodyGR = document.getElementById('totalsGR').querySelector('tbody');
  tbodyCampo.innerHTML=''; tbodyGR.innerHTML='';

  const totalsCampo = {}; const totalsGR = {};
  STAT_KEYS_CAMPO.forEach(st=>{ totalsCampo[LABELS[st]] = {p1:0, p2:0}; });
  STAT_KEYS_GR.forEach(st=>{ totalsGR[LABELS[st]] = {p1:0, p2:0}; });

  playersCampo.forEach(p => { STAT_KEYS_CAMPO.forEach(st => { totalsCampo[LABELS[st]].p1 += p[st+'1']; totalsCampo[LABELS[st]].p2 += p[st+'2']; }); });
  playersGR.forEach(p => { STAT_KEYS_GR.forEach(st => { totalsGR[LABELS[st]].p1 += p[st+'1']; totalsGR[LABELS[st]].p2 += p[st+'2']; }); });

  for(const k in totalsCampo){ const {p1,p2} = totalsCampo[k]; tbodyCampo.innerHTML += `<tr><td>${k}</td><td>${p1}</td><td>${p2}</td><td>${p1+p2}</td></tr>`; }
  for(const k in totalsGR){ const {p1,p2} = totalsGR[k]; tbodyGR.innerHTML += `<tr><td>${k}</td><td>${p1}</td><td>${p2}</td><td>${p1+p2}</td></tr>`; }
}

// ---------- Incremento / Decremento ----------
document.addEventListener('click', e => {
  if(!e.target.classList.contains('inc') && !e.target.classList.contains('dec')) return;

  const activeGame = getActiveGameId();
  if (!activeGame) {
    alert("Nenhum jogo ativo. Por favor, selecione ou crie um jogo em 'Configurar Jogo'.");
    return;
  }

  const delta = e.target.classList.contains('inc') ? 1 : -1;
  const id = parseInt(e.target.dataset.id), stat = e.target.dataset.stat;
  const player = statsData[id]; if(!player) return;
  player[stat] = Math.max(0, (player[stat]||0)+delta);

  const input = document.querySelector(`.valueInput[data-id='${id}'][data-stat='${stat}']`);
  if(input){ input.value = player[stat]; input.classList.add('updated'); setTimeout(()=>input.classList.remove('updated'),300); }
  scheduleAutoSave(); updateTotals();
});

// ---------- Renderização ----------
function renderPlayers(arr, containerId, part, keys){
  if(!document.getElementById(containerId)) return;
  const tbody = document.getElementById(containerId).querySelector('tbody');
  tbody.innerHTML = '';
  arr.forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.id}</td><td>${p.name}</td>`+
      keys.map(stat=>{
        const key = stat+(part==='part1'?'1':'2');
        return `<td>
          <div class='button-group'>
            <button class='dec' data-id='${p.id}' data-stat='${key}' data-type='${containerId}'>-</button>
            <input type='number' class='valueInput' data-id='${p.id}' data-stat='${key}' data-type='${containerId}' value='${p[key]||0}' min='0' readonly>
            <button class='inc' data-id='${p.id}' data-stat='${key}' data-type='${containerId}'>+</button>
          </div>
        </td>`;
      }).join('');
    tbody.appendChild(tr);
  });
}
async function render(){
  await loadPlayersFromConfig();
  renderPlayers(playersCampo,'tableCampo1','part1',STAT_KEYS_CAMPO);
  renderPlayers(playersGR,'tableGR1','part1',STAT_KEYS_GR);
  renderPlayers(playersCampo,'tableCampo2','part2',STAT_KEYS_CAMPO);
  renderPlayers(playersGR,'tableGR2','part2',STAT_KEYS_GR);
  // renderInOut(); // This is for entradassaidas.html, not estatisticas.html
  updateTotals();
}

// ---------- Entradas / Saídas (moved to entradassaidas.html) ----------
// The functions renderInOutTable and renderInOut are no longer needed here
// as they are specific to entradassaidas.html.

// ---------- Inicialização ----------
async function init(){
  await initializeFirebase(); // Ensures auth & migration

  const activeGame = getActiveGameId();
  if (!activeGame) {
    console.warn("No active game. Redirecting to game config.");
    // This init is called by other pages, so we don't want to alert/redirect here
    // The calling page should handle the absence of an active game.
    return;
  }

  await loadFromLocal();
  await loadPlayersFromConfig();
  render();
}

// Expose init globally for other scripts to call
window.init = init;

// ---------- Sincronização em tempo real ----------
// Listen for changes to statsData and player configurations
onFirebaseDataChange(STORAGE_KEY, (data) => {
  if (data) {
    statsData = data.stats || {};
    inOutData = data.inOut || {};
    render();
  }
});

onFirebaseDataChange(FB_PATHS_GLOBAL.fieldPlayers, () => {
  loadPlayersFromConfig().then(render);
});

onFirebaseDataChange(FB_PATHS_GLOBAL.goalKeepers, () => {
  loadPlayersFromConfig().then(render);
});

// No auto-init here, as this file is imported by others.
// The importing HTML files will call window.init() when ready.