/* WOPR Beat Machine · po
   PO-35 helpers: step lists, mono squeeze, slots and chain, copy text and MIDI export.
   All files share one global scope: anything defined in an earlier file can be used here.
   Load order is set in index.html. */
/* ---------- text, strategy, midi ---------- */
function stepsOf(P, id, lo){ const r = []; for (let i = 0; i < 16; i++) if (P[id][lo + i]) r.push(i + 1); return r; }
function monoLine(P, lo){ const r = []; for (let i = 0; i < 16; i++){ const id = monoAt(P, lo + i); if (id) r.push((i + 1) + KEY[id]); } return r; }
function chainInfo(){
  const n = S.len / 16, slots = [], slotOf = [];
  for (let p = 0; p < n; p++){
    const m = Array.from({length:16}, (_, i) => monoAt(S.main, p * 16 + i)), key = m.map(x => x ? KEY[x] : '-').join('');
    let k = slots.findIndex(sl => sl.key === key);
    if (k < 0){ slots.push({key, p, m}); k = slots.length - 1; }
    slotOf.push(k);
  }
  return {slots, chain: slotOf.map(k => k + 1)};
}
const roleTxt = p => S.roles[p] && S.roles[p] !== 'GROOVE' ? ` (${MOVE_NAME[S.roles[p]] || S.roles[p]})` : '';
function strategy(){
  const n = S.len / 16;
  if (n < 2) return null;
  const {slots, chain} = chainInfo(), L = id => id ? KEY[id] : '–';
  const out = [`${n} patterns use ${slots.length} PO slot${slots.length > 1 ? 's' : ''}. Repeats come from the chain.`];
  slots.forEach((sl, k) => {
    const hits = sl.m.filter(Boolean).length, head = `Slot ${k + 1} = pattern ${sl.p + 1}${roleTxt(sl.p)}`;
    if (!hits){ out.push(`${head}: leave it empty.`); return; }
    let best = -1, bd = 99;
    for (let j = 0; j < k; j++){ const d = sl.m.reduce((a, x, i) => a + (x !== slots[j].m[i]), 0); if (d < bd){ bd = d; best = j; } }
    if (best >= 0 && bd <= Math.floor(hits * .6)){
      const d = []; sl.m.forEach((x, i) => { if (x !== slots[best].m[i]) d.push(`${i + 1}: ${L(slots[best].m[i])}→${L(x)}`); });
      out.push(`${head}: select slot ${best + 1}, hold WRITE + PATTERN and press ${k + 1}, then change ${bd} step${bd > 1 ? 's' : ''}. ${d.join(' · ')}`);
    } else out.push(`${head}: program it (${hits} hits).`);
  });
  out.push(`Chain: <b>${chain.join(' ')}</b>. Hold PATTERN and press those keys in that order.`);
  return out;
}
function allText(){
  let s = `WOPR BEAT · ${GENRES[S.genre].name} · DEFCON ${S.defcon} · ${S.tempo} BPM · ${S.len} STEPS\n`;
  for (let p = 0; p < S.len / 16; p++){
    const lo = p * 16;
    s += `\nPATTERN ${p + 1}${roleTxt(p).toUpperCase()}\n`;
    IDS.forEach(id => { const st = stepsOf(S.main, id, lo); if (st.length) s += `${NAME[id].padEnd(6)} ${st.join(' ')}\n`; });
    s += `PO MONO ${monoLine(S.main, lo).join(' ')}\n`;
  }
  if (S.len > 16) s += `\nPO CHAIN ${chainInfo().chain.join(' ')}\n`;
  return s;
}
function vlq(n){ const b = [n & 127]; while ((n >>= 7)) b.unshift((n & 127) | 128); return b; }
function midiBytes(){
  const st = 24, ev = [];
  for (let i = 0; i < S.len; i++) TRACKS.forEach(t => { if (S.main[t.id][i]) ev.push({tick:i * st, on:1, note:t.note}, {tick:i * st + 12, on:0, note:t.note}); });
  ev.sort((a, b) => a.tick - b.tick || a.on - b.on);
  const mpq = Math.round(60000000 / S.tempo);
  const trk = [0, 0xFF, 0x51, 3, (mpq >> 16) & 255, (mpq >> 8) & 255, mpq & 255];
  let last = 0;
  ev.forEach(e => { trk.push(...vlq(e.tick - last), e.on ? 0x99 : 0x89, e.note, e.on ? 100 : 0); last = e.tick; });
  trk.push(...vlq(S.len * st - last), 0xFF, 0x2F, 0);
  const n = trk.length;
  return new Uint8Array([0x4D,0x54,0x68,0x64, 0,0,0,6, 0,0, 0,1, 0,96, 0x4D,0x54,0x72,0x6B, (n>>>24)&255,(n>>16)&255,(n>>8)&255,n&255, ...trk]);
}
