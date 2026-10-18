/* WOPR Beat Machine · history
   Undo/redo history for the arrows in the top bar.
   All files share one global scope: anything defined in an earlier file can be used here.
   Load order is set in index.html. */
/* ---------- history ---------- */
let H = [], hi = -1;
const snap = () => JSON.stringify({genre:S.genre, kit:S.kit, defcon:S.defcon, len:S.len, tempo:S.tempo, swing:S.swing, main:S.main, base:S.base, roles:S.roles});
function pushHistory(){ H = H.slice(0, hi + 1); H.push(snap()); if (H.length > 40) H.shift(); hi = H.length - 1; }
function touchHistory(){ if (hi >= 0) H[hi] = snap(); }
function restore(j){
  const o = JSON.parse(j);
  ['genre','kit','defcon','len','tempo','swing','main'].forEach(k => { if (o[k] !== undefined) S[k] = o[k]; });
  S.base = o.base || o.fills || {};
  S.roles = o.roles || Object.fromEntries(Object.keys(o.fills || {}).map(k => [k, 'FILL']));
  if (ui.page >= S.len / 16) ui.page = 0;
  render();
}
