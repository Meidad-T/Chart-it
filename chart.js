// chart.js - responsible for chart DOM manipulation and butterfly animations

export let previewMode = false;

const columnsRow = document.getElementById('columns');
const rowsBody = document.getElementById('rows');

export function setPreview(v){
  previewMode = !!v;
  document.getElementById('chart').classList.toggle('preview-mode', previewMode);
}

export function addColumn(name){
  if(!name) return;
  const th = document.createElement('th');
  th.textContent = name;
  columnsRow.appendChild(th);

  // add empty cells to existing rows
  Array.from(rowsBody.querySelectorAll('tr')).forEach(tr=>{
    const td = document.createElement('td');
    td.addEventListener('click', ()=> cellClicked(td));
    tr.appendChild(td);
  });
}

export function addRow(name){
  if(!name) return;
  const tr = document.createElement('tr');
  const th = document.createElement('th');
  th.textContent = name;
  tr.appendChild(th);

  const colCount = columnsRow.children.length - 1;
  for(let i=0;i<colCount;i++){
    const td = document.createElement('td');
    td.addEventListener('click', ()=> cellClicked(td));
    tr.appendChild(td);
  }
  rowsBody.appendChild(tr);
}

export function clearChart(){
  columnsRow.innerHTML = '<th></th>';
  rowsBody.innerHTML = '';
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
  flyButterflyToCell(b, td);
}

// helpers for serialization: store list of butterflies (colors) per cell
export function serializeChart(){
  const data = {columns:[], rows:[], cells:[]};
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
  clearChart();
  if(!data) return;
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
}

