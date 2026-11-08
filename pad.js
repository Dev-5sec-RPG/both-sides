// Both Sides — controller and keyboard play.
// Controller: a selection frame jumps from button to button (stick / d-pad), A decides, B goes back,
// and the shoulder / face buttons do the common actions directly.
// When a controller or the keyboard is in use, each button shows the key that works it; moving the mouse hides them.
(() => {
  const $ = id => document.getElementById(id);
  const UI = () => window.BSUI, P = () => window.BSUI.pad, T = () => window.BSTut;
  const L = (...a) => window.BothSides.L(...a);

  // ---------- which input is in use, and which controller family ----------
  let mode = 'mouse', fam = 'xbox';
  function setMode(m) {
    if (m === mode) return; mode = m;
    document.body.classList.toggle('inp-pad', m === 'pad');
    document.body.classList.toggle('inp-kb', m === 'kb');
    if (m !== 'pad') clearFocus();
    decorate(true);
  }
  let mx = -1, my = -1;
  document.addEventListener('mousemove', e => { if (mx >= 0 && Math.abs(e.clientX - mx) + Math.abs(e.clientY - my) > 6) setMode('mouse'); mx = e.clientX; my = e.clientY; });
  document.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || e.pointerType === 'touch') setMode('mouse'); });

  // ---------- glyphs ----------
  // action -> [xbox, playstation, keyboard]
  const G = {
    sellA: ['LB', 'L1', 'Q'], sellB: ['RB', 'R1', 'O'], opsA: ['LT', 'L2', 'W'], opsB: ['RT', 'R2', 'P'],
    pause: ['Y', '△', 'Space'], more: ['X', '□', 'D'], menu: ['≡', 'OPTIONS', 'Esc'],
    sell: ['Y', '△', 'Enter'], close: ['B', '○', 'Esc'], ok: ['A', '×', 'Enter'], no: ['B', '○', 'Esc'],
    skip: ['≡', 'OPTIONS', 'Esc'], next: ['A', '×', 'Enter'],
  };
  const FACE = { A: 'ga', B: 'gb', X: 'gx', Y: 'gy', '×': 'pc', '○': 'pr', '□': 'ps', '△': 'pt' };
  function glyph(k) {
    const g = G[k]; if (!g) return '';
    const s = mode === 'kb' ? g[2] : fam === 'ps' ? g[1] : g[0];
    const cls = mode === 'kb' ? 'kc' : FACE[s] ? 'face ' + FACE[s] : 'sh';
    return `<span class="${cls}">${s}</span>`;
  }
  // element -> action. Selectors are looked up afresh each time, since the screens redraw themselves
  const MARK = [
    ['#AbSell', 'sellA'], ['#BbSell', 'sellB'], ['#AbOps', 'opsA'], ['#BbOps', 'opsB'], ['#bPause', 'pause'],
    ['#cA [data-more]', 'more'], ['#cB [data-more]', 'more'], ['#bHome', 'menu'],
    ['#mc [data-do="sell"]', 'sell'], ['#mc [data-do="close"]', 'close'], ['#mGo', 'ok'], ['#mNo', 'no'],
    ['#mvSkip', 'skip'], ['#mvHint', 'next'],
  ];
  let decoQueued = false;
  function decorate(force) {
    const on = mode !== 'mouse';
    for (const [sel, k] of MARK) document.querySelectorAll(sel).forEach(el => {
      let s = el.querySelector(':scope > .kg');
      if (!on) { if (s) s.remove(); return; }
      const html = glyph(k);
      if (!s) { s = document.createElement('span'); s.className = 'kg'; el.appendChild(s); }
      if (force || s.dataset.h !== html) { s.innerHTML = html; s.dataset.h = html; }
    });
    const ph = $('mPadHint');
    if (ph) {
      const h = !on ? '' : mode === 'kb'
        ? `<span><span class="kc">↑</span><span class="kc">↓</span>${L('品目', 'Item', '品目')}</span><span><span class="kc">←</span><span class="kc">→</span>±0.05</span><span><span class="kc">Shift</span>+<span class="kc">←</span><span class="kc">→</span>±0.2</span><span><span class="kc">0-9</span><span class="kc">.</span>${L('直接入力', 'Type it', '直接输入')}</span>`
        : `<span>${glyph('more')}${L('品目', 'Item', '品目')}</span><span>${fam === 'ps' ? '<span class="sh">L1</span><span class="sh">R1</span>' : '<span class="sh">LB</span><span class="sh">RB</span>'}±0.05</span><span>${fam === 'ps' ? '<span class="sh">L2</span><span class="sh">R2</span>' : '<span class="sh">LT</span><span class="sh">RT</span>'}±0.2</span>`;
      if (ph.dataset.h !== h) { ph.innerHTML = h; ph.dataset.h = h; }
    }
  }
  // re-applied straight away (before paint) whenever a screen redraws a labelled button
  new MutationObserver(() => { if (decoQueued || mode === 'mouse') return; decoQueued = true; try { decorate(false); keepFocus(); } finally { decoQueued = false; } })
    .observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'disabled', 'class'] });

  // ---------- what is on top, and what can be selected there ----------
  const vis = el => { if (!el || el.disabled) return false; if (el.closest('[hidden]')) return false; const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const shown = id => { const e = $(id); return !!e && !e.hidden && e.getBoundingClientRect().width > 0; };
  const fadeOn = () => { const f = $('fade'); return !!f && /\bon\b/.test(f.className); };
  function layer() {
    if (P().movieOn()) return 'movie';
    if (shown('modal')) return 'modal';
    if (shown('hpop')) return 'hpop';
    if (shown('home')) return 'home';
    if (T() && T().on) return 'tut';
    return 'game';
  }
  const SEL = 'button, input[type="range"], [data-pick]';
  function candidates(ly) {
    let root, list;
    if (ly === 'modal') root = $('mc');
    else if (ly === 'hpop') root = $('hpop');
    else if (ly === 'home') root = $('home');
    else if (ly === 'movie') return [];
    else if (ly === 'tut') {
      // only the tutorial's own buttons and the thing the current step asks you to press
      const s = T().step(); list = [...$('tut').querySelectorAll('button')];
      if (s && s.wait && s.t) list = list.concat([...document.querySelectorAll(s.t)].flatMap(el => el.matches(SEL) ? [el] : [...el.querySelectorAll(SEL)]));
      if (shown('modal')) list = list.concat([...$('mc').querySelectorAll(SEL)]);
      return [...new Set(list)].filter(vis);
    } else root = $('stage');
    list = [...root.querySelectorAll(SEL)];
    if (ly === 'game') list = list.filter(el => !el.closest('#modal, #movie, #home, #tut'));
    return list.filter(vis);
  }

  // ---------- the selection frame ----------
  let cur = null;
  function clearFocus() { if (cur) cur.classList.remove('padf'); cur = null; }
  function setFocus(el) {
    if (cur === el) return; clearFocus(); if (!el) return;
    cur = el; el.classList.add('padf');
    try { el.focus({ preventScroll: true }); } catch (e) { /* not focusable */ }
    const mc = $('mc'); if (mc && mc.contains(el)) el.scrollIntoView({ block: 'nearest' });
    if (window.BSSE) window.BSSE.play('hover');
  }
  // the frame follows redraws: if its element was replaced, find the new one by its identifying attributes
  let lastLy = '', lastStep = null, autoGame = false;
  function keepFocus() {
    if (mode !== 'pad') return;
    // a new window or screen came up: put the frame on its main button
    const ly = layer(), st = T() && T().on ? T().step() : null;
    if (ly !== lastLy || st !== lastStep) {
      const stepMoved = st !== lastStep; lastLy = ly; lastStep = st; const c = candidates(ly);
      autoGame = ly === 'game';
      if (!cur || !c.includes(cur) || (stepMoved && st && st.wait)) { const f = preferred(c, ly); if (f) { clearFocus(); setFocus(f); } else if (!cur || !c.includes(cur)) clearFocus(); }
      return;
    }
    // the war table fades in after the switch: until the player moves the frame, keep trying for the Sell button
    if (autoGame && ly === 'game' && (!cur || !cur.matches('#AbSell'))) { const a = $('AbSell'); if (vis(a)) { autoGame = false; setFocus(a); return; } }
    if (!cur) return;
    if (document.contains(cur) && vis(cur)) { if (!cur.classList.contains('padf')) cur.classList.add('padf'); return; }
    const key = ['id', 'data-pick', 'data-qm', 'data-do', 'data-op', 'data-open', 'data-tog', 'data-more', 'data-pm'].map(a => cur.getAttribute(a) ? `[${a}="${cur.getAttribute(a)}"]` : '').join('');
    const c = candidates(layer()), hit = key ? c.find(el => el.matches(key)) : null;
    cur = null; setFocus(hit || preferred(c, layer()));
  }
  function preferred(list, ly) {
    const pick = sel => list.find(el => el.matches(sel));
    // tutorial hands-on step: the frame goes to the thing it asks you to press
    if (T() && T().on) { const s = T().step(); if (s && s.wait && s.t) { const tg = [...document.querySelectorAll(s.t)]; const hit = list.find(el => tg.some(x => x === el || x.contains(el))); if (hit) return hit; } }
    if (ly === 'modal') return pick('[data-do="sell"]') || pick('#mGo') || pick('.btn.primary') || pick('[data-do="close"]') || list[0];
    if (ly === 'home') return pick('#hNew') || list[0];
    if (ly === 'hpop') return pick('[data-scn]') || pick('.btn.primary') || list[0];
    if (ly === 'tut') { const s = T().step(); if (s && s.wait) { const t = list.find(el => !el.closest('#tut')); if (t) return t; } return null; }
    return pick('#AbSell') || list[0];
  }
  function move(dx, dy) {
    autoGame = false;
    const ly = layer(), list = candidates(ly);
    if (!list.length) return;
    if (!cur || !list.includes(cur)) { setFocus(preferred(list, ly) || list[0]); return; }
    const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bs = 1e9;
    for (const el of list) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const p = dx ? (x - ax) * dx : (y - ay) * dy, q = dx ? Math.abs(y - ay) : Math.abs(x - ax);
      // must lie ahead; overlapping rows/columns count as straight ahead
      const edge = dx ? (dx > 0 ? r.left - a.right : a.left - r.right) : (dy > 0 ? r.top - a.bottom : a.top - r.bottom);
      if (p <= 4 && edge < -2) continue;
      if (p <= 4) continue;
      const overlap = dx ? !(r.bottom < a.top || r.top > a.bottom) : !(r.right < a.left || r.left > a.right);
      const s = Math.max(0, edge) + p * 0.2 + q * (overlap ? 0.5 : 2.5);
      if (s < bs) { bs = s; best = el; }
    }
    if (best) setFocus(best);
  }
  function press(el) {
    if (!el) return;
    const ly = layer(), c = candidates(ly);
    if (!c.includes(el)) { const f = preferred(c, ly); if (f) setFocus(f); return; } if (el.matches('input[type="range"]')) return; el.click(); }

  // ---------- actions shared by the controller and the keyboard ----------
  const click = sel => { const el = document.querySelector(sel); if (el && vis(el)) { el.click(); return true; } return false; };
  const inTutAllowed = sel => { const s = T() && T().on ? T().step() : null; if (!T() || !T().on) return true; if (!s || !s.wait || !s.t) return false; return [...document.querySelectorAll(s.t)].some(t => t.matches(sel) || t.querySelector(sel)); };
  function direct(k) {
    const ly = layer(), p = P(), act = p.act;
    if (ly === 'movie') { if (k === 'ok') p.movieNext(); else if (k === 'menu') p.movieSkip(); return; }
    // tutorial: on reading steps A / B page forward / back, whatever window is open underneath
    if (T() && T().on) { const s = T().step(); if (s && !s.wait) { if (k === 'ok') T().next(); else if (k === 'back') T().back(); return; } }
    if (ly === 'tut' && !shown('modal')) {
      if (k === 'ok') { if (cur && document.contains(cur)) press(cur); else T().next(); return; }
      if (k === 'back') { T().back(); return; }
    }
    if (ly === 'home' || ly === 'hpop') {
      if (k === 'ok') press(cur); else if (k === 'back') { if (ly === 'hpop') click('#hpop [data-hclose]'); }
      return;
    }
    if (ly === 'modal' || (ly === 'tut' && shown('modal'))) {
      const sell = act && act.kind === 'sell';
      if (k === 'ok') { press(cur && $('mc').contains(cur) ? cur : $('mc').querySelector('#mGo, .btn.primary')); return; }
      if (k === 'back') { click('#mNo') || click('#mc [data-do="close"]'); return; }
      if (sell) {
        if (k === 'sell') click('#mc [data-do="sell"]');
        else if (k === 'item') p.item(1);
        else if (k === 'm-') p.setM(act.m - 0.05); else if (k === 'm+') p.setM(act.m + 0.05);
        else if (k === 'M-') p.setM(act.m - 0.2); else if (k === 'M+') p.setM(act.m + 0.2);
      }
      return;
    }
    // the war table
    const go = sel => { if (inTutAllowed(sel)) click(sel); };
    if (k === 'ok') { press(cur); return; }
    if (k === 'sellA') go('#AbSell'); else if (k === 'sellB') go('#BbSell');
    else if (k === 'opsA') go('#AbOps'); else if (k === 'opsB') go('#BbOps');
    else if (k === 'pause') { if (ly === 'game') click('#bPause'); }
    else if (k === 'more') {
      const A = $('cA'), B = $('cB'); if (!A || !B) return;
      const open = !(A.classList.contains('open') || B.classList.contains('open'));
      A.classList.toggle('open', open); B.classList.toggle('open', open);
      if (window.BSSE) window.BSSE.play('page');
    } else if (k === 'menu') { if (ly === 'game') { p.menu(); setTimeout(() => { if (mode === 'pad') move(0, 0); }, 0); } }
  }

  // ---------- keyboard ----------
  let typed = '', typedAt = 0;
  // capture phase: runs before ui.js / tutorial.js, and stops the event for keys it has used
  document.addEventListener('keydown', e => {
    const used = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    const k = e.key, ly = layer(), act = P().act;
    if (k !== 'Shift') setMode('kb');
    if (ly === 'movie') return;                       // ui.js handles Enter / Space / Esc here
    if (T() && T().on) { const s = T().step(); if (!s || !s.wait) return; }   // reading steps: tutorial.js
    if (ly === 'tut' && !shown('modal')) {            // tutorial.js handles Enter / arrows / Esc
      const m = { q: 'sellA', w: 'opsA', o: 'sellB', p: 'opsB' }[k.toLowerCase()]; if (m) direct(m);
      return;
    }
    if (act && act.kind === 'sell' && shown('modal')) {
      if (k === 'ArrowLeft' || k === 'ArrowRight') { used(); const s = (k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 0.2 : 0.05); P().setM(act.m + s); return; }
      if (k === 'ArrowUp' || k === 'ArrowDown') { used(); P().item(k === 'ArrowUp' ? -1 : 1); return; }
      if (k === 'Enter') { used(); direct('sell'); return; }
      if (/^[0-9.]$/.test(k)) {
        used(); const now = performance.now();
        if (now - typedAt > 1200) typed = ''; typedAt = now; typed = (typed + k).slice(0, 4);
        const v = parseFloat(typed); if (!isNaN(v)) P().setM(v);
        return;
      }
      return;
    }
    if (ly !== 'game') return;
    if (shown('modal')) return;                        // event windows: Enter works the focused button, Esc closes (ui.js)
    const m = { q: 'sellA', w: 'opsA', o: 'sellB', p: 'opsB', d: 'more' }[k.toLowerCase()];
    if (m) { used(); direct(m); return; }
    if (k === 'Escape' && P().menu()) used();
  }, true);

  // ---------- controller ----------
  // standard mapping: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 View, 9 Menu, 12-15 d-pad
  const prev = {}, held = {};
  let raf = 0;
  function poll(t) {
    raf = requestAnimationFrame(poll);
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    if (!pads.length) return;
    const gp = pads.find(p => p.buttons.some(b => b.pressed) || p.axes.some(a => Math.abs(a) > 0.5)) || pads[0];
    fam = /054c|playstation|dualshock|dualsense|wireless controller/i.test(gp.id) ? 'ps' : 'xbox';
    const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, ry = gp.axes[3] || 0;
    const st = {
      up: b(12) || ay < -0.6, down: b(13) || ay > 0.6, left: b(14) || ax < -0.6, right: b(15) || ax > 0.6,
      A: b(0), B: b(1), X: b(2), Y: b(3), LB: b(4), RB: b(5), LT: b(6), RT: b(7), MENU: b(9), VIEW: b(8),
    };
    let any = false;
    for (const k in st) {
      const down = st[k];
      if (down && !prev[k]) { any = true; held[k] = t + 380; fire(k); }
      else if (down && REPEAT[k] && t > held[k]) { held[k] = t + 110; fire(k); }
      prev[k] = down;
    }
    if (Math.abs(ry) > 0.3) { const sc = layer() === 'modal' ? $('mc') : document.querySelector('.wire ul'); if (sc) sc.scrollTop += ry * 14; any = true; }
    if (any) setMode('pad');
  }
  const REPEAT = { up: 1, down: 1, left: 1, right: 1, LB: 1, RB: 1, LT: 1, RT: 1 };
  function fire(k) {
    if (mode !== 'pad') { setMode('pad'); }
    if (fadeOn()) return;
    const ly = layer(), act = P().act, sellOpen = act && act.kind === 'sell' && shown('modal');
    // the range slider takes left / right while it holds the frame
    if (cur && cur.id === 'mRange' && sellOpen && (k === 'left' || k === 'right')) { P().setM(act.m + (k === 'left' ? -0.05 : 0.05)); return; }
    if (k === 'up') return move(0, -1); if (k === 'down') return move(0, 1);
    if (k === 'left') return move(-1, 0); if (k === 'right') return move(1, 0);
    if (k === 'A') return direct('ok');
    if (k === 'B') return direct('back');
    if (k === 'MENU') return direct('menu');
    if (sellOpen) {
      if (k === 'LB') return direct('m-'); if (k === 'RB') return direct('m+');
      if (k === 'LT') return direct('M-'); if (k === 'RT') return direct('M+');
      if (k === 'X') return direct('item'); if (k === 'Y') return direct('sell');
      return;
    }
    if (ly === 'game' || ly === 'tut') {
      if (k === 'LB') return direct('sellA'); if (k === 'RB') return direct('sellB');
      if (k === 'LT') return direct('opsA'); if (k === 'RT') return direct('opsB');
      if (k === 'Y') return direct('pause'); if (k === 'X') return direct('more');
    }
  }
  window.addEventListener('gamepadconnected', () => { if (!raf) raf = requestAnimationFrame(poll); });
  if (navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)) raf = requestAnimationFrame(poll);
  // a frame appears as soon as the controller is used on a screen that has none
  window.BSPad = { get mode() { return mode; }, setMode, decorate, layer, get focus() { return cur; }, fire, fam: f => { fam = f; decorate(true); } };
})();
