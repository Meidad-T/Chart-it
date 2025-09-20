import * as Chart from './chart.js';
import * as Storage from './storage.js';

// inside main.js
import './chart.js';
import './script.js';
import './storage.js';


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
const exportBtn = document.getElementById('exportBtn');
const previewBtn = document.getElementById('previewBtn');
const leaveLiveBtn = document.getElementById('leaveLiveBtn');
const importFile = document.getElementById('importFile');

function showLanding(){ landing.classList.remove('hidden'); editor.classList.add('hidden'); if(backBtn) backBtn.classList.add('hidden'); }
function showEditor(){ landing.classList.add('hidden'); editor.classList.remove('hidden'); if(backBtn) backBtn.classList.remove('hidden'); }

newChartBtn.addEventListener('click', ()=>{ Chart.clearChart(); showEditor(); });
if(newChartBtn2) newChartBtn2.addEventListener('click', ()=>{ Chart.clearChart(); showEditor(); });

fileInput.addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  try{
    const data = await Storage.readFile(f);
    Chart.restoreChart(data);
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

if(exportBtn) exportBtn.addEventListener('click', ()=>{ showExportModal('chart'); });

exportCancelBtn?.addEventListener('click', hideExportModal);
exportModal?.addEventListener('click', (e)=>{ if(e.target === exportModal) hideExportModal(); });
exportFilenameInput?.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') exportConfirmBtn?.click(); if(e.key === 'Escape') hideExportModal(); });
exportConfirmBtn?.addEventListener('click', ()=>{
  const data = Chart.serializeChart();
  let name = (exportFilenameInput.value || 'chart').trim();
  name = name.replace(/[\\/\?%*:|"<>]/g, '-');
  if(!/\.ivritlee$/i.test(name)) name = name + '.ivritlee';
  hideExportModal();
  Storage.exportToFile(data, name);
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