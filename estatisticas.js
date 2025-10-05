// ---------- Configuração ----------
const STORAGE_KEY = 'estatisticas_valores';
const DEBOUNCE_MS = 500;

const STAT_KEYS_CAMPO = ['rem','stopped','fora','goals','wrongPasses','fouls'];
const STAT_KEYS_GR = ['grOnNet','grStopped','grGoals','fouls'];

const LABELS = {
  rem:"Remates", stopped:"Interceptados", fora:"Fora", goals:"Golos",
  wrongPasses:"Passes Errados", fouls:"Faltas",
  grOnNet:"Defesas", grStopped:"Interceptados", grGoals:"Golos Sofridos"
};

let playersCampo = [], playersGR = [];
let autoSaveTimer, statsData = {}, inOutData = {}, statsEnabled = false;
const intervals = [];

// Intervalos descendentes de 25:00 até 0:30
for(let t=25*60; t>=30; t-=30){
  const m = Math.floor(t/60), s = t%60;
  intervals.push(s===0 ? `${m}` : (m===0 ? '30' : `${m}'30`));
}

// ---------- Helpers ----------
function buildPlayerStats(player, isGR){
  const obj = { id: player.numero, name: player.nome, type: isGR?'GR':'Campo' };
  const keys = isGR ? STAT_KEYS_GR : STAT_KEYS_CAMPO;
  keys.forEach(k => { obj[k+'1']=0; obj[k+'2']=0; });
  return obj;
}

function loadPlayersFromConfig(){
  const fieldPlayers = JSON.parse(localStorage.getItem("fieldPlayers")) || [];
  const goalKeepers = JSON.parse(localStorage.getItem("goalKeepers")) || [];

  // só quem tem estatísticas ativas
  const fieldWithStats = fieldPlayers.filter(p => p.estatisticas);
  const goalWithStats = goalKeepers.filter(p => p.estatisticas);

  // garantir que existe statsData no storage e atualizar nomes/números
  fieldWithStats.forEach(p=>{
    if(!statsData[p.numero]) {
      statsData[p.numero] = buildPlayerStats(p,false);
    } else {
      statsData[p.numero].name = p.nome; // atualizar nome
      statsData[p.numero].id = p.numero; // atualizar número
    }
  });
  goalWithStats.forEach(p=>{
    if(!statsData[p.numero]) {
      statsData[p.numero] = buildPlayerStats(p,true);
    } else {
      statsData[p.numero].name = p.nome;
      statsData[p.numero].id = p.numero;
    }
  });

  // listas atuais só com quem tem estatísticas ligadas
  playersCampo = fieldWithStats.map(p=>statsData[p.numero]);
  playersGR = goalWithStats.map(p=>statsData[p.numero]);
}

// ---------- Salvamento ----------
function saveToLocal(){ 
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ stats: statsData, inOut: inOutData })); 
  if(document.getElementById('lastSaved')) 
    document.getElementById('lastSaved').textContent='Última gravação: '+new Date().toLocaleString('pt-PT'); 
}
function scheduleAutoSave(){ clearTimeout(autoSaveTimer); autoSaveTimer = setTimeout(saveToLocal, DEBOUNCE_MS); }
function loadFromLocal(){
  const saved = localStorage.getItem(STORAGE_KEY);
  if(saved){ 
    try{
      const data = JSON.parse(saved);
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
function render(){
  renderPlayers(playersCampo,'tableCampo1','part1',STAT_KEYS_CAMPO);
  renderPlayers(playersGR,'tableGR1','part1',STAT_KEYS_GR);
  renderPlayers(playersCampo,'tableCampo2','part2',STAT_KEYS_CAMPO);
  renderPlayers(playersGR,'tableGR2','part2',STAT_KEYS_GR);
  renderInOut(); updateTotals();
}

// ---------- Entradas / Saídas ----------
function renderInOutTable(tableId){
  if(!document.getElementById(tableId)) return;
  const table = document.getElementById(tableId);
  const thead = table.querySelector('thead tr'); 
  thead.innerHTML = '<th>#</th><th>Nome</th>';
  intervals.forEach(iv => { thead.innerHTML += `<th class="rotate">${iv}</th>`; });

  const tbody = table.querySelector('tbody'); tbody.innerHTML='';
  const allPlayers = [...playersCampo, ...playersGR];

  allPlayers.forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.id}</td><td>${p.name||'-'}</td>`;
    intervals.forEach(iv=>{
      const cell = document.createElement('td'); cell.className='inout-cell';
      const key = `${tableId}_${p.id}_${iv}`;
      cell.textContent = inOutData[key]||'';
      if(inOutData[key]==='E'){ cell.style.background='#27ae60'; cell.style.color='#fff'; }
      else if(inOutData[key]==='S'){ cell.style.background='#f39c12'; cell.style.color='#fff'; }
      cell.addEventListener('click', ()=>{
        if(!inOutData[key] || inOutData[key]===''){ inOutData[key]='E'; cell.style.background='#27ae60'; cell.style.color='#fff'; }
        else if(inOutData[key]==='E'){ inOutData[key]='S'; cell.style.background='#f39c12'; cell.style.color='#fff'; }
        else { inOutData[key]=''; cell.style.background=''; cell.style.color=''; }
        cell.textContent = inOutData[key]; scheduleAutoSave();
      });
      tr.appendChild(cell);
    });
    tbody.appendChild(tr);
  });
}
function renderInOut(){
  renderInOutTable('tableInOut1'); 
  renderInOutTable('tableInOut2'); 
}

// ---------- Inicialização ----------
function init(){
  loadFromLocal();
  loadPlayersFromConfig();
  statsEnabled = true;
  render();
}

// ---------- Sincronização em tempo real ----------
window.addEventListener("storage", (e)=>{
  if(e.key === "fieldPlayers" || e.key === "goalKeepers"){
    loadPlayersFromConfig();
    render();
  }
});

// start
init();
