/* WOPR Beat Machine · actions
   What every button does. A button with data-act="name" calls A.name(value, button). Patches can add new actions to A.
   All files share one global scope: anything defined in an earlier file can be used here.
   Load order is set in index.html. */
/* ---------- actions ---------- */
function rotate(a, lo, dir){ const seg = a.slice(lo, lo + 16); const r = dir > 0 ? [seg[15], ...seg.slice(0, 15)] : [...seg.slice(1), seg[0]]; a.splice(lo, 16, ...r); }
const A = {
  genre(v){ S.genre = v; S.kit = 0; S.tempo = GENRES[v].tempo; S.swing = GENRES[v].swing; generate(); },
  ckit(){ S.kit = ((S.kit || 0) + 1) % KITS[S.genre].length; touchHistory(); log(`KIT · ${kit().name}`); if (!playing) preview(); render(); },
  cstyle(){ const ks = Object.keys(GENRES); A.genre(ks[(ks.indexOf(S.genre) + 1) % ks.length]); },
  csteps(){ const L = [16,32,48,64,96,128]; A.len(String(L[(L.indexOf(S.len) + 1) % L.length])); },
  cswing(){ const W = [0,8,16,24,32,40,50]; S.swing = W.find(w => w > S.swing) ?? 0; touchHistory(); log(`SWING ${S.swing}%`); render(); },
  chear(){ A.hear(ui.mono ? 'full' : 'mono'); },
  defcon(v){ S.defcon = +v; log(`DEFCON ${v} · ${DEF_TXT[v]}`); render(); },
  len(v){ const n = +v; if (n === S.len) return; setLen(n, false); pushHistory(); log(`LENGTH ${n} STEPS`); render(); },
  gen(){ generate(); },
  vary(){
    const p = ui.page; if (!S.base[p]) S.base[p] = pageOf(p);
    mutate(S.main, 2 + Math.round(chaos() * 4), p * 16, p * 16 + 16);
    roll('vary'); pushHistory(); log(`PATTERN ${p + 1} TWEAKED`); render();
  },
  mv(v){ applyMove(v); },
  sp(v){ applySpice(v); },
  song(){ rollSong(); },
  reset(){ resetPage(); },
  moves(){ ui.movesOpen = !ui.movesOpen; render(); },
  latch(){
    ui.latch = !ui.latch;
    $('#latchBtn').textContent = ui.latch ? 'TAP MODE' : 'HOLD MODE'; $('#latchBtn').classList.toggle('on', ui.latch);
    $('#latchBtn').setAttribute('aria-pressed', ui.latch); fxShow();
  },
  fxoff(){ fxAllOff(); },
  csel(){ ui.sel = IDS[(IDS.indexOf(ui.sel) + 1) % IDS.length]; render(); },
  save(){
    const list = store.get('wopr.saved', []), d = new Date();
    list.unshift({id:String(d.getTime()), name:`${GENRES[S.genre].name} · D${S.defcon} · ${S.len}`,
      date:d.toLocaleString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}) + ` · ${S.tempo} BPM`, data:snap()});
    log(store.set('wopr.saved', list.slice(0, 100)) ? 'SAVED TO THIS DEVICE' : 'SAVE FAILED: THIS BROWSER IS BLOCKING STORAGE');
    render();
  },
  play(){ playing ? stop() : start(); },
  tdn(){ S.tempo = Math.max(60, S.tempo - 2); touchHistory(); renderBar(); },
  tup(){ S.tempo = Math.min(200, S.tempo + 2); touchHistory(); renderBar(); },
  hear(v){ ui.mono = v === 'mono'; log(ui.mono ? 'HEARING PO MONO' : 'HEARING FULL KIT'); render(); },
  page(v){ ui.page = +v; if (ui.follow && playing){ ui.follow = false; log('FOLLOW OFF'); } render(); },
  follow(){ ui.follow = !ui.follow; log(ui.follow ? 'FOLLOW ON' : 'FOLLOW OFF'); render(); },
  cell(v, b){
    const id = b.dataset.t, i = +v;
    S.main[id][i] = S.main[id][i] ? 0 : 1;
    if (S.main[id][i]){ try { audio(); VOICE[id](AC.currentTime + .01); } catch(e){} }
    touchHistory(); render();
  },
  tsel(v){ ui.sel = v; render(); },
  lock(){ S.locks[ui.sel] = !S.locks[ui.sel]; render(); },
  solo(){ ui.solo[ui.sel] = !ui.solo[ui.sel]; render(); },
  shl(){ rotate(S.main[ui.sel], ui.page * 16, -1); touchHistory(); render(); },
  shr(){ rotate(S.main[ui.sel], ui.page * 16, 1); touchHistory(); render(); },
  flip(){ const a = S.main[ui.sel], o = ui.page * 16; a.splice(o, 16, ...a.slice(o, o + 16).reverse()); touchHistory(); render(); },
  clr(){ const a = S.main[ui.sel], o = ui.page * 16; a.fill(0, o, o + 16); touchHistory(); render(); },
  poinfo(){ ui.poInfo = !ui.poInfo; render(); },
  chip(v){ ui.chip = v; if (v === 'mono') ui.poSolo = null; else if (ui.poSolo) ui.poSolo = v; render(); },
  psolo(){
    ui.poSolo = ui.poSolo ? null : ui.chip;
    log(ui.poSolo ? `SOLO ${NAME[ui.poSolo]} IN MONO` : 'SOLO OFF');
    if (ui.poSolo && !playing) start(); else render();
  },
  tab(v){
    if (v !== ui.tab){ ui.stack.push(ui.tab); if (ui.stack.length > 30) ui.stack.shift(); ui.tab = v; }
    ui.confirmDel = null; render(); $('#mid').scrollTop = 0;
  },
  back(){ if (ui.stack.length){ ui.tab = ui.stack.pop(); render(); $('#mid').scrollTop = 0; } },
  hprev(){ if (hi > 0){ hi--; restore(H[hi]); log(`HISTORY ${hi + 1} OF ${H.length}`); } },
  hnext(){ if (hi < H.length - 1){ hi++; restore(H[hi]); log(`HISTORY ${hi + 1} OF ${H.length}`); } },
  copy(v, b){
    const txt = allText(), out = $('#copyOut');
    const fallback = () => { ui.poInfo = true; render(); out.hidden = false; out.value = txt; out.focus(); out.select(); log('SELECT THE TEXT AND COPY IT'); };
    try { navigator.clipboard.writeText(txt).then(() => { b.textContent = 'COPIED'; setTimeout(() => b.textContent = 'COPY', 1500); }, fallback); }
    catch(e){ fallback(); }
  },
  midi(){
    try {
      const blob = new Blob([midiBytes()], {type:'audio/midi'}), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = `wopr-${S.genre}-d${S.defcon}-${S.len}steps.mid`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      log('MIDI SAVED · IN CLAUDE PREVIEW USE YOUR WEB ADDRESS');
    } catch(e){ log('MIDI EXPORT FAILED IN THIS BROWSER'); }
  },
  load(v){ const it = store.get('wopr.saved', []).find(x => x.id === v); if (!it) return; restore(it.data); pushHistory(); log('LOADED ' + it.name); A.tab('machine'); },
  del(v){
    if (ui.confirmDel !== v){ ui.confirmDel = v; renderSaved(); return; }
    store.set('wopr.saved', store.get('wopr.saved', []).filter(x => x.id !== v)); ui.confirmDel = null; renderSaved();
  },
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const f = A[b.dataset.act]; if (f) f(b.dataset.v, b);
});
