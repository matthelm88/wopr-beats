/* WOPR Beat Machine · generate
   Rolls new beats (NEW BEAT, TWEAK, FILL) and changes the length.
   All files share one global scope: anything defined in an earlier file can be used here.
   Load order is set in index.html. */
/* ---------- generation ---------- */
function pick(ids, w){
  let tot = ids.reduce((s, id) => s + (w[id] || 1), 0), r = rnd() * tot;
  for (const id of ids){ r -= (w[id] || 1); if (r <= 0) return id; }
  return ids[ids.length - 1];
}
function genPage(){
  const G = GENRES[S.genre], c = chaos(), out = {};
  for (const id of IDS){
    const tpl = G.tpl[id], a = [];
    const tw = id === 'kick' ? .45 : id === 'snare' ? .5 : .7;
    for (let i = 0; i < 16; i++){
      const off = i % 2 ? .55 : (i % 4 === 2 ? .4 : .25);
      a.push(rnd() < tpl[i] * (1 - .45 * c) + G.wild * c * off * tw ? 1 : 0);
    }
    if (c < .75 && tpl[0] >= .9) a[0] = 1;
    if (c < .5) tpl.forEach((p, i) => { if (p >= .95) a[i] = 1; });
    out[id] = a;
  }
  return out;
}
function mutate(P, count, lo, hi){
  const ids = IDS.filter(id => !S.locks[id]);
  if (!ids.length) return 0;
  const W = {kick:1, snare:1.2, chat:2, ohat:.8, perc:1.6}, c = chaos(), tpl = GENRES[S.genre].tpl;
  let done = 0, tries = 0;
  while (done < count && tries < 150){
    tries++;
    const id = pick(ids, W), i = lo + Math.floor(rnd() * (hi - lo));
    if (id === 'kick' && i % 16 === 0 && c < .75) continue;
    const p = tpl[id][i % 16];
    if (P[id][i]){ if (rnd() < .55 - p * .3 + c * .2){ P[id][i] = 0; done++; } }
    else if (rnd() < p * .6 + .12 + c * .3){ P[id][i] = 1; done++; }
  }
  return done;
}
function makeFill(base){
  const c = chaos(), f = clone(base), start = c > .5 ? 4 : 8;
  for (let i = start; i < 16; i++){
    const ramp = (i - start + 1) / (16 - start);
    if (!S.locks.snare) f.snare[i] = rnd() < .25 + ramp * .7 ? 1 : 0;
    if (!S.locks.chat) f.chat[i] = rnd() < c * .2 ? 1 : 0;
    if (!S.locks.ohat) f.ohat[i] = 0;
    if (!S.locks.kick) f.kick[i] = ((i % 4 === 0 && rnd() < .6) || rnd() < c * .25) ? 1 : 0;
    if (!S.locks.perc) f.perc[i] = rnd() < c * .35 * ramp ? 1 : 0;
  }
  if (!S.locks.snare) f.snare[15] = 1;
  return f;
}
function generate(){
  const c = chaos(), pages = S.len / 16, base = genPage(), M = blank(0);
  for (let pg = 0; pg < pages; pg++){
    const page = clone(base);
    if (pg > 0) mutate(page, Math.round(1 + c * 3 + pg * .7), 0, 16);
    IDS.forEach(id => M[id].push(...page[id]));
  }
  IDS.forEach(id => { if (S.locks[id] && S.main) M[id] = fit(S.main[id], S.len); });
  S.main = M; S.base = {}; S.roles = {}; S.auto = null;   // a new beat starts with no recorded effects
  if (ui.page >= pages) ui.page = 0;
  roll('gen'); pushHistory();
  log(`${GENRES[S.genre].name} · DEFCON ${S.defcon} · ${S.len} STEPS`);
  render();
}
function setLen(n, exact){
  if (n === S.len) return;
  const c = chaos(), M = blank(0);
  for (let pg = 0; pg < n / 16; pg++){
    if (pg < S.len / 16){ IDS.forEach(id => M[id].push(...S.main[id].slice(pg * 16, pg * 16 + 16))); continue; }
    const page = Object.fromEntries(IDS.map(id => [id, S.main[id].slice(0, 16)]));
    if (!exact) mutate(page, Math.round(1 + c * 3 + pg * .7), 0, 16);
    IDS.forEach(id => M[id].push(...page[id]));
  }
  [S.base, S.roles].forEach(o => Object.keys(o).forEach(p => { if (+p >= n / 16) delete o[p]; }));
  S.len = n; S.main = M;
  if (S.auto) S.auto = fitAuto(S.auto, n);   // recorded effects keep their steps; new steps start empty
  if (ui.page >= n / 16) ui.page = 0;
}
