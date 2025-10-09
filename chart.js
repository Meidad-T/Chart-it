// chart.js - responsible for chart DOM manipulation and butterfly animations

export let previewMode = false;

// Lazily resolve DOM elements — some hosts (or module load order) may import modules before DOM is parsed.
let columnsRow = null;
let rowsBody = null;
let chartTitle = '(Untitled chart)';

function ensureDom(){
  if(!columnsRow) columnsRow = document.getElementById('columns');
  if(!rowsBody) rowsBody = document.getElementById('rows');
  ensureStarCountHeader();
}

// Ensure there's a trailing, non-removable "Stars" header used to show per-row totals
function ensureStarCountHeader(){
  if(!columnsRow) return;
  const last = columnsRow.children[columnsRow.children.length - 1];
  if(!last || !last.classList || !last.classList.contains('star-header')){
    const th = document.createElement('th');
    th.className = 'star-header';
    th.textContent = 'Stars';
    columnsRow.appendChild(th);
  }
}

export function setPreview(v){
  previewMode = !!v;
  const chartEl = document.getElementById('chart');
  if(chartEl) chartEl.classList.toggle('preview-mode', previewMode);
}

export function setTitle(t){ chartTitle = String(t || '').slice(0,50); const el = document.getElementById('chartTitle'); if(el) el.textContent = chartTitle; }
export function getTitle(){ return chartTitle; }

export function addColumn(name){
  ensureDom();
  if(!name) return;
  const th = document.createElement('th');
  th.textContent = name;
  // insert before star header
  const starHeader = columnsRow.querySelector('.star-header');
  if(starHeader) columnsRow.insertBefore(th, starHeader); else columnsRow.appendChild(th);
  makeColumnHeaderEditable(th);

  // add an empty cell in each existing row (before the star-count cell)
  Array.from(rowsBody.querySelectorAll('tr')).forEach(tr => {
    const td = document.createElement('td');
    td.addEventListener('click', ()=> cellClicked(td));
    const starTd = tr.querySelector('td.row-star-count');
    if(starTd) tr.insertBefore(td, starTd); else tr.appendChild(td);
  });
}

export function addRow(name){
  ensureDom();
  if(!name) return;
  const tr = document.createElement('tr');
  const th = document.createElement('th');
  th.textContent = name;
  tr.appendChild(th);
  makeRowHeaderEditable(th);
  th.setAttribute('data-row-index', rowsBody.children.length);

  // add data cells for each user column (exclude corner and star header)
  const colCount = getActualColumnsCount();
  for(let i=0;i<colCount;i++){
    const td = document.createElement('td');
    td.addEventListener('click', ()=> cellClicked(td));
    tr.appendChild(td);
  }
  // trailing star count cell
  const starTd = document.createElement('td');
  starTd.className = 'row-star-count';
  starTd.textContent = '0';
  tr.appendChild(starTd);
  rowsBody.appendChild(tr);
}

function getActualColumnsCount(){
  ensureDom();
  if(!columnsRow) return 0;
  const total = columnsRow.children.length;
  // corner + user columns + star header
  if(total <= 2) return Math.max(0, total - 1);
  return Math.max(0, total - 2);
}

export function removeRow(index){
  ensureDom();
  const rows = Array.from(rowsBody.children);
  if(typeof index !== 'number' || index < 0 || index >= rows.length) return false;
  const tr = rows[index];
  const tds = Array.from(tr.querySelectorAll('td'));
  tds.forEach(td => {
    const butterflies = Array.from(td.querySelectorAll('.butterfly'));
    butterflies.forEach(b => {
      try{ if(b.parentElement) b.remove(); }catch(e){}
      for(let i = starHistory.length-1;i>=0;i--){ if(starHistory[i].el === b) starHistory.splice(i,1); }
    });
  });
  tr.remove();
  Array.from(rowsBody.children).forEach((r,i)=>{ const th = r.children[0]; if(th) th.setAttribute('data-row-index', i); });
  notifyHistory();
  updateAllRowCounts();
  return true;
}

