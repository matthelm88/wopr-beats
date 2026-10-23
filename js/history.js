/* WOPR Beat Machine · history
   Undo/redo history for the arrows in the top bar.
   All files share one global scope: anything defined in an earlier file can be used here.
   Load order is set in index.html. */
/* ---------- history ---------- */
let H = [], hi = -1;
const snap = () => JSON.stringify({genre:S.genre, kit:S.kit, defcon:S.defcon, len:S.len, tempo:S.tempo, swing:S.swing, main:S.main, base:S.base, roles:S.roles, auto:S.auto || null, bass:S.bass || null});
function pushHistory(){ H = H.slice(0, hi + 1); H.push(snap()); if (H.length > 40) H.shift(); hi = H.length - 1; }
function touchHistory(){ if (hi >= 0) H[hi] = snap(); }
function restore(j){
  const o = JSON.parse(j);
  ['genre','kit','defcon','len','tempo','swing','main'].forEach(k => { if (o[k] !== undefined) S[k] = o[k]; });
  S.base = o.base || o.fills || {};
  S.roles = o.roles || Object.fromEntries(Object.keys(o.fills || {}).map(k => [k, 'FILL']));
  S.auto = Array.isArray(o.auto) && o.auto.length === S.len ? o.auto : null;   // recorded punch-in effects
  S.bass = o.bass && Array.isArray(o.bass.n) && o.bass.n.length === S.len ? o.bass : null;   // bass line (bass.js patch); none = a new one is rolled
  if (ui.page >= S.len / 16) ui.page = 0;
  render();
}
