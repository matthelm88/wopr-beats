/* WOPR Beat Machine · perform
   PERFORM page: 48 punch-in effects from Teenage Engineering gear in three banks, the pattern-end switching rules,
   recording effects into the pattern (automation), TEMP SAVE and RESET, and the pad touch handling.
   All files share one global scope: anything defined in an earlier file can be used here.
   Load order is set in index.html. */

/* ---------- the effects: [id, name, device], 16 per bank in pad order ---------- */
const FXDEF = [
  // BANK 1 · K.O: PO-33 buttons 1-15, plus the PO-35 stutter sweep on 16
  ['L16','LOOP 16','PO-33'], ['L12','LOOP 12','PO-33'], ['LS','LOOP SHORT','PO-33'], ['LSS','LOOP SHORTER','PO-33'],
  ['UNI','UNISON','PO-33'], ['UNIL','UNISON LOW','PO-33'], ['OCTU','OCTAVE UP','PO-33'], ['OCTD','OCTAVE DOWN','PO-33'],
  ['ST4','STUTTER 4','PO-33'], ['ST3','STUTTER 3','PO-33'], ['SCR','SCRATCH','PO-33'], ['SCRF','SCRATCH FAST','PO-33'],
  ['Q68','6/8 QUAN\u00ADTIZE','PO-33'], ['RTG','RE\u00ADTRIGGER','PO-33'], ['REV','REVERSE','PO-33'], ['SWP','STUTTER SWEEP','PO-35'],
  // BANK 2 · TONE: PO-35, PO-32 tonic and PO-12 rhythm
  ['TG','TRANCE GATE','PO-35'], ['HALF','HALF RATE','PO-35'], ['B16','16-BAR BUILD UP','PO-35'], ['BEND','PITCH BEND UP','PO-32'],
  ['PLFO','PITCH LFO','PO-32'], ['SQSH','SQUASH','PO-32'], ['BNC','BOUNCING BALL','PO-32'], ['EQSW','EQ SWEEP','PO-32'],
  ['LPF','LOWPASS FILTER','PO-12'], ['LPSW','LOWPASS SWEEP','PO-12'], ['HPF','HIPASS FILTER','PO-12'], ['HPSW','HIPASS SWEEP','PO-12'],
  ['DIST','DISTOR\u00ADTION','PO-12'], ['CRSH','BIT CRUSH','PO-12'], ['DLY','DELAY','PO-12'], ['FDBK','FEEDBACK','PO-12'],
  // BANK 3 · CHOP: PO-12, PO-28 robot, PO-24 office, OP-Z and EP-133 K.O. II
  ['SHUF','NOTE SHUFFLE','PO-12'], ['FILL','FILL-IN','PO-28'], ['FILF','FILL-IN FAST','PO-28'], ['GLT','GLITCH','PO-28'],
  ['GLTF','GLITCH FAST','PO-28'], ['BLND','BLINDS','PO-28'], ['NOIS','NOISE','PO-28'], ['DLOW','DISTORT LOW','PO-24'],
  ['DHI','DISTORT HIGH','PO-24'], ['DUCK','DUCK','OP-Z'], ['STER','STEREO','OP-Z'], ['TAPE','TAPE STOP','EP-133'],
  ['TREM','TREMOLO','EP-133'], ['PRND','PITCH RANDOM','EP-133'], ['FLFO','FILTER LFO','EP-133'], ['SLCE','SLICE','EP-133'],
];
const BANKS = [['K.O','PO-33 · 35'], ['TONE','PO-35 · 32 · 12'], ['CHOP','PO · OP-Z · EP']];
const FXNAME = Object.fromEntries(FXDEF.map(([id, n]) => [id, n]));
const FXBANK = Object.fromEntries(FXDEF.map(([id], i) => [id, Math.floor(i / 16)]));
if (ui.bank === undefined) ui.bank = 0;

/* ---------- state ----------
   live: the pad you are playing. autoFx: the effect written into the pattern at this step.
   Live always wins; when it ends, whatever is recorded takes over again. */