export function removeColumn(index){
  ensureDom();
  const cols = Array.from(columnsRow.children).slice(1, -1);
  if(typeof index !== 'number' || index < 0 || index >= cols.length) return false;
  const realIndex = index + 1;
  const th = columnsRow.children[realIndex];
  if(th) th.remove();
  Array.from(rowsBody.children).forEach(tr=>{
    const td = tr.children[realIndex];
    if(td){
      const butterflies = Array.from(td.querySelectorAll('.butterfly'));
      butterflies.forEach(b=>{ try{ if(b.parentElement) b.remove(); }catch(e){} for(let i = starHistory.length-1;i>=0;i--){ if(starHistory[i].el === b) starHistory.splice(i,1); } });
      td.remove();
    }
  });
  Array.from(columnsRow.children).forEach((c,i)=>{ if(i>0 && !c.classList.contains('star-header')) c.setAttribute('data-col-index', i); });
  notifyHistory();
  updateAllRowCounts();
  return true;
}

function makeColumnHeaderEditable(th){
  if(!th) return;
  th.addEventListener('click', ()=>{
    th.contentEditable = 'true';
    th.focus();
    // select all so typing replaces existing text
    document.execCommand('selectAll', false, null);
  });
  th.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); th.blur(); } if(e.key === 'Escape'){ th.blur(); } });
  th.addEventListener('blur', ()=>{ th.contentEditable = 'false'; const text = (th.textContent || '').trim().slice(0,50); th.textContent = text || '(Unnamed)'; });
}

function makeRowHeaderEditable(th){
  if(!th) return;
  th.addEventListener('click', ()=>{
    th.contentEditable = 'true';
    th.focus();
    // select all so typing will replace
    document.execCommand('selectAll', false, null);
  });
  th.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); th.blur(); } if(e.key === 'Escape'){ th.blur(); } });
  th.addEventListener('blur', ()=>{ th.contentEditable = 'false'; const text = (th.textContent || '').trim().slice(0,50); th.textContent = text || '(Unnamed)'; });
}

export function clearChart(){
  ensureDom();
  columnsRow.innerHTML = '<th></th>';
  rowsBody.innerHTML = '';
}

export function clearStars(){
  ensureDom();
  const tds = rowsBody.querySelectorAll('td');
  tds.forEach(td => {
    const butterflies = td.querySelectorAll('.butterfly');
    butterflies.forEach(b => b.remove());
  });
  starHistory.length = 0;
  notifyHistory();
  updateAllRowCounts();
}

const starHistory = [];
const historyListeners = [];

export function hasUndo(){ return starHistory.length > 0; }

function notifyHistory(){ try{ historyListeners.forEach(cb=>{ try{ cb(); }catch(e){} }); }catch(e){} }
export function onHistoryChange(cb){ if(typeof cb === 'function') historyListeners.push(cb); }

export function undoLastStar(){
  const entry = starHistory.pop();
  notifyHistory();
  if(!entry) return false;
  try{ if(entry.el && entry.el.parentElement) entry.el.remove(); try{ if(entry.td) layoutButterfliesInCell(entry.td); }catch(e){} }catch(e){}
  try{ if(entry && entry.td){ const tr = entry.td.closest('tr'); if(tr) updateRowStarCount(tr); } }catch(e){}
  return true;
}

function rand(min, max){ return Math.random()*(max-min)+min; }

const WEIGHTED_PALETTE = [
  {color:'#FF6B00', weight:30},
  {color:'#FFD400', weight:30},
  {color:'#FF3B3B', weight:30},
  {color:'#FF69B4', weight:25},
  {color:'#8A2BE2', weight:25},
  {color:'#06B6D4', weight:25},
  {color:'#1E3A8A', weight:20},
  {color:'#A8E6A3', weight:17},
  {color:'#006400', weight:17},
  {color:'#00A3FF', weight:17},
  {color:'#FFB6C1', weight:17},
  {color:'#9BAE9E', weight:17},
  {color:'#C0C0C0', weight:5},
  {color:'#D4AF37', weight:4}
];
let lastColor = null;
function weightedRandomColor(){
  const choices = WEIGHTED_PALETTE.filter(e => e.color !== lastColor);
  const total = choices.reduce((s,c)=> s + c.weight, 0);
  let r = Math.random() * total;
  for(const c of choices){ if(r < c.weight){ lastColor = c.color; return c.color; } r -= c.weight; }
  const fallback = WEIGHTED_PALETTE[Math.floor(Math.random()*WEIGHTED_PALETTE.length)].color;
  lastColor = fallback;
  return fallback;
}
function randomColor(){ return weightedRandomColor(); }

export function createButterfly(color){ const butterfly = document.createElement('div'); butterfly.className = 'butterfly'; butterfly.style.background = color || randomColor(); return butterfly; }

