/* WOPR Beat Machine · perform
   PERFORM page: punch-in effects, the pattern-end switching rules and the pad touch handling.
   All files share one global scope: anything defined in an earlier file can be used here.
   Load order is set in index.html. */
/* ---------- punch-in effects (PO-33 1-15, 16 = no effect; PO-35 9-12) ---------- */
const FXDEF = [
  ['L16','LOOP 16','LOOP'], ['L12','LOOP 12','LOOP'], ['LS','LOOP SHORT','LOOP'], ['LSS','LOOP SHORTER','LOOP'],
  ['UNI','UNISON','PITCH'], ['UNIL','UNISON LOW','PITCH'], ['OCTU','OCTAVE UP','PITCH'], ['OCTD','OCTAVE DOWN','PITCH'],
  ['ST4','STUTTER 4','STUTTER'], ['ST3','STUTTER 3','STUTTER'], ['SCR','SCRATCH','SCRATCH'], ['SCRF','SCRATCH FAST','SCRATCH'],
  ['Q68','6/8 QUANTIZE','TIME'], ['RTG','RETRIGGER','TIME'], ['REV','REVERSE','TIME'], ['NOFX','NO EFFECT',''],
  ['SWP','STUTTER SWEEP','PO-35'], ['TG','TRANCE GATE','PO-35'], ['HALF','HALF RATE','PO-35'], ['B16','16-BAR BUILD UP','PO-35'],
];
const FXNAME = Object.fromEntries(FXDEF.map(([id, n]) => [id, n]));
const SEQ_FX = new Set(['L16','L12','LS','LSS','ST4','ST3','SCR','SCRF','Q68','RTG','REV','SWP','HALF','B16']);
const fxOn = new Map();
let seqStack = [];
function topSeq(){ for (let i = seqStack.length - 1; i >= 0; i--){ const f = fxOn.get(seqStack[i]); if (f) return f; } return null; }
function plan(g, base, d){
  const f = topSeq();
  if (!f) return [{idx:base, off:0, sw:true}];
  const k = g - f.g0, L = S.len, i0 = f.i0, M = x => ((x % L) + L) % L, one = (idx, off = 0, sw = true) => ({idx:M(idx), off, sw});
  switch (f.id){
    case 'L16': return [one(i0 + k % 16)];
    case 'L12': return [one(i0 + k % 12)];
    case 'LS':  return [one(i0 + k % 4)];
    case 'LSS': return [one(i0 + k % 2)];
    case 'ST4': return [one(i0)];
    case 'ST3': { const r = []; for (let n = Math.ceil(k * 3 / 4); n * 4 / 3 < k + 1; n++) r.push(one(i0, (n * 4 / 3 - k) * d, false)); return r; }
    case 'SWP': { const r = []; if (f.next === undefined) f.next = 0;
      while (f.next < k + 1){ r.push(one(i0, (f.next - k) * d, false)); f.next += Math.max(.125, 2 / Math.pow(2, Math.floor(f.next / 4))); }
      return r; }
    case 'RTG': return [one(i0 - i0 % 16 + k % 8)];
    case 'REV': return [one(i0 - k)];
    case 'Q68': { const st = base % 4; return st === 3 ? [] : [one(base, st * d / 3, false)]; }
    case 'HALF': return k % 2 ? [] : [one(i0 + k / 2)];
    case 'SCR': return [one(i0 + [0,1,2,1,0,-1,0,1][k % 8])];
    case 'SCRF': { const o = [0,1,0,-1]; return [one(i0 + o[(2 * k) % 4], 0, false), one(i0 + o[(2 * k + 1) % 4], d / 2, false)]; }
    case 'B16': { const b = Math.floor(k / 16), n = b < 8 ? 16 : b < 12 ? 8 : b < 14 ? 4 : b < 15 ? 2 : 1; return [one(i0 + k % n)]; }
  }
  return [{idx:base, off:0, sw:true}];
}
function fxAudio(t, d, g){
  if (fxOn.has('TG')){ const G = fxGate.gain; G.setValueAtTime(1, t); G.setValueAtTime(1, t + d * .42); G.linearRampToValueAtTime(0, t + d * .5); }
  const f = topSeq();
  if (f && (f.id === 'SCR' || f.id === 'SCRF') && fxFilt.type === 'lowpass'){
    const k = g - f.g0;
    fxFilt.frequency.setTargetAtTime(k % 2 ? 900 : 7000, t, .02);
    if (f.id === 'SCRF') fxFilt.frequency.setTargetAtTime(k % 2 ? 7000 : 900, t + d / 2, .015);
  }
}
function filterReset(t){
  if (!AC) return; t = t ?? AC.currentTime;
  fxFilt.frequency.cancelScheduledValues(t); fxFilt.type = 'lowpass'; fxFilt.frequency.setValueAtTime(20000, t);
}
function gateReset(t){ if (!AC) return; t = t ?? AC.currentTime; fxGate.gain.cancelScheduledValues(t); fxGate.gain.setValueAtTime(1, t); }
/* Starting from nothing is instant. Stopping, or switching to another effect, waits for the end of the 16-step pattern. */
let fxPending = null;   // {type:'stop'} or {type:'swap', id}
function fxStartNow(id, g, t){
  fxOn.set(id, {id, g0:g, i0:g % S.len});
  if (SEQ_FX.has(id)){ seqStack = seqStack.filter(x => x !== id); seqStack.push(id); }
  if (id === 'B16'){
    fxFilt.frequency.cancelScheduledValues(t); fxFilt.type = 'highpass';
    fxFilt.frequency.setValueAtTime(30, t); fxFilt.frequency.exponentialRampToValueAtTime(2500, t + 256 * stepDur());
  }
}
function fxStopAll(t){
  const had = [...fxOn.keys()];
  fxOn.clear(); seqStack = [];
  if (had.includes('TG')) gateReset(t);
  if (had.some(id => id === 'B16' || id === 'SCR' || id === 'SCRF')) filterReset(t);
}
function fxTap(id){
  if (!playing) start();
  if (id === 'NOFX'){ fxPending = fxOn.size ? {type:'stop'} : null; fxShow(); return; }
  if (!fxOn.size){ fxPending = null; fxStartNow(id, gstep, nextT); fxShow(); return; }
  if (fxOn.has(id)){ fxPending = fxPending && fxPending.type === 'stop' ? null : {type:'stop'}; fxShow(); return; }
  fxPending = fxPending && fxPending.type === 'swap' && fxPending.id === id ? null : {type:'swap', id};
  fxShow();
}
function fxLift(id, activeHeld){
  if (fxPending && fxPending.type === 'swap' && fxPending.id === id){
    fxPending = fxOn.size && !activeHeld ? {type:'stop'} : null; fxShow(); return;
  }
  if (fxOn.has(id) && !(fxPending && fxPending.type === 'swap')){ fxPending = {type:'stop'}; fxShow(); }
}
function fxAllOff(){ if (fxOn.size) fxPending = {type:'stop'}; else fxPending = null; fxShow(); }
function fxClear(){ fxPending = null; if (AC) fxStopAll(AC.currentTime); fxShow(); }
function later(t, fn){ setTimeout(fn, Math.max(0, (t - AC.currentTime) * 1000)); }
function fxShow(){
  const swapTo = fxPending && fxPending.type === 'swap' ? fxPending.id : null, ending = !!fxPending && fxOn.size > 0;
  $$('#fxgrid [data-fx]').forEach(b => {
    const id = b.dataset.fx, on = fxOn.has(id);
    b.classList.toggle('on', on); b.classList.toggle('ending', on && ending); b.classList.toggle('armed', id === swapTo);
    b.setAttribute('aria-pressed', on);
  });
  $('#allOffBtn').classList.toggle('ending', !!fxPending && fxPending.type === 'stop' && fxOn.size > 0);
  const names = [...fxOn.keys()].map(id => FXNAME[id]).join(' + ');
  let txt;
  if (!names) txt = ui.latch ? 'TAP A PAD TO PUNCH IN' : 'HOLD A PAD TO PUNCH IN';
  else if (swapTo) txt = `${names} → ${FXNAME[swapTo]} AT PATTERN END`;
  else if (fxPending) txt = `${names} · ENDS AT PATTERN END`;
  else txt = names;
  $('#perfHead').textContent = '> ' + txt;
}

