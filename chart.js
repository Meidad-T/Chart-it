// chart.js - responsible for chart DOM manipulation and butterfly animations

export let previewMode = false;

// Lazily resolve DOM elements — some hosts (or module load order) may import modules before DOM is parsed.
let columnsRow = null;
let rowsBody = null;
let chartTitle = '(Untitled chart)';

function ensureDom(){
  if(!columnsRow) columnsRow = document.getElementById('columns');
  if(!rowsBody) rowsBody = document.getElementById('rows');
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
  columnsRow.appendChild(th);
  // make column header editable (click to rename column)
  makeColumnHeaderEditable(th);

  // add empty cells to existing rows
  Array.from(rowsBody.querySelectorAll('tr')).forEach(tr=>{
    const td = document.createElement('td');
    td.addEventListener('click', ()=> cellClicked(td));
    tr.appendChild(td);
  });
}

// Make a column <th> editable similarly to the chart title and row headers.
function makeColumnHeaderEditable(th){
  if(!th) return;
  th.addEventListener('click', ()=>{
    th.contentEditable = 'true';
    th.focus();
    document.execCommand('selectAll', false, null);
    document.getSelection().collapseToEnd();
  });
  th.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){ e.preventDefault(); th.blur(); }
    if(e.key === 'Escape'){ th.blur(); }
  });
  th.addEventListener('blur', ()=>{
    th.contentEditable = 'false';
    const text = (th.textContent || '').trim().slice(0,50);
    th.textContent = text || '(Unnamed)';
  });
}

export function addRow(name){
  ensureDom();
  if(!name) return;
  const tr = document.createElement('tr');
  const th = document.createElement('th');
  th.textContent = name;
  tr.appendChild(th);

  // make the row header editable (click to rename student)
  makeRowHeaderEditable(th);

  const colCount = columnsRow.children.length - 1;
  for(let i=0;i<colCount;i++){
    const td = document.createElement('td');
    td.addEventListener('click', ()=> cellClicked(td));
    tr.appendChild(td);
  }
  rowsBody.appendChild(tr);
}

// Make a row <th> editable similarly to the chart title.
function makeRowHeaderEditable(th){
  if(!th) return;
  th.addEventListener('click', ()=>{
    th.contentEditable = 'true';
    th.focus();
    // select all and move cursor to end
    document.execCommand('selectAll', false, null);
    document.getSelection().collapseToEnd();
  });
  th.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){ e.preventDefault(); th.blur(); }
    if(e.key === 'Escape'){ th.blur(); }
  });
  th.addEventListener('blur', ()=>{
    th.contentEditable = 'false';
    const text = (th.textContent || '').trim().slice(0,50);
    th.textContent = text || '(Unnamed)';
  });
}

export function clearChart(){
  ensureDom();
  columnsRow.innerHTML = '<th></th>';
  rowsBody.innerHTML = '';
}

// Remove all butterflies from the chart but keep the rows/columns intact.
export function clearStars(){
  ensureDom();
  const tds = rowsBody.querySelectorAll('td');
  tds.forEach(td => {
    const butterflies = td.querySelectorAll('.butterfly');
    butterflies.forEach(b => b.remove());
  });
  // reset history
  starHistory.length = 0;
  notifyHistory();
}

// History stack for placed butterflies to support undo
const starHistory = [];
const historyListeners = [];

export function hasUndo(){ return starHistory.length > 0; }

function notifyHistory(){ try{ historyListeners.forEach(cb=>{ try{ cb(); }catch(e){/* ignore listener errors */} }); }catch(e){} }

export function onHistoryChange(cb){ if(typeof cb === 'function') historyListeners.push(cb); }

export function undoLastStar(){
  const entry = starHistory.pop();
  notifyHistory();
  if(!entry) return false;
  try{
    if(entry.el && entry.el.parentElement) entry.el.remove();
    // re-layout the cell where the butterfly was removed
    try{ if(entry.td) layoutButterfliesInCell(entry.td); }catch(e){}
  }catch(e){/* ignore */}
  return true;
}

function rand(min, max){ return Math.random()*(max-min)+min; }

// weighted palette: user-specified preferences (weights are relative; selection is randomized by weight)
const WEIGHTED_PALETTE = [
  {color:'#FF6B00', weight:30}, // orange
  {color:'#FFD400', weight:30}, // yellow
  {color:'#FF3B3B', weight:30}, // red

  {color:'#FF69B4', weight:25}, // pink
  {color:'#8A2BE2', weight:25}, // purple
  {color:'#06B6D4', weight:25}, // cyan

  {color:'#1E3A8A', weight:20}, // dark blue

  // other colors (lighter greens, sage, light blues) with default medium weight
  {color:'#A8E6A3', weight:17}, // light green
  {color:'#006400', weight:17}, // dark green
  {color:'#00A3FF', weight:17}, // sky blue
  {color:'#FFB6C1', weight:17}, // light pink
  {color:'#9BAE9E', weight:17}, // sage

  {color:'#C0C0C0', weight:5},  // silver (rare)
  {color:'#D4AF37', weight:4}   // gold (very rare)
];
// ensure lastColor is tracked
let lastColor = null;

