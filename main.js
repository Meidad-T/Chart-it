import * as Chart from './chart.js';
import * as Storage from './storage.js';


// UI elements
const landing = document.getElementById('landing');
const editor = document.getElementById('editor');
const newChartBtn = document.getElementById('newChartBtn');
const newChartBtn2 = document.getElementById('newChartBtn2');
const fileInput = document.getElementById('fileInput');
const fileInput2 = document.getElementById('fileInput2');
// track imported file info so we can overwrite on save if possible
let importedFile = null; // will hold either a File or a FileSystemFileHandle when available
let chartDirty = false;
const addColumnBtn = document.getElementById('addColumnBtn');
const addRowBtn = document.getElementById('addRowBtn');
const columnName = document.getElementById('columnName');
const rowName = document.getElementById('rowName');
const backBtn = document.getElementById('backBtn');
const saveBtn = document.getElementById('saveBtn');
const previewBtn = document.getElementById('previewBtn');
const leaveLiveBtn = document.getElementById('leaveLiveBtn');
const importFile = document.getElementById('importFile');
const clearStarsBtn = document.getElementById('clearStarsBtn');
const undoBtn = document.getElementById('undoBtn');

function showLanding(){ landing.classList.remove('hidden'); editor.classList.add('hidden'); if(backBtn) backBtn.classList.add('hidden'); }
function showEditor(){ landing.classList.add('hidden'); editor.classList.remove('hidden'); if(backBtn) backBtn.classList.remove('hidden'); }

// Landing 'Create New Chart' -- no warning (fresh start)
if(newChartBtn2) newChartBtn2.addEventListener('click', ()=>{
  Chart.clearChart();
  Chart.setTitle('(Untitled chart)');
  const chartTitleEl = document.getElementById('chartTitle');
  if(chartTitleEl) chartTitleEl.textContent = '(Untitled chart)';
  showEditor();
});

// Top-nav New Session opens a small confirm modal
const confirmModal = document.getElementById('confirmModal');
const confirmProceedBtn = document.getElementById('confirmProceedBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalBody = document.getElementById('confirmModalBody');

function showConfirm(title, body, onProceed){
  if(!confirmModal) return;
  confirmModalTitle.textContent = title;
  confirmModalBody.textContent = body;
  confirmModal.classList.remove('hidden');
  // wire temporary proceed handler
  const handler = ()=>{ try{ onProceed(); } finally{ confirmModal.classList.add('hidden'); confirmProceedBtn.removeEventListener('click', handler); } };
  confirmProceedBtn.addEventListener('click', handler);
}

confirmCancelBtn?.addEventListener('click', ()=>{ confirmModal.classList.add('hidden'); });
confirmModal?.addEventListener('click', (e)=>{ if(e.target === confirmModal) confirmModal.classList.add('hidden'); });

newChartBtn.addEventListener('click', ()=>{
  showConfirm('Erase chart?','This will remove all rows, columns and stars. This cannot be undone.', ()=>{
    Chart.clearChart();
    Chart.setPreview(false);
    document.getElementById('controls').classList.remove('hidden');
    if(leaveLiveBtn) leaveLiveBtn.classList.add('hidden');
    Chart.setTitle('(Untitled chart)');
    const chartTitleEl2 = document.getElementById('chartTitle');
    if(chartTitleEl2) chartTitleEl2.textContent = '(Untitled chart)';
    showEditor();
  });
});

fileInput.addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  try{
    let data = await Storage.readFile(f);
    // Normalize older export formats (from legacy script.js) to new format
    data = normalizeImportedData(data);
    Chart.restoreChart(data);
    // remember imported file so Save can attempt to overwrite
    importedFile = f;
    // If browser supports showSaveFilePicker or file handles, later we may try to convert
    try{ if(window.showSaveFilePicker && f && f.name){ /* no-op, we will request a handle on save if needed */ } }catch(e){}
  updateUndoButton();
    showEditor();
  }catch(err){ alert('Failed to read file: '+err.message); }
  fileInput.value = '';
});

// mark chart dirty when chart dispatches change events
document.addEventListener('chart-changed', ()=>{ chartDirty = true; try{ updateUndoButton(); }catch(e){} });
if(fileInput2) fileInput2.addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  try{ const data = await Storage.readFile(f); Chart.restoreChart(data); showEditor(); }
  catch(err){ alert('Failed to read file: '+err.message); }
  // remember imported file from secondary uploader as well
  importedFile = f;
  fileInput2.value = '';
});