let live = null, autoFx = null, fxPending = null;   // fxPending: {type:'stop'} or {type:'swap', id}
let rec = false, recallPending = false;
let tempSave = store.get('wopr.temp', null);        // {data, at}
const mkFx = (id, g) => ({id, g0:g, i0:g % S.len});
function fitAuto(a, n){ return Array.from({length:n}, (_, i) => (a && i < a.length ? a[i] : null) || null); }
function autoAt(i){ return S.auto && S.auto.length === S.len ? S.auto[i] : null; }
function hasAuto(){ return !!(S.auto && S.auto.some(Boolean)); }
function later(t, fn){ setTimeout(fn, Math.max(0, (t - AC.currentTime) * 1000)); }

/* ---------- which steps play ----------
   Returns the events for global step g: {idx, off, sw, pm (pitch), lv (level), voice, noise}. */
function plan(f, g, base, d){
  const dflt = [{idx:base, off:0, sw:true}];
  if (!f) return dflt;
  const k = g - f.g0, L = S.len, i0 = f.i0, P0 = base - base % 16, M = x => ((x % L) + L) % L;
  const one = (idx, off = 0, sw = true, x) => Object.assign({idx:M(idx), off, sw}, x);
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
    // pitch: the beat keeps playing, each hit is re-pitched
    case 'BEND': return [one(base, 0, true, {pm:Math.pow(2, (k % 16) / 16)})];
    case 'PLFO': return [one(base, 0, true, {pm:Math.pow(2, .3 * Math.sin(k * Math.PI / 4))})];
    case 'PRND': return [one(base, 0, true, {pm:[.5, .75, 1, 1, 1.335, 1.5, 2][Math.floor(rnd() * 7)]})];
    // order: steps from the current pattern in a random order
    case 'SHUF': return [one(P0 + Math.floor(rnd() * 16))];
    // bouncing ball: the first step repeats faster and quieter, then bounces again every 16 steps
    case 'BNC': { const c = k % 16, r = [];
      if (c === 0){ f.bt = 0; f.bi = 3; f.bn = 0; }
      while (f.bt < c + 1){ r.push(one(i0, (f.bt - c) * d, false, {lv:Math.max(.12, 1 - f.bn * .08)})); f.bt += f.bi; f.bi = Math.max(.125, f.bi * .72); f.bn++; }
      return r; }
    // tape stop: playback slows to a halt over 12 steps, dropping in pitch, then stays stopped
    case 'TAPE': { if (k === 0) f.pos = 0;
      const rate = Math.max(0, 1 - (k + .5) / 12), p0 = f.pos, p1 = p0 + rate, r = [];
      for (let n = Math.ceil(p0); n < p1; n++) r.push(one(i0 + n, (n - p0) / rate * d, false, {pm:.35 + .65 * rate}));
      f.pos = p1; return r; }
    // glitch: random steps jump in, sometimes as quick repeats
    case 'GLT': case 'GLTF': { const fast = f.id === 'GLTF', subs = fast ? 2 : 1, r = [];
      for (let s = 0; s < subs; s++){
        const off = s * d / subs;
        if (rnd() < (fast ? .5 : .3)){
          const j = P0 + Math.floor(rnd() * 16), n = rnd() < .5 ? 1 : (fast ? 4 : 3);
          for (let q = 0; q < n; q++) r.push(one(j, off + q * d / subs / n, false));
        } else if (s === 0) r.push(one(base));
      }
      return r; }
    // fill-in: a snare roll on top of the beat that gets louder toward the end of the pattern
    case 'FILL': case 'FILF': { const n = f.id === 'FILF' ? 2 : 1, lv = .3 + .7 * (base % 16) / 15, r = [one(base)];
      for (let q = 0; q < n; q++) r.push({idx:base, voice:'snare', off:q * d / n, sw:q === 0, lv});
      return r; }
    case 'NOIS': return [one(base), {idx:base, noise:true, off:0, sw:true}];
  }
  return dflt;
}
function noiseHit(t){
  LAYER.noise({t:'noise', ft:'bandpass', f:1200 + rnd() * 6000, q:1.4, dec:.04 + rnd() * .09, v:.45}, t, master, 1, 1);
}

