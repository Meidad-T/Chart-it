// storage.js - responsible for import/export of chart data

export function exportToFile(data, filename = 'chart.chart'){
  const blob = new Blob([JSON.stringify(data)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Try to write to an existing file handle (File System Access API) or fallback to download.
export async function saveToFileOrDownload(data, filename = 'chart.chart', existingFileHandle = null){
  const json = JSON.stringify(data);
  // if we have a file handle and the browser supports it, try to write to that file
  try{
    if(existingFileHandle && typeof existingFileHandle.createWritable === 'function'){
      const writable = await existingFileHandle.createWritable();
      await writable.write(json);
      await writable.close();
      return {ok:true, method:'overwrite'};
    }
  }catch(err){
    // if writing failed, fall through to download fallback
    console.warn('overwrite failed', err);
  }
  // fallback: same as exportToFile
  try{
    const blob = new Blob([json], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return {ok:true, method:'download'};
  }catch(err){
    return {ok:false, error:err};
  }
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