/* ---------- pads (built once; presses only toggle classes) ---------- */
$('#fxgrid').innerHTML = FXDEF.map(([id, name, grp], i) =>
  `<button class="fx${id === 'NOFX' ? ' nofx' : ''} g-${grp || 'none'}" data-fx="${id}" aria-pressed="false"><span class="n">${i < 16 ? i + 1 : 'PO-35 · ' + (i - 7)}</span>${grp && grp !== 'PO-35' ? `<span class="g">${grp}</span>` : ''}<span class="nm">${name}</span></button>`).join('');
$('#pstrip').innerHTML = Array.from({length:16}, (_, i) => `<i data-pstep="${i}"${i % 4 === 0 && i ? ' class="q"' : ''}></i>`).join('');
(() => {
  const grid = $('#fxgrid'), held = new Map();
  const down = e => {
    const b = e.target.closest('[data-fx]'); if (!b) return;
    e.preventDefault();
    const id = b.dataset.fx;
    if (!ui.latch && id !== 'NOFX'){ try { b.setPointerCapture(e.pointerId); } catch(_){} held.set(e.pointerId, id); }
    fxTap(id);
  };
  const up = e => {
    const id = held.get(e.pointerId); if (id === undefined) return;
    held.delete(e.pointerId);
    const still = [...held.values()];
    if (!still.includes(id)) fxLift(id, still.some(v => fxOn.has(v)));
  };
  grid.addEventListener('pointerdown', down);
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev => grid.addEventListener(ev, up));
  grid.addEventListener('contextmenu', e => e.preventDefault());
  grid.addEventListener('keydown', e => {
    const b = e.target.closest('[data-fx]'); if (!b || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault(); fxTap(b.dataset.fx);
  });
})();