addColumnBtn.addEventListener('click', ()=>{ const name = columnName.value.trim(); if(!name) return; Chart.addColumn(name); columnName.value = ''; });
addRowBtn.addEventListener('click', ()=>{ const name = rowName.value.trim(); if(!name) return; Chart.addRow(name); rowName.value = ''; });

if(backBtn) backBtn.addEventListener('click', ()=>{ showLanding(); });
// Export modal elements
const exportModal = document.getElementById('exportModal');
const exportFilenameInput = document.getElementById('exportFilename');
const exportConfirmBtn = document.getElementById('exportConfirmBtn');
const exportCancelBtn = document.getElementById('exportCancelBtn');

function showExportModal(defaultName = 'chart'){
  exportFilenameInput.value = defaultName;
  exportModal.classList.remove('hidden');
  setTimeout(()=> exportFilenameInput.focus(), 50);
}
function hideExportModal(){ exportModal.classList.add('hidden'); }

if(saveBtn) saveBtn.addEventListener('click', ()=>{
  // If we previously imported a file and chart is dirty, attempt to overwrite without prompting
  if(importedFile && chartDirty){
    const data = Chart.serializeChart();
    (async ()=>{
      try{
        const name = (importedFile && importedFile.name) ? importedFile.name : 'chart.chart';
        const res = await Storage.saveToFileOrDownload(data, name, importedFile);
        if(res && res.ok){ showToast('Saved successfully ('+res.method+')'); chartDirty = false; }
        else showToast('Save failed');
      }catch(err){ console.error(err); showToast('Save failed: '+err.message); }
    })();
    return;
  }
  // otherwise fall back to showing the save-as modal
  showExportModal('chart');
});

exportCancelBtn?.addEventListener('click', hideExportModal);
exportModal?.addEventListener('click', (e)=>{ if(e.target === exportModal) hideExportModal(); });
exportFilenameInput?.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') exportConfirmBtn?.click(); if(e.key === 'Escape') hideExportModal(); });
exportConfirmBtn?.addEventListener('click', ()=>{
  const data = Chart.serializeChart();
  let name = (exportFilenameInput.value || 'chart').trim();
  name = name.replace(/[\\/\?%*:|"<>]/g, '-');
  if(!/\.chart$/i.test(name)) name = name + '.chart';
  hideExportModal();
  // If we previously imported a file and the filename matches, try to overwrite
  (async ()=>{
    try{
      const res = await Storage.saveToFileOrDownload(data, name, importedFile);
      if(res && res.ok){ showToast('Saved successfully ('+res.method+')'); }
      else { showToast('Save failed'); }
    }catch(err){ console.error(err); showToast('Save failed: '+err.message); }
  })();
});

// helper: small toast messages
function showToast(msg, timeout = 2500){
  try{
    let el = document.getElementById('toast-msg');
    if(!el){ el = document.createElement('div'); el.id = 'toast-msg'; el.style.position='fixed'; el.style.right='18px'; el.style.bottom='18px'; el.style.padding='10px 14px'; el.style.background='rgba(0,0,0,0.8)'; el.style.color='#fff'; el.style.borderRadius='8px'; el.style.zIndex=9999; document.body.appendChild(el); }
    el.textContent = msg; el.style.opacity = '1';
    setTimeout(()=>{ try{ el.style.opacity = '0'; }catch(e){} }, timeout);
  }catch(e){ console.warn('toast failed',e); }
}

// Clear stars button: remove butterflies but keep rows/columns
clearStarsBtn?.addEventListener('click', ()=>{
  showConfirm('Clear all stars?','This will remove butterflies but keep rows and columns.', ()=>{
    Chart.clearStars();
    // exit preview mode and restore controls so user can place stars again
    Chart.setPreview(false);
    document.getElementById('controls').classList.remove('hidden');
    if(leaveLiveBtn) leaveLiveBtn.classList.add('hidden');
    // ensure preview button label matches non-preview state
    if(previewBtn) previewBtn.textContent = 'Start The Show';
    updateUndoButton();
  });
});
previewBtn.addEventListener('click', ()=>{
  const newMode = !Chart.previewMode;
  Chart.setPreview(newMode);
  // toggle UI
  document.getElementById('controls').classList.toggle('hidden', newMode);
  if(leaveLiveBtn) leaveLiveBtn.classList.toggle('hidden', !newMode);
  // update preview button label
  previewBtn.textContent = newMode ? 'End The Show' : 'Start The Show';
});

if(leaveLiveBtn){
  leaveLiveBtn.addEventListener('click', ()=>{
    Chart.setPreview(false);
    document.getElementById('controls').classList.remove('hidden');
    leaveLiveBtn.classList.add('hidden');
    if(previewBtn) previewBtn.textContent = 'Start The Show';
  });
}

// hidden import in editor if needed
importFile.addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  try{ const data = await Storage.readFile(f); Chart.restoreChart(data); }
  catch(err){ alert('Import failed: '+err.message); }
  importFile.value = '';
});

