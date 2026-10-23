/* WOPR Beat Machine · patch: bass generator
   Adds a BASS tab with a one-note-at-a-time bass line (like a mono synth or the M-VAVE FM-1 playing one part).
   - The line matches the STYLE: acid lines for BIG BEAT, EBM sequences for INDUSTRIAL, root 8ths for PUNK,
     kick-locked syncopation and octave pops for FUNK, sparse odd intervals for IDM and JUNKYARD.
   - It follows the kick of each pattern, so MOVES, SPICES and TWEAK on the drums re-shape it.
   - Its sound follows the KIT (three bass tones per style), or pick one with TONE.
   - NEW BEAT and ROLL A SONG roll a new bass too, unless the bass is LOCKed.
   Data lives in S.bass (saved with the beat by history.js). Notes are stored as semitones from the key's root.
   All files share one global scope: anything defined in an earlier file can be used here. */
(() => {
  /* ---------- music helpers ---------- */
  const NOTE = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const nn = m => NOTE[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);   // MIDI 60 = C4
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const SCALES = {
    MINOR:[0,2,3,5,7,8,10], DORIAN:[0,2,3,5,7,9,10], PHRYG:[0,1,3,5,7,8,10], PENTA:[0,3,5,7,10],
    MAJOR:[0,2,4,5,7,9,11], MIXO:[0,2,4,5,7,9,10], HIJAZ:[0,1,4,5,7,8,10],
  };
  const SC_NAME = {MINOR:'MINOR', DORIAN:'DORIAN', PHRYG:'PHRYGIAN', PENTA:'MINOR PENTATONIC', MAJOR:'MAJOR', MIXO:'MIXOLYDIAN', HIJAZ:'PHRYGIAN DOMINANT'};
  const LO = -5, HI = 12;                                   // the grid: a 4th below the root up to the octave
  const fold = x => { while (x > HI) x -= 12; while (x < LO) x += 12; return x; };
  function snapS(x, sc){
    const s = SCALES[sc] || SCALES.MINOR; let best = 0, bd = 99;
    for (let o = -2; o <= 2; o++) for (const v of s){ const c = v + o * 12, d = Math.abs(c - x); if (d < bd){ bd = d; best = c; } }
    return best;
  }
  const inKey = (x, sc) => fold(snapS(x, sc));
  const rows = sc => { const r = []; for (let x = HI; x >= LO; x--) if (snapS(x, sc) === x) r.push(x); return r; };
  const base = B => 28 + ((B.key - 4 + 12) % 12) + 12 * (B.oct || 0);   // root: E1 to D#2 at OCT 1
  const one = a => a[Math.floor(rnd() * a.length)];
  const wpick = (list, r) => { const tot = list.reduce((s, x) => s + x[1], 0); let v = r * tot; for (const [x, w] of list){ v -= w; if (v <= 0) return x; } return list[list.length - 1][0]; };
  const seeded = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const WILD = [1, 6, 8, 11, 13, -1, -6, 15];

  /* ---------- how each style plays bass ----------
     hit(i, kick, chaos, mode): chance of a note on step i. iv: intervals (semitones, snapped to the scale) with weights.
     prog: root movement across patterns. half: the root moves every 8 steps (punk). */
  const BS = {
    bigbeat: {style:'ACID', scales:['MINOR','PHRYG','DORIAN'], prog:[[0,0,0,0],[0,0,-2,-2],[0,0,5,-2],[0,3,0,-2]],
      iv:[[0,40],[12,15],[3,12],[7,12],[10,10],[5,6],[1,4]], acc:.3, slide:.22, kickRoot:true,
      gate:[[1,80],[2,12],[.5,8]],
      hit:(i, k) => i === 0 ? 1 : k ? .6 : i % 4 === 2 ? .55 : i % 2 ? .45 : .5},
    idm: {style:'GLITCH', scales:['DORIAN','MINOR','PHRYG'], prog:[[0,0,0,0],[0,-4,0,3],[0,5,-2,0],[0,1,0,-5]],
      iv:[[0,25],[12,12],[7,12],[3,10],[10,10],[2,8],[-5,8],[15,5],[5,6],[1,4]], acc:.25, slide:.12,
      gate:[[1,45],[.5,25],[2,15],[3,15]],
      hit:(i, k) => k ? .55 : i % 3 === 0 ? .38 : .25},
    industrial: {style:'EBM', scales:['PHRYG','MINOR'], prog:[[0,0,0,0],[0,0,-4,-2],[0,0,1,0],[0,-2,-4,-2]],
      iv:[[0,70],[12,14],[7,6],[3,5],[1,5]], acc:.2, slide:.03, modes:['16','OFF','8TH','GAL'],
      gate:[[1,85],[.5,15]], oct:(i, r) => i % 4 === 2 && r > .65,
      hit:(i, k, c, m) => m === '16' ? .95 : m === 'OFF' ? (k ? .05 : .92) : m === '8TH' ? (i % 4 === 2 ? .995 : .05) : (i % 4 >= 2 ? .95 : i % 4 === 0 && k ? .5 : .05)},
    junk: {style:'SCRAP', scales:['HIJAZ','PHRYG'], prog:[[0,0,0,0],[0,1,0,1],[0,0,6,0],[0,1,-2,0]],
      iv:[[0,40],[1,12],[6,10],[12,10],[7,10],[-6,6],[13,6]], acc:.35, slide:.15, kickRoot:true,
      gate:[[1,30],[2,30],[3,20],[4,20]],
      hit:(i, k) => k ? .7 : i % 3 === 2 ? .25 : .1},
    punk: {style:'DRIVE', scales:['MAJOR','MIXO','MINOR'], prog:[[0,5,7,5],[0,-2,5,0],[0,0,5,7],[0,7,-2,5],[0,3,5,-2]], half:true,
      iv:[[0,85],[12,8],[7,7]], acc:0, beatAcc:true, slide:0,
      gate:[[1,100]],
      hit:(i) => i % 2 === 0 ? .97 : .03},
    funk: {style:'SLAP', scales:['DORIAN','PENTA','MINOR'], prog:[[0,0,0,0],[0,0,5,5],[0,5,0,5],[0,0,0,-2]],
      iv:[[0,45],[12,22],[7,10],[10,10],[3,8],[5,5]], acc:.25, ghost:.22, slide:.05, kickRoot:true,
      gate:[[1,60],[.5,30],[2,10]], oct:(i, r) => i % 2 === 1 && r > .55,
      hit:(i, k) => i === 0 ? 1 : k ? .85 : i % 2 ? .35 : .28},
  };

  /* ---------- bass sounds: three per style, in the same order as that style's kits ----------
     w wave, det detune (two oscillators), sub sine an octave down, cut/env/q/fdec filter, dec pluck decay,
     drop pitch thump, fm {r ratio, idx depth, dec}, drive/crush like the kits, v level. */
  const TONES = {
    bigbeat:   [{name:'808', w:'sine', cut:3000, drive:.35, drop:.6, dropDec:.04, dec:.9, v:.9},
                {name:'REESE', w:'sawtooth', det:14, sub:.4, cut:380, env:2, q:2, fdec:.25, drive:.25, v:.55},
                {name:'ACID', w:'sawtooth', cut:260, env:9, q:13, fdec:.18, drive:.3, v:.5}],
    idm:       [{name:'BLIP', w:'sine', fm:{r:2, idx:4, dec:.12}, cut:5000, dec:.25, v:.7},
                {name:'PLUCK', w:'triangle', sub:.5, cut:2500, env:1, fdec:.1, dec:.3, drop:.15, dropDec:.03, v:.8},
                {name:'CRUSH', w:'square', cut:900, env:3, q:4, fdec:.12, crush:4, v:.4}],
    industrial:[{name:'GRIND', w:'sawtooth', det:9, cut:500, env:4, q:6, fdec:.15, drive:.8, v:.45},
                {name:'EBM', w:'sawtooth', sub:.3, cut:350, env:6, q:8, fdec:.1, dec:.22, v:.55},
                {name:'PULSE', w:'square', cut:700, env:3, q:5, fdec:.12, drive:.5, v:.4}],
    junk:      [{name:'METAL', w:'sine', fm:{r:1.41, idx:6, dec:.4}, cut:3000, dec:.6, v:.6},
                {name:'PIPE', w:'triangle', fm:{r:3, idx:2, dec:.3}, cut:4000, dec:.8, v:.7},
                {name:'THUMP', w:'sine', drop:1, dropDec:.05, cut:3000, dec:.5, drive:.4, v:.95}],
    punk:      [{name:'PICK', w:'sawtooth', sub:.3, cut:900, env:2.5, q:1, fdec:.08, dec:.45, drive:.2, v:.5},
                {name:'FUZZ', w:'sawtooth', det:6, sub:.35, cut:1200, env:1, q:1, fdec:.1, drive:.9, v:.4},
                {name:'GRIT', w:'square', cut:1000, env:2, q:2, fdec:.08, crush:5, drive:.4, v:.38}],
    funk:      [{name:'SLAP', w:'square', sub:.45, cut:500, env:10, q:6, fdec:.06, dec:.35, v:.5},
                {name:'DISCO', w:'sawtooth', sub:.3, cut:600, env:5, q:4, fdec:.09, dec:.28, v:.5},
                {name:'ZAP', w:'square', sub:.8, cut:450, env:2, q:3, fdec:.15, drive:.15, v:.45}],
  };
  const toneOf = B => { const t = TONES[B.genre] || TONES.bigbeat; return t[B.tone >= 0 ? B.tone % 3 : (S.genre === B.genre ? (S.kit || 0) % 3 : 0)]; };

  /* ---------- generating ---------- */
  const sig = p => (S.main ? S.main.kick.slice(p * 16, p * 16 + 16).join('') : '') + '|' + (S.roles[p] || '');
  function rootOf(B, p, i){
    const G = BS[B.genre], k = G.half ? p * 2 + (i >= 8 ? 1 : 0) : p;
    return B.prog[k % B.prog.length];
  }
  function genPageInto(p){
    const B = S.bass, G = BS[B.genre], c = B.c, lo = p * 16, role = S.roles[p] || '';
    const K = S.main ? S.main.kick.slice(lo, lo + 16) : Array(16).fill(0);
    const r = seeded(B.seed + p * 7919);
    let prevOn = false;
    for (let i = 0; i < 16; i++){
      const alt = [r(), r(), r(), r(), r(), r(), r()];      // always drawn, so later pages stay the same when re-rolled
      const d = p > 0 && alt[6] < c * .25 ? alt : B.R[i];  // later patterns vary only above DEFCON 5
      const k = K[i];
      let ph = G.hit(i, k, c, B.mode);
      ph = Math.min(1, ph * (1 - .3 * c) + c * .25);
      let on = d[0] < ph, iv = wpick(G.iv, d[1]), gate = wpick(G.gate, d[4]);
      if (G.kickRoot && k && d[1] < .55) iv = 0;
      if (G.oct && G.oct(i, d[1])) iv = 12;
      if (d[5] < c * .35) iv = WILD[Math.floor(d[5] / (c * .35) * WILD.length) % WILD.length];
      const anchor = i === 0 || (G.half && i === 8);
      if (anchor && c < .75){ on = true; iv = 0; }
      let acc = G.beatAcc ? (i % 4 === 0 ? 1 : 0) : d[2] < G.acc ? 1 : (G.ghost && d[2] > 1 - G.ghost ? -1 : 0);
      if (acc < 0) gate = .5;
      if (anchor && c < .75 && acc < 0){ acc = 0; gate = 1; }   // the downbeat is never a ghost note
      let sl = G.slide && d[3] < G.slide && prevOn && !anchor ? 1 : 0;
      /* song roles shape the bass the way they shape the drums */
      if (role === 'STRIP'){ on = on && i % 8 === 0; iv = 0; gate = 4; sl = 0; }
      else if (role === 'BREAK'){ on = i === 0 || i === 8; iv = 0; gate = 4; sl = 0; acc = 0; }
      else if (role === 'GAP' && i >= 12) on = false;
      else if (role === 'STOP'){ on = on && (k || i === 0); gate = .5; sl = 0; }
      else if (role === 'DROP' && i === 0){ on = true; iv = 0; acc = 1; }
      const j = lo + i;
      B.n[j] = on ? inKey(rootOf(B, p, i) + iv, B.sc) : null;
      B.g[j] = gate; B.a[j] = on ? acc : 0; B.s[j] = on ? sl : 0;
      prevOn = on;
    }
    B.sig[p] = sig(p); B.ed[p] = 0;
  }
  function genBass(){
    const old = S.bass || {}, G = BS[S.genre];
    const B = {genre:S.genre, key:old.key ?? 4, oct:old.oct ?? 0, scale:old.scale || 'AUTO', lv:old.lv ?? 1,
               tone:old.genre === S.genre ? (old.tone ?? -1) : -1};
    B.sc = B.scale === 'AUTO' ? one(G.scales) : B.scale;
    B.prog = one(G.prog); B.mode = G.modes ? one(G.modes) : ''; B.c = chaos(); B.seed = Math.floor(rnd() * 1e9);
    B.R = Array.from({length:16}, () => Array.from({length:7}, () => Math.round(rnd() * 1000) / 1000));
    B.n = []; B.g = []; B.a = []; B.s = []; B.ed = []; B.sig = [];
    S.bass = B;
    for (let p = 0; p < S.len / 16; p++) genPageInto(p);
  }
  function fitBass(){
    const B = S.bass; if (!B) return;
    const L = S.len;
    ['n','g','a','s'].forEach(k => { if (B[k].length > L) B[k].length = L; });
    ['ed','sig'].forEach(k => { if (B[k].length > L / 16) B[k].length = L / 16; });
    for (let p = Math.floor(B.n.length / 16); p < L / 16; p++) genPageInto(p);
  }
  function refreshBass(){     // re-fit pages whose kick or role changed, unless you edited that page's bass
    const B = S.bass; if (!B) return;
    for (let p = 0; p < S.len / 16; p++) if (!B.ed[p] && B.sig[p] !== sig(p)) genPageInto(p);
  }

  /* hook into the beat: NEW BEAT and ROLL A SONG roll a new bass; other changes re-fit it */
  let needRoll = false;
  const _gen = generate;     generate = function(){ needRoll = true; try { _gen(); } finally { needRoll = false; } };
  const _song = rollSong;    rollSong = function(){ needRoll = true; try { _song(); } finally { needRoll = false; } };
  const _setLen = setLen;    setLen = function(n, exact){ _setLen(n, exact); fitBass(); };
  const _push = pushHistory;
  pushHistory = function(){
    if (S.main){
      if (needRoll && (!S.bass || !S.locks.bass)) genBass();
      else if (S.bass){ fitBass(); if (!S.locks.bass) refreshBass(); }
      needRoll = false;
    }
    _push();
  };

  /* ---------- the bass synth (one voice: a new note cuts the last, a slide glides it) ---------- */
  let bv = null;
  function stopAt(v, t){ v.oscs.forEach(x => { try { x.o.stop(t); } catch(_){} }); }
  function bassPlay(m, t, dur, acc, slide){
    const B = S.bass, T = toneOf(B), f = mtof(m) * (fxPm || 1);
    const vel = (acc > 0 ? 1.3 : acc < 0 ? .45 : 1) * (fxLv || 1) * (B.lv ?? 1), v = (T.v || .5) * vel * .9, end = t + dur;
    if (slide && bv && bv.end > t + .001){                 // glide the sounding note to the new pitch
      bv.oscs.forEach(x => { hold(x.o.frequency, t); x.o.frequency.setTargetAtTime(f * x.mul, t, .03); });
      const G = bv.g.gain; hold(G, t); G.setTargetAtTime(v, t, .01);
      if (T.dec) G.setTargetAtTime(0, t + .03, T.dec / 3);
      G.setTargetAtTime(0, end, .012); stopAt(bv, end + .08); bv.end = end;
      return;
    }
    if (bv && bv.end > t){ hold(bv.g.gain, t); bv.g.gain.setTargetAtTime(0, t, .005); stopAt(bv, t + .05); }
    const out = T.drive || T.crush ? shaper(T.drive || 0, T.crush || 0) : master;
    const g = AC.createGain(), flt = AC.createBiquadFilter(), oscs = [];
    flt.type = 'lowpass'; flt.Q.value = T.q || 0;
    const cut = T.cut || 8000, pk = Math.min(16000, cut * (1 + (T.env || 0) * (acc > 0 ? 1.7 : 1)));
    flt.frequency.setValueAtTime(pk, t);
    if (T.env) flt.frequency.setTargetAtTime(cut, t + .003, (T.fdec || .1) / 3);
    flt.connect(g); g.connect(out);
    const mk = (type, mul, det, lvl, dest) => {
      const o = AC.createOscillator(), og = AC.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f * mul * (1 + (T.drop || 0)), t);
      if (T.drop) o.frequency.exponentialRampToValueAtTime(f * mul, t + (T.dropDec || .05));
      if (det) o.detune.value = det;
      og.gain.value = lvl; o.connect(og); og.connect(dest); o.start(t); oscs.push({o, mul});
      return o;
    };
    if (T.det){ mk(T.w, 1, -T.det, .5, flt); mk(T.w, 1, T.det, .5, flt); }
    else {
      const c = mk(T.w, 1, 0, 1, flt);
      if (T.fm){
        const mo = AC.createOscillator(), mg = AC.createGain(), mf = f * T.fm.r;
        mo.frequency.setValueAtTime(mf, t);
        mg.gain.setValueAtTime(T.fm.idx * mf * (acc > 0 ? 1.4 : 1), t); mg.gain.setTargetAtTime(mf * .05, t, T.fm.dec / 3);
        mo.connect(mg); mg.connect(c.frequency); mo.start(t); oscs.push({o:mo, mul:T.fm.r});
      }
    }
    if (T.sub) mk('sine', .5, 0, T.sub, g);                 // sub skips the filter
    const G = g.gain;
    G.setValueAtTime(0, t); G.linearRampToValueAtTime(v, t + .004);
    if (T.dec) G.setTargetAtTime(0, t + .004, T.dec / 3);
    G.setTargetAtTime(0, end, .012);
    bv = {g, oscs, end};
    stopAt(bv, end + .08);
  }
  function bassStep(idx, t){
    const B = S.bass; if (!B || B.n.length !== S.len) return;
    const o = B.n[idx]; if (o === null || o === undefined) return;
    const d = stepDur(), nx = (idx + 1) % S.len, g = B.g[idx] || 1;
    let dur = g * d * .92;
    if (g <= 1 && B.n[nx] !== null && B.n[nx] !== undefined && B.s[nx]) dur = d * 1.05;   // legato into a slide
    bassPlay(base(B) + o, t, dur, B.a[idx], !!B.s[idx]);
  }
  const _ps = playStep;
  playStep = function(idx, t){
    const drumSolo = IDS.some(id => ui.solo[id]), bh = ui.bassHear || 'mix';
    if (bh !== 'solo' || drumSolo || ui.poSolo) _ps(idx, t);
    if (!S.bass || bh === 'mute' || ui.poSolo || (drumSolo && bh !== 'solo')) return;
    try { bassStep(idx, t); } catch(err){ console.error('[WOPR bass]', err); }
  };
  function previewNote(o){ try { audio(); bassPlay(base(S.bass) + o, AC.currentTime + .01, .3, 0, false); } catch(_){} }

  /* ---------- text and MIDI for the FM-1 ---------- */
  function noteTxt(B, j){
    const nxt = j + 1 < B.n.length ? j + 1 : -1;
    return nn(base(B) + B.n[j]) + (B.a[j] > 0 ? '!' : '') + (B.a[j] < 0 ? '(soft)' : '')
      + (B.g[j] > 1 ? ' ×' + B.g[j] : '') + (nxt >= 0 && B.s[nxt] && B.n[nxt] !== null ? '~' : '');
  }
  function pageNotes(B, p){
    const r = [];
    for (let i = 0; i < 16; i++){ const j = p * 16 + i; if (B.n[j] !== null && B.n[j] !== undefined) r.push(`${i + 1} ${noteTxt(B, j)}`); }
    return r;
  }
  function bassText(){
    const B = S.bass;
    let s = `WOPR BASS · ${GENRES[B.genre].name} · ${NOTE[B.key]} ${SC_NAME[B.sc]} · ${toneOf(B).name} · ${S.tempo} BPM · ${S.len} STEPS\n`
      + `Step number, then note (MIDI 60 = C4). ! accent · (soft) ghost note · ×2 hold 2 steps · ~ slide into the next note\n`;
    for (let p = 0; p < S.len / 16; p++){
      const rt = NOTE[(B.key + rootOf(B, p, 0) + 120) % 12];
      s += `\nPATTERN ${p + 1}${roleTxt(p).toUpperCase()} · ROOT ${rt}\n${pageNotes(B, p).join('  ') || 'REST'}\n`;
    }
    return s;
  }
  function bassMidi(){
    const B = S.bass, st = 24, ev = [], b = base(B);
    for (let i = 0; i < S.len; i++){
      if (B.n[i] === null || B.n[i] === undefined) continue;
      const nx = (i + 1) % S.len, glide = B.s[nx] && B.n[nx] !== null && B.n[nx] !== B.n[i];
      const len = glide ? st + 3 : Math.max(6, Math.round((B.g[i] || 1) * st * .9));
      const note = b + B.n[i], vel = B.a[i] > 0 ? 120 : B.a[i] < 0 ? 50 : 96;
      ev.push({tick:i * st, on:1, note, vel}, {tick:Math.min(i * st + len, S.len * st), on:0, note});
    }
    ev.sort((a, c) => a.tick - c.tick || a.on - c.on);
    const mpq = Math.round(60000000 / S.tempo);
    const trk = [0, 0xFF, 0x51, 3, (mpq >> 16) & 255, (mpq >> 8) & 255, mpq & 255];
    let last = 0;
    ev.forEach(e => { trk.push(...vlq(e.tick - last), e.on ? 0x90 : 0x80, e.note, e.on ? e.vel : 0); last = e.tick; });
    trk.push(...vlq(Math.max(0, S.len * st - last)), 0xFF, 0x2F, 0);
    const n = trk.length;
    return new Uint8Array([0x4D,0x54,0x68,0x64, 0,0,0,6, 0,0, 0,1, 0,96, 0x4D,0x54,0x72,0x6B, (n>>>24)&255,(n>>16)&255,(n>>8)&255,n&255, ...trk]);
  }

  /* ---------- screen ---------- */
  const LV = [.5, .75, 1, 1.25, 1.5];
  function renderBass(){
    const B = S.bass, sec = $('#tab-bass'); if (!B || !sec) return;
    sec.hidden = ui.tab !== 'bass';
    const T = toneOf(B), hear = ui.bassHear || 'mix';
    $('#bHead').textContent = `> BASS · ${NOTE[B.key]} ${SC_NAME[B.sc]} · ${BS[B.genre].style}${B.mode ? ' ' + B.mode : ''} · FOLLOWS THE KICK`;
    $('#bset').innerHTML =
        `<button class="btn cyc" data-act="bkey" aria-label="Key ${NOTE[B.key]}, tap for the next key"><small>KEY</small>${NOTE[B.key]}</button>`
      + `<button class="btn cyc w-sc" data-act="bscale" aria-label="Scale ${SC_NAME[B.sc]}${B.scale === 'AUTO' ? ', picked by the style' : ''}, tap to change"><small>SCALE${B.scale === 'AUTO' ? ' AUTO' : ''}</small>${B.sc}</button>`
      + `<button class="btn cyc w-tone" data-act="btone" aria-label="Tone ${T.name}${B.tone < 0 ? ', following the kit' : ''}, tap to change"><small>TONE${B.tone < 0 ? ' AUTO' : ''}</small>${T.name}</button>`
      + `<button class="btn cyc" data-act="blv" aria-label="Bass level ${Math.round((B.lv ?? 1) * 100)} percent"><small>LEVEL</small>${Math.round((B.lv ?? 1) * 100)}%</button>`
      + `<button class="btn cyc${hear !== 'mix' ? ' on' : ''}" data-act="bhear" aria-label="Hear bass ${hear}, tap to change"><small>HEAR</small>${hear.toUpperCase()}</button>`;
    const rolled = ui.rolled; ui.rolled = bRolled;
    $('#bgen').innerHTML = dieSVG('bgen') + `<span class="bigtxt">ROLL BASS<small>MATCHES ${GENRES[B.genre].name} + THE KICK</small></span>`;
    const pt = pageTabs(); $('#pagesB').innerHTML = pt; $('#pagesB').hidden = !pt;
    const R = rows(B.sc), off = ui.page * 16, b = base(B), K = S.main.kick;
    const tails = {};
    for (let i = 0; i < 16; i++){
      const j = off + i, o = B.n[j];
      if (o === null || o === undefined) continue;
      for (let k = 1; k < Math.ceil(B.g[j] || 1) && i + k < 16; k++){ const jj = j + k; if (B.n[jj] !== null && B.n[jj] !== undefined) break; tails[jj] = o; }
    }
    let h = '';
    for (const r of R){
      const root = r % 12 === 0;
      h += `<div class="bl${root ? ' root' : ''}">${nn(b + r)}</div>`;
      for (let i = 0; i < 16; i++){
        const j = off + i, on = B.n[j] === r;
        const cls = 'bc' + (root ? ' root' : '') + (i % 4 === 0 && i ? ' q' : '') + (on ? ' on' : '') + (on && B.a[j] > 0 ? ' acc' : '') + (on && B.a[j] < 0 ? ' gh' : '')
          + (on && B.s[j] ? ' sl' : '') + (!on && tails[j] === r ? ' tail' : '') + (K[j] ? ' kk' : '');
        h += `<button class="${cls}" data-act="bcell" data-v="${j}" data-o="${r}" data-idx="${j}" aria-label="Step ${i + 1} ${nn(b + r)}${on ? ', on' : ''}"></button>`;
      }
    }
    const grid = $('#bgrid'); grid.style.gridTemplateRows = `repeat(${R.length}, minmax(0, 1fr))`; grid.innerHTML = h;
    const notes = pageNotes(B, ui.page);
    $('#bnotes').innerHTML = `<b>PAT ${ui.page + 1}</b> ` + (notes.length ? notes.join(' · ') : 'NO NOTES · TAP THE GRID TO ADD');
    $('#bact').innerHTML =
        `<button class="btn" data-act="btweak" aria-label="Tweak a few bass notes on pattern ${ui.page + 1}">${dieSVG('btweak')}TWEAK</button>`
      + `<button class="btn" data-act="boct" data-v="-1"${(B.oct || 0) <= -1 ? ' disabled' : ''} aria-label="Octave down">OCT▼</button>`
      + `<button class="btn" data-act="boct" data-v="1"${(B.oct || 0) >= 2 ? ' disabled' : ''} aria-label="Octave up">OCT▲</button>`
      + `<button class="btn${S.locks.bass ? ' on' : ''}" data-act="block" aria-pressed="${!!S.locks.bass}" aria-label="Lock the bass so NEW BEAT keeps it">LOCK</button>`
      + `<button class="btn" data-act="bclr" aria-label="Clear the bass on pattern ${ui.page + 1}">CLR</button>`;
    ui.rolled = rolled; bRolled = null;
  }
  let bRolled = null;
  const say = t => { const h = $('#bHead'); if (h) h.textContent = '> ' + t; };

  /* ---------- buttons ---------- */
  const edited = () => { S.bass.ed[ui.page] = 1; };
  Object.assign(A, {
    bgen(){ genBass(); roll('bgen'); bRolled = 'bgen'; pushHistory(); say('NEW BASS LINE'); render(); },
    btweak(){
      const B = S.bass, p = ui.page, lo = p * 16, G = BS[B.genre], cnt = 2 + Math.round(chaos() * 3);
      let done = 0, tries = 0;
      while (done < cnt && tries < 80){
        tries++;
        const i = Math.floor(rnd() * 16), j = lo + i, nv = inKey(rootOf(B, p, i) + wpick(G.iv, rnd()), B.sc);
        if (B.n[j] === null || B.n[j] === undefined){ if (rnd() < .6){ B.n[j] = nv; B.g[j] = 1; B.a[j] = 0; B.s[j] = 0; done++; } }
        else if (i === 0) continue;
        else if (rnd() < .4){ B.n[j] = null; B.s[j] = 0; done++; }
        else if (nv !== B.n[j]){ B.n[j] = nv; done++; }
      }
      edited(); roll('btweak'); bRolled = 'btweak'; pushHistory(); render();
    },
    bcell(v, b){
      const B = S.bass, j = +v, o = +b.dataset.o;
      if (B.n[j] === o){ B.n[j] = null; B.s[j] = 0; B.a[j] = 0; }
      else { B.n[j] = o; B.g[j] = 1; B.a[j] = 0; B.s[j] = 0; previewNote(o); }
      edited(); touchHistory(); render();
    },
    bkey(){ S.bass.key = (S.bass.key + 1) % 12; touchHistory(); previewNote(0); render(); },
    bscale(){
      const B = S.bass, L = ['AUTO', ...Object.keys(SCALES)], nxt = L[(L.indexOf(B.scale) + 1) % L.length];
      B.scale = nxt; B.sc = nxt === 'AUTO' ? one(BS[B.genre].scales) : nxt;
      B.n = B.n.map(o => o === null || o === undefined ? null : inKey(o, B.sc));
      touchHistory(); render();
    },
    btone(){ const B = S.bass; B.tone = B.tone >= 2 ? -1 : B.tone + 1; touchHistory(); previewNote(0); render(); },
    blv(){ const B = S.bass; B.lv = LV[(LV.indexOf(B.lv ?? 1) + 1) % LV.length]; touchHistory(); render(); },
    bhear(){ const H3 = ['mix','solo','mute']; ui.bassHear = H3[(H3.indexOf(ui.bassHear || 'mix') + 1) % 3]; render(); },
    boct(v){ const B = S.bass; B.oct = Math.max(-1, Math.min(2, (B.oct || 0) + (+v))); touchHistory(); previewNote(0); render(); },
    block(){ S.locks.bass = !S.locks.bass; say(S.locks.bass ? 'BASS LOCKED · NEW BEAT KEEPS IT' : 'BASS UNLOCKED'); render(); },
    bclr(){ const B = S.bass, lo = ui.page * 16; for (let j = lo; j < lo + 16; j++){ B.n[j] = null; B.s[j] = 0; B.a[j] = 0; } edited(); touchHistory(); render(); },
    bcopy(v, b){
      const txt = bassText();
      const fallback = () => { const out = $('#bOut'); out.hidden = false; out.value = txt; out.focus(); out.select(); say('SELECT THE TEXT AND COPY IT'); };
      try { navigator.clipboard.writeText(txt).then(() => { b.textContent = 'COPIED'; setTimeout(() => b.textContent = 'COPY NOTES', 1500); }, fallback); }
      catch(_){ fallback(); }
    },
    bmidi(){
      try {
        const url = URL.createObjectURL(new Blob([bassMidi()], {type:'audio/midi'})), a = document.createElement('a');
        a.href = url; a.download = `wopr-bass-${S.bass.genre}-${NOTE[S.bass.key].replace('#', 's')}-${S.len}steps.mid`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
        say('BASS MIDI SAVED · CHANNEL 1');
      } catch(_){ say('MIDI EXPORT FAILED IN THIS BROWSER'); }
    },
  });

  /* status line under play shows when the bass is soloed or muted */
  const _rb = renderBar;
  renderBar = function(){ _rb(); const h = ui.bassHear; if (h && h !== 'mix') $('#runStat').insertAdjacentHTML('beforeend', ` · <b>BASS ${h.toUpperCase()}</b>`); };

  /* ---------- build the tab ---------- */
  on('ready', () => {
    document.body.insertAdjacentHTML('beforeend', `<style>   /* after style.css so these win */
      .navtabs{grid-template-columns:repeat(6,1fr)!important}
      .navtabs .btn{font-size:14px!important}
      #bset .btn{flex:.8 1 0;font-size:clamp(12px,2.8cqh,20px)}
      #bset .w-sc{flex-grow:1.2} #bset .w-tone{flex-grow:1.15}
      #bset .cyc small{letter-spacing:.04em}
      #bact .btn{padding:0 2px;gap:.3em} #bact .btn:first-child{flex-grow:1.5} #bact .die{width:.9em;height:.9em}
      .tab>.bgrid{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:40px repeat(16,minmax(0,1fr));gap:2px}
      .bl{font-family:var(--f-display);font-size:clamp(11px,2.1cqh,15px);color:var(--dim);display:flex;align-items:center;line-height:1;white-space:nowrap;min-height:0;overflow:hidden}
      .bl.root{color:var(--fg)}
      .bc{border:1px solid var(--line);background:var(--faint);border-radius:2px;padding:0;min-width:0;min-height:0;cursor:pointer}
      .bc.root{background:#06280f}
      .bc.kk:not(.on){border-bottom-color:var(--dim)}
      .bc.q{margin-left:3px}
      .bc.on{background:var(--fg);border-color:var(--fg);box-shadow:0 0 6px var(--glow)}
      .bc.on.acc{box-shadow:0 0 12px var(--fg)}
      .bc.on.gh{opacity:.45}
      .bc.on.sl{border-left:3px solid var(--bg)}
      .bc.tail{background:var(--dim);border-color:var(--dim);opacity:.5}
      .bc.ph{border-color:var(--amber)}
      .bc.on.ph{background:var(--amber);border-color:var(--amber)}
      #bnotes{overflow-y:auto}
      #bOut{min-height:90px}
    </style>`);
    document.querySelector('#tab-perform').insertAdjacentHTML('afterend', `
      <section id="tab-bass" class="tab" hidden>
        <p class="console" id="bHead">&gt; BASS</p>
        <div class="row" id="bset"></div>
        <button id="bgen" class="big" data-act="bgen" aria-label="Roll a new bass line"></button>
        <div class="pages" id="pagesB"></div>
        <div class="bgrid" id="bgrid" aria-label="Bass notes for this pattern"></div>
        <p class="note" id="bnotes"></p>
        <textarea id="bOut" readonly hidden aria-label="Bass notes as text"></textarea>
        <div class="row" id="bact"></div>
        <div class="row">
          <button class="btn" data-act="bcopy">COPY NOTES</button>
          <button class="btn" data-act="bmidi">BASS MIDI</button>
        </div>
      </section>`);
    document.querySelector('.navtabs [data-v="perform"]').insertAdjacentHTML('afterend', '<button class="btn" data-act="tab" data-v="bass">BASS</button>');
    const g = document.querySelector('#tab-guide section:last-of-type');
    g.insertAdjacentHTML('afterend', `
      <section><h2>BASS</h2><p>The BASS tab adds a one-note-at-a-time bass line, written for a mono synth like the M-VAVE FM-1. It matches the style: BIG BEAT plays acid lines with slides and accents, INDUSTRIAL plays EBM sequences (16ths, between the kicks, offbeat 8ths or a gallop), PUNK drives root 8ths that change chord every half pattern, FUNK locks to the kick with ghost notes and octave pops, IDM and JUNKYARD go sparse with odd intervals. It follows the kick of each pattern, so FILL, MOVES, SPICES and TWEAK on the drums re-shape it, and NEW BEAT and ROLL A SONG roll a new one. LOCK keeps it through new beats. Editing a pattern's bass by hand keeps that pattern as you left it.</p></section>
      <section><h2>BASS SETTINGS</h2><p>KEY changes the key; it stays when you roll. SCALE AUTO lets the style pick (minor, phrygian, dorian, pentatonic, major, mixolydian or hijaz); tap to choose one yourself and the notes move to fit it. TONE AUTO uses the bass sound made for the kit; tap for that style's other two. LEVEL sets the bass volume. HEAR: MIX plays it with the drums, SOLO plays it alone (or with any soloed drum, to learn the kick and bass together), MUTE turns it off. OCT moves the whole line an octave; the note names follow. Phone speakers barely play the lowest notes, so use OCT▲ or headphones if it sounds thin.</p></section>
      <section><h2>BASS GRID</h2><p>Rows are the notes of the scale, root rows brighter, lowest at the bottom. Tap a box to put that note on that step; tap it again to remove it. One note per step. Faint boxes after a note show how long it holds. A dark notch on a note means it slides from the note before it. A dim note is a soft ghost note. Underlines in empty boxes show where the kick hits. The line under the grid lists this pattern's notes as step and note, the same way you would enter them: ! accent, (soft) ghost, ×2 hold 2 steps, ~ slide into the next note. Note names use MIDI 60 = C4; some synths call that note C3, so check one note on yours.</p></section>
      <section><h2>BASS OUT</h2><p>COPY NOTES copies every pattern's notes as text. BASS MIDI saves the bass as its own .mid file on MIDI channel 1, with accents louder and ghost notes softer. Punch-in effects on PERFORM play on the bass too.</p></section>`);
    if (!S.bass){ genBass(); touchHistory(); }
  });
  on('render', () => {
    if (!S.bass){ genBass(); touchHistory(); }
    else if (S.bass.n.length !== S.len) fitBass();
    renderBass();
  });
})();
