/* WOPR Beat Machine · moves
   Section moves, spices and ROLL A SONG.
   All files share one global scope: anything defined in an earlier file can be used here.
   Load order is set in index.html. */
/* ---------- section moves, spices, song ---------- */
const SECTION = ['FILL','BUILD','BREAK','GAP','DROP','HALF','STRIP','STOP','ANSWER'];
const SPICES = ['PUSH','O-HAT','RATCHET','M-GUN','GHOST','EUCLID','POLY'];
const ROLE_TAG = {FILL:'F', BUILD:'B', BREAK:'BR', GAP:'G', DROP:'D', HALF:'H', STRIP:'S', STOP:'X', ANSWER:'A'};
const ch = a => a[Math.floor(rnd() * a.length)];
const e16 = () => Array(16).fill(0);
const at = steps => { const a = e16(); steps.forEach(i => a[i] = 1); return a; };
const gcd = (a, b) => b ? gcd(b, a % b) : a, lcm = (a, b) => a * b / gcd(a, b);
function lockFix(o, g){ IDS.forEach(id => { if (S.locks[id]) o[id] = g[id].slice(); }); return o; }

const MV = {
  FILL: g => makeFill(g),
  BUILD(g){
    const c = chaos(), o = clone(g);
    const snd = rnd() < .6 ? 'snare' : (rnd() < .5 ? 'perc' : 'kick');
    const lays = [[1,0,0,0,1,0,0,0,1,0,1,0,1,1,1,1],[1,0,1,0,1,0,1,0,1,1,1,1,1,1,1,1],[1,0,0,0,1,0,0,0,1,0,0,0,1,1,1,1],[1,0,0,1,0,0,1,0,1,0,1,0,1,1,1,1]];
    if (c > .5) lays.push([1,0,1,1,0,1,1,0,1,1,1,1,1,1,1,1]);
    IDS.forEach(id => o[id] = e16());
    o[snd] = ch(lays).slice();
    if (snd !== 'kick' && rnd() < .55) o.kick = at([0,4,8,12]);
    if (rnd() < .35) o.chat = at([0,4,8,12]);
    return o;
  },
  BREAK(g){
    const c = chaos(), o = clone(g);
    o.kick = e16();
    const sn = []; g.snare.forEach((v, i) => { if (v) sn.push(i); });
    o.snare = e16(); const keep = ch([0,1,1,2]);
    for (let k = 0; k < keep && sn.length; k++) o.snare[sn.splice(Math.floor(rnd() * sn.length), 1)[0]] = 1;
    if (rnd() < .5) o.chat = g.chat.map((v, i) => i % 2 ? 0 : v);
    for (let i = 1; i < 16; i += 2) if (rnd() < .08 + c * .2) o.perc[i] = 1;
    return o;
  },
  GAP(g){
    const c = chaos(), o = clone(g), L = ch(c > .5 ? [4,8,8] : [2,4,4,8]);
    IDS.forEach(id => { for (let i = 16 - L; i < 16; i++) o[id][i] = 0; });
    if (rnd() < .55) o[ch(['snare','kick'])][15] = 1;
    return o;
  },
  DROP(g){
    const o = clone(g);
    o.kick[0] = 1; o[ch(['ohat','perc'])][0] = 1;
    const spots = [2,3,6,7,10,11,14].filter(i => !o.kick[i]);
    for (let k = 0, n = 1 + (rnd() < .5 ? 1 : 0); k < n && spots.length; k++) o.kick[spots.splice(Math.floor(rnd() * spots.length), 1)[0]] = 1;
    return o;
  },
  HALF(g){
    const c = chaos(), o = clone(g);
    o.kick = at([0, ...ch([[10],[11],[6,10],[11,14],[3,10]])]);
    o.snare = at([8]); if (c > .4 && rnd() < .5) o.snare[14] = 1;
    o.chat = rnd() < .5 ? at([0,4,8,12]) : at([0,2,4,6,8,10,12,14]);
    o.ohat = e16();
    o.perc = g.perc.map(v => v && rnd() < .5 ? 1 : 0);
    return o;
  },
  STRIP(g){
    const o = clone(g);
    let keep = ch([['chat'],['chat','perc'],['kick','chat'],['perc'],['kick'],['chat','ohat']]);
    IDS.forEach(id => { if (!keep.includes(id)) o[id] = e16(); });
    if (!keep.some(id => o[id].some(Boolean))) o.chat = at([0,2,4,6,8,10,12,14]);
    return o;
  },
  STOP(){
    const o = {}; IDS.forEach(id => o[id] = e16());
    ch([[0],[0,3,6],[0,6],[0,3,6,10],[0,2],[0,6,12],[0,3,6,9,12]]).forEach(i => {
      o.kick[i] = 1; if (rnd() < .7) o.snare[i] = 1; if (rnd() < .5) o.perc[i] = 1;
    });
    return o;
  },
  ANSWER(g, prev){
    const o = clone(g), d = ch([2,-2,3,1,-3,4]);
    o.kick = prev.kick.slice();
    const src = prev.snare.some(Boolean) ? prev.snare : g.snare;
    o.snare = e16(); src.forEach((v, i) => { if (v) o.snare[(i + d + 16) % 16] = 1; });
    o.perc = prev.perc.slice().reverse();
    return o;
  },
};
const MOVE_NAME = {FILL:'FILL', BUILD:'BUILD-UP', BREAK:'BREAKDOWN', GAP:'PRE-DROP GAP', DROP:'DROP', HALF:'HALF-TIME', STRIP:'STRIP', STOP:'STOP', ANSWER:'ANSWER'};