// normalize imported data to the shape expected by Chart.restoreChart
function normalizeImportedData(data){
  if(!data || !data.cells) return data;
  // detect legacy format: cells rows with objects like {hasButterfly, color}
  const isLegacyCell = Array.isArray(data.cells) && data.cells.length>0 && Array.isArray(data.cells[0]) && data.cells[0].length>0 && ('hasButterfly' in data.cells[0][0] || 'color' in data.cells[0][0]);
  if(!isLegacyCell) return data;

  const out = {columns: data.columns || [], rows: data.rows || [], cells: []};
  data.cells.forEach(rowCells => {
    const newRow = [];
    rowCells.forEach(cell => {
      if(!cell) { newRow.push({butterflies: []}); return; }
      if(cell.hasOwnProperty('hasButterfly') || cell.hasOwnProperty('color')){
        const list = cell.hasButterfly ? [{color: cell.color || null}] : [];
        newRow.push({butterflies: list});
      }else if(cell.butterflies){
        newRow.push(cell);
      }else{
        newRow.push({butterflies: []});
      }
    });
    out.cells.push(newRow);
  });
  return out;
}

// Typed animation for landing
const typedEl = document.getElementById('typed');
const words = ['Teachers','Educators','Parents','Instructors','Mentors'];
let ti = 0, ci = 0, deleting = false;
// typed animation (inline — both words centered together)
function tick(){
  const word = words[ti % words.length];
  if(!deleting){
    typedEl.textContent = word.slice(0, ci+1);
    ci++;
    if(ci >= word.length){ deleting = true; setTimeout(tick,1200); return; }
  }else{
    typedEl.textContent = word.slice(0, ci-1);
    ci--;
    if(ci <= 0){ deleting = false; ti++; }
  }
  setTimeout(tick, deleting ? 80 : 140);
}
tick();

// start on landing
showLanding();

// Chart title editing
const chartTitleEl = document.getElementById('chartTitle');
function initChartTitle(){
  if(!chartTitleEl) return;
  chartTitleEl.textContent = Chart.getTitle() || '(Untitled chart)';
  chartTitleEl.addEventListener('click', ()=>{
    chartTitleEl.contentEditable = 'true';
    chartTitleEl.focus();
    // select all so typing replaces current title
    document.execCommand('selectAll', false, null);
  });
  chartTitleEl.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){ e.preventDefault(); chartTitleEl.blur(); }
    if(e.key === 'Escape'){ chartTitleEl.blur(); }
  });
  chartTitleEl.addEventListener('blur', ()=>{
    chartTitleEl.contentEditable = 'false';
    const text = (chartTitleEl.textContent || '').trim().slice(0,50);
    chartTitleEl.textContent = text || '(Untitled chart)';
    Chart.setTitle(text);
  });
}

initChartTitle();

// Ensure existing column and row headers are editable (for restored charts or static HTML)
function initExistingHeaders(){
  try{
    const cols = document.querySelectorAll('#columns th');
    cols.forEach((th, i)=>{ if(i>0 && !th.classList.contains('star-header')){ th.addEventListener('click', ()=>{ th.contentEditable='true'; th.focus(); document.execCommand('selectAll', false, null); }); th.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); th.blur(); } if(e.key==='Escape') th.blur(); }); th.addEventListener('blur', ()=>{ th.contentEditable='false'; const text = (th.textContent||'').trim().slice(0,50); th.textContent = text || '(Unnamed)'; }); } });
    const rows = document.querySelectorAll('#rows th');
    rows.forEach(th=>{ th.addEventListener('click', ()=>{ th.contentEditable='true'; th.focus(); document.execCommand('selectAll', false, null); }); th.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); th.blur(); } if(e.key==='Escape') th.blur(); }); th.addEventListener('blur', ()=>{ th.contentEditable='false'; const text = (th.textContent||'').trim().slice(0,50); th.textContent = text || '(Unnamed)'; }); });
  }catch(e){/* ignore */}
}
initExistingHeaders();