/* ---------- the sound of each effect ---------- */
function hold(p, t){ if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t); }
function setP(p, v, t){ hold(p, t); p.setValueAtTime(v, t); }
function mix(t, dry, dist, crush){ setP(fxDry.gain, dry, t); setP(fxDistG.gain, dist, t); setP(fxCrushG.gain, crush, t); }
function echo(t, send, fb, steps){ setP(dly.delayTime, Math.min(1.9, steps * stepDur()), t); setP(dlySend.gain, send, t); setP(dlyFb.gain, fb, t); }
function fxReset(t){
  if (!AC) return;
  setP(fxGate.gain, 1, t);
  setP(fxFilt.frequency, 20000, t); setP(fxFilt.Q, .7, t);
  setP(fxHP.frequency, 10, t); setP(fxHP.Q, .7, t);
  setP(fxEQ.gain, 0, t); setP(fxEQ.Q, .7, t);
  mix(t, 1, 0, 0); setP(fxSum.gain, 1, t);
  if (fxPan.pan) setP(fxPan.pan, 0, t);
  setP(fxComp.threshold, -24, t); setP(fxComp.knee, 30, t); setP(fxComp.ratio, 12, t);
  setP(fxComp.attack, .003, t); setP(fxComp.release, .25, t);
  setP(dlySend.gain, 0, t); setP(dlyFb.gain, .3, t);   // echoes already in the delay fade out on their own
}
function fxBegin(f, t){
  if (!f) return;
  const LP = fxFilt.frequency, HP = fxHP.frequency;
  switch (f.id){
    case 'B16':  HP.setValueAtTime(30, t); HP.exponentialRampToValueAtTime(2500, t + 256 * stepDur()); break;
    case 'LPF':  LP.setValueAtTime(650, t); fxFilt.Q.setValueAtTime(7, t); break;
    case 'LPSW': fxFilt.Q.setValueAtTime(9, t); break;
    case 'HPF':  HP.setValueAtTime(1400, t); fxHP.Q.setValueAtTime(3, t); break;
    case 'HPSW': fxHP.Q.setValueAtTime(6, t); break;
    case 'EQSW': fxEQ.gain.setValueAtTime(18, t); fxEQ.Q.setValueAtTime(4, t); break;
    case 'FLFO': fxFilt.Q.setValueAtTime(8, t); break;
    case 'DIST': mix(t, 0, .55, 0); break;
    case 'CRSH': mix(t, 0, 0, .8); break;
    case 'DLOW': mix(t, 0, .6, 0); LP.setValueAtTime(420, t); fxFilt.Q.setValueAtTime(4, t); break;
    case 'DHI':  mix(t, 0, .5, 0); HP.setValueAtTime(1800, t); fxHP.Q.setValueAtTime(2, t); break;
    case 'SQSH': fxComp.threshold.setValueAtTime(-50, t); fxComp.knee.setValueAtTime(0, t); fxComp.ratio.setValueAtTime(20, t);
                 fxComp.attack.setValueAtTime(.001, t); fxComp.release.setValueAtTime(.06, t); fxSum.gain.setValueAtTime(3.2, t); break;
    case 'DLY':  echo(t, 1, .38, 3); break;
    case 'FDBK': echo(t, 1, .86, 2); break;
  }
}
function fxAudio(f, t, d, g, sw){
  if (!f) return;
  const k = g - f.g0, c = k % 16, G = fxGate.gain, LP = fxFilt.frequency, HP = fxHP.frequency;
  switch (f.id){
    case 'TG':   G.setValueAtTime(1, t); G.setValueAtTime(1, t + d * .42); G.linearRampToValueAtTime(0, t + d * .5); break;
    case 'SCR':  LP.setTargetAtTime(k % 2 ? 900 : 7000, t, .02); break;
    case 'SCRF': LP.setTargetAtTime(k % 2 ? 900 : 7000, t, .02); LP.setTargetAtTime(k % 2 ? 7000 : 900, t + d / 2, .015); break;
    case 'LPSW': if (c === 0){ LP.setValueAtTime(14000, t); LP.exponentialRampToValueAtTime(220, t + 16 * d); } break;
    case 'HPSW': if (c === 0){ HP.setValueAtTime(30, t); HP.exponentialRampToValueAtTime(5000, t + 16 * d); } break;
    case 'EQSW': if (c === 0){ fxEQ.frequency.setValueAtTime(120, t); fxEQ.frequency.exponentialRampToValueAtTime(7000, t + 16 * d); } break;
    case 'FLFO': if (k % 2 === 0){ LP.setValueAtTime(300, t); LP.exponentialRampToValueAtTime(4000, t + d); LP.exponentialRampToValueAtTime(300, t + 2 * d); } break;
    case 'BLND': G.setValueAtTime(1, t); G.setValueAtTime(0, t + d * .25); G.setValueAtTime(1, t + d * .5); G.setValueAtTime(0, t + d * .75); break;
    case 'TREM': if (k % 2 === 0){ G.setValueAtTime(1, t); G.linearRampToValueAtTime(.15, t + d); G.linearRampToValueAtTime(1, t + 2 * d); } break;
    case 'SLCE': G.setValueAtTime(1, t); G.setValueAtTime(1, t + sw + d * .28); G.linearRampToValueAtTime(0, t + sw + d * .36); break;
    case 'DUCK': if (g % 4 === 0){ G.setValueAtTime(1, t); G.setValueAtTime(1, t + d * .5); G.linearRampToValueAtTime(.15, t + d * .6); G.linearRampToValueAtTime(1, t + d * 3.6); } break;
    case 'STER': if (fxPan.pan) fxPan.pan.setValueAtTime(g % 2 ? .85 : -.85, t + sw); break;
  }
}