function applyMove(name){
  let p = ui.page;
  if ((name === 'FILL' || name === 'ANSWER') && S.len === 16){ setLen(32, true); p = ui.page = 1; }
  if (!S.base[p]) S.base[p] = pageOf(p);
  const g = S.base[p], np = S.len / 16, pp = (p - 1 + np) % np;
  const prev = pp === p ? g : pageOf(pp);
  writePage(p, lockFix(MV[name](clone(g), clone(prev)), g));
  S.roles[p] = name;
  roll('mv_' + name); pushHistory();
  log(`${MOVE_NAME[name]} ROLLED ON PATTERN ${p + 1}`);
  render();
}

function hitsOf(a, lo){ const r = []; for (let i = 0; i < 16; i++) if (a[lo + i]) r.push(i); return r; }
const unlock = id => `UNLOCK ${NAME[id]} FIRST`;
const SP = {
  PUSH(P, lo){
    const id = rnd() < .65 ? 'kick' : 'snare'; if (S.locks[id]) return unlock(id);
    const h = hitsOf(P[id], lo).filter(i => i > 0 && !P[id][lo + i - 1]);
    if (!h.length) return `NO ${NAME[id]} TO PUSH`;
    const i = ch(h); P[id][lo + i] = 0; P[id][lo + i - 1] = 1;
    return `${NAME[id]} PUSHED EARLY TO STEP ${i}`;
  },
  'O-HAT'(P, lo){
    if (S.locks.ohat) return unlock('ohat');
    const st = ch([[6],[14],[6,14],[2,6,10,14]]);
    st.forEach(i => { P.ohat[lo + i] = 1; if (!S.locks.chat) P.chat[lo + i] = 0; });
    return `OPEN HAT ON STEP ${st.map(i => i + 1).join(' ')}`;
  },
  RATCHET(P, lo){
    let id = ui.sel; if (S.locks[id]) return unlock(id);
    let h = hitsOf(P[id], lo).filter(i => i < 15);
    if (!h.length && !S.locks.snare){ id = 'snare'; h = hitsOf(P.snare, lo).filter(i => i < 15); }
    if (!h.length) return 'NO HITS TO RATCHET';
    const i = ch(h), n = rnd() < .5 + chaos() * .3 ? 2 : 1;
    for (let k = 1; k <= n && i + k < 16; k++) P[id][lo + i + k] = 1;
    return `${NAME[id]} RATCHET ON STEP ${i + 1}`;
  },
  'M-GUN'(P, lo){
    if (S.locks.kick) return unlock('kick');
    const L = ch([4,4,8]); for (let i = 16 - L; i < 16; i++) P.kick[lo + i] = 1;
    return `MACHINE GUN KICK · LAST ${L} STEPS`;
  },
  GHOST(P, lo){
    if (S.locks.snare) return unlock('snare');
    const cand = [];
    hitsOf(P.snare, lo).forEach(i => [-1,1,2,-2].forEach(d => { const j = i + d; if (j >= 0 && j < 16 && !P.snare[lo + j] && !cand.includes(j)) cand.push(j); }));
    if (!cand.length) return 'NO ROOM FOR GHOST NOTES';
    const n = 1 + Math.floor(rnd() * (2 + chaos() * 2));
    for (let k = 0; k < n && cand.length; k++) P.snare[lo + cand.splice(Math.floor(rnd() * cand.length), 1)[0]] = 1;
    return 'GHOST SNARES ADDED';
  },
  EUCLID(P, lo){
    const id = ui.sel; if (S.locks[id]) return unlock(id);
    const k = 2 + Math.floor(rnd() * (4 + chaos() * 5)), r = Math.floor(rnd() * 16);
    for (let i = 0; i < 16; i++) P[id][lo + (i + r) % 16] = (i * k) % 16 < k ? 1 : 0;
    return `${NAME[id]} · ${k} HITS SPREAD EVENLY`;
  },
  POLY(P){
    const id = ui.sel; if (S.locks[id]) return unlock(id);
    const n = ch([3,5,6,7]), m = Array(n).fill(0); m[0] = 1;
    if (n > 3 && rnd() < .4 + chaos() * .4) m[1 + Math.floor(rnd() * (n - 1))] = 1;
    for (let i = 0; i < S.len; i++) P[id][i] = m[i % n];
    const l = lcm(n, 16);
    return `${NAME[id]} ${n}-STEP LOOP · LINES UP EVERY ${l} STEPS${l > S.len ? ' (LONGER THAN THIS BEAT)' : ''}`;
  },
};
function applySpice(name){
  const p = ui.page, pages = name === 'POLY' ? [...Array(S.len / 16).keys()] : [p];
  const added = pages.filter(q => !S.base[q]);
  added.forEach(q => S.base[q] = pageOf(q));
  const before = JSON.stringify(S.main);
  const msg = SP[name](S.main, p * 16);
  roll('sp_' + name);
  if (JSON.stringify(S.main) === before){ added.forEach(q => delete S.base[q]); log(msg); render(); return; }
  pushHistory(); log(msg); render();
}
function resetPage(){
  const p = ui.page; if (!S.base[p]) return;
  writePage(p, S.base[p]); delete S.base[p];
  if (ROLE_TAG[S.roles[p]]) delete S.roles[p];
  pushHistory(); log(`PATTERN ${p + 1} BACK TO ITS GROOVE`); render();
}