function updateUndoButton(){
  if(!undoBtn) return;
  try{ undoBtn.disabled = !Chart.hasUndo(); }catch(e){ undoBtn.disabled = true; }
}

// undo button click
undoBtn?.addEventListener('click', ()=>{
  try{ const ok = Chart.undoLastStar(); if(ok) updateUndoButton(); }
  catch(e){ console.warn(e); }
});

// call once at startup
updateUndoButton();

// listen for history changes so Undo button updates immediately when history changes
if(typeof Chart.onHistoryChange === 'function'){
  Chart.onHistoryChange(()=>{
    try{ updateUndoButton(); }catch(e){}
  });
}

// Theme selector wiring: persist choice and apply `theme-colorful` class
const themeSelect = document.getElementById('themeSelect');
const deleteModeBtn = document.getElementById('deleteModeBtn');
let deleteMode = false;

function setDeleteMode(v){
  deleteMode = !!v;
  if(deleteModeBtn) deleteModeBtn.classList.toggle('active', deleteMode);
  // visually indicate mode (simple style change)
  try{ if(deleteMode) deleteModeBtn.textContent = 'Exit remove mode'; else deleteModeBtn.textContent = 'Remove rows/cols'; }catch(e){}
}

// attach delegated click handlers to row/column headers so we don't need to rebind on add/remove
document.addEventListener('click', (e)=>{
  if(!deleteMode) return;
  const target = e.target;
  if(!target) return;
  // if clicked a row header (<th> inside tbody rows)
  if(target.tagName === 'TH' && target.parentElement && target.parentElement.tagName === 'TR' && target.parentElement.parentElement && target.parentElement.parentElement.id === 'rows'){
    const tr = target.parentElement;
    const rows = Array.from(document.getElementById('rows').children);
    const idx = rows.indexOf(tr);
    if(idx >= 0){
      showConfirm('Remove row?','This will remove the student and any stars in the row. This cannot be undone.', ()=>{
        Chart.removeRow(idx);
        setDeleteMode(false);
      });
    }
    e.stopPropagation(); e.preventDefault();
    return;
  }
  // if clicked a column header (<th> inside the thead row)
  // if clicked a column header (<th> inside the thead row)
  const clickedTh = (typeof target.closest === 'function') ? target.closest('th') : (target.tagName === 'TH' ? target : null);
  if(clickedTh){
    const headerRow = clickedTh.closest('tr');
    if(headerRow && headerRow.id === 'columns'){
      const ths = Array.from(headerRow.children).slice(1); // skip corner
      const idx = ths.indexOf(clickedTh);
      if(idx >= 0){
        showConfirm('Remove column?','This will remove the assignment/column and any stars in that column. This cannot be undone.', ()=>{
          Chart.removeColumn(idx);
          setDeleteMode(false);
        });
      }
      e.stopPropagation(); e.preventDefault();
      return;
    }
  }
});