function layoutButterfliesInCell(td){
  const butterflies = Array.from(td.querySelectorAll('.butterfly'));
  const count = butterflies.length;
  if(count === 0) return;
  const rect = td.getBoundingClientRect();
  const available = Math.max(24, rect.width - 20);
  const iconW = 28;
  const spacing = count > 1 ? Math.min(iconW + 8, available / count) : 0;
  const totalWidth = (count - 1) * spacing;
  butterflies.forEach((b,i)=>{
    b.style.position = 'absolute';
    b.style.top = '50%';
    const offset = (i*spacing) - (totalWidth/2);
    b.style.left = `calc(50% + ${offset}px)`;
    b.style.transform = 'translate(-50%, -50%) scale(1)';
    b.style.transition = 'left 0.35s ease, top 0.35s ease, transform 0.35s ease';
  });
  try{ const tr = td.closest('tr'); if(tr) updateRowStarCount(tr); }catch(e){}
}

function flyButterflyToCell(butterfly, td){
  document.body.appendChild(butterfly);
  butterfly.style.left = '20px'; butterfly.style.top = '20px'; butterfly.style.transform = 'translate(0,0)'; butterfly.getBoundingClientRect();
  const rect = td.getBoundingClientRect();
  const targetX = rect.left + rect.width/2 + (window.scrollX || window.pageXOffset || 0);
  const targetY = rect.top + rect.height/2 + (window.scrollY || window.pageYOffset || 0);
  butterfly.style.willChange = 'left, top, transform';
  butterfly.style.transition = 'left 1s ease, top 1s ease, transform 0.9s ease';
  requestAnimationFrame(()=>{ butterfly.style.left = `${targetX}px`; butterfly.style.top = `${targetY}px`; butterfly.style.transform = 'translate(-50%, -50%)'; });
  setTimeout(()=>{
    try{ butterfly.style.transition = 'none'; butterfly.style.willChange = 'auto'; td.appendChild(butterfly); butterfly.style.position = 'absolute'; butterfly.style.left = '50%'; butterfly.style.top = '50%'; butterfly.style.transform = 'translate(-50%, -50%)'; layoutButterfliesInCell(td); try{ const tr = td.closest('tr'); if(tr) updateRowStarCount(tr); }catch(e){} }catch(e){ console.warn(e); }
  }, 1000 + 20);
}

function cellClicked(td){ if(!previewMode) return; const color = randomColor(); const b = createButterfly(color); try{ starHistory.push({el: b, td}); notifyHistory(); }catch(e){} flyButterflyToCell(b, td); }

export function serializeChart(){
  ensureDom();
  const data = {title: chartTitle, columns:[], rows:[], cells:[]};
  const colCount = getActualColumnsCount();
  for(let i=0;i<colCount;i++){ const header = columnsRow.children[i+1]; data.columns.push(header ? header.textContent : ''); }
  Array.from(rowsBody.children).forEach(tr=>{
    data.rows.push(tr.children[0].textContent);
    const rowCells = [];
    for(let i=1;i<=colCount;i++){ const td = tr.children[i]; const butterflies = Array.from(td ? td.querySelectorAll('.butterfly') : []); const list = butterflies.map(b=> ({color: b.style.background})); rowCells.push({butterflies: list}); }
    data.cells.push(rowCells);
  });
  return data;
}

export function restoreChart(data){
  ensureDom(); clearChart(); if(!data) return; if(data.title) setTitle(data.title);
  data.columns?.forEach(c=> addColumn(c));
  data.rows?.forEach(r=> addRow(r));
  data.cells?.forEach((rowCells,rIndex)=>{ const tr = rowsBody.children[rIndex]; rowCells.forEach((cell,cIndex)=>{ const td = tr.children[cIndex+1]; (cell.butterflies||[]).forEach(binfo=>{ const b = createButterfly(binfo.color); td.appendChild(b); b.style.position = 'absolute'; b.style.left = '50%'; b.style.top = '50%'; b.style.transform = 'translate(-50%, -50%)'; b.style.transition = 'none'; }); layoutButterfliesInCell(td); }); });
  starHistory.length = 0; notifyHistory(); updateAllRowCounts();
}

function updateRowStarCount(tr){ if(!tr) return; const butterflies = Array.from(tr.querySelectorAll('td .butterfly')); const count = butterflies.length; const starTd = tr.querySelector('td.row-star-count'); if(starTd) starTd.textContent = String(count); }
function updateAllRowCounts(){ Array.from(rowsBody.children).forEach(tr=> updateRowStarCount(tr)); }

