/* WOPR Beat Machine · render
   Draws every screen from the state. Patches can run after each draw with on('render', fn).
   All files share one global scope: anything defined in an earlier file can be used here.
   Load order is set in index.html. */
/* ---------- render ---------- */
function segBtns(act, items, curV){
  return items.map(([v, label]) => `<button class="btn${String(v) === String(curV) ? ' on' : ''}" data-act="${act}" data-v="${v}">${label}</button>`).join('');
}
function pageTabs(){
  if (S.len === 16) return '';
  const n = S.len / 16, short = n > 4;
  return Array.from({length:n}, (_, p) => {
      const t = ROLE_TAG[S.roles[p]];
      return `<button class="btn${p === ui.page ? ' on' : ''}" data-act="page" data-v="${p}" aria-label="Pattern ${p + 1}${S.roles[p] ? ' ' + S.roles[p] : ''}">${short ? '' : 'PAT '}${p + 1}${t ? `<sup>${t}</sup>` : ''}</button>`;
    }).join('')
    + `<button class="btn follow${ui.follow ? ' on' : ''}" data-act="follow" aria-pressed="${ui.follow}">${short ? 'FLW' : 'FOLLOW'}</button>`;
}
function renderMachine(){
  const sw = S.swing;
  $('#setrow').innerHTML =
      `<button class="btn cyc w-style" data-act="cstyle" aria-label="Style ${GENRES[S.genre].name}, tap for next style"><small>STYLE</small>${GENRES[S.genre].name}</button>`
    + `<button class="btn cyc w-kit" data-act="ckit" aria-label="Kit ${kit().name}, tap for the next ${GENRES[S.genre].name} kit"><small>KIT ${(S.kit % KITS[S.genre].length) + 1}/${KITS[S.genre].length}</small>${kit().name}</button>`
    + `<button class="btn cyc" data-act="csteps" aria-label="${S.len} steps, tap to change"><small>STEPS</small>${S.len}</button>`
    + `<button class="btn cyc" data-act="cswing" aria-label="Swing ${sw} percent, tap to change"><small>SWING</small>${sw}%</button>`
    + `<button class="btn cyc${ui.mono ? ' on' : ''}" data-act="chear" aria-label="Hear ${ui.mono ? 'PO mono' : 'full kit'}, tap to switch"><small>HEAR</small>${ui.mono ? 'MONO' : 'FULL'}</button>`;
  $('#defcon').innerHTML = [5,4,3,2,1].map(n => `<button class="btn${S.defcon === n ? ' on' : ''}" data-act="defcon" data-v="${n}" aria-label="DEFCON ${n}">${n}</button>`).join('');
  $('#defTxt').textContent = DEF_TXT[S.defcon];
  $('#gen').innerHTML = dieSVG('gen') + '<span class="bigtxt">NEW BEAT<small>SHALL WE PLAY A GAME?</small></span>';
  $('#gen').setAttribute('aria-label', 'New beat: roll a whole new pattern');

  const hasBase = !!S.base[ui.page], fp = S.len === 16 ? 2 : ui.page + 1;
  $('#actions').innerHTML =
      `<button class="btn" data-act="vary" aria-label="Tweak a few steps on pattern ${ui.page + 1}">${dieSVG('vary')}TWEAK</button>`
    + `<button class="btn${S.roles[ui.page] === 'FILL' ? ' on' : ''}" data-act="mv" data-v="FILL" aria-label="Roll a fill on pattern ${fp}">${dieSVG('mv_FILL')}FILL</button>`
    + `<button class="btn" data-act="reset"${hasBase ? '' : ' disabled'} aria-label="Reset pattern ${ui.page + 1} to its original groove">RESET</button>`
    + `<button class="btn${ui.movesOpen ? ' on' : ''}" data-act="moves" aria-expanded="${ui.movesOpen}">${ui.movesOpen ? 'PADS' : 'MOVES'}</button>`;
  const pt = pageTabs(); $('#pages').innerHTML = pt; $('#pages').hidden = !pt;

  const P = S.main, off = ui.page * 16;
  let m = '';
  for (const t of TRACKS){
    const sel = ui.sel === t.id, flags = (S.locks[t.id] ? 'L' : '') + (ui.solo[t.id] ? 'S' : '');
    m += `<button class="mlabel${sel ? ' sel' : ''}" data-act="tsel" data-v="${t.id}">${t.name}${flags ? `<i>${flags}</i>` : ''}</button>`;
    for (let i = 0; i < 16; i++){
      const idx = off + i;
      m += `<div class="mc${P[t.id][idx] ? ' on' : ''}${sel ? ' selrow' : ''}${i % 4 === 0 && i ? ' q' : ''}" data-act="tsel" data-v="${t.id}" data-idx="${idx}"></div>`;
    }
  }
  $('#mini').innerHTML = m;

  const s = ui.sel;
  $('#trackbar').innerHTML =
      `<button class="btn${S.locks[s] ? ' on' : ''}" data-act="lock" aria-label="Lock ${NAME[s]}">LOCK</button>`
    + `<button class="btn${ui.solo[s] ? ' on' : ''}" data-act="solo" aria-label="Solo ${NAME[s]}">SOLO</button>`
    + `<button class="btn" data-act="shl" aria-label="Shift ${NAME[s]} left">◄</button>`
    + `<button class="btn" data-act="shr" aria-label="Shift ${NAME[s]} right">►</button>`
    + `<button class="btn" data-act="flip" aria-label="Reverse ${NAME[s]}">FLIP</button>`
    + `<button class="btn" data-act="clr" aria-label="Clear ${NAME[s]}">CLR</button>`;

  $('#padName').textContent = NAME[s] + (S.len > 16 ? ` · PAT ${ui.page + 1}` : '') + (S.roles[ui.page] && S.roles[ui.page] !== 'GROOVE' ? ` · ${S.roles[ui.page]}` : '');
  renderMoves();
  const hits = stepsOf(P, s, off);
  $('#padInfo').textContent = hits.length ? `${hits.length} HIT${hits.length > 1 ? 'S' : ''}` : 'TAP PADS TO ADD';
  let h = '';
  for (let i = 0; i < 16; i++){
    const idx = off + i, on = P[s][idx];
    h += `<button class="pad${on ? ' on' : ''}" data-act="cell" data-t="${s}" data-v="${idx}" data-idx="${idx}" aria-label="${NAME[s]} step ${i + 1}${on ? ', on' : ''}"><span class="n">${i + 1}</span><span class="s">${on ? KEY[s] : ''}</span></button>`;
  }
  $('#pads').innerHTML = h;
}
function renderMoves(){
  const open = ui.movesOpen;
  $('#moves').hidden = !open; $('#trackbar').hidden = open; $('#padwrap').hidden = open;
  if (!open) return;
  const role = S.roles[ui.page];
  $('#moves').innerHTML =
      `<button class="btn song" data-act="song">${dieSVG('song')}ROLL A SONG · ${S.len < 32 ? 64 : S.len} STEPS</button>`
    + `<div class="mvlab"><span>SECTION MOVES</span><b>PATTERN ${ui.page + 1}${role && role !== 'GROOVE' ? ' · ' + MOVE_NAME[role] : ''}</b></div>`
    + `<div class="mvgrid c3">${SECTION.map(n => `<button class="btn${role === n ? ' on' : ''}" data-act="mv" data-v="${n}" aria-label="${MOVE_NAME[n]} on this pattern">${dieSVG('mv_' + n)}${n}</button>`).join('')}</div>`
    + `<div class="mvlab"><span>SPICES · THEY STACK</span><b>PATTERN ${ui.page + 1}</b></div>`
    + `<div class="mvgrid c4">${SPICES.map(n => `<button class="btn" data-act="sp" data-v="${n}">${dieSVG('sp_' + n)}${n}</button>`).join('')}`
    + `<button class="btn cyc" data-act="csel" aria-label="Sound for RATCHET, EUCLID and POLY: ${NAME[ui.sel]}. Tap to change"><small>SOUND</small>${NAME[ui.sel]}</button></div>`;
}
function renderPO(){
  const P = S.main, off = ui.page * 16;
  $('#poHead').textContent = `> PO-35 VIEW · PATTERN ${ui.page + 1} OF ${S.len / 16}${S.roles[ui.page] && S.roles[ui.page] !== 'GROOVE' ? ' · ' + S.roles[ui.page] : ''}`;
  const pt = pageTabs(); $('#pagesPo').innerHTML = pt; $('#pagesPo').hidden = !pt;
  $('#chips').innerHTML = segBtns('chip', [['mono','MONO'], ...TRACKS.map(t => [t.id, t.name])], ui.chip);
  $('#psolo').innerHTML = ui.chip === 'mono'
    ? '<button class="btn" disabled>TAP A SOUND TO SOLO IT IN MONO</button>'
    : `<button class="btn${ui.poSolo ? ' on' : ''}" data-act="psolo">${ui.poSolo ? 'SOLO ON · ' : 'SOLO '}${NAME[ui.chip]} IN MONO</button>`;
  $('#info').hidden = !ui.poInfo; $('#powrap').hidden = ui.poInfo; $('#monoNote').hidden = ui.poInfo;
  $('#infoBtn').textContent = ui.poInfo ? 'BACK TO GRID' : 'STEP LIST'; $('#infoBtn').classList.toggle('on', ui.poInfo);

  let h = '', dropped = 0, lost = 0, kept = 0;
  for (let i = 0; i < 16; i++){
    const idx = off + i;
    const n = IDS.filter(id => P[id][idx]).length; if (n > 1) dropped += n - 1;
    const m = monoAt(P, idx);
    let id = null, cls = '';
    if (ui.chip === 'mono'){ id = m; if (id) cls = ' on'; }
    else if (P[ui.chip][idx]){ id = ui.chip; if (m === ui.chip){ cls = ' on'; kept++; } else { cls = ' lost'; lost++; } }
    h += `<div class="pob${cls}" data-idx="${idx}"><span class="n">${i + 1}</span><span class="s">${id ? KEY[id] : ''}</span></div>`;
  }
  $('#po').innerHTML = h;
  $('#monoNote').innerHTML = ui.chip === 'mono'
    ? (dropped ? `The PO plays one sound per step, so <b>${dropped} hit${dropped > 1 ? 's' : ''}</b> on shared steps ${dropped > 1 ? 'are' : 'is'} left out. Kick wins, then snare, metal, open hat, closed hat.` : 'Every hit fits. No shared steps on this pattern.')
    : `${NAME[ui.chip]}: <b>${kept}</b> step${kept === 1 ? '' : 's'} to record.` + (lost ? ` Dashed steps (${lost}) lose to a louder sound in mono, so leave them out.` : '') + (ui.poSolo ? ' Solo plays only the steps to record.' : '');

  $('#listHead').textContent = `PATTERN ${ui.page + 1} STEPS`;
  let s = '';
  IDS.forEach(id => { s += `<span>${NAME[id]}</span><span>${stepsOf(P, id, off).join(' ') || '–'}</span>`; });
  s += `<span>MONO</span><span>${monoLine(P, off).join(' ') || '–'}</span>`;
  if (ui.chip !== 'mono'){
    const ms = []; for (let i = 0; i < 16; i++) if (monoAt(P, off + i) === ui.chip) ms.push(i + 1);
    s += `<span>${KEY[ui.chip]} MONO</span><span>${ms.join(' ') || '–'}</span>`;
  }
  $('#steps').innerHTML = s;
  const strat = strategy();
  $('#stratPanel').hidden = !strat;
  if (strat) $('#strat').innerHTML = strat.map(l => `<li>${l}</li>`).join('');
}
function renderSaved(){
  const list = store.get('wopr.saved', []);
  $('#saved').innerHTML = list.length ? list.map(it => `
    <div class="sitem">
      <div><strong>${it.name}</strong><small>${it.date}</small></div>
      <button class="btn" data-act="load" data-v="${it.id}">LOAD</button>
      <button class="btn" data-act="del" data-v="${it.id}">${ui.confirmDel === it.id ? 'CONFIRM' : 'DELETE'}</button>
    </div>`).join('')
    : '<p class="empty">No saved patterns yet. Tap SAVE on the MACHINE tab when a beat grabs you.</p>';
}
function renderBar(){
  $('#play').innerHTML = playing ? '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="5.5" width="13" height="13" fill="currentColor"/></svg>' : '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>'; $('#play').classList.toggle('on', playing);
  $('#play').setAttribute('aria-label', playing ? 'Stop' : 'Play from the start');
  $('#tempo').textContent = S.tempo;
  const solos = IDS.filter(id => ui.solo[id]).map(id => NAME[id]);
  const hear = ui.poSolo ? `<b>SOLO ${NAME[ui.poSolo]} · MONO</b>` : solos.length ? `<b>SOLO ${solos.join('+')}</b>${ui.mono ? ' · MONO' : ''}` : (ui.mono ? 'HEARING PO MONO' : 'HEARING FULL KIT');
  $('#runStat').innerHTML = `${GENRES[S.genre].name} · ${S.len} STEPS<br>${hear}`;
}
function renderTabs(){
  ['machine','po','perform','saved','guide'].forEach(t => $('#tab-' + t).hidden = ui.tab !== t);
  $$('.navtabs .btn').forEach(b => b.classList.toggle('on', b.dataset.v === ui.tab));
  $('#back').disabled = !ui.stack.length;
  $('#hPos').textContent = `${hi + 1}/${H.length}`;
  $('#hPrev').disabled = hi <= 0; $('#hNext').disabled = hi >= H.length - 1;
}
function render(){
  renderMachine(); renderPO(); renderSaved(); renderBar(); renderTabs(); mark();
  ui.rolled = null;
  emit('render');
}