/* ---------- the clock calls these ---------- */
/* On every 16-step downbeat: queued live changes and a queued RESET land here. */
function fxBoundary(g, t){
  if (recallPending){ recallPending = false; doRecall(); }
  if (fxPending){ const p = fxPending; fxPending = null; live = p.type === 'swap' ? mkFx(p.id, g) : null; }
  later(t, fxShow);
}
/* Every step: work out which effect is in charge, switch the sound if it changed, and record if REC is on. */
function fxStep(g, base, t){
  const a = autoAt(base);
  if (a !== (autoFx ? autoFx.id : null)) autoFx = a && FXNAME[a] ? mkFx(a, g) : null;
  const f = live || autoFx;
  if (f !== fxEff){ fxReset(t); fxBegin(f, t); fxEff = f; later(t, fxShow); }
  if (rec && live){
    if (!S.auto || S.auto.length !== S.len) S.auto = fitAuto(S.auto, S.len);
    S.auto[base] = live.id;
  }
  return f;
}

/* ---------- pads: starting is instant; stopping or switching waits for the end of the 16-step pattern ---------- */
function fxTap(id){
  if (!playing){ fxPending = null; live = mkFx(id, 0); start(); fxShow(); return; }
  if (!live){ fxPending = null; live = mkFx(id, gstep); fxShow(); return; }
  if (live.id === id){ fxPending = fxPending && fxPending.type === 'stop' ? null : {type:'stop'}; fxShow(); return; }
  fxPending = fxPending && fxPending.type === 'swap' && fxPending.id === id ? null : {type:'swap', id};
  fxShow();
}
function fxLift(id, activeHeld){
  if (fxPending && fxPending.type === 'swap' && fxPending.id === id){
    fxPending = live && !activeHeld ? {type:'stop'} : null; fxShow(); return;
  }
  if (live && live.id === id && !(fxPending && fxPending.type === 'swap')){ fxPending = {type:'stop'}; fxShow(); }
}
function fxAllOff(){ fxPending = live ? {type:'stop'} : null; fxShow(); }
function fxClear(){
  fxPending = null; live = null; autoFx = null; fxEff = null; recallPending = false;
  if (AC) fxReset(AC.currentTime);
  fxShow();
}