function weightedRandomColor(){
  // build choices excluding lastColor if possible
  const choices = WEIGHTED_PALETTE.filter(e => e.color !== lastColor);
  const total = choices.reduce((s,c)=> s + c.weight, 0);
  let r = Math.random() * total;
  for(const c of choices){
    if(r < c.weight){ lastColor = c.color; return c.color; }
    r -= c.weight;
  }
  // fallback
  const fallback = WEIGHTED_PALETTE[Math.floor(Math.random()*WEIGHTED_PALETTE.length)].color;
  lastColor = fallback;
  return fallback;
}
function randomColor(){
  return weightedRandomColor();
}

export function createButterfly(color){
  const butterfly = document.createElement('div');
  butterfly.className = 'butterfly';
  butterfly.style.background = color || randomColor();
  return butterfly;
}

// layout multiple butterflies evenly using the actual td width
function layoutButterfliesInCell(td){
  const butterflies = Array.from(td.querySelectorAll('.butterfly'));
  const count = butterflies.length;
  if(count === 0) return;

  const rect = td.getBoundingClientRect();
  const available = Math.max(24, rect.width - 20); // padding
  const iconW = 28; // approx butterfly width
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
}

function flyButterflyToCell(butterfly, td){
  document.body.appendChild(butterfly);

  // original quick flight: start near top-left and animate for ~1s
  butterfly.style.left = '20px';
  butterfly.style.top = '20px';
  butterfly.style.transform = 'translate(0,0)';
  butterfly.getBoundingClientRect();

  const rect = td.getBoundingClientRect();
  const targetX = rect.left + rect.width/2;
  const targetY = rect.top + rect.height/2;

  butterfly.style.transition = 'left 1s ease, top 1s ease, transform 0.9s ease';
  requestAnimationFrame(()=>{
    butterfly.style.left = `${targetX}px`;
    butterfly.style.top = `${targetY}px`;
    butterfly.style.transform = 'translate(-50%, -50%)';
  });

  // after ~1s, attach butterfly into cell and layout evenly
  setTimeout(()=>{
    try{
      butterfly.style.transition = 'none';
      td.appendChild(butterfly);
      butterfly.style.position = 'absolute';
      butterfly.style.left = '50%';
      butterfly.style.top = '50%';
      butterfly.style.transform = 'translate(-50%, -50%)';
      layoutButterfliesInCell(td);
    }catch(e){ console.warn(e); }
  }, 1000 + 20);
}

function cellClicked(td){
  if(!previewMode) return;
  const color = randomColor();
  const b = createButterfly(color);
  // record history at click time so undo removes in click order even if animations finish out-of-order
  try{ starHistory.push({el: b, td}); notifyHistory(); }catch(e){}
  flyButterflyToCell(b, td);
}

// helpers for serialization: store list of butterflies (colors) per cell
export function serializeChart(){
  ensureDom();
  const data = {title: chartTitle, columns:[], rows:[], cells:[]};
  for(let i=1;i<columnsRow.children.length;i++) data.columns.push(columnsRow.children[i].textContent);
  Array.from(rowsBody.children).forEach(tr=>{
    data.rows.push(tr.children[0].textContent);
    const rowCells = [];
    for(let i=1;i<tr.children.length;i++){
      const td = tr.children[i];
      const butterflies = Array.from(td.querySelectorAll('.butterfly'));
      const list = butterflies.map(b=> ({color: b.style.background}));
      rowCells.push({butterflies: list});
    }
    data.cells.push(rowCells);
  });
  return data;
}

export function restoreChart(data){
  ensureDom();
  clearChart();
  if(!data) return;
  if(data.title) setTitle(data.title);
  data.columns?.forEach(c=> addColumn(c));
  data.rows?.forEach(r=> addRow(r));
  data.cells?.forEach((rowCells,rIndex)=>{
    const tr = rowsBody.children[rIndex];
    rowCells.forEach((cell,cIndex)=>{
      const td = tr.children[cIndex+1];
      (cell.butterflies||[]).forEach(binfo=>{
        const b = createButterfly(binfo.color);
        td.appendChild(b);
        b.style.position = 'absolute';
        b.style.left = '50%';
        b.style.top = '50%';
        b.style.transform = 'translate(-50%, -50%)';
        b.style.transition = 'none';
      });
      layoutButterfliesInCell(td);
    });
  });
  // restore should start with an empty history (we're loading a saved state)
  starHistory.length = 0;
  notifyHistory();
}

