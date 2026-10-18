/* WOPR Beat Machine · patch: export and load saves
   Adds EXPORT and LOAD to the SAVED tab so your saves can live outside the browser.
   EXPORT makes a .json file and opens the iPhone share sheet (Save to Files, Mail, AirDrop...).
   LOAD picks a file and merges its saves into the SAVED list, skipping ones already there. */
(() => {
  const KEY = 'wopr.saved', MAX = 300;
  const say = t => { const c = document.querySelector('#tab-saved .console'); if (c) c.textContent = '> ' + t; };
  const clean = s => String(s).replace(/[<>&"'`]/g, '').slice(0, 80);
  const plural = n => n === 1 ? '' : 'S';

  on('ready', () => {
    document.querySelector('#tab-saved .console').insertAdjacentHTML('afterend',
      `<div class="row saveio">
         <button class="btn" data-act="exportSaves">EXPORT</button>
         <button class="btn" data-act="loadSaves">LOAD FILE</button>
       </div>
       <input type="file" id="loadFile" accept=".json,application/json,text/plain" hidden>`);
    document.querySelector('#loadFile').addEventListener('change', e => {
      const f = e.target.files[0]; e.target.value = '';
      if (f) readFile(f);
    });
  });

  /* SAVE now keeps up to 300 saves (was 100) so loaded files are not trimmed */
  A.save = () => {
    const list = store.get(KEY, []), d = new Date();
    list.unshift({id:String(d.getTime()), name:`${GENRES[S.genre].name} · D${S.defcon} · ${S.len}`,
      date:d.toLocaleString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}) + ` · ${S.tempo} BPM`, data:snap()});
    log(store.set(KEY, list.slice(0, MAX)) ? 'SAVED TO THIS DEVICE' : 'SAVE FAILED: THIS BROWSER IS BLOCKING STORAGE');
    render();
  };

  A.exportSaves = async () => {
    const list = store.get(KEY, []);
    if (!list.length){ say('NOTHING SAVED YET'); return; }
    const name = `wopr-saves-${new Date().toISOString().slice(0, 10)}.json`;
    const data = JSON.stringify({app:'WOPR Beat Machine', kind:'saves', format:1, exported:new Date().toISOString(), saves:list});
    let file = null;
    try { file = new File([data], name, {type:'application/json'}); } catch(_){}
    if (file && navigator.canShare && navigator.canShare({files:[file]})){
      try { await navigator.share({files:[file]}); say(`EXPORTED ${list.length} SAVE${plural(list.length)}`); return; }
      catch(err){ if (err && err.name === 'AbortError'){ say('EXPORT CANCELLED'); return; } }
    }
    try {
      const url = URL.createObjectURL(new Blob([data], {type:'application/json'})), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      say(`EXPORTED ${list.length} SAVE${plural(list.length)} · CHECK DOWNLOADS`);
    } catch(_){ say('EXPORT IS NOT AVAILABLE IN THIS BROWSER'); }
  };

  A.loadSaves = () => document.querySelector('#loadFile').click();

  function validBeat(str){
    try {
      const o = JSON.parse(str);
      return o && GENRES[o.genre] && [16,32,48,64,80,96,112,128].includes(o.len)
        && o.main && IDS.every(id => Array.isArray(o.main[id]) && o.main[id].length === o.len);
    } catch(_){ return false; }
  }
  function readFile(f){
    const r = new FileReader();
    r.onerror = () => say('COULD NOT READ THAT FILE');
    r.onload = () => {
      let incoming = null;
      try { const o = JSON.parse(r.result); incoming = Array.isArray(o) ? o : o && o.saves; } catch(_){}
      if (!Array.isArray(incoming)){ say('THAT FILE IS NOT A WOPR SAVES FILE'); return; }
      const good = incoming
        .filter(it => it && /^\d+$/.test(String(it.id)) && typeof it.data === 'string' && validBeat(it.data))
        .map(it => ({id:String(it.id), name:clean(it.name || 'LOADED BEAT'), date:clean(it.date || ''), data:it.data}));
      if (!good.length){ say('NO BEATS FOUND IN THAT FILE'); return; }
      const list = store.get(KEY, []), have = new Set(list.map(x => x.id));
      const fresh = good.filter(it => !have.has(it.id));
      const merged = [...list, ...fresh].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, MAX);
      if (!store.set(KEY, merged)){ say('LOAD FAILED: THIS BROWSER IS BLOCKING STORAGE'); return; }
      say(`LOADED ${fresh.length} NEW SAVE${plural(fresh.length)}` + (good.length - fresh.length ? ` · ${good.length - fresh.length} ALREADY HERE` : ''));
      renderSaved();
    };
    r.readAsText(f);
  }
})();
