import * as Chart from './chart.js';
import * as Storage from './storage.js';


// UI elements
const landing = document.getElementById('landing');
const editor = document.getElementById('editor');
const newChartBtn = document.getElementById('newChartBtn');
const newChartBtn2 = document.getElementById('newChartBtn2');
const fileInput = document.getElementById('fileInput');
const fileInput2 = document.getElementById('fileInput2');
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
if(newChartBtn2) newChartBtn2.addEventListener('click', ()=>{ Chart.clearChart(); showEditor(); });

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
  updateUndoButton();
    showEditor();
  }catch(err){ alert('Failed to read file: '+err.message); }
  fileInput.value = '';
});
if(fileInput2) fileInput2.addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  try{ const data = await Storage.readFile(f); Chart.restoreChart(data); showEditor(); }
  catch(err){ alert('Failed to read file: '+err.message); }
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

if(saveBtn) saveBtn.addEventListener('click', ()=>{ showExportModal('chart'); });

exportCancelBtn?.addEventListener('click', hideExportModal);
exportModal?.addEventListener('click', (e)=>{ if(e.target === exportModal) hideExportModal(); });
exportFilenameInput?.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') exportConfirmBtn?.click(); if(e.key === 'Escape') hideExportModal(); });
exportConfirmBtn?.addEventListener('click', ()=>{
  const data = Chart.serializeChart();
  let name = (exportFilenameInput.value || 'chart').trim();
  name = name.replace(/[\\/\?%*:|"<>]/g, '-');
  if(!/\.chart$/i.test(name)) name = name + '.chart';
  hideExportModal();
  Storage.exportToFile(data, name);
});

// Clear stars button: remove butterflies but keep rows/columns
clearStarsBtn?.addEventListener('click', ()=>{
  showConfirm('Clear all stars?','This will remove butterflies but keep rows and columns.', ()=>{
    Chart.clearStars();
    Chart.setPreview(false);
    document.getElementById('controls').classList.remove('hidden');
    if(leaveLiveBtn) leaveLiveBtn.classList.add('hidden');
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
  previewBtn.textContent = newMode ? 'Exit Preview mode' : 'Toggle Preview';
});

if(leaveLiveBtn){
  leaveLiveBtn.addEventListener('click', ()=>{
    Chart.setPreview(false);
    document.getElementById('controls').classList.remove('hidden');
    leaveLiveBtn.classList.add('hidden');
    if(previewBtn) previewBtn.textContent = 'Toggle Preview';
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
    // place cursor at end
    document.execCommand('selectAll', false, null);
    document.getSelection().collapseToEnd();
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