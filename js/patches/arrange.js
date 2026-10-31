/* WOPR Beat Machine · patch: SONG tab (arranger)
   Turns the current main beat into a song: INTRO, RISE, MAIN, OUTRO, FINISH, drums + bass for each.
   - MAIN is your beat and bass as they are. INTRO, RISE and FINISH are built from MAIN.
   - INTRO and OUTRO share one pattern. FM-1 slots: A = MAIN, B = INTRO/OUTRO, C = RISE, D = FINISH.
   - Pattern lengths: MAIN = the whole beat, INTRO/OUTRO and RISE = up to 2 bars, FINISH = 1 bar,
     so the whole song fits the PO's 16 slots. Section lengths come from the style; LEN overrides one section.
   - LOCK keeps a pattern through BUILD and NEW BEAT. Editing a pattern by hand locks it.
   - NEW BEAT, ROLL A SONG and STYLE rebuild the unlocked patterns; smaller beat edits show BEAT CHANGED.
   Data lives in S.song (saved with the beat by history.js). Needs bass.js for the bass parts.
   All files share one global scope: anything defined in an earlier file can be used here. */
(() => {
  const SEC = ['intro','rise','main','outro','finish'];
  const PAT = {intro:'intro', rise:'rise', main:'main', outro:'intro', finish:'finish'};
  const SLOT = {main:'A', intro:'B', rise:'C', finish:'D'};
  const SNAME = {intro:'INTRO', rise:'RISE', main:'MAIN', outro:'OUTRO', finish:'FINISH'};
  const PNAME = {main:'MAIN', intro:'INTRO/OUTRO', rise:'RISE', finish:'FINISH'};
  /* automatic section lengths in bars (16 steps), by style; each lands near one minute at the style's tempo */
  const AUTO = {
    bigbeat:   {intro:8, rise:8, main:16, outro:8, finish:1},
    idm:       {intro:8, rise:4, main:16, outro:8, finish:1},
    industrial:{intro:8, rise:8, main:16, outro:8, finish:1},
    junk:      {intro:4, rise:4, main:8,  outro:4, finish:1},
    punk:      {intro:4, rise:4, main:16, outro:4, finish:1},
    funk:      {intro:4, rise:4, main:16, outro:8, finish:1},
  };
  const REPS = [1, 2, 3, 4, 6, 8, 12, 16];
  /* how each style strips its intro (first option is the most typical) */
  const INTRO = {
    bigbeat:   [{kick:'beats', keep:['chat']}, {kick:'one', keep:['chat','perc']}, {kick:'full', keep:[]}],
    idm:       [{kick:'one', keep:['chat','perc']}, {kick:'none', keep:['perc']}, {kick:'full', keep:['chat']}],
    industrial:[{kick:'full', keep:['perc']}, {kick:'full', keep:[]}, {kick:'one', keep:['perc','chat']}],
    junk:      [{kick:'one', keep:['perc']}, {kick:'full', keep:['perc']}, {kick:'none', keep:['chat','perc']}],
    punk:      [{kick:'beats', keep:['chat']}, {kick:'one', keep:['chat']}, {kick:'full', keep:[], snare:true}],
    funk:      [{kick:'full', keep:['chat']}, {kick:'one', keep:['chat']}, {kick:'beats', keep:['chat','perc']}],
  };
  const KICK_TXT = {full:'KICK', beats:'KICK ON THE BEATS', one:'KICK ON BAR 1', none:''};
  /* the rise: which sound rolls, and how the kick runs under it */
  const RISE = {
    bigbeat:{roll:['snare','perc'], kick:'four'}, idm:{roll:['perc','snare'], kick:'main'}, industrial:{roll:['snare','kick'], kick:'four'},
    junk:{roll:['perc','snare'], kick:'main'}, punk:{roll:['snare','kick'], kick:'four'}, funk:{roll:['snare','perc'], kick:'main'},
  };
  /* the finish: sounds on each stab */
  const FIN = {bigbeat:['kick','snare'], idm:['kick','perc'], industrial:['kick','snare','perc'], junk:['kick','perc'], punk:['kick','snare'], funk:['kick','snare']};

  /* ---------- music helpers (same rules as bass.js) ---------- */
  const NOTE = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const nn = m => NOTE[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  const SCALES = {MINOR:[0,2,3,5,7,8,10], DORIAN:[0,2,3,5,7,9,10], PHRYG:[0,1,3,5,7,8,10], PENTA:[0,3,5,7,10], MAJOR:[0,2,4,5,7,9,11], MIXO:[0,2,4,5,7,9,10], HIJAZ:[0,1,4,5,7,8,10]};
  const SC_NAME = {MINOR:'MINOR', DORIAN:'DORIAN', PHRYG:'PHRYGIAN', PENTA:'MINOR PENTATONIC', MAJOR:'MAJOR', MIXO:'MIXOLYDIAN', HIJAZ:'PHRYGIAN DOMINANT'};
  const LO = -5, HI = 12;
  const fold = x => { while (x > HI) x -= 12; while (x < LO) x += 12; return x; };
  function snapS(x, sc){
    const s = SCALES[sc] || SCALES.MINOR; let best = 0, bd = 99;
    for (let o = -2; o <= 2; o++) for (const v of s){ const c = v + o * 12, d = Math.abs(c - x); if (d < bd){ bd = d; best = c; } }
    return best;
  }
  const inKey = x => fold(snapS(x, S.bass ? S.bass.sc : 'MINOR'));
  const rows = sc => { const r = []; for (let x = HI; x >= LO; x--) if (snapS(x, sc) === x) r.push(x); return r; };
  const baseOf = B => 28 + ((B.key - 4 + 12) % 12) + 12 * (B.oct || 0);
  const one = a => a[Math.floor(rnd() * a.length)];
  const wpick = list => { const tot = list.reduce((s, x) => s + x[1], 0); let v = rnd() * tot; for (const [x, w] of list){ v -= w; if (v <= 0) return x; } return list[list.length - 1][0]; };
  const has = v => v !== null && v !== undefined;
  const emptyB = n => ({n:Array(n).fill(null), g:Array(n).fill(1), a:Array(n).fill(0), s:Array(n).fill(0)});
  const sliceD = (d, n) => Object.fromEntries(IDS.map(id => [id, fit(d[id].slice(0, n), n)]));
  const rootAt = p => { const B = S.bass; return B && B.prog ? (B.prog[p % B.prog.length] || 0) : 0; };
  const sig = () => { const t = JSON.stringify(S.main) + S.len + '|' + (S.bass ? S.bass.n.join(',') + S.bass.key : ''); let h = 5381; for (let i = 0; i < t.length; i++) h = (h * 33 + t.charCodeAt(i)) | 0; return String(h); };
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  /* ---------- building the patterns ---------- */
  function genMain(){
    const B = S.bass, L = S.len, b = emptyB(L);
    if (B) ['n','g','a','s'].forEach(k => { for (let i = 0; i < L; i++){ const v = B[k][i]; if (k === 'n' ? has(v) : v !== undefined) b[k][i] = v; } });
    return {len:L, d:clone(S.main), b, lock:false, desc:'YOUR BEAT AND BASS AS THEY ARE'};
  }
  function genIntro(MP){
    const c = chaos(), opts = INTRO[S.genre] || INTRO.bigbeat, o = wpick(opts.map((x, k) => [x, k ? 1 : 3]));
    const T = Math.min(MP.len, 32), src = sliceD(MP.d, T), d = blank(T);
    for (let i = 0; i < T; i++){
      d.kick[i] = o.kick === 'full' ? src.kick[i] : o.kick === 'beats' ? ((src.kick[i] && i % 4 === 0) || i % 16 === 0 ? 1 : 0) : o.kick === 'one' ? (i % 16 === 0 ? 1 : 0) : 0;
      IDS.forEach(id => {
        if (id === 'kick') return;
        if (o.keep.includes(id)) d[id][i] = src[id][i];
        else if (src[id][i] && rnd() < c * .15) d[id][i] = 1;       // higher DEFCON lets a few extra hits through
      });
      if (o.snare && i % 8 === 4) d.snare[i] = 1;
    }
    if (!IDS.some(id => d[id].some(Boolean))) for (let i = 0; i < T; i += 2) d.chat[i] = 1;
    if (T >= 16 && rnd() < .2 + c * .35) d.snare[T - 2] = 1;          // a pickup into the next section
    const b = emptyB(T);
    if (S.bass){
      const ons = [];
      for (let i = 0; i < T; i++) if (i % 16 === 0 || (o.kick !== 'one' && o.kick !== 'none' && d.kick[i] && i % 4 === 0)) ons.push(i);
      ons.forEach((i, k) => {
        const nx = k + 1 < ons.length ? ons[k + 1] : T, mn = MP.b.n[i];
        b.n[i] = has(mn) ? mn : inKey(rootAt(Math.floor(i / 16))); b.g[i] = Math.min(8, nx - i);
      });
    }
    const kept = [KICK_TXT[o.kick], ...o.keep.map(id => NAME[id]), o.snare ? 'SNARE ON THE BEATS' : ''].filter(Boolean).join(' + ');
    return {len:T, d, b, lock:false, desc:kept || 'SPARSE'};
  }
  function genRise(MP){
    const c = chaos(), R = RISE[S.genre] || RISE.bigbeat, roll = rnd() < .7 ? R.roll[0] : R.roll[1];
    const T = Math.min(MP.len, 32), src = sliceD(MP.d, T), d = blank(T), gap = wpick([[0, 3], [1, 2], [2, 2], [4, 1]]);
    for (let i = 0; i < T; i++){
      const x = i / T, rate = x < .25 ? 8 : x < .5 ? 4 : x < .75 ? 2 : 1;
      d[roll][i] = i % rate === 0 || rnd() < c * .15 * x ? 1 : 0;
      if (roll !== 'kick') d.kick[i] = R.kick === 'four' || x >= .5 ? (i % 4 === 0 ? 1 : 0) : src.kick[i];
      if (roll !== 'chat') d.chat[i] = x < .75 ? src.chat[i] : 0;
      if (roll !== 'snare') d.snare[i] = x < .75 ? src.snare[i] : 0;
      if (roll !== 'perc') d.perc[i] = x < .5 ? src.perc[i] : 0;
      if (i >= T - gap) IDS.forEach(id => d[id][i] = 0);
    }
    const b = emptyB(T);
    if (S.bass) for (let i = 0; i < T - gap; i++){
      const x = i / T;
      if (x < .75 && i % 2) continue;
      b.n[i] = x < .5 ? 0 : x < .75 ? ((i / 2) % 2 ? 12 : 0) : fold(snapS(Math.round((x - .75) / .25 * 12), S.bass.sc));
      b.g[i] = x < .75 ? 1 : .5; b.a[i] = i % 4 === 0 ? 1 : 0;
    }
    return {len:T, d, b, lock:false, desc:`${NAME[roll]} ROLL, BASS CLIMBS${gap ? ` · ${gap}-STEP GAP AT THE END` : ''}`};
  }
  function genFinish(){
    const c = chaos(), ends = c < .25 ? [[0], [0], [0,3,6]] : [[0], [0,3,6], [0,6], [0,2,4], [0,3,6,9], [0,6,12]];
    const st = one(ends), last = st[st.length - 1], tr = FIN[S.genre] || FIN.bigbeat, d = blank(16), b = emptyB(16);
    st.forEach(i => tr.forEach(id => d[id][i] = 1));
    d.ohat[last] = 1;
    if (S.bass){
      const ap = inKey(one([0, 7, 12]));
      st.forEach(i => { b.n[i] = i === last ? 0 : ap; b.g[i] = i === last ? 16 - last : 1; b.a[i] = i === last ? 1 : 0; });
    }
    return {len:16, d, b, lock:false, desc:st.length > 1 ? `${st.length} STABS, LAST HIT ON STEP ${last + 1}` : 'ONE BIG HIT ON STEP 1'};
  }
  const GEN = {intro:genIntro, rise:genRise, finish:genFinish};
  function build(){
    if (!S.main) return;
    if (!S.song) S.song = {v:1, pat:{}, reps:{}, src:'', sc:''};
    const so = S.song, locked = k => so.pat[k] && so.pat[k].lock;
    if (!locked('main')) so.pat.main = genMain();
    ['intro','rise','finish'].forEach(k => { if (!locked(k)) so.pat[k] = GEN[k](so.pat.main); });
    so.src = sig(); so.sc = S.bass ? S.bass.sc : '';
  }

  /* ---------- the song as a timeline ---------- */
  function repsOf(sec){
    const o = S.song.reps[sec]; if (o) return o;
    const bars = (AUTO[S.genre] || AUTO.bigbeat)[sec], pb = S.song.pat[PAT[sec]].len / 16;
    return Math.max(1, Math.round(bars / pb));
  }
  function tl(){
    let start = 0;
    return SEC.map(sec => { const pk = PAT[sec], P = S.song.pat[pk], reps = repsOf(sec), e = {sec, pk, P, start, len:P.len, reps, steps:P.len * reps}; start += e.steps; return e; });
  }
  const totalOf = T => T[T.length - 1].start + T[T.length - 1].steps;

  /* ---------- playback: PLAY SONG and LOOP borrow the normal clock ---------- */
  let songPlay = null, sq = [], sNow = null;   // songPlay: {mode:'song'} or {mode:'loop', sec}
  const _ps = playStep;
  playStep = function(idx, t){
    if (!songPlay || !S.song) return _ps(idx, t);
    const T = tl(), total = totalOf(T);
    let pos = gstep - gstep % S.len + idx;
    if (songPlay.mode === 'loop'){ const e = T.find(x => x.sec === songPlay.sec); pos = e.start + pos % e.steps; }
    else if (pos >= total){ endSong(t); return; }
    const e = T.find(x => pos >= x.start && pos < x.start + x.steps); if (!e) return;
    const j = (pos - e.start) % e.len, m = S.main, l = S.len, b = S.bass;
    sq.push({t, pos, sec:e.sec, j});
    S.main = e.P.d; S.len = e.len; S.bass = b ? Object.assign({}, b, e.P.b) : b;   // play the section through the normal voices
    try { _ps(j, t); } finally { S.main = m; S.len = l; S.bass = b; }
  };
  function endSong(t){
    if (songPlay.ending) return;
    songPlay.ending = true;
    setTimeout(() => { if (songPlay && songPlay.ending && playing){ stop(); say('SONG FINISHED'); } }, Math.max(0, (t - AC.currentTime) * 1000) + 1200);
  }
  const _aa = autoAt;  autoAt = i => songPlay ? null : _aa(i);        // recorded effects belong to the main beat
  const _stop = stop;  stop = function(){ songPlay = null; sq = []; sNow = null; _stop(); };
  function playSong(mode, sec){
    if (playing) stop();
    songPlay = {mode, sec, ending:false}; ui.songFollow = mode === 'song'; sq = []; sNow = null;
    if (typeof rec !== 'undefined' && rec){ rec = false; touchHistory(); }   // REC writes to the main beat, so it stops
    start(); if (typeof fxShow === 'function') fxShow();
    requestAnimationFrame(sDraw);
  }
  function sDraw(){
    if (!songPlay || !playing){ sq = []; return; }
    sq.sort((a, b) => a.t - b.t);
    let c = null; while (sq.length && sq[0].t <= AC.currentTime) c = sq.shift();
    if (c){
      sNow = c;
      if (ui.tab === 'song' && ui.songFollow && (c.sec !== ui.songSec || Math.floor(c.j / 16) !== ui.songPage)){ ui.songSec = c.sec; ui.songPage = Math.floor(c.j / 16); renderSong(); }
      else markSong();
    }
    requestAnimationFrame(sDraw);
  }
  function markSong(){
    const tab = $('#tab-song'); if (!tab || tab.hidden) return;
    tab.querySelectorAll('.sph').forEach(e => e.classList.remove('sph'));
    const c = sNow; if (!c || !songPlay) return;
    tab.querySelectorAll(`#sstrip [data-v="${c.sec}"]`).forEach(e => e.classList.add('sph'));
    if (PAT[c.sec] === PAT[ui.songSec]){
      tab.querySelectorAll(`[data-sidx="${c.j}"]`).forEach(e => e.classList.add('sph'));
      tab.querySelectorAll(`#spages [data-v="${Math.floor(c.j / 16)}"]`).forEach(e => e.classList.add('sph'));
    }
    const pt = $('#splaySub'); if (pt && songPlay.mode === 'song') pt.textContent = `BAR ${Math.floor(c.pos / 16) + 1} OF ${totalOf(tl()) / 16}`;
  }

  /* ---------- exports ---------- */
  function noteTxt(b, j, B){
    const nx = j + 1 < b.n.length ? j + 1 : -1;
    return nn(baseOf(B) + b.n[j]) + (b.a[j] > 0 ? '!' : '') + (b.a[j] < 0 ? '(soft)' : '') + (b.g[j] > 1 ? ' ×' + b.g[j] : '') + (nx >= 0 && b.s[nx] && has(b.n[nx]) ? '~' : '');
  }
  function barNotes(b, p, B){ const r = []; for (let i = 0; i < 16; i++){ const j = p * 16 + i; if (has(b.n[j])) r.push(`${i + 1} ${noteTxt(b, j, B)}`); } return r; }
  function headTxt(T){
    const B = S.bass, bars = totalOf(T) / 16;
    return `WOPR SONG · ${GENRES[S.genre].name}${B ? ` · ${NOTE[B.key]} ${SC_NAME[B.sc] || B.sc}` : ''} · ${S.tempo} BPM · ${bars} BARS · ${mmss(totalOf(T) * stepDur())}\n`;
  }
  function fmText(){
    const T = tl(), B = S.bass;
    let s = headTxt(T) + `\nFM-1 SONG PAGE\n#  SECTION  SLOT  REPEATS\n`;
    T.forEach((e, k) => { s += `${k + 1}  ${SNAME[e.sec].padEnd(7)}  ${SLOT[e.pk]}     ${e.reps}\n`; });
    s += `One repeat = one play of the slot's whole pattern.\n`;
    if (!B) return s + '\nNo bass line yet. Open the BASS tab once.\n';
    s += `\nFM-1 SLOTS · step, then note (MIDI 60 = C4) · ! accent · (soft) ghost · ×2 hold 2 steps · ~ slide into the next note\n`;
    ['main','intro','rise','finish'].forEach(pk => {
      const P = S.song.pat[pk], n = P.len / 16;
      s += `\nSLOT ${SLOT[pk]} · ${PNAME[pk]} · ${P.len} STEPS (${n} BAR${n > 1 ? 'S' : ''})\n`;
      for (let p = 0; p < n; p++) s += `${n > 1 ? `BAR ${p + 1}: ` : ''}${barNotes(P.b, p, B).join('  ') || 'REST'}\n`;
    });
    return s;
  }
  function poInfo(){
    const slots = [], slotOf = {};
    ['main','intro','rise','finish'].forEach(pk => {
      const P = S.song.pat[pk]; slotOf[pk] = [];
      for (let p = 0; p < P.len / 16; p++){
        const m = Array.from({length:16}, (_, i) => monoAt(P.d, p * 16 + i)), key = m.map(x => x ? KEY[x] : '-').join('');
        let k = slots.findIndex(x => x.key === key);
        if (k < 0){ slots.push({key, m, pk, p}); k = slots.length - 1; }
        slotOf[pk].push(k + 1);
      }
    });
    return {slots, slotOf};
  }
  const runs = a => { const r = []; a.forEach(n => { const l = r[r.length - 1]; if (l && n === l[1] + 1) l[1] = n; else r.push([n, n]); }); return r.map(([x, y]) => x === y ? x : `${x}-${y}`).join(', '); };
  function poText(){
    const T = tl(), {slots, slotOf} = poInfo(), L = id => id ? KEY[id] : '–', name = sl => `${PNAME[sl.pk]}${S.song.pat[sl.pk].len > 16 ? ' BAR ' + (sl.p + 1) : ''}`;
    const chain = []; T.forEach(e => { for (let r = 0; r < e.reps; r++) chain.push(...slotOf[e.pk]); });
    let s = headTxt(T) + `\nPO-35 SONG · ${slots.length} OF 16 SLOTS · CHAIN OF ${chain.length} PATTERNS\n`;
    if (slots.length > 16) s += `TOO MANY SLOTS: the PO holds 16. Shorten the main beat (STEPS) and BUILD again.\n`;
    if (chain.length > 128) s += `CHAIN TOO LONG: PO chains hold up to 128. Use LEN to shorten sections.\n`;
    s += `\nPROGRAM ORDER · fullest first, then copy and take away\n`;
    slots.forEach((sl, k) => {
      const hits = sl.m.filter(Boolean).length, head = `Slot ${k + 1} = ${name(sl)}`;
      if (!hits){ s += `${head}: leave it empty.\n`; return; }
      let best = -1, bd = 99;
      for (let j = 0; j < k; j++){ const dd = sl.m.reduce((a, x, i) => a + (x !== slots[j].m[i]), 0); if (dd < bd){ bd = dd; best = j; } }
      if (best >= 0 && bd <= Math.floor(hits * .6)){
        const dl = []; sl.m.forEach((x, i) => { if (x !== slots[best].m[i]) dl.push(`${i + 1}: ${L(slots[best].m[i])}→${L(x)}`); });
        s += `${head}: select slot ${best + 1}, hold WRITE + PATTERN and press ${k + 1}, then change ${bd} step${bd > 1 ? 's' : ''}. ${dl.join(' · ')}\n`;
      } else s += `${head}: program it (${hits} hits).\n`;
    });
    s += `\nCHAIN · hold PATTERN and press the slots in this order\n`;
    T.forEach(e => { const g = slotOf[e.pk]; s += `${SNAME[e.sec].padEnd(7)} ${g.length > 1 ? '(' + g.join(' ') + ')' : g[0]} ×${e.reps}\n`; });
    s += `FULL: ${chain.join(' ')}\n\nSTEPS PER SLOT · K KICK · S SNARE · H C-HAT · O O-HAT · M METAL\n`;
    slots.forEach((sl, k) => {
      const P = S.song.pat[sl.pk], lo = sl.p * 16;
      s += `\nSLOT ${k + 1} · ${name(sl)}\n`;
      IDS.forEach(id => { const st = stepsOf(P.d, id, lo); if (st.length) s += `${NAME[id].padEnd(6)} ${st.join(' ')}\n`; });
      s += `PO MONO ${monoLine(P.d, lo).join(' ') || '–'}\n`;
    });
    return s;
  }
  function songMidi(){
    const T = tl(), total = totalOf(T), st = 24, dr = [], bs = [], B = S.bass;
    T.forEach(e => { for (let r = 0; r < e.reps; r++) for (let i = 0; i < e.len; i++){
      const tk = (e.start + r * e.len + i) * st, P = e.P;
      TRACKS.forEach(t => { if (P.d[t.id][i]) dr.push({tick:tk, on:1, note:t.note, vel:100}, {tick:tk + 12, on:0, note:t.note}); });
      if (!B || !has(P.b.n[i])) continue;
      const nx = (i + 1) % e.len, glide = P.b.s[nx] && has(P.b.n[nx]) && P.b.n[nx] !== P.b.n[i];
      const len = glide ? st + 3 : Math.max(6, Math.round((P.b.g[i] || 1) * st * .9)), note = baseOf(B) + P.b.n[i];
      bs.push({tick:tk, on:1, note, vel:P.b.a[i] > 0 ? 120 : P.b.a[i] < 0 ? 50 : 96}, {tick:Math.min(tk + len, total * st), on:0, note});
    } });
    const txt = s => [...s].map(ch => ch.charCodeAt(0) & 127);
    const chunk = (evs, ch, title) => {
      evs.sort((a, b) => a.tick - b.tick || a.on - b.on);
      const n = txt(title), trk = [0, 0xFF, 0x03, n.length, ...n];
      if (ch < 0){ const mpq = Math.round(60000000 / S.tempo); trk.push(0, 0xFF, 0x51, 3, (mpq >> 16) & 255, (mpq >> 8) & 255, mpq & 255); }
      let last = 0;
      evs.forEach(e => { trk.push(...vlq(e.tick - last), (e.on ? 0x90 : 0x80) | ch, e.note, e.on ? e.vel : 0); last = e.tick; });
      trk.push(...vlq(Math.max(0, total * st - last)), 0xFF, 0x2F, 0);
      const L = trk.length;
      return [0x4D,0x54,0x72,0x6B, (L >>> 24) & 255, (L >> 16) & 255, (L >> 8) & 255, L & 255, ...trk];
    };
    return new Uint8Array([0x4D,0x54,0x68,0x64, 0,0,0,6, 0,1, 0,3, 0,96,
      ...chunk([], -1, 'WOPR SONG'), ...chunk(dr, 9, 'DRUMS'), ...chunk(bs, 0, 'BASS')]);
  }

  /* ---------- screen ---------- */
  let sRolled = null;
  const say = t => { const h = $('#sHead'); if (h) h.textContent = '> ' + t; };
  function renderSong(){
    const tab = $('#tab-song'); if (!tab) return;
    tab.hidden = ui.tab !== 'song';
    if (tab.hidden || !S.song) return;
    const so = S.song, T = tl(), total = totalOf(T), sel = ui.songSec, pk = PAT[sel], P = so.pat[pk], pages = P.len / 16;
    if (ui.songPage >= pages) ui.songPage = 0;
    const stale = so.src !== sig() && !so.pat.main.lock, sp = songPlay && playing ? songPlay : null;
    $('#sHead').textContent = stale ? '> BEAT CHANGED · TAP BUILD TO UPDATE' : `> SONG · ${total / 16} BARS · ${mmss(total * stepDur())}`;
    $('#sstrip').innerHTML = T.map(e => `<button class="btn sbtn${e.sec === sel ? ' on' : ''}" data-act="ssec" data-v="${e.sec}" aria-label="${SNAME[e.sec]}, slot ${SLOT[e.pk]}, ${e.steps / 16} bars${e.P.lock ? ', locked' : ''}">`
      + `<small>${SLOT[e.pk]} · ${e.steps / 16} BAR${e.steps > 16 ? 'S' : ''}</small>${SNAME[e.sec]}${e.P.lock ? '<i>L</i>' : ''}</button>`).join('');
    const rolled = ui.rolled; ui.rolled = sRolled;
    const ps = sp && sp.mode === 'song';
    $('#sgo').innerHTML = `<button class="big" data-act="sbuild" aria-label="Build the song from the beat">${dieSVG('sbuild')}<span class="bigtxt">BUILD<small>FROM THE BEAT</small></span></button>`
      + `<button class="big${ps ? ' on' : ''}" data-act="splay" aria-label="${ps ? 'Stop the song' : 'Play the whole song'}"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ps ? '<rect x="5.5" y="5.5" width="13" height="13" fill="currentColor"/>' : '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'}</svg>`
      + `<span class="bigtxt">${ps ? 'STOP' : 'PLAY SONG'}<small id="splaySub">${total / 16} BARS · ${mmss(total * stepDur())}</small></span></button>`;
    const ov = so.reps[sel], r = repsOf(sel), loopOn = sp && sp.mode === 'loop' && PAT[sp.sec] === pk;
    $('#sctl').innerHTML =
        `<button class="btn cyc${ov ? ' on' : ''}" data-act="slen" aria-label="${SNAME[sel]} length ${r * pages} bars, ${ov ? 'set by you' : 'automatic'}, tap to change"><small>LEN ${ov ? '×' + r : 'AUTO'}</small>${r * pages} BAR${r * pages > 1 ? 'S' : ''}</button>`
      + `<button class="btn${P.lock ? ' on' : ''}" data-act="slock" aria-pressed="${!!P.lock}" aria-label="Lock ${PNAME[pk]}">LOCK</button>`
      + `<button class="btn${loopOn ? ' on' : ''}" data-act="sloop" aria-pressed="${!!loopOn}" aria-label="Loop ${SNAME[sel]}">LOOP</button>`
      + `<button class="btn" data-act="sroll"${P.lock ? ' disabled' : ''} aria-label="${pk === 'main' ? 'Copy the beat into MAIN again' : 'Roll a new ' + PNAME[pk]}">${dieSVG('sroll')}${pk === 'main' ? 'COPY' : 'ROLL'}</button>`
      + `<button class="btn cyc" data-act="sview" aria-label="Showing ${ui.songView}, tap to change"><small>VIEW</small>${ui.songView.toUpperCase()}</button>`;
    ui.rolled = rolled; sRolled = null;
    const pg = $('#spages');
    pg.hidden = pages < 2 || ui.songView === 'list';
    pg.innerHTML = pages < 2 ? '' : Array.from({length:pages}, (_, p) => `<button class="btn${p === ui.songPage ? ' on' : ''}" data-act="spage" data-v="${p}">${pages > 4 ? '' : 'BAR '}${p + 1}</button>`).join('');
    const g = $('#sgrid'), off = ui.songPage * 16;
    g.className = ui.songView;
    if (ui.songView === 'drums'){
      let h = '';
      for (const t of TRACKS){
        h += `<div class="slab">${t.name}</div>`;
        for (let i = 0; i < 16; i++){ const j = off + i; h += `<button class="scell${P.d[t.id][j] ? ' on' : ''}${i % 4 === 0 && i ? ' q' : ''}" data-act="scell" data-t="${t.id}" data-v="${j}" data-sidx="${j}" aria-label="${t.name} step ${i + 1}${P.d[t.id][j] ? ', on' : ''}"></button>`; }
      }
      g.style.gridTemplateRows = ''; g.innerHTML = h;
    } else if (ui.songView === 'bass'){
      const B = S.bass;
      if (!B){ g.innerHTML = '<p class="slist">NO BASS YET · OPEN THE BASS TAB ONCE</p>'; }
      else {
        const R = rows(B.sc), b = baseOf(B), tails = {};
        for (let i = 0; i < 16; i++){ const j = off + i, o = P.b.n[j]; if (!has(o)) continue;
          for (let k = 1; k < Math.ceil(P.b.g[j] || 1) && i + k < 16; k++){ if (has(P.b.n[j + k])) break; tails[j + k] = o; } }
        let h = '';
        for (const r of R){
          const root = r % 12 === 0;
          h += `<div class="bl${root ? ' root' : ''}">${nn(b + r)}</div>`;
          for (let i = 0; i < 16; i++){
            const j = off + i, on = P.b.n[j] === r;
            h += `<button class="bc${root ? ' root' : ''}${i % 4 === 0 && i ? ' q' : ''}${on ? ' on' : ''}${on && P.b.a[j] > 0 ? ' acc' : ''}${on && P.b.a[j] < 0 ? ' gh' : ''}${on && P.b.s[j] ? ' sl' : ''}${!on && tails[j] === r ? ' tail' : ''}${P.d.kick[j] ? ' kk' : ''}" data-act="sbcell" data-v="${j}" data-o="${r}" data-sidx="${j}" aria-label="Step ${i + 1} ${nn(b + r)}${on ? ', on' : ''}"></button>`;
          }
        }
        g.style.gridTemplateRows = `repeat(${R.length}, minmax(0, 1fr))`; g.innerHTML = h;
      }
    } else {
      g.style.gridTemplateRows = '';
      g.innerHTML = `<div class="slist">${(fmText() + '\n' + poText()).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`;
    }
    const {slotOf} = poInfo(), po = [...new Set(slotOf[pk])];
    $('#snote').innerHTML = `<b>FM-1 SLOT ${SLOT[pk]}</b> · PO SLOT${po.length > 1 ? 'S' : ''} ${runs(po.sort((a, b) => a - b))} · ${P.desc}${pk === 'intro' ? ` · <b>SAME PATTERN AS ${sel === 'intro' ? 'OUTRO' : 'INTRO'}</b>` : ''}`;
    markSong();
  }

  /* ---------- buttons ---------- */
  const lockEdited = P => { if (P.lock) return false; P.lock = true; return true; };   // hand edits lock the pattern
  function copyText(txt, b, label){
    const fallback = () => {
      ui.songView = 'list'; render();
      const el = document.querySelector('#sgrid .slist');
      if (el){ const rg = document.createRange(); rg.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); }
      say('SELECT THE TEXT AND COPY IT');
    };
    try { navigator.clipboard.writeText(txt).then(() => { b.textContent = 'COPIED'; setTimeout(() => b.textContent = label, 1500); }, fallback); }
    catch(_){ fallback(); }
  }
  Object.assign(A, {
    ssec(v){ ui.songSec = v; ui.songPage = 0; if (songPlay) ui.songFollow = false; render(); },
    spage(v){ ui.songPage = +v; if (songPlay) ui.songFollow = false; render(); },
    sbuild(){
      const so = S.song, open = ['main','intro','rise','finish'].filter(k => !so.pat[k].lock);
      if (!open.length){ say('EVERY PATTERN IS LOCKED · UNLOCK ONE FIRST'); return; }
      build(); roll('sbuild'); sRolled = 'sbuild'; pushHistory(); render();
      say(open.length === 4 ? 'SONG BUILT FROM THE BEAT' : `REBUILT ${open.map(k => PNAME[k]).join(', ')}`);
    },
    sroll(){
      const pk = PAT[ui.songSec], so = S.song; if (so.pat[pk].lock) return;
      if (pk === 'main'){ so.pat.main = genMain(); so.src = sig(); }
      else so.pat[pk] = GEN[pk](so.pat.main);
      roll('sroll'); sRolled = 'sroll'; pushHistory(); render();
      say(pk === 'main' ? 'MAIN COPIED FROM THE BEAT · TAP BUILD TO REFIT THE REST' : `NEW ${PNAME[pk]} · ${so.pat[pk].desc}`);
    },
    slen(){ const sec = ui.songSec, L = [0, ...REPS], cur = S.song.reps[sec] || 0; S.song.reps[sec] = L[(L.indexOf(cur) + 1) % L.length] || null; touchHistory(); render(); },
    slock(){ const P = S.song.pat[PAT[ui.songSec]]; P.lock = !P.lock; touchHistory(); render(); say(P.lock ? `${PNAME[PAT[ui.songSec]]} LOCKED · BUILD AND NEW BEAT KEEP IT` : `${PNAME[PAT[ui.songSec]]} UNLOCKED`); },
    sloop(){ const sp = songPlay && playing ? songPlay : null; if (sp && sp.mode === 'loop' && PAT[sp.sec] === PAT[ui.songSec]){ stop(); return; } playSong('loop', ui.songSec); say(`LOOPING ${SNAME[ui.songSec]}`); },
    splay(){ if (songPlay && playing && songPlay.mode === 'song'){ stop(); return; } playSong('song'); say('PLAYING THE SONG'); },
    sview(){ const V = ['drums','bass','list']; ui.songView = V[(V.indexOf(ui.songView) + 1) % V.length]; render(); },
    scell(v, b){
      const P = S.song.pat[PAT[ui.songSec]], id = b.dataset.t, j = +v;
      P.d[id][j] = P.d[id][j] ? 0 : 1;
      if (P.d[id][j]){ try { audio(); VOICE[id](AC.currentTime + .01); } catch(_){} }
      const msg = lockEdited(P); touchHistory(); render(); if (msg) say(`${PNAME[PAT[ui.songSec]]} LOCKED · YOUR EDITS STAY`);
    },
    sbcell(v, b){
      const P = S.song.pat[PAT[ui.songSec]], j = +v, o = +b.dataset.o;
      if (P.b.n[j] === o){ P.b.n[j] = null; P.b.s[j] = 0; P.b.a[j] = 0; }
      else {
        P.b.n[j] = o; P.b.g[j] = 1; P.b.a[j] = 0; P.b.s[j] = 0;
        if (S.bass) try {                                     // preview through bass.js: one silent drum step plus this note
          audio(); const m = S.main, l = S.len, bb = S.bass;
          S.main = blank(1); S.len = 1; S.bass = Object.assign({}, bb, {n:[o], g:[1], a:[0], s:[0]});
          try { _ps(0, AC.currentTime + .01); } finally { S.main = m; S.len = l; S.bass = bb; }
        } catch(_){}
      }
      const msg = lockEdited(P); touchHistory(); render(); if (msg) say(`${PNAME[PAT[ui.songSec]]} LOCKED · YOUR EDITS STAY`);
    },
    sfm(v, b){ copyText(fmText(), b, 'FM-1 SONG'); },
    spo(v, b){ copyText(poText(), b, 'PO CHAIN'); },
    smidi(){
      try {
        const url = URL.createObjectURL(new Blob([songMidi()], {type:'audio/midi'})), a = document.createElement('a');
        a.href = url; a.download = `wopr-song-${S.genre}-${totalOf(tl()) / 16}bars.mid`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
        say('SONG MIDI SAVED · DRUMS CH 10 · BASS CH 1');
      } catch(_){ say('MIDI EXPORT FAILED IN THIS BROWSER'); }
    },
  });

  /* NEW BEAT, ROLL A SONG and STYLE rebuild the unlocked patterns (after bass.js has rolled its new line) */
  let needSong = false;
  const _gen = generate;   generate = function(){ needSong = true; try { _gen(); } finally { needSong = false; } };
  const _song = rollSong;  rollSong = function(){ needSong = true; try { _song(); } finally { needSong = false; } };
  const _push = pushHistory;
  pushHistory = function(){ const r = needSong; needSong = false; _push(); if (r && S.main && S.song){ build(); touchHistory(); } };

  const _rb = renderBar;
  renderBar = function(){ _rb(); if (songPlay && playing) $('#runStat').insertAdjacentHTML('beforeend', ` · <b>${songPlay.mode === 'song' ? 'SONG' : 'LOOP ' + SNAME[songPlay.sec]}</b>`); };

  /* ---------- build the tab ---------- */
  on('ready', () => {
    Object.assign(ui, {songSec:'intro', songPage:0, songView:'drums', songFollow:true});
    document.body.insertAdjacentHTML('beforeend', `<style>   /* after style.css and bass.js so these win */
      .navtabs{grid-template-columns:repeat(7,minmax(0,1fr))!important;gap:3px!important}
      .navtabs .btn{font-size:13px!important;letter-spacing:0!important;padding:0!important;overflow:hidden}
      @media (max-width:350px){.navtabs .btn{font-size:11px!important}}
      #sstrip{height:8cqh;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px}
      .sbtn{flex-direction:column;gap:0;line-height:.95;padding:0 2px;position:relative;overflow:hidden;font-size:clamp(13px,min(3.1cqh,5cqw),22px)}
      .sbtn small{font-size:.6em;letter-spacing:.06em;opacity:.75}
      .sbtn i{font-style:normal;font-size:clamp(9px,1.6cqh,12px);color:var(--amber);position:absolute;top:1px;right:3px}
      .sbtn.on i{color:var(--bg)}
      .sbtn.sph:not(.on){border-color:var(--amber);color:var(--amber)}
      .sbtn.sph.on{box-shadow:0 0 0 2px var(--amber)}
      #sgo{height:7.6cqh;display:flex;gap:6px}
      #sgo .big{flex:1 1 0;min-width:0;height:100%;gap:8px;padding:0 6px;color:inherit;font-size:clamp(16px,min(4.4cqh,5.4cqw),30px)}
      #sgo .big.on{background:var(--amber);border-color:var(--amber);color:var(--bg);text-shadow:none;box-shadow:0 0 14px rgba(255,178,46,.5)}
      #sgo .big .die{width:4.6cqh;height:4.6cqh}
      #sgo .ico{width:4.2cqh;height:4.2cqh;flex:none}
      #sgo .bigtxt{white-space:nowrap;min-width:0;overflow:hidden}
      #sgo .bigtxt small{font-variant-numeric:tabular-nums}
      #sctl .btn{padding:0 2px;gap:.3em;font-size:clamp(12px,min(2.8cqh,4.2cqw),20px)}
      #sctl .die{width:.9em;height:.9em}
      #spages .btn.sph:not(.on){border-color:var(--amber);color:var(--amber)}
      #sgrid{flex:1 1 auto;min-height:0;display:grid;gap:2px}
      #sgrid.drums{grid-template-columns:48px repeat(16,minmax(0,1fr));grid-template-rows:repeat(5,minmax(0,1fr));gap:.8cqh 2px}
      #sgrid.bass{grid-template-columns:40px repeat(16,minmax(0,1fr))}
      #sgrid.list{display:block;overflow-y:auto;overscroll-behavior:contain;border:1px solid var(--line);background:var(--panel)}
      .slab{font-family:var(--f-display);font-size:clamp(11px,2.3cqh,16px);color:var(--dim);display:flex;align-items:center;line-height:1;white-space:nowrap;min-height:0}
      .scell{border:1px solid var(--line);background:var(--faint);border-radius:2px;padding:0;min-width:0;min-height:0;cursor:pointer}
      .scell.q{margin-left:3px}
      .scell.on{background:var(--fg);border-color:var(--fg);box-shadow:0 0 6px var(--glow)}
      .scell.sph{outline:2px solid var(--amber);outline-offset:-1px}
      .scell.on.sph{background:var(--amber);border-color:var(--amber)}
      #sgrid .bc.sph{border-color:var(--amber)} #sgrid .bc.on.sph{background:var(--amber);border-color:var(--amber)}
      .slist{margin:0;padding:8px;white-space:pre-wrap;font-size:11.5px;line-height:1.35;color:#9dffb8;-webkit-user-select:text;user-select:text;font-variant-numeric:tabular-nums}
      #snote{height:5.6cqh}
      #sexp .btn{padding:0 2px}
    </style>`);
    document.querySelector('#tab-perform').insertAdjacentHTML('afterend', `
      <section id="tab-song" class="tab" hidden>
        <p class="console" id="sHead">&gt; SONG</p>
        <div id="sstrip" aria-label="Song sections"></div>
        <div id="sgo"></div>
        <div class="row" id="sctl"></div>
        <div class="pages" id="spages"></div>
        <div id="sgrid" class="drums" aria-label="This section's pattern"></div>
        <p class="note" id="snote"></p>
        <div class="row" id="sexp">
          <button class="btn" data-act="sfm">FM-1 SONG</button>
          <button class="btn" data-act="spo">PO CHAIN</button>
          <button class="btn" data-act="smidi">SONG MIDI</button>
        </div>
      </section>`);
    const nb = document.querySelector('.navtabs [data-v="bass"]') || document.querySelector('.navtabs [data-v="perform"]');
    nb.insertAdjacentHTML('afterend', '<button class="btn" data-act="tab" data-v="song">SONG</button>');
    document.querySelector('#tab-guide section:last-of-type').insertAdjacentHTML('afterend', `
      <section><h2>SONG TAB</h2><p>The SONG tab turns your beat into a whole song: INTRO, RISE, MAIN, OUTRO, FINISH, with drums and bass in each. MAIN is your beat and bass exactly as they are. INTRO strips MAIN down the way the style would (big beat keeps kick and hats, junkyard keeps the metal, and so on). RISE rolls a snare or metal build that gets faster while the bass climbs, sometimes with a short gap before MAIN. FINISH is one bar: a big hit or a few stabs, with the bass holding the root. INTRO and OUTRO are the same pattern, so you only program it once. BUILD makes every unlocked pattern again from the beat. NEW BEAT, ROLL A SONG and STYLE rebuild them too; smaller changes to the beat show BEAT CHANGED until you tap BUILD.</p></section>
      <section><h2>SONG SECTIONS</h2><p>Tap a section in the strip to see it. Each shows its FM-1 slot and length. LEN AUTO picks the length from the style (about a minute in total); tap LEN to set how many times that section repeats, or back to AUTO. LOCK keeps a pattern through BUILD and NEW BEAT; editing a pattern by hand locks it for you. LOOP plays only that section, over and over. ROLL makes a new version of that section; on MAIN it is COPY, which copies the beat in again. VIEW switches between DRUMS, BASS and LIST. Tap the grid to edit, the same way as on the other tabs. PLAY SONG plays it all once and stops after the FINISH; the strip and grid follow along until you tap a section.</p></section>
      <section><h2>SONG LENGTHS</h2><p>MAIN is as long as your beat (STEPS). INTRO/OUTRO and RISE are up to 2 bars and FINISH is 1 bar, so the whole song needs at most 13 PO slots. Repeats make the sections longer.</p></section>
      <section><h2>SONG OUT</h2><p>FM-1 SONG copies the SONG page entries (section, slot, repeats) plus the bass notes for slots A to D: A = MAIN, B = INTRO/OUTRO, C = RISE, D = FINISH. One repeat is one play of that slot's whole pattern. PO CHAIN copies which PO slot gets which bar, programmed fullest first so later slots are a copy and a few changes, then the chain order and every slot's steps. PO chains hold up to 128 patterns. SONG MIDI saves the whole song as one .mid file: drums on channel 10, bass on channel 1. LIST shows the same text on screen.</p></section>`);
    if (!S.song){ build(); touchHistory(); }
  });
  on('render', () => {
    if (!S.main) return;
    if (!S.song || !S.song.pat || !S.song.pat.main){ S.song = null; build(); touchHistory(); }
    else if (S.bass && S.song.sc !== S.bass.sc){            // SCALE changed on the BASS tab: move song notes into the new scale
      Object.values(S.song.pat).forEach(P => { P.b.n = P.b.n.map(o => has(o) ? inKey(o) : null); });
      S.song.sc = S.bass.sc; touchHistory();
    }
    renderSong();
  });
})();
