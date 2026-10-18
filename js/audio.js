/* WOPR Beat Machine · audio
   Web Audio engine: output chain, drive/bit-crush shapers, the layer synths and pitch effects.
   All files share one global scope: anything defined in an earlier file can be used here.
   Load order is set in index.html. */
/* ---------- audio ---------- */
/* Effect chain (every stage is a fixed node, so effects switch sample-exact on the downbeat):
   master → lowpass (fxFilt) → hipass (fxHP) → peaking EQ (fxEQ) → gate (fxGate)
          → dry / distortion / bit-crush mix → fxSum → stereo pan → compressor → out
   plus a tempo-synced delay sent from after the pan. */
let AC = null, master = null, noiseBuf = null, fxFilt = null, fxGate = null;
let fxHP = null, fxEQ = null, fxDry = null, fxDistG = null, fxCrushG = null, fxSum = null, fxPan = null, fxComp = null;
let dly = null, dlySend = null, dlyFb = null;
let fxEff = null, fxPm = 1, fxLv = 1;   // effect in charge, plus per-hit pitch and level set by the sequencer
function makeCurve(drive, bits){
  const n = 2048, c = new Float32Array(n), k = 1 + drive * 24, nrm = Math.tanh(k);
  for (let i = 0; i < n; i++){
    let y = i / (n - 1) * 2 - 1;
    if (drive) y = Math.tanh(y * k) / nrm;
    if (bits){ const q = Math.pow(2, bits) / 2; y = Math.round(y * q) / q; }
    c[i] = y;
  }
  return c;
}
function audio(){
  if (!AC){
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const g = v => { const n = AC.createGain(); n.gain.value = v; return n; };
    const bq = (type, f) => { const n = AC.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = .7; return n; };
    fxComp = AC.createDynamicsCompressor();
    master = g(.8);
    fxFilt = bq('lowpass', 20000); fxHP = bq('highpass', 10); fxEQ = bq('peaking', 1000); fxEQ.gain.value = 0;
    fxGate = g(1); fxDry = g(1); fxDistG = g(0); fxCrushG = g(0); fxSum = g(1);
    const dws = AC.createWaveShaper(); dws.curve = makeCurve(.9, 0); dws.oversample = '2x';
    const cws = AC.createWaveShaper(); cws.curve = makeCurve(.15, 3);
    fxPan = AC.createStereoPanner ? AC.createStereoPanner() : g(1);
    master.connect(fxFilt); fxFilt.connect(fxHP); fxHP.connect(fxEQ); fxEQ.connect(fxGate);
    fxGate.connect(fxDry); fxGate.connect(dws); fxGate.connect(cws);
    fxDry.connect(fxSum); dws.connect(fxDistG); fxDistG.connect(fxSum); cws.connect(fxCrushG); fxCrushG.connect(fxSum);
    fxSum.connect(fxPan); fxPan.connect(fxComp); fxComp.connect(AC.destination);
    dly = AC.createDelay(2); dlySend = g(0); dlyFb = g(.3);
    const dlyTone = bq('lowpass', 3200);
    fxPan.connect(dlySend); dlySend.connect(dly); dly.connect(dlyTone); dlyTone.connect(dlyFb); dlyFb.connect(dly); dlyTone.connect(fxComp);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function env(g, t, v, dur){ g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); }

const shapers = {};
function shaper(drive, bits){
  const key = drive + '_' + bits;
  if (!shapers[key]){
    const ws = AC.createWaveShaper(); ws.curve = makeCurve(drive, bits); ws.oversample = drive ? '2x' : 'none'; ws.connect(master);
    shapers[key] = ws;
  }
  return shapers[key];
}
const LAYER = {
  tone(l, t, out, pm, lv){
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = l.w || 'sine'; o.frequency.setValueAtTime(F(l.f0, pm), t);
    if (l.f1) o.frequency.exponentialRampToValueAtTime(F(l.f1, pm), t + (l.sw || l.dec * .4));
    env(g, t, l.v * lv, l.dec); o.connect(g); g.connect(out); o.start(t); o.stop(t + l.dec + .03);
  },
  noise(l, t, out, pm, lv){
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = noiseBuf; f.type = l.ft; f.frequency.setValueAtTime(F(l.f, pm), t);
    if (l.f1) f.frequency.exponentialRampToValueAtTime(F(l.f1, pm), t + l.dec);
    if (l.q) f.Q.value = l.q;
    env(g, t, l.v * lv, l.dec); s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * Math.max(0, Math.min(.4, .95 - l.dec))); s.stop(t + l.dec + .03);
  },
  metal(l, t, out, pm, lv){
    const f = AC.createBiquadFilter(), g = AC.createGain();
    f.type = l.ft; f.frequency.value = F(l.f, pm); if (l.q) f.Q.value = l.q;
    env(g, t, l.v * lv, l.dec); f.connect(g); g.connect(out);
    l.fs.forEach(fr => { const o = AC.createOscillator(); o.type = l.w || 'square'; o.frequency.value = F(fr * (l.mul || 1), pm); o.connect(f); o.start(t); o.stop(t + l.dec + .03); });
  },
  clap(l, t, out, pm, lv){
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(), G = g.gain, v = l.v * lv;
    s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = F(l.f, pm); f.Q.value = l.q || 1;
    G.setValueAtTime(0, t);
    for (let k = 0; k < 3; k++){ const a = t + k * .011; G.setValueAtTime(v, a); G.linearRampToValueAtTime(v * .15, a + .009); }
    G.setValueAtTime(v, t + .033); G.exponentialRampToValueAtTime(.001, t + .033 + l.dec);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * .4); s.stop(t + .04 + l.dec);
  },
  fm(l, t, out, pm, lv){
    const c = AC.createOscillator(), m = AC.createOscillator(), mg = AC.createGain(), g = AC.createGain();
    c.frequency.value = F(l.c, pm); m.frequency.value = F(l.m, pm);
    mg.gain.setValueAtTime(l.idx * F(l.m, pm), t); mg.gain.exponentialRampToValueAtTime(1, t + l.dec);
    m.connect(mg); mg.connect(c.frequency); env(g, t, l.v * lv, l.dec); c.connect(g); g.connect(out);
    c.start(t); m.start(t); c.stop(t + l.dec + .03); m.stop(t + l.dec + .03);
  },
};
const F = (f, pm) => Math.max(20, Math.min(18000, f * pm));
function pitchSet(){
  const id = fxEff ? fxEff.id : null, v = fxLv;
  let p = fxPm;
  if (id === 'OCTU') p *= 2;
  if (id === 'OCTD') p *= .5;
  const r = [[p, v]];
  if (id === 'UNI') r.push([p * 1.015, .7 * v], [p * .985, .7 * v]);
  if (id === 'UNIL') r.push([p * .5, .85 * v]);
  return r;
}
function hit(spec, t){
  const out = spec.drive || spec.crush ? shaper(spec.drive || 0, spec.crush || 0) : master;
  pitchSet().forEach(([pm, lv]) => spec.L.forEach(l => LAYER[l.t](l, t, out, pm, lv)));
}
const VOICE = Object.fromEntries(IDS.map(id => [id, t => hit(kit()[id], t)]));
function preview(){
  try {
    audio(); const t = AC.currentTime + .03, b = 60 / S.tempo / 4;
    [['kick',0],['chat',2],['snare',4],['chat',6],['kick',7],['perc',8],['ohat',10],['snare',12]].forEach(([id, st]) => VOICE[id](t + st * b));
  } catch(e){}
}
function monoAt(P, i){ for (const id of MONO_ORDER) if (P[id][i]) return id; return null; }