deleteModeBtn?.addEventListener('click', ()=>{ setDeleteMode(!deleteMode); });
function applyTheme(name){
  const body = document.body;
  if(!body) return;
  if(name === 'colorful'){
    body.classList.add('theme-colorful');
    // (Rainbow removed) do not inject rainbow arch for the colorful theme.
    // inject full-screen SVG background
    if(!document.querySelector('.colorful-bg')){
      const wrapper = document.createElement('div'); wrapper.className = 'colorful-bg';
      wrapper.innerHTML = `
        <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="skyGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#a0e8ff"/>
              <stop offset="60%" stop-color="#dff7ff"/>
              <stop offset="100%" stop-color="#fff"/>
            </linearGradient>
          </defs>
          <rect width="1600" height="900" fill="url(#skyGrad)"/>
          <g transform="translate(800,120)">
            <path d="M-700,300 A700,300 0 0 1 700,300 L700,400 A700,300 0 0 0 -700,400 Z" fill="#ff4d4d" opacity="0.95"/>
            <path d="M-650,320 A650,280 0 0 1 650,320 L650,400 A650,280 0 0 0 -650,400 Z" fill="#ffb84d" opacity="0.95"/>
            <path d="M-600,340 A600,260 0 0 1 600,340 L600,400 A600,260 0 0 0 -600,400 Z" fill="#fff26b" opacity="0.95"/>
            <path d="M-550,360 A550,240 0 0 1 550,360 L550,400 A550,240 0 0 0 -550,400 Z" fill="#8fe07e" opacity="0.95"/>
            <path d="M-500,380 A500,220 0 0 1 500,380 L500,400 A500,220 0 0 0 -500,400 Z" fill="#7ad3ff" opacity="0.95"/>
          </g>
          <g transform="translate(0,420)">
            <path class="hill" d="M0,200 Q200,100 400,150 T800,160 T1200,140 T1600,120 L1600,400 L0,400 Z" fill="#7ed957" />
            <path class="hill" d="M0,240 Q300,140 600,180 T1200,200 T1600,180 L1600,400 L0,400 Z" fill="#66c24a" opacity="0.95"/>
            <path class="hill" d="M0,280 Q400,180 800,220 T1600,240 L1600,400 L0,400 Z" fill="#5fbf3a" opacity="0.9"/>
          </g>
          <g class="clouds" fill="#fff" opacity="0.95">
            <g class="cloud slow" transform="translate(120,120)">
              <circle cx="-12" cy="0" r="22"/>
              <circle cx="18" cy="-8" r="18"/>
              <circle cx="44" cy="6" r="16"/>
              <ellipse cx="16" cy="12" rx="46" ry="14"/>
            </g>
            <g class="cloud medium" transform="translate(520,60)">
              <circle cx="-20" cy="6" r="30"/>
              <circle cx="24" cy="-10" r="26"/>
              <circle cx="62" cy="8" r="22"/>
              <ellipse cx="28" cy="20" rx="80" ry="18"/>
            </g>
            <g class="cloud fast" transform="translate(1020,90)">
              <circle cx="-8" cy="0" r="26"/>
              <circle cx="26" cy="-12" r="22"/>
              <circle cx="56" cy="4" r="18"/>
              <ellipse cx="28" cy="18" rx="68" ry="16"/>
            </g>
          </g>
        </svg>
      `;
      document.body.appendChild(wrapper);
    }
    // show title color input when colorful
    try{ const t = document.getElementById('titleColorInput'); if(t && t.parentElement) t.parentElement.style.display = 'flex'; }catch(e){}
    // apply saved title color if present
    try{ const savedColor = localStorage.getItem('butterfly_title_color'); if(savedColor) applyTitleColor(savedColor); }catch(e){}
  }else{
    body.classList.remove('theme-colorful');
    const r = document.querySelector('.rainbow-arch'); if(r) r.remove();
    const svgBg = document.querySelector('.colorful-bg'); if(svgBg) svgBg.remove();
    // hide title color input when not colorful and reset title color
    try{ const t = document.getElementById('titleColorInput'); if(t && t.parentElement) t.parentElement.style.display = 'none'; }catch(e){}
    applyTitleColor('');
  }
}

// Title color picker wiring: persist title color and apply when colorful theme active
const titleColorInput = document.getElementById('titleColorInput');
function applyTitleColor(color){
  const titleEl = document.getElementById('chartTitle');
  if(!titleEl) return;
  titleEl.style.color = color || '';
}

// load saved color and apply if theme is colorful
try{
  const savedColor = localStorage.getItem('butterfly_title_color');
  if(titleColorInput){
    if(savedColor) titleColorInput.value = savedColor;
    titleColorInput.addEventListener('input', (e)=>{
      const c = e.target.value;
      try{ localStorage.setItem('butterfly_title_color', c); }catch(err){}
      // apply only when colorful theme active
      if(document.body.classList.contains('theme-colorful')) applyTitleColor(c);
    });
  }
  // apply on load if current theme is colorful
  if(document.body.classList.contains('theme-colorful') && savedColor){ applyTitleColor(savedColor); }
}catch(e){}

// initialize theme from localStorage
try{
  const saved = localStorage.getItem('butterfly_theme') || 'original';
  applyTheme(saved);
  if(themeSelect) themeSelect.value = saved;
}catch(e){}

themeSelect?.addEventListener('change', (e)=>{
  const v = e.target.value || 'original';
  applyTheme(v);
  try{ localStorage.setItem('butterfly_theme', v); }catch(e){}
});