/* ---------- record, temp save, reset ---------- */
function takeTemp(quiet){
  const at = new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
  tempSave = {data:snap(), at};
  store.set('wopr.temp', tempSave);
  if (!quiet) perfSay(`TEMP SAVED AT ${at} · RESET COMES BACK HERE`);
}
function doRecall(){
  if (!tempSave) return;
  rec = false;
  restore(tempSave.data); pushHistory();
  perfSay(`BACK TO TEMP SAVE (${tempSave.at})`);
}
function fxRec(){
  rec = !rec;
  if (rec && !tempSave){ takeTemp(true); perfSay(`REC · TEMP SAVE TAKEN FIRST (${tempSave.at})`); }
  if (!rec) touchHistory();
  if (rec && !playing) start();
  fxShow();
}
function fxRecall(){
  if (!tempSave){ perfSay('NO TEMP SAVE YET · TAP TEMP SAVE FIRST'); return; }
  if (!playing){ doRecall(); fxShow(); return; }
  recallPending = !recallPending; fxShow();
}
function fxWipe(){
  if (!hasAuto()){ perfSay('NO RECORDED EFFECTS TO CLEAR'); return; }
  S.auto = null; touchHistory(); perfSay('RECORDED EFFECTS CLEARED'); perfMark();
}

/* ---------- drawing ---------- */
let perfMsg = null, perfMsgTimer = null;
function perfSay(msg){ perfMsg = msg; clearTimeout(perfMsgTimer); perfMsgTimer = setTimeout(() => { perfMsg = null; fxShow(); }, 2600); fxShow(); }
function fxPads(){
  const b = ui.bank;
  $('#banks').innerHTML = BANKS.map(([n, dev], i) => {
    const lit = (live && FXBANK[live.id] === i) || (!live && autoFx && FXBANK[autoFx.id] === i);
    return `<button class="btn cyc${i === b ? ' on' : ''}${lit ? ' lit' : ''}" data-act="bank" data-v="${i}" aria-pressed="${i === b}"><small>${dev}</small>${i + 1} · ${n}</button>`;
  }).join('');
  $('#fxgrid').innerHTML = FXDEF.slice(b * 16, b * 16 + 16).map(([id, name, dev], i) =>
    `<button class="fx" data-fx="${id}" aria-pressed="false"><span class="n">${i + 1}</span><span class="g">${dev}</span><span class="nm">${name}</span></button>`).join('');
  fxShow();
  if (typeof fitFxNames === 'function') fitFxNames(true);
}
function fxShow(){
  const swapTo = fxPending && fxPending.type === 'swap' ? fxPending.id : null, ending = !!fxPending && !!live;
  const autoId = !live && autoFx ? autoFx.id : null;
  $$('#fxgrid [data-fx]').forEach(b => {
    const id = b.dataset.fx, on = !!live && live.id === id;
    b.classList.toggle('on', on); b.classList.toggle('ending', on && ending); b.classList.toggle('armed', id === swapTo);
    b.classList.toggle('auto', id === autoId);
    b.setAttribute('aria-pressed', on);
  });
  $$('#banks [data-v]').forEach(b => {
    const i = +b.dataset.v;
    b.classList.toggle('lit', (live && FXBANK[live.id] === i) || (!!autoId && FXBANK[autoId] === i));
  });
  $('#allOffBtn').classList.toggle('ending', !!fxPending && fxPending.type === 'stop' && !!live);
  $('#recBtn').classList.toggle('on', rec); $('#recBtn').setAttribute('aria-pressed', rec);
  $('#recallBtn').classList.toggle('ending', recallPending);
  $('#recallBtn').innerHTML = tempSave ? `RESET<small>${recallPending ? 'AT PATTERN END' : tempSave.at}</small>` : 'RESET<small>NO TEMP SAVE</small>';
  $('#recallBtn').disabled = !tempSave;
  let txt;
  if (perfMsg) txt = perfMsg;
  else if (live){
    const n = FXNAME[live.id];
    txt = swapTo ? `${n} → ${FXNAME[swapTo]} AT PATTERN END` : fxPending ? `${n} · ENDS AT PATTERN END` : n;
  }
  else if (autoId) txt = `PLAYING RECORDED ${FXNAME[autoId]}`;
  else txt = ui.latch ? 'TAP A PAD TO PUNCH IN' : 'HOLD A PAD TO PUNCH IN';
  if (!perfMsg && rec) txt = '● REC · ' + txt;
  if (!perfMsg && recallPending) txt += ' · RESET AT PATTERN END';
  $('#perfHead').textContent = '> ' + txt;
}
/* the 16-step strip: red marks show steps with a recorded effect on the pattern you are hearing */
function perfMark(){
  const p = cur ? Math.floor(cur.idx / 16) : ui.page, off = p * 16;
  $$('#pstrip [data-pstep]').forEach(e => e.classList.toggle('au', !!autoAt(off + +e.dataset.pstep)));
}