const SHAPES = {
  2: [['G','FILL'],['G','ANSWER']],
  3: [['G','ANSWER','FILL'],['STRIP','G','FILL'],['G','G','BUILD+GAP']],
  4: [['STRIP','G','BUILD+GAP','DROP'],['G','ANSWER','BREAK','FILL'],['G','G','HALF','FILL'],['G','FILL','BREAK','BUILD+GAP']],
  6: [['STRIP','G','ANSWER','FILL','BUILD+GAP','DROP'],['G','G','FILL','BREAK','HALF','BUILD+GAP'],['STRIP','G','G','FILL','BREAK','STOP']],
  8: [['STRIP','G','G','FILL','BREAK','BUILD+GAP','DROP','FILL'],['G','ANSWER','G','FILL','BREAK','HALF','BUILD+GAP','DROP'],['G','G','G','FILL','HALF','HALF','BUILD+GAP','STOP']],
};
function songShape(n){
  if (SHAPES[n]) return ch(SHAPES[n]);
  const sh = ['STRIP']; while (sh.length < n - 1) sh.push('G'); sh.push('FILL'); return sh;
}
function rollSong(){
  if (S.len < 32) S.len = 64;
  const shape = songShape(S.len / 16), g = genPage(), pages = [], done = {};
  if (S.main) IDS.forEach(id => { if (S.locks[id]) g[id] = S.main[id].slice(0, 16); });
  S.base = {}; S.roles = {};
  shape.forEach((r, p) => {
    let pg;
    if (r === 'G') pg = clone(g);
    else if (done[r]) pg = clone(done[r]);
    else {
      const [a, b] = r.split('+'), prev = p ? pages[p - 1] : g;
      pg = lockFix(MV[a](clone(g), clone(prev)), g);
      if (b) pg = lockFix(MV[b](pg, clone(prev)), g);
      done[r] = pg;
    }
    pages.push(pg);
    S.roles[p] = r === 'G' ? 'GROOVE' : r.split('+')[0];
    if (r !== 'G') S.base[p] = clone(g);
  });
  S.main = blank(0); pages.forEach(pg => IDS.forEach(id => S.main[id].push(...pg[id])));
  ui.page = 0; roll('song'); pushHistory();
  log('SONG · ' + shape.map(r => r === 'G' ? 'GROOVE' : r.split('+')[0]).join(' '));
  render();
}
