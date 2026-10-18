/* WOPR Beat Machine · sequencer
   Playback clock: plays steps, applies punch-in effects, moves the playhead.
   All files share one global scope: anything defined in an earlier file can be used here.
   Load order is set in index.html. */
let playing = false, timer = null, nextT = 0, gstep = 0, vq = [], cur = null;
const stepDur = () => 60 / S.tempo / 4;
function playStep(idx, t){
  const P = S.main;
  if (ui.poSolo){ if (monoAt(P, idx) === ui.poSolo) VOICE[ui.poSolo](t); return; }
  let hits = IDS.filter(id => P[id][idx]);
  if (IDS.some(id => ui.solo[id])) hits = hits.filter(id => ui.solo[id]);
  if (ui.mono && hits.length) hits = [MONO_ORDER.find(m => hits.includes(m))];
  hits.forEach(id => VOICE[id](t));
}

function tick(){
  while (nextT < AC.currentTime + .1){
    const d = stepDur(), g = gstep, base = g % S.len, sw = base % 2 ? d * S.swing / 100 * .6 : 0;
    if (fxPending && g % 16 === 0){
      const pend = fxPending; fxPending = null;
      fxStopAll(nextT);
      if (pend.type === 'swap') fxStartNow(pend.id, g, nextT);
      later(nextT, fxShow);
    }
    plan(g, base, d).forEach(e => { const t = nextT + e.off + (e.sw ? sw : 0); playStep(e.idx, t); vq.push({t, idx:e.idx}); });
    fxAudio(nextT, d, g);
    nextT += d; gstep++;
  }
  vq.sort((a, b) => a.t - b.t);
}
function draw(){
  if (!playing) return;
  let changed = false;
  while (vq.length && vq[0].t <= AC.currentTime){ cur = vq.shift(); changed = true; }
  if (changed && ui.follow && Math.floor(cur.idx / 16) !== ui.page){ ui.page = Math.floor(cur.idx / 16); render(); }
  else if (changed) mark();
  requestAnimationFrame(draw);
}
function mark(){
  $$('.ph').forEach(e => e.classList.remove('ph'));
  if (!cur) return;
  $$(`[data-idx="${cur.idx}"]`).forEach(e => e.classList.add('ph'));
  $$(`[data-act="page"][data-v="${Math.floor(cur.idx / 16)}"]`).forEach(e => e.classList.add('ph'));
  $$(`#pstrip [data-pstep="${cur.idx % 16}"]`).forEach(e => e.classList.add('ph'));
  $('#perfPat').textContent = `PAT ${Math.floor(cur.idx / 16) + 1}/${S.len / 16}`;
}
function start(){
  audio(); playing = true; gstep = 0; vq = []; nextT = AC.currentTime + .06;
  timer = setInterval(tick, 25); tick(); requestAnimationFrame(draw);
  log('PLAYING'); render();
}
function stop(){ fxClear(); playing = false; clearInterval(timer); vq = []; gstep = 0; cur = null; mark(); log('STOPPED'); render(); }
