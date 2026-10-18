/* WOPR Beat Machine · core
   Shared helpers, the five tracks, app state (S = the beat, ui = screen state), storage, dice and patch hooks.
   All files share one global scope: anything defined in an earlier file can be used here.
   Load order is set in index.html. */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const TRACKS = [
  {id:'kick',  name:'KICK',  k:'K', note:36},
  {id:'snare', name:'SNARE', k:'S', note:38},
  {id:'chat',  name:'C-HAT', k:'H', note:42},
  {id:'ohat',  name:'O-HAT', k:'O', note:46},
  {id:'perc',  name:'METAL', k:'M', note:56},
];
const IDS = TRACKS.map(t => t.id);
const NAME = Object.fromEntries(TRACKS.map(t => [t.id, t.name]));
const KEY = Object.fromEntries(TRACKS.map(t => [t.id, t.k]));
const MONO_ORDER = ['kick','snare','perc','ohat','chat'];



const S = {genre:'bigbeat', kit:0, defcon:4, len:16, tempo:128, swing:12, main:null, base:{}, roles:{}, locks:{}};
const ui = {tab:'machine', stack:[], page:0, sel:'kick', solo:{}, mono:false, chip:'mono', poSolo:null, follow:false, poInfo:false, movesOpen:false, latch:true,
            confirmDel:null, dice:{gen:5, vary:3, fill:2}, rolled:null};

const rnd = Math.random;
const chaos = () => (5 - S.defcon) / 4;
const blank = n => Object.fromEntries(IDS.map(id => [id, Array(n).fill(0)]));
const clone = o => JSON.parse(JSON.stringify(o));
const fit = (a, n) => Array.from({length:n}, (_, i) => a[i % a.length] || 0);
const pageOf = (p) => Object.fromEntries(IDS.map(id => [id, S.main[id].slice(p * 16, p * 16 + 16)]));
const writePage = (p, pg) => IDS.forEach(id => S.main[id].splice(p * 16, 16, ...pg[id]));
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } }
};
function log(msg){ $('#console').textContent = '> ' + msg; }

/* ---------- the die ---------- */
const PIPS = {
  1:[[50,50]], 2:[[29,29],[71,71]], 3:[[29,29],[50,50],[71,71]],
  4:[[29,29],[71,29],[29,71],[71,71]], 5:[[29,29],[71,29],[50,50],[29,71],[71,71]],
  6:[[29,27],[71,27],[29,50],[71,50],[29,73],[71,73]]
};
function dieSVG(key){
  const n = ui.dice[key] || (ui.dice[key] = 1 + Math.floor(rnd() * 6));
  return `<svg class="die${ui.rolled === key ? ' roll' : ''}" viewBox="0 0 100 100" aria-hidden="true">`
    + `<rect x="7" y="7" width="86" height="86" rx="18" fill="none" stroke="currentColor" stroke-width="8"/>`
    + PIPS[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="currentColor"/>`).join('') + `</svg>`;
}
function roll(key){
  let n; do { n = 1 + Math.floor(rnd() * 6); } while (n === ui.dice[key]);
  ui.dice[key] = n; ui.rolled = key;
}


/* ---------- version + hooks for patches ---------- */
const WOPR_VERSION = '15';
const HOOKS = {};
function on(ev, fn){ (HOOKS[ev] = HOOKS[ev] || []).push(fn); }
function emit(ev, ...args){ (HOOKS[ev] || []).forEach(fn => { try { fn(...args); } catch(err){ console.error('[WOPR patch]', ev, err); } }); }