/* Pad names: each one as big as fits its pad, up to twice the old size (the CSS size is the cap).
   Long words like RETRIGGER come out smaller than short ones like DELAY. Re-runs on bank change, screen size and font load. */
let fitKey = '';
function fitFxNames(force){
  const grid = $('#fxgrid'), first = grid.querySelector('.fx');
  if (!first || ui.tab !== 'perform' || !first.clientWidth) return;
  const key = ui.bank + ':' + first.clientWidth + 'x' + first.clientHeight;
  if (!force && key === fitKey) return;
  fitKey = key;
  grid.querySelectorAll('.fx').forEach(pad => {
    const nm = pad.querySelector('.nm'), num = pad.querySelector('.n');
    nm.style.fontSize = '';
    const cap = parseFloat(getComputedStyle(nm).fontSize);
    const room = pad.clientHeight - 6 - (num.offsetTop + num.offsetHeight);   // height below the pad number
    const fits = px => { nm.style.fontSize = px + 'px'; return nm.scrollWidth <= nm.clientWidth + .5 && nm.offsetHeight <= room; };
    if (fits(cap)) return;
    let lo = 10, hi = cap;
    for (let i = 0; i < 8; i++){ const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
    nm.style.fontSize = Math.floor(lo * 2) / 2 + 'px';
  });
}
on('render', () => fitFxNames());
window.addEventListener('resize', () => fitFxNames());
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitFxNames(true));

/* ---------- pads (rebuilt on bank change; presses only toggle classes) ---------- */
$('#pstrip').innerHTML = Array.from({length:16}, (_, i) => `<i data-pstep="${i}"${i % 4 === 0 && i ? ' class="q"' : ''}></i>`).join('');
fxPads();
(() => {
  const grid = $('#fxgrid'), held = new Map();
  const down = e => {
    const b = e.target.closest('[data-fx]'); if (!b) return;
    e.preventDefault();
    const id = b.dataset.fx;
    if (!ui.latch){ try { b.setPointerCapture(e.pointerId); } catch(_){} held.set(e.pointerId, id); }
    fxTap(id);
  };
  const up = e => {
    const id = held.get(e.pointerId); if (id === undefined) return;
    held.delete(e.pointerId);
    const still = [...held.values()];
    if (!still.includes(id)) fxLift(id, still.some(v => live && live.id === v));
  };
  grid.addEventListener('pointerdown', down);
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev => grid.addEventListener(ev, up));
  grid.addEventListener('contextmenu', e => e.preventDefault());
  grid.addEventListener('keydown', e => {
    const b = e.target.closest('[data-fx]'); if (!b || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault(); fxTap(b.dataset.fx);
  });
})();
