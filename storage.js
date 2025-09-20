// storage.js - responsible for import/export of chart data

export function exportToFile(data, filename = 'chart.ivritlee'){
  const blob = new Blob([JSON.stringify(data)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readFile(file){
  return new Promise((resolve,reject)=>{
    if(!file) return reject(new Error('no-file'));
    const reader = new FileReader();
    reader.onload = e=>{
      try{ const data = JSON.parse(e.target.result); resolve(data); }
      catch(err){ reject(err); }
    };
    reader.onerror = ()=> reject(new Error('read-error'));
    reader.readAsText(file);
  });
}
