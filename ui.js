// Both Sides — game screen, home screen, effects. Depends on engine.js (window.BothSides).
(function () {
  'use strict';
  const S = window.BothSides, I = S.ITEMS, O = S.OPS, fmt = S.fmt;
  const L = (ja, en) => S.L(ja, en);
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const stage = $('stage');
  let g = null, started = false, act = null, dbg = false, scale = 1, rotDismissed = false, mode = 'home', curSc = 's1';

  // ---------- settings (kept in this browser only) ----------
  const SET = { lang: 'ja', fx: true, reduce: false, autoFull: true };
  try { Object.assign(SET, JSON.parse(localStorage.getItem('bs_settings') || '{}')); } catch (e) { /* storage unavailable */ }
  function saveSet() { try { localStorage.setItem('bs_settings', JSON.stringify(SET)); } catch (e) { /* ignore */ } }
  const RM = () => SET.reduce || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- static texts ----------
  const T = {
    cal: ['暦', 'Date'], money: ['所持金', 'Cash'], profit: ['利益(スコア)', 'Profit (score)'], dbg: ['検証', 'Debug'],
    retreat: ['撤退', 'Withdraw'], home: ['ホームに戻る', 'Home'], capA: ['A国 首都', 'Capital A'], capB: ['B国 首都', 'Capital B'],
    frontline: ['戦線', 'front'], stockTitle: ['倉庫(装備・傭兵は自動生産で押すと停止/再開。兵糧は押した回数だけ作る。各12まで)', 'Warehouse (arms and mercs auto-produce; tap to pause. Rations: one per tap. Max 12 each)'],
    newsTitle: ['戦況ニュース', 'War news'], hNew: ['新しい戦争', 'New War'], hTut: ['チュートリアル', 'Tutorial'], hSet: ['設定', 'Settings'],
    rotate: ['このゲームは横画面向けです。端末を横向きにしてお楽しみください。', 'This game is made for landscape. Please turn your device sideways.'], rotateOk: ['このまま遊ぶ', 'Play anyway'],
  };
  const tx = k => L(T[k][0], T[k][1]);
  function applyStatic() {
    document.documentElement.lang = S.LANG.cur;
    document.querySelectorAll('[data-t]').forEach(el => { const k = el.dataset.t; if (T[k]) el.textContent = tx(k); });
    $('bFull').setAttribute('aria-label', L('全画面', 'Full screen')); $('bFull').title = L('全画面', 'Full screen');
    $('bDbg').title = L('隠し値の表示(検証用)', 'Show hidden values (debug)');
  }
  const SHORT = () => ({ equip: L('装備一式', 'Arms'), merc: L('傭兵', 'Mercs'), food: L('兵糧', 'Rations') });
  function short(n) {
    const a = Math.abs(n), sg = n < 0 ? '-' : '';
    if (S.LANG.cur === 'en') {
      if (a >= 1e6) return sg + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M';
      if (a >= 1e3) return sg + Math.round(a / 1e3) + 'K';
      return sg + Math.round(a);
    }
    if (a >= 1e8) return sg + (a / 1e8).toFixed(1) + '億';
    if (a >= 1e6) return sg + Math.round(a / 1e4) + '万';
    if (a >= 1e4) return sg + (a / 1e4).toFixed(1) + '万';
    return sg + Math.round(a);
  }
  const wk = t => Math.max(1, Math.ceil(t / 3 - 1e-6));
  const monthOf = t => S.dateOf(t).replace(/1週$/, '').replace(/ W1$/, '');

  // ---------- gauge scales: decided per war from both nations' opening values ----------
  const SC = { troop: 150000, fund: 7500000, eq: 2, crew: 3 };
  function setScales() {
    const A = g.c.A, B = g.c.B, up = (v, st) => Math.ceil(v / st - 1e-9) * st;
    SC.troop = up(Math.max(A.front, B.front, A.reserve, B.reserve) * 1.4, 10000);
    SC.fund = up(Math.max(A.funds, B.funds) * 1.35, 500000);
    SC.eq = Math.max(2, up(Math.max(S.eqSuff(g, A), S.eqSuff(g, B)) * 1.6, 0.5));
    SC.crew = Math.max(2, up(Math.max(S.crewFill(A), S.crewFill(B)) * 1.5, 0.5));
  }
  const tkEq = () => [100 / SC.eq, 150 / SC.eq], tkCrew = () => [95, 110, 150].map(v => v / SC.crew);

  // ---------- fit to screen ----------
  function fit() {
    const vv = window.visualViewport, vw = vv ? vv.width : window.innerWidth, vh = vv ? vv.height : window.innerHeight;
    const compact = vh < 560 || vw < 1000;
    stage.className = compact ? 'compact' : 'full';
    const W = compact ? 900 : 1280, H = compact ? 420 : 720;
    scale = Math.min(vw / W, vh / H);
    stage.style.transform = 'scale(' + scale + ')';
    stage.style.left = Math.max(0, (vw - W * scale) / 2) + 'px';
    stage.style.top = Math.max(0, (vh - H * scale) / 2) + 'px';
    $('rotate').hidden = rotDismissed || !(vh > vw && vw < 700);
    fxResize();
    if (window.BSTut) window.BSTut.relayout();
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 200));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  const fsOK = !!(document.fullscreenEnabled && document.documentElement.requestFullscreen);
  const touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  function goFull() {
    if (!fsOK || document.fullscreenElement) return;
    document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); setTimeout(fit, 200); }).catch(() => {});
  }
  $('bFull').hidden = !fsOK;
  let fsUserOff = false;
  $('bFull').onclick = () => { if (document.fullscreenElement) { fsUserOff = true; document.exitFullscreen().catch(() => {}); } else { fsUserOff = false; goFull(); } };
  if (touch && fsOK) document.addEventListener('pointerup', e => { if (SET.autoFull && !fsUserOff && !document.fullscreenElement && !e.target.closest('#bFull')) goFull(); }, true);
  document.addEventListener('fullscreenchange', () => { $('bFull').classList.toggle('on', !!document.fullscreenElement); setTimeout(fit, 200); });
  $('bRotOk').onclick = () => { rotDismissed = true; fit(); };

  // ---------- build ----------
  const IC = {
    sol: '<circle cx="12" cy="7" r="3.5"></circle><path d="M5 21v-3a7 7 0 0 1 14 0v3"></path>',
    mor: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 2 3 4"></path>',
    ant: '<path d="M4 14c3 0 5-2 7-5 1 3 4 5 9 5-3 3-7 5-11 5"></path><path d="M11 9V4"></path>',
    sus: '<circle cx="10.5" cy="10.5" r="6"></circle><path d="M15 15l5 5"></path>',
    food: '<path d="M12 21V8M12 8c0-3 2-5 4-5 0 3-2 5-4 5zM12 8c0-3-2-5-4-5 0 3 2 5 4 5zM12 13c0-3 2-5 4-5 0 3-2 5-4 5zM12 13c0-3-2-5-4-5 0 3 2 5 4 5z"></path>',
    fund: '<rect x="3" y="7" width="18" height="12" rx="2"></rect><path d="M16 13h2M3 10h18"></path>',
    sell: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"></path><path d="M3 8l9 5 9-5M12 13v8"></path>',
    frt: '<path d="M5 21V3"></path><path d="M5 4h12l-3 4 3 4H5"></path>',
    crw: '<circle cx="9" cy="8" r="3"></circle><path d="M3 20v-2a6 6 0 0 1 12 0v2"></path><circle cx="17" cy="9" r="2.5"></circle><path d="M17 14a5 5 0 0 1 4.5 4.5V20"></path>',
    sor: '<path d="M4 12h14"></path><path d="M13 6l6 6-6 6"></path>',
    eqs: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"></path>',
    ops: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>',
  };
  const ico = (k, stroke) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${stroke || 'var(--muted)'}" stroke-width="1.8" aria-hidden="true">${IC[k]}</svg>`;
  function row(id, key, icon, label, det, ticks, em) {
    const c = (det ? ' det' : '') + (em ? ' em' : '');
    return `${ico(icon).replace('<svg', '<svg class="' + c + '"')}<span class="lb${c}" id="${id}${key}L">${label}</span>
      <div class="bar${c}" id="${id}${key}B"><i></i>${(ticks || []).map(t => `<span class="tk" style="left:${t}%"></span>`).join('')}</div>
      <span class="v${c}" id="${id}${key}V"></span>`;
  }
  const LB = () => ({ mor: L('戦意', 'Morale'), ant: L('反戦', 'Anti-war'), frt: L('前線', 'Front'), res: L('予備', 'Reserve'), sor: L('出動', 'Deploy'), eqs: L('装備', 'Arms'), crw: L('充足', 'Crew'), food: L('兵糧', 'Food'), fund: L('資金', 'Funds'), sus: L('疑惑', 'Suspic.') });
  function buildCard(id) {
    const lb = LB(), nm = S.LANG.cur === 'en' ? id : id + '国';
    $('c' + id).setAttribute('aria-label', nm);
    $('c' + id).innerHTML = `
      <div class="ch"><span class="nm">${nm}</span><div class="flags" id="${id}fl"></div><button class="more" data-more="${id}">${L('詳細', 'More')}</button></div>
      <div class="trait" id="${id}tr"></div>
      <div class="risk" id="${id}rk" hidden></div>
      <div class="gg">
        ${row(id, 'mor', 'mor', lb.mor, false, [25], true)}
        ${row(id, 'ant', 'ant', lb.ant, true, [50])}
        ${row(id, 'frt', 'frt', lb.frt, false, null, true)}
        ${row(id, 'res', 'sol', lb.res, true)}
        ${row(id, 'sor', 'sor', lb.sor, true)}
        ${row(id, 'eqs', 'eqs', lb.eqs, false, tkEq(), true)}
        ${row(id, 'crw', 'crw', lb.crw, false, tkCrew(), true)}
        ${row(id, 'food', 'food', lb.food, false, [53.8, 69.2, 76.9], true)}
        ${row(id, 'fund', 'fund', lb.fund, false, null, true)}
        ${row(id, 'sus', 'sus', lb.sus, false, [50, 75, 90], true)}
      </div>
      <div class="sub"><span>${L('兵糧1単位', '1 ration')} <b id="${id}ct">—</b></span><span>${L('融資', 'Loan')} <b id="${id}ln">—</b></span></div>
      <div class="dbg" id="${id}dbg" hidden></div>
      <div class="acts">
        <button data-open="sell" data-c="${id}" id="${id}bSell">${ico('sell', '')}${L('販売', 'Sell')}</button>
        <button data-open="ops" data-c="${id}" id="${id}bOps">${ico('ops', '')}${L('暗躍', 'Covert')}</button>
      </div>`;
  }
  function buildStock() {
    const sh = SHORT();
    $('stock').innerHTML = Object.values(I).map(it => it.key === 'food' ? `
      <div class="slotw"><button class="slot" id="sl_food" data-food="add" title="${esc(L('押した回数だけ兵糧を作る(1回で1単位)。作ってから3か月売れないと廃棄', 'Makes one ration per tap. Spoils if unsold for 3 months'))}">
        <span class="sn"><span>${sh.food}</span><span class="st" id="ss_food"></span></span>
        <span class="cnt" id="sc_food">×0</span>
        <span class="pg"><i id="sp_food" style="width:0"></i></span>
      </button><button class="fcan" data-food="sub" id="fcan" hidden>${L('取消', 'Undo')}</button></div>` : `
      <button class="slot" id="sl_${it.key}" data-tog="${it.key}" title="${esc(it.name + '(' + it.sub + ')・' + it.trait)}">
        <span class="sn"><span>${sh[it.key]}</span><span class="st" id="ss_${it.key}"></span></span>
        <span class="cnt" id="sc_${it.key}">×0</span>
        <span class="pg"><i id="sp_${it.key}" style="width:0"></i></span>
      </button>`).join('');
  }
  function rebuildAll() {
    applyStatic();
    if (!g) return;
    for (const id of ['A', 'B']) { const open = $('c' + id).classList.contains('open'); buildCard(id); $('c' + id).classList.toggle('open', open); }
    buildStock(); wireKey = ''; render();
  }

  // ---------- render ----------
  function setBar(id, w, color, left) {
    const el = $(id), i = el.querySelector('i');
    i.style.width = Math.max(0, Math.min(100, w)) + '%'; i.style.left = (left || 0) + '%'; i.style.background = color;
  }
  function setV(id, text, full, color) { const el = $(id); el.textContent = text; if (full) el.dataset.full = full; else delete el.dataset.full; el.style.color = color || ''; }
  function loanOf(id) { return g.loans.filter(l => l.cid === id).reduce((s, l) => s + l.amount, 0); }
  let frontArr = [];
  function front(sA) {
    const x = sA * 1000, t = g ? g.t : 0;
    const jag = [0, -18, 12, -8, 20, -13, 7, -10, 15, 0];
    frontArr = jag.map((o, i) => ({ x: x + o * (0.8 + 0.2 * Math.sin(t / 4 + i)), y: i * 500 / 9 }));
    return frontArr.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
  }
  const PAUSE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14"></rect><rect x="14" y="5" width="4" height="14"></rect></svg>';
  const PLAY_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"></path></svg>';

  function render() {
    if (!g) return;
    const busy = !started || g.over || !!g.modal || !!act;
    $('hDate').textContent = S.dateOf(g.t);
    $('hTrack').style.width = Math.min(100, g.t / S.CFG.cap * 100) + '%';
    const ps = S.priceStep(g);
    { const nx = S.nextPriceCheck(g); $('hStep').textContent = L('定価 ×', 'List x') + ps.toFixed(1) + (nx ? L('(次の見直し: ' + monthOf(nx) + ')', ' (next review: ' + monthOf(nx) + ')') : ''); }
    setV('hMoney', short(g.money), L('所持金 ', 'Cash ') + fmt(g.money));
    const p = g.money - S.CFG.startMoney;
    setV('hProfit', (p >= 0 ? '+' : '') + short(p), L('利益 ', 'Profit ') + (p >= 0 ? '+' : '') + fmt(p), p >= 0 ? 'var(--good)' : 'var(--bad2)');
    $('bPause').disabled = busy; $('bRetreat').disabled = busy;
    const playing = g.paused && started && !busy;
    $('bPause').setAttribute('aria-label', playing ? L('再開', 'Resume') : L('一時停止', 'Pause'));
    const want = playing ? 'play' : 'pause';
    if ($('bPause').dataset.s !== want) { $('bPause').dataset.s = want; $('bPause').innerHTML = playing ? PLAY_SVG : PAUSE_SVG; }

    const sA = S.territory(g, 'A'), pts = front(sA);
    $('front1').setAttribute('points', pts); $('front2').setAttribute('points', pts); $('frontGlow').setAttribute('points', pts);
    $('polyA').setAttribute('points', '0,0 ' + pts + ' 0,500');
    $('polyB').setAttribute('points', '1000,0 ' + pts + ' 1000,500');
    $('pill').style.left = (sA * 100) + '%';
    { const hist = g.history, ref = hist.length > 6 ? hist[hist.length - 7].terr : sA, d = sA - ref;
      $('pA').textContent = d > 0.004 ? L('A国が押している ▶', 'A advancing ▶') : ''; $('pB').textContent = d < -0.004 ? L('◀ B国が押している', '◀ B advancing') : '';
      if (Math.abs(d) <= 0.004) $('pA').textContent = L('膠着', 'Stalemate'); }

    for (const id of ['A', 'B']) {
      const c = g.c[id], s = S.shareOf(g, id);
      const tr = S.transitSum(c);
      setBar(id + 'frtB', c.front / SC.troop * 100, 'var(--troop)');
      setV(id + 'frtV', short(c.front), L('前線の部隊 ' + fmt(c.front) + '人(移動中 ' + fmt(tr) + '人)', 'Front ' + fmt(c.front) + ' (moving ' + fmt(tr) + ')'));
      setBar(id + 'resB', c.reserve / SC.troop * 100, 'var(--troop2)');
      setV(id + 'resV', short(c.reserve), L('後方の予備 ' + fmt(c.reserve) + '人', 'Reserve ' + fmt(c.reserve)));
      const sw = c.sortieRate * 3;
      setBar(id + 'sorB', sw / 1200 * 100, sw < 250 ? 'var(--bad)' : 'var(--brass)');
      { const q = S.eqSuff(g, c), nn = c.noNeed; setBar(id + 'eqsB', Math.min(q, SC.eq) / SC.eq * 100, nn ? 'var(--muted)' : 'var(--eq)');
        setV(id + 'eqsV', Math.min(999, Math.round(q * 100)) + '%', L('装備充足率 ' + Math.round(q * 100) + '%(兵1人あたりの装備を、どの国も同じ基準で測った値。低いほど装備を高く買い、150%を超えると武器を買わなくなり、130%を下回ると再び買う)', 'Equipment ' + Math.round(q * 100) + '% (arms per soldier, same scale for all. Lower pays more; over 150% stops buying until below 130%)'), nn ? 'var(--muted)' : ''); }
      { const cf = S.crewFill(c); setBar(id + 'crwB', Math.min(cf, SC.crew) / SC.crew * 100, cf < 0.95 ? 'var(--bad)' : cf <= 1.1 ? 'var(--warn)' : 'var(--crew)');
        setV(id + 'crwV', Math.min(999, Math.round(cf * 100)) + '%', L('人員充足率 ' + (cf * 100).toFixed(0) + '%(全軍の兵÷装備を扱う必要人数。110%以下で傭兵の相場が上がり、95%を切ると装備の相場が落ちる)', 'Crew ' + (cf * 100).toFixed(0) + '% (soldiers / crew needed for arms. At 110% or less mercs pay more; under 95% arms pay less)'), cf < 0.95 ? 'var(--bad2)' : cf <= 1.1 ? '#e2a764' : ''); }
      setV(id + 'sorV', short(sw) + L('/週', '/wk'), L('出動の勢い 毎週' + fmt(sw) + '人(予備の数・戦意・兵糧で決まる)', 'Deployment ' + fmt(sw) + '/week (set by reserve, morale and food)'), sw < 250 ? 'var(--bad2)' : '');
      setBar(id + 'morB', c.morale, c.morale < 25 ? 'var(--bad)' : 'var(--good)');
      setV(id + 'morV', c.morale.toFixed(0), null, c.morale < 25 ? 'var(--bad2)' : '');
      setBar(id + 'antB', c.antiwar, '#b8b3a6');
      setV(id + 'antV', c.antiwar.toFixed(0));
      const v = c.susp;
      setBar(id + 'susB', Math.abs(v) / 2, v >= 80 ? 'var(--bad)' : v >= 50 ? 'var(--warn)' : v < 0 ? 'var(--good)' : 'var(--brass)', v >= 0 ? 50 : 50 + v / 2);
      setV(id + 'susV', (v > 0 ? '+' : '') + v.toFixed(0), L('疑惑度 ' + v.toFixed(1) + '(-100 信頼 〜 100 疑惑/50で値引き要求・80で取引停止)', 'Suspicion ' + v.toFixed(1) + ' (-100 trust to 100 doubt; 50 wants discounts, 80 stops trade)'), v >= 50 ? '#e2a764' : v < 0 ? 'var(--good)' : '');
      const fl0 = c.foodLv, fcol = fl0 < 70 ? 'var(--bad)' : fl0 < 90 ? 'var(--warn)' : fl0 < 100 ? 'var(--brass)' : 'var(--good)';
      setBar(id + 'foodB', Math.min(fl0, 130) / 130 * 100, fcol);
      setV(id + 'foodV', Math.round(fl0) + '%', L('兵糧 ' + Math.round(fl0) + '%(100%を切ると戦意と出動が落ち始め、70%を下回ると目に見えて弱る。90%未満で高く買う。自給率 ' + Math.round(S.selfSuff(g, c) * 100) + '%)', 'Food ' + Math.round(fl0) + '% (below 100% morale and deployment slip; below 70% sharply. Pays more under 90%. Self-sufficiency ' + Math.round(S.selfSuff(g, c) * 100) + '%)'), fl0 < 70 ? 'var(--bad2)' : fl0 < 90 ? '#e2a764' : '');
      setBar(id + 'fundB', c.funds / SC.fund * 100, c.funds < S.CFG.loanLimit ? 'var(--bad)' : 'var(--brass)');
      setV(id + 'fundV', short(c.funds), L('資金 ', 'Funds ') + fmt(c.funds), c.funds < S.CFG.loanLimit ? 'var(--bad2)' : '');
      const dz = { mor: c.morale < 35, sus: c.susp >= 50, food: c.foodLv < 90, fund: c.funds < S.CFG.loanLimit, sor: c.sortieRate * 3 < 250, crw: S.crewFill(c) < 0.95 };
      let anyD = false;
      for (const k in dz) { $(id + k + 'B').classList.toggle('danger', dz[k]); $(id + k + 'V').classList.toggle('danger', dz[k]); if (dz[k]) anyD = true; }
      $('c' + id).classList.toggle('alert', anyD);
      { const tr = $(id + 'tr'), t = c.trait || ''; if (tr.textContent !== t) tr.textContent = t; tr.hidden = !t; }
      { const rk = S.collapseRisk(g, c), el = $(id + 'rk');
        if (rk.lv > 0) {
          const t = (rk.lv === 2 ? L('崩壊の危険', 'Collapse danger') : L('崩壊の注意', 'Collapse risk')) + ': ' + rk.why.join(L('・', ', ')) + (rk.weeks != null ? L('(あと約' + rk.weeks + '週で降伏)', ' (surrender in ~' + rk.weeks + ' wk)') : '');
          if (el.textContent !== t) el.textContent = t;
          el.className = 'risk lv' + rk.lv; el.hidden = false;
        } else el.hidden = true; }
      $(id + 'ct').textContent = '+' + Math.round(S.foodRestore(c)) + '%';
      const ln = loanOf(id); $(id + 'ln').textContent = ln ? short(ln) : '—';
      const fl = [], dem = S.demand(g, c);
      if (c.susp >= 80) fl.push(['bad', L('取引停止', 'Trade halted')]); else if (c.susp >= 50) fl.push(['bad', L('値引き要求', 'Wants discount')]);
      if (c.morale < 25) fl.push(['bad', L('購入意思なし', 'Not buying')]);
      else if (s > 0.65 && c.antiwar > 50) fl.push(['good', L('早期終結を望む', 'Wants it over')]);
      else if (c.noNeed) fl.push(['', L('武器は不要', 'No arms needed')]);
      if (c.foodLv < 100) fl.push([c.foodLv < 90 ? 'bad' : '', c.foodLv < 70 ? L('兵糧欠乏', 'Starving') : c.foodLv < 90 ? L('兵糧不足・高値', 'Food short, pays more') : L('兵糧不足', 'Food short')]);
      if (S.desertRate(c) > 0) fl.push(['bad', c.funds < c.initFunds * S.CFG.desertHeavy ? L('兵の大量離脱', 'Mass desertion') : L('兵の離脱', 'Desertion')]);
      if (c.funds < S.CFG.loanLimit && g.t >= O.loan.unlock && !g.loans.some(l => l.cid === id)) fl.push(['', L('融資可', 'Loan OK')]);
      if (c.susp <= -40) fl.push(['good', L('厚い信頼', 'Strong trust')]); else if (c.susp <= -15) fl.push(['good', L('信頼', 'Trust')]); else if (c.funds >= S.CFG.richLine) fl.push(['good', L('資金潤沢', 'Rich')]);
      if (c.policy !== 'normal') fl.push(['', L('方針: ', 'Policy: ') + S.POLICY[c.policy].name]);
      if (c.massing) fl.push(['bad', L('首都に集結中', 'Massing troops')]);
      if (c.transit.some(x => x.wave)) fl.push(['bad', L('大規模増援 移動中', 'Surge en route')]);
      const flh = fl.slice(0, 4).map(([k, t]) => `<span class="flag${k ? ' ' + k : ''}">${esc(t)}</span>`).join('');
      if ($(id + 'fl').innerHTML !== flh) $(id + 'fl').innerHTML = flh;
      const db = $(id + 'dbg'); db.hidden = !dbg;
      if (dbg) db.innerHTML = `<span>${L('需要', 'Demand')} <b>${dem.toFixed(2)}</b></span><span>${L('警戒', 'Alarm')} <b>${c.threat.toFixed(0)}</b></span><span>${L('基本倍率', 'Base')} <b>×${S.fairMult(g, c).toFixed(2)}</b></span><span>${L('押す力の比', 'Push')} <b>${Math.round(S.pressure(g, id) * 100)}%</b></span>`;
      document.querySelectorAll('[data-open][data-c="' + id + '"]').forEach(b => b.disabled = busy);
      const shp = $('ship' + id), items = c.pipeline.slice().sort((a, b) => a.at - b.at), sh = SHORT();
      const shh = items.slice(0, 3).map(p => `<span>${sh[p.item]} ${L('到着まで' + wk(p.at - g.t) + '週', 'in ' + wk(p.at - g.t) + ' wk')}</span>`).join('') + (items.length > 3 ? `<span>${L('ほか' + (items.length - 3) + '件', '+' + (items.length - 3) + ' more')}</span>` : '');
      if (shp.innerHTML !== shh) shp.innerHTML = shh;
    }
    for (const k in I) {
      $('sc_' + k).textContent = '×' + g.inv[k];
      const on = k === 'food' ? g.foodQueue > 0 : g.prodOn[k];
      $('sp_' + k).style.width = on ? Math.min(100, g.prodT[k] / (I[k].interval / S.CFG.prodRate) * 100) + '%' : '0';
      $('ss_' + k).textContent = k === 'food' ? (g.foodQueue > 0 ? L('作成 残り', 'Queued ') + g.foodQueue : L('押すと1単位作る', 'Tap to make')) : !on ? L('停止中', 'Paused') : g.inv[k] >= S.CFG.invCap ? L('満杯', 'Full') : L('生産中', 'Making');
      $('sl_' + k).classList.toggle('off', !on);
      if (k === 'food') $('fcan').hidden = !(g.foodQueue > 0);
    }
    renderEffects();
    renderWire();
  }
  // timed effects and schedule (top centre). Ended effects show as "ended" for about 2 weeks
  const effMemo = {};
  function renderEffects() {
    const list = [];
    if (g.order) list.push({ k: 'ord', cls: 'ord', t: L('緊急発注: ' + g.c[g.order.cid].name + ' ' + I[g.order.item].name + ' 残り' + g.order.left + '/' + g.order.qty + '・あと' + wk(g.order.deadline - g.t) + '週', 'Rush order: ' + g.c[g.order.cid].name + ' ' + I[g.order.item].name + ' ' + g.order.left + '/' + g.order.qty + ' left, ' + wk(g.order.deadline - g.t) + ' wk') });
    for (const id of ['A', 'B']) {
      const c = g.c[id];
      if (c.policy !== 'normal') list.push({ k: id + 'pol', cls: 'pol', t: L(c.name + ' 方針「' + S.POLICY[c.policy].name + '」 あと' + wk(c.policyUntil - g.t) + '週', c.name + ' "' + S.POLICY[c.policy].name + '" policy, ' + wk(c.policyUntil - g.t) + ' wk') });
      if (g.t < c.priceModUntil) list.push({ k: id + 'pm', cls: 'mod', t: L(c.name + ' 競合の参入で相場 -20% あと' + wk(c.priceModUntil - g.t) + '週', c.name + ' rival dealer: prices -20%, ' + wk(c.priceModUntil - g.t) + ' wk') });
      if (g.t < c.pushModUntil) list.push({ k: id + 'push', cls: 'mod', t: L(c.name + ' 突破作戦で押す力 +25% あと' + wk(c.pushModUntil - g.t) + '週', c.name + ' breakthrough: push +25%, ' + wk(c.pushModUntil - g.t) + ' wk') });
    }
    for (const p of (g.pending || [])) if (p.at > g.t) list.push({ k: 'pre' + p.at, cls: 'pre', t: L('予定: ' + p.label + ' あと' + wk(p.at - g.t) + '週', 'Coming: ' + p.label + ', ' + wk(p.at - g.t) + ' wk') });
    const crit = [];
    for (const id of ['A', 'B']) {
      const c = g.c[id];
      if (S.terrOf(S.shareOf(g, id)) < S.CFG.defeatAlert) crit.push({ k: id + 'def', cls: 'bad', t: L(c.name + ' 敗北の危機: これ以上押し込まれると敗北', c.name + ' on the brink: one more push means defeat') });
      if (c.surT > 0) crit.push({ k: id + 'sur', cls: 'bad', t: L(c.name + ' 降伏を検討中 あと' + wk(S.CFG.surrHold - c.surT) + '週', c.name + ' considering surrender, ' + wk(S.CFG.surrHold - c.surT) + ' wk') });
    }
    if (g.peaceT > 0) crit.push({ k: 'peace', cls: 'bad', t: L('講和の動き 成立まで あと' + wk(S.CFG.peaceHold - g.peaceT) + '週', 'Peace talks: ' + wk(S.CFG.peaceHold - g.peaceT) + ' wk to a deal') });
    list.unshift(...crit);
    const keys = new Set(list.map(x => x.k));
    for (const k in effMemo) if (!keys.has(k)) { if (!effMemo[k].endT) effMemo[k].endT = g.t; if (g.t - effMemo[k].endT > 6) delete effMemo[k]; }
    for (const x of list) effMemo[x.k] = { t: x.t, cls: x.cls };
    const strip = t => t.replace(/ あと\d+週$/, '').replace(/, \d+ wk$/, '');
    const ended = Object.entries(effMemo).filter(([k, v]) => v.endT != null).map(([k, v]) => `<span class="${v.cls} end">${esc(strip(v.t))} ${L('終了', 'ended')}</span>`);
    const h = list.map(x => `<span class="${x.cls}">${esc(x.t)}</span>`).concat(ended).slice(0, 6).join('');
    if ($('effs').innerHTML !== h) $('effs').innerHTML = h;
  }
  let wireKey = '';
  function renderWire() {
    const key = g.news.length + ':' + (g.news[0] && g.news[0].text);
    if (key === wireKey) return; wireKey = key;
    $('wire').innerHTML = g.news.slice(0, 6).map(n => `<li class="${n.kind}"><span class="t">${S.dateOf(n.t)}</span><span class="x" title="${esc(n.text)}">${esc(n.text)}</span></li>`).join('');
  }

  // ---------- crisis vignette: red = capital/surrender, green = peace/imposed peace ----------
  function crisis() {
    let red = null, green = null;
    for (const id of ['A', 'B']) {
      const c = g.c[id], tr = S.terrOf(S.shareOf(g, id));
      if (c.surT > 0) { const r = (S.CFG.surrHold - c.surT) / 3; red = red == null ? r : Math.min(red, r); }
      if (tr < S.CFG.defeatAlert) { const r = tr < 0.12 ? 2 : 9; red = red == null ? r : Math.min(red, r); }
    }
    if (g.peaceT > 0) green = (S.CFG.peaceHold - g.peaceT) / 3;
    if (g.t >= S.CFG.cap - S.CFG.capWarn) { const r = (S.CFG.cap - g.t) / 3; green = green == null ? r : Math.min(green, r); }
    return { red, green };
  }
  let vigPhase = 0;
  function updateVig(dt) {
    const el = $('vig');
    if (!g || !started || g.over || mode !== 'game' || !SET.fx) { el.style.opacity = 0; return; }
    const { red, green } = crisis();
    if (red == null && green == null) { el.style.opacity = 0; return; }
    const remain = Math.min(red == null ? 99 : red, green == null ? 99 : green);
    const period = remain <= 3 ? 0.7 : 1.6;
    vigPhase += dt / period;
    let useRed = red != null;
    if (red != null && green != null) useRed = Math.floor(vigPhase) % 2 === 0; // both: alternate each beat
    const col = useRed ? '170,32,24' : '40,150,80';
    el.style.background = `radial-gradient(ellipse at center, rgba(${col},0) 52%, rgba(${col},.55) 100%)`;
    el.style.opacity = RM() ? 0.6 : (0.3 + 0.55 * (0.5 - 0.5 * Math.cos(vigPhase * Math.PI * 2))).toFixed(3);
  }

  // ---------- living map ----------
  const FX = { cv: null, ctx: null, W: 0, H: 0, k: 1, units: { A: [], B: [] }, flashes: [], ripples: [], sparks: [], prevPipe: { A: [], B: [] }, shareLog: [], lastRipple: -99, clock: 0, lastCas: { A: null, B: null }, killAcc: { A: 0, B: 0 }, arrAcc: { A: 0, B: 0 }, prevTransit: { A: [], B: [] }, pushRate: 0, compactT: 0 };
  const MEN_PER_KILL = 3000, MEN_PER_MARKER = 3000;
  const COL = { A: { main: '#8fb6de', fill: 'rgba(36,58,84,.92)', dark: '#3b6a99' }, B: { main: '#e09a88', fill: 'rgba(84,40,32,.92)', dark: '#8e3f2f' } };
  const CAPS = { A: { x: 0.11, y: 0.77 }, B: { x: 0.89, y: 0.77 } };
  const PER_ROW = { inf: 6, armor: 5 };
  function fxResize() {
    const map = $('map'), cv = $('fx');
    FX.W = map.offsetWidth; FX.H = map.offsetHeight;
    const k = (window.devicePixelRatio || 1) * scale;
    cv.width = Math.max(1, Math.round(FX.W * k)); cv.height = Math.max(1, Math.round(FX.H * k));
    cv.style.width = FX.W + 'px'; cv.style.height = FX.H + 'px';
    FX.cv = cv; FX.ctx = cv.getContext('2d'); FX.k = k;
  }
  function frontX(yf) {
    if (!frontArr.length) return FX.W / 2;
    const yy = yf * 500;
    for (let i = 1; i < frontArr.length; i++) {
      const a = frontArr[i - 1], b = frontArr[i];
      if (yy <= b.y) { const t = (yy - a.y) / ((b.y - a.y) || 1); return (a.x + (b.x - a.x) * t) / 1000 * FX.W; }
    }
    return frontArr[frontArr.length - 1].x / 1000 * FX.W;
  }
  // fixed formation slots: row = position along the front, col = distance behind it
  function slotPos(side, slot, kind) {
    const dir = side === 'A' ? -1 : 1, step = 0.148, n = PER_ROW[kind], row = slot % n, col = Math.floor(slot / n);
    const yf = kind === 'armor' ? 0.16 + step / 2 + row * step : 0.16 + row * step;
    const off = kind === 'armor' ? 42 + col * 22 : 16 + col * 18;
    return { x: frontX(yf) + dir * off, y: yf * FX.H };
  }
  function freeSlot(list, kind) { const used = new Set(list.filter(u => u.kind === kind && u.st !== 'out' && u.st !== 'dead').map(u => u.slot)); let s = 0; while (used.has(s)) s++; return s; }
  function addUnit(side, kind, x, y, a) {
    const list = FX.units[side], slot = freeSlot(list, kind), p = slotPos(side, slot, kind), dir = side === 'A' ? -1 : 1;
    list.push({ kind, slot, x: x != null ? x : p.x + dir * 46, y: y != null ? y : p.y, a: a != null ? a : 0, st: 'live', ph: Math.random() * 6.28, kick: 0 });
  }
  // casualties: a front-row unit falls; the one behind it steps up later
  function processKills(side) {
    const cas = g.cas[side];
    if (FX.lastCas[side] == null) { FX.lastCas[side] = cas; return; }
    FX.killAcc[side] += cas - FX.lastCas[side]; FX.lastCas[side] = cas;
    while (FX.killAcc[side] >= MEN_PER_KILL) {
      FX.killAcc[side] -= MEN_PER_KILL;
      const live = FX.units[side].filter(u => u.kind === 'inf' && u.st === 'live');
      if (!live.length) break;
      live.sort((a, b) => a.slot - b.slot);
      const frontRow = live.filter(u => u.slot < PER_ROW.inf);
      const pool = frontRow.length ? frontRow : live.slice(0, 3);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      pick.st = 'dead'; pick.t0 = FX.clock;
      for (let i = 0; i < 5; i++) FX.sparks.push({ x: pick.x, y: pick.y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, t0: FX.clock, life: 0.45, c: '255,120,90' });
    }
  }
  function syncUnits(side) {
    const c = g.c[side], list = FX.units[side];
    const want = { armor: Math.max(0, Math.min(8, Math.round(c.power * 0.25 / 120000))), inf: Math.max(c.front > 1000 ? 1 : 0, Math.min(24, Math.round(c.front / 4500))) };
    for (const kind of ['armor', 'inf']) {
      const live = list.filter(u => u.kind === kind && u.st === 'live');
      const lo = kind === 'inf' && started ? want[kind] - 2 : want[kind], hi = kind === 'inf' && started ? want[kind] + 2 : want[kind];
      if (live.length < lo) for (let n = live.length; n < lo; n++) addUnit(side, kind);
      else if (live.length > hi) { live.sort((a, b) => b.slot - a.slot); for (let n = 0; n < live.length - hi; n++) { live[n].st = 'out'; live[n].t0 = FX.clock; } }
    }
  }
  // close gaps one unit at a time: the unit directly behind a hole steps forward
  function compactSlots(side) {
    for (const kind of ['inf', 'armor']) {
      const n = PER_ROW[kind], live = FX.units[side].filter(u => u.kind === kind && u.st === 'live');
      const used = new Set(live.map(u => u.slot));
      for (const u of live.sort((a, b) => a.slot - b.slot)) { const tgt = u.slot - n; if (tgt >= 0 && !used.has(tgt)) { used.delete(u.slot); u.slot = tgt; used.add(tgt); return; } }
    }
  }
  function drawUnit(ctx, u, side, s) {
    const col = COL[side], w = (u.kind === 'armor' ? 17 : 14) * s, h = (u.kind === 'armor' ? 11 : 9) * s;
    const grow = u.st === 'dead' ? 1 + (FX.clock - u.t0) * 0.6 : 1;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, u.a)); ctx.translate(u.x, u.y); ctx.scale(grow, grow);
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 3 * s; ctx.shadowOffsetY = 1;
    ctx.fillStyle = col.fill; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = u.st === 'dead' ? '#ff7a5f' : col.main; ctx.lineWidth = 1.3;
    ctx.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1);
    ctx.beginPath();
    if (u.kind === 'armor') ctx.ellipse(0, 0, w * 0.3, h * 0.24, 0, 0, Math.PI * 2);
    else { ctx.moveTo(-w / 2 + 1, -h / 2 + 1); ctx.lineTo(w / 2 - 1, h / 2 - 1); ctx.moveTo(w / 2 - 1, -h / 2 + 1); ctx.lineTo(-w / 2 + 1, h / 2 - 1); }
    ctx.stroke(); ctx.restore();
  }
  function convoyPoint(side, p) {
    const lag = I[p.item].lag, prog = Math.max(0, Math.min(1, 1 - (p.at - g.t) / lag));
    if (p.vy == null) p.vy = 0.2 + Math.random() * 0.65;
    const cp = CAPS[side], sx = cp.x * FX.W, sy = cp.y * FX.H, ex = frontX(p.vy), ey = p.vy * FX.H;
    const mx = (sx + ex) / 2, my = Math.max(sy, ey) + 30;
    const t = prog, x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * mx + t * t * ex, y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * my + t * t * ey;
    return { x, y, sx, sy, mx, my, ex, ey, prog };
  }
  function drawConvoy(ctx, side, p, s) {
    const q = convoyPoint(side, p), col = COL[side];
    ctx.save(); ctx.globalAlpha = 0.3; ctx.strokeStyle = '#c8a14c'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(q.sx, q.sy); ctx.quadraticCurveTo(q.mx, q.my, q.ex, q.ey); ctx.stroke(); ctx.restore();
    const trail = { equip: [3, 0, 10], merc: [6, 1.6, 5], food: [4, 2.2, 6] }[p.item];
    for (let n = 0; n < trail[0]; n++) {
      const back = n * trail[2], lag = I[p.item].lag, dprog = back / (Math.hypot(q.ex - q.sx, q.ey - q.sy) || 1);
      const r = convoyPoint(side, Object.assign({}, p, { at: p.at + dprog * lag })); if (r.prog <= 0) continue;
      ctx.fillStyle = col.main; ctx.strokeStyle = '#14171a'; ctx.lineWidth = 1;
      if (p.item === 'equip') { const w = 9 * s, h = 6 * s; ctx.fillRect(r.x - w / 2, r.y - h / 2, w, h); ctx.strokeRect(r.x - w / 2, r.y - h / 2, w, h); }
      else { ctx.beginPath(); ctx.arc(r.x, r.y, trail[1] * s, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  function drawTroops(ctx, side, x, s) {
    const prog = Math.max(0, Math.min(1, (g.t - x.t0) / ((x.at - x.t0) || 1)));
    if (x.k == null) { FX.arrAcc[side] += x.n; x.k = Math.floor(FX.arrAcc[side] / MEN_PER_MARKER); FX.arrAcc[side] -= x.k * MEN_PER_MARKER; }
    if (!x.k) return;
    const cp = CAPS[side], sx = cp.x * FX.W, sy = cp.y * FX.H, list = FX.units[side];
    if (!x.slots) { x.slots = []; const used = new Set(list.filter(u => u.kind === 'inf' && u.st === 'live').map(u => u.slot)); let s0 = 0; for (let i = 0; i < x.k; i++) { while (used.has(s0)) s0++; x.slots.push(s0); used.add(s0); } }
    x._pos = [];
    for (let i = 0; i < x.k; i++) {
      const end = slotPos(side, x.slots[i], 'inf');
      const e = Math.max(0, Math.min(1, prog - i * (x.wave ? 0.012 : 0.04))), pr = e * e * (3 - 2 * e);
      const px = sx + (end.x - sx) * pr, py = sy + (end.y - sy) * pr;
      x._pos.push({ x: px, y: py });
      drawUnit(ctx, { x: px, y: py, kind: 'inf', a: 0.75, st: 'live' }, side, s);
    }
  }
  function detectTroopArrivals(side) {
    const now = g.c[side].transit, prev = FX.prevTransit[side];
    for (const x of prev) if (!now.includes(x) && x.k) for (let i = 0; i < x.k; i++) { const p = (x._pos && x._pos[i]) || null; addUnit(side, 'inf', p ? p.x : null, p ? p.y : null, 0.75); }
    FX.prevTransit[side] = now.slice();
  }
  function detectArrivals(side) {
    const now = g.c[side].pipeline, prev = FX.prevPipe[side];
    for (const p of prev) if (!now.includes(p) && p.at <= g.t + 0.2) FX.flashes.push({ side, yf: p.vy == null ? 0.5 : p.vy, t0: FX.clock, big: p.item !== 'food' });
    FX.prevPipe[side] = now.slice();
  }
  function detectPush() {
    const sA = S.territory(g, 'A');
    FX.shareLog.push({ t: g.t, s: sA }); while (FX.shareLog.length && FX.shareLog[0].t < g.t - 2) FX.shareLog.shift();
    const d = sA - FX.shareLog[0].s;
    FX.pushRate += (d - FX.pushRate) * 0.2;
    if (Math.abs(d) > 0.012 && FX.clock - FX.lastRipple > 1.4) { FX.lastRipple = FX.clock; FX.ripples.push({ side: d > 0 ? 'A' : 'B', yf: 0.25 + Math.random() * 0.55, t0: FX.clock }); }
  }
  function fxFrame(dt) {
    if (!FX.ctx || !g) return;
    FX.clock += dt;
    const ctx = FX.ctx, s = stage.classList.contains('compact') ? 0.8 : 1, live = started && !g.paused && !g.over, rm = RM();
    ctx.setTransform(FX.k, 0, 0, FX.k, 0, 0);
    ctx.clearRect(0, 0, FX.W, FX.H);
    if (live) { detectArrivals('A'); detectArrivals('B'); detectPush(); }
    else { FX.prevPipe.A = g.c.A.pipeline.slice(); FX.prevPipe.B = g.c.B.pipeline.slice(); }
    const push = Math.max(-1, Math.min(1, FX.pushRate * 60)); // >0: A pushing, <0: B pushing
    FX.compactT += dt; const doCompact = FX.compactT > 0.35; if (doCompact) FX.compactT = 0;
    for (const side of ['A', 'B']) {
      if (live) { detectTroopArrivals(side); processKills(side); } else FX.prevTransit[side] = g.c[side].transit.slice();
      syncUnits(side); if (doCompact && live) compactSlots(side);
      const dir = side === 'A' ? -1 : 1, mine = side === 'A' ? push : -push, list = FX.units[side];
      for (const u of list) {
        if (u.st === 'dead') { u.a -= dt * 1.6; }
        else if (u.st === 'out') { u.a -= dt * 0.9; u.x += dir * dt * 14; }
        else {
          u.a = Math.min(1, u.a + dt * 1.2);
          const p = slotPos(side, u.slot, u.kind), sp = Math.min(1, dt * 1.6);
          u.x += (p.x - u.x) * sp; u.y += (p.y - u.y) * sp;
        }
        let ox = 0;
        if (live && !rm && u.st === 'live') {
          ox = Math.sin(FX.clock * 2 + u.ph) * 1.1;
          if (mine > 0.15) ox += -dir * mine * 5 * Math.max(0, Math.sin(FX.clock * 5 + u.ph)); // the attacker surges forward
          else if (mine < -0.15) ox += (Math.random() - 0.5) * 2.4 * -mine; // the defender is shaken
        }
        const keep = u.x; u.x += ox; drawUnit(ctx, u, side, s); u.x = keep;
      }
      FX.units[side] = list.filter(u => u.a > 0 || u.st === 'live');
      for (const p of g.c[side].pipeline) drawConvoy(ctx, side, p, s);
      for (const x of g.c[side].transit) drawTroops(ctx, side, x, s);
      if (g.c[side].massing) {
        const cp = CAPS[side], n = Math.min(14, Math.round(g.c[side].reserve / 6000));
        for (let i = 0; i < n; i++) { const r = i % 5, q = Math.floor(i / 5);
          drawUnit(ctx, { x: cp.x * FX.W + (side === 'A' ? 1 : -1) * (30 + q * 17), y: cp.y * FX.H - 34 + r * 13, kind: 'inf', st: 'live', a: 0.55 + 0.25 * Math.sin(FX.clock * 3 + i) }, side, s * 0.85); }
      }
    }
    // gunfire along the front: busier when one side is pushing hard
    if (live && !rm) {
      const rate = 3 + Math.abs(push) * 14;
      if (Math.random() < rate * dt) { const yf = 0.12 + Math.random() * 0.8, x = frontX(yf) + (Math.random() - 0.5) * 18; FX.sparks.push({ x, y: yf * FX.H, vx: 0, vy: 0, t0: FX.clock, life: 0.22, c: '255,226,160', r: 2 + Math.random() * 2 }); }
    }
    FX.sparks = FX.sparks.filter(p => {
      const age = FX.clock - p.t0; if (age > p.life) return false;
      const k = age / p.life; ctx.fillStyle = `rgba(${p.c},${(1 - k) * 0.9})`;
      ctx.beginPath(); ctx.arc(p.x + p.vx * age, p.y + p.vy * age, (p.r || 1.6) * s * (1 - k * 0.5), 0, Math.PI * 2); ctx.fill(); return true;
    });
    FX.flashes = FX.flashes.filter(f => {
      const age = FX.clock - f.t0, dur = 0.9; if (age > dur) return false;
      const x = frontX(f.yf), y = f.yf * FX.H, k = age / dur, R = (f.big ? 30 : 20) * s * (0.4 + k);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, 'rgba(226,192,125,' + (0.7 * (1 - k)) + ')'); gr.addColorStop(1, 'rgba(226,192,125,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill(); return true;
    });
    FX.ripples = FX.ripples.filter(r => {
      const age = FX.clock - r.t0, dur = rm ? 0.6 : 1.3; if (age > dur) return false;
      const x = frontX(r.yf), y = r.yf * FX.H, k = age / dur;
      ctx.strokeStyle = COL[r.side].main; ctx.globalAlpha = 0.6 * (1 - k); ctx.lineWidth = 2;
      for (const m of [1, 0.6]) { ctx.beginPath(); ctx.arc(x, y, (8 + 42 * k) * m * s, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1; return true;
    });
  }

  // ---------- tooltip ----------
  let tipTimer = null;
  function showTip(el) {
    const tip = $('tip'), sr = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    tip.textContent = el.dataset.full; tip.hidden = false;
    let x = (r.left + r.width / 2 - sr.left) / scale, y = (r.top - sr.top) / scale - 6;
    const w = tip.offsetWidth, W = stage.offsetWidth;
    x = Math.max(w / 2 + 6, Math.min(W - w / 2 - 6, x)); if (y < tip.offsetHeight + 4) y = (r.bottom - sr.top) / scale + tip.offsetHeight + 8;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  stage.addEventListener('pointerover', e => { const el = e.target.closest('[data-full]'); if (el && el.dataset.full && e.pointerType === 'mouse') showTip(el); });
  stage.addEventListener('pointerout', e => { if (e.target.closest('[data-full]') && e.pointerType === 'mouse') $('tip').hidden = true; });
  stage.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-full]');
    if (el && el.dataset.full && e.pointerType !== 'mouse') { showTip(el); clearTimeout(tipTimer); tipTimer = setTimeout(() => $('tip').hidden = true, 2200); }
  });

  // ---------- modal plumbing ----------
  function showModal(html, cls) { const m = $('mc'); m.className = 'mc' + (cls ? ' ' + cls : ''); m.innerHTML = html; $('modal').hidden = false; $('tip').hidden = true; m.scrollTop = 0; }
  function hideModal() { $('modal').hidden = true; }

  // ---------- action dossiers ----------
  function openAct(kind, cid) {
    if (!started || g.over || g.modal) return;
    const first = ['equip', 'merc', 'food'].find(k => g.inv[k] > 0);
    act = { kind, cid, item: first || (act && act.item) || 'equip', m: 1, msg: '', ok: true, log: [], blocked: false };
    g.paused = true; render(); renderAct(true);
  }
  function closeAct() { if (!act) return; act = null; hideModal(); g.paused = false; render(); }
  function mbar(pct, color, ticks, left) {
    return `<div class="bar"><i style="width:${Math.max(0, Math.min(100, pct))}%;left:${left || 0}%;background:${color}"></i>${(ticks || []).map(t => `<span class="tk" style="left:${t}%"></span>`).join('')}</div>`;
  }
  function mrow(label, pct, color, val, ticks, left, vcolor) { return `<span class="ml">${label}</span>${mbar(pct, color, ticks, left)}<span class="mv"${vcolor ? ` style="color:${vcolor}"` : ''}>${val}</span>`; }
  function susRow(c) { const v = c.susp; return mrow(L('疑惑度', 'Suspicion'), Math.abs(v) / 2, v >= 80 ? 'var(--bad)' : v >= 50 ? 'var(--warn)' : v < 0 ? 'var(--good)' : 'var(--brass)', (v > 0 ? '+' : '') + v.toFixed(0), [50, 75, 90], v >= 0 ? 50 : 50 + v / 2, v >= 50 ? '#e2a764' : v < 0 ? 'var(--good)' : ''); }
  function flagsOf(c) {
    const fl = [], s = S.shareOf(g, c.id);
    if (c.susp <= -40) fl.push(['good', L('厚い信頼', 'Strong trust')]); else if (c.susp <= -15) fl.push(['good', L('信頼', 'Trust')]); else if (c.funds >= S.CFG.richLine) fl.push(['good', L('資金潤沢', 'Rich')]);
    if (c.susp >= 80) fl.push(['bad', L('取引停止', 'Trade halted')]); else if (c.susp >= 50) fl.push(['bad', L('値引き要求', 'Wants discount')]);
    if (c.morale < 25) fl.push(['bad', L('購入意思なし', 'Not buying')]); else if (s > 0.65 && c.antiwar > 50) fl.push(['good', L('早期終結を望む', 'Wants it over')]); else if (c.noNeed) fl.push(['', L('武器は不要', 'No arms needed')]);
    if (c.foodLv < 100) fl.push([c.foodLv < 90 ? 'bad' : '', c.foodLv < 70 ? L('兵糧欠乏', 'Starving') : c.foodLv < 90 ? L('兵糧不足・高値', 'Food short, pays more') : L('兵糧不足', 'Food short')]);
    fl.push(['', L('方針: ', 'Policy: ') + S.POLICY[c.policy].name + (c.policy !== 'normal' ? L('(あと' + wk(c.policyUntil - g.t) + '週)', ' (' + wk(c.policyUntil - g.t) + ' wk)') : '')]);
    if (c.massing) fl.push(['bad', L('首都に集結中', 'Massing troops')]);
    if (c.transit.some(x => x.wave)) fl.push(['bad', L('大規模増援 移動中', 'Surge en route')]);
    return `<div class="mflags">${fl.map(([k, t]) => `<span class="flag${k ? ' ' + k : ''}">${esc(t)}</span>`).join('')}</div>`;
  }
  // status block in the sell/covert screens: the same gauges as the nation's card, in the same order and look
  const strip = el => { el.querySelectorAll('[id]').forEach(x => x.removeAttribute('id')); el.removeAttribute('id'); return el; };
  function gaugesOf(id) { const gg = $('c' + id).querySelector('.gg').cloneNode(true); return strip(gg).outerHTML; }
  function susOnly(id) {
    const lb = $(id + 'susL'), parts = [lb.previousElementSibling, lb, $(id + 'susB'), $(id + 'susV')];
    return '<div class="gg">' + parts.map(p => strip(p.cloneNode(true)).outerHTML).join('') + '</div>';
  }
  function panel(c, kind) {
    const oc = g.c[S.other(c.id)];
    let h = `<div class="mstat ${c.id}"><div class="msh"><span class="nm">${esc(c.name)}</span><span class="tr">${esc(c.trait || '')}</span></div>${flagsOf(c)}${gaugesOf(c.id)}</div>`;
    if (kind === 'ops') h += `<div class="mstat ${oc.id}"><div class="msh"><span class="nm">${esc(oc.name)}</span><span class="tr">${L('暗躍の疑惑は相手国にも波及する', 'Covert work raises its suspicion too')}</span></div>${susOnly(oc.id)}</div>`;
    return h;
  }
  function logHTML() { return act.log.length ? `<div class="stamp">${L('この停止中の行動', 'Actions this pause')}</div><ul class="mlog">${act.log.slice().reverse().map(l => `<li class="${l.ok ? 'ok' : 'ng'}">${esc(l.text)}</li>`).join('')}</ul>` : ''; }
  const respHTML = () => `<div class="resp ${act.ok ? 'ok' : 'ng'}">${esc(act.msg)}</div>`;
  const stampOf = k => k + L(' / 時が止まっています ', ' / Time is stopped ') + S.dateOf(g.t);
  function renderAct(focus) {
    const c = g.c[act.cid], oc = act.cid ? g.c[S.other(act.cid)] : null, sh = SHORT();
    let h = '';
    if (act.kind === 'sell') {
      const picks = Object.values(I).map(it => {
        const est = S.estimate(g, c, it.key), ld = c.lastDeal[it.key];
        const info = it.key === 'food' ? foodInfo(c, est)
          : ld ? L('前回 ×' + ld.m.toFixed(2) + '・' + Math.max(0, Math.round((g.t - ld.t) / 3)) + '週前(' + ld.label + ')', 'Last x' + ld.m.toFixed(2) + ', ' + Math.max(0, Math.round((g.t - ld.t) / 3)) + ' wk ago (' + ld.label + ')') : L('前回の取引なし', 'No deal yet');
        return `<button class="pick${act.item === it.key ? ' sel' : ''}" data-pick="${it.key}">
          <span class="pn"><span>${sh[it.key]}</span><span class="num">×${g.inv[it.key]}</span></span>
          <span class="pl tr">${esc(it.trait)}</span>
          <span class="pl num">${L('定価 ', 'List ')}${fmt(S.listPrice(g, it.key))}</span>
          <span class="pe">${esc(info)}${dbg ? L('(実際×', ' (true x') + S.fairMult(g, c, it.key).toFixed(2) + ')' : ''}</span>${priceTags(c)}</button>`;
      }).join('');
      const has = g.inv[act.item] > 0;
      h = `<div class="stamp">${stampOf(L('販売', 'Sell'))}</div><h2>${L(c.name + 'へ売り込む', 'Sell to ' + c.name)}</h2>
        <div class="picks">${picks}</div>
        <div class="priceline"><span class="mult" id="mMult"></span><span class="yen" id="mYen"></span></div>
        <input type="range" id="mRange" min="0" max="2" step="0.05" value="${act.m}" aria-label="${L('価格倍率', 'Price multiplier')}">
        <div class="quick">${[[0, L('無償供与', 'Free')], [0.3, '×0.3'], [0.5, '×0.5'], [0.8, '×0.8'], [1, '×1.0'], [1.2, '×1.2'], [1.5, '×1.5'], [1.8, '×1.8'], [2, '×2.0']].map(([m, l]) => `<button class="btn" data-qm="${m}">${l}</button>`).join('')}</div>
        <div class="foot"><button class="btn" data-do="close">${L('閉じて再開', 'Close and resume')}</button><button class="btn primary" data-do="sell" ${has && !act.blocked ? '' : 'disabled'}>${sellLabel(has)}</button></div>
        ${respHTML()}${panel(c, 'sell')}${logHTML()}`;
    } else if (act.kind === 'home') {
      showModal(`<div class="stamp">${stampOf(L('ホームに戻る', 'Home'))}</div><h2>${L('今の戦争を捨ててホームに戻りますか', 'Abandon this war and go home?')}</h2>
        <p>${L('今の戦争は精算されず、記録も残りません。', 'This war will not be settled or recorded.')}</p>
        <div class="foot"><button class="btn" data-do="close">${L('続ける', 'Keep playing')}</button><button class="btn primary" data-do="home">${L('ホームに戻る', 'Go home')}</button></div>`);
      if (focus) { const b = $('mc').querySelector('[data-do="close"]'); if (b) b.focus(); }
      return;
    } else if (act.kind === 'retreat') {
      showModal(`<div class="stamp">${stampOf(L('撤退', 'Withdraw'))}</div><h2>${L('ここで手を引きますか', 'Pull out now?')}</h2>
        <p>${L('現在の所持金で精算し、試合を終えます。倉庫の在庫は価値を失い、貸し付けた融資は回収できません。戦争はあなた抜きで続きます。', 'You settle with the cash you hold and end the match. Stock is lost and loans are not repaid. The war goes on without you.')}</p>
        <div class="kv"><span>${L('所持金', 'Cash')} <b>${fmt(g.money)}</b></span><span>${L('利益', 'Profit')} <b>${(g.money - S.CFG.startMoney >= 0 ? '+' : '') + fmt(g.money - S.CFG.startMoney)}</b></span><span>${L('融資残高', 'Loans out')} <b>${short(loanOf('A') + loanOf('B'))}</b></span></div>
        <div class="foot"><button class="btn" data-do="close">${L('続ける', 'Keep playing')}</button><button class="btn primary" data-do="retreat">${L('精算して撤退', 'Settle and withdraw')}</button></div>`);
      if (focus) { const b = $('mc').querySelector('[data-do="close"]'); if (b) b.focus(); }
      return;
    } else {
      const cn = c.name, on = oc.name, wkLeft = c.policy !== 'normal' ? wk(c.policyUntil - g.t) : 0;
      const now = c.policy === 'normal' ? '' : L('現在の方針: ' + S.POLICY[c.policy].name + '(あと' + wkLeft + '週)', 'Current policy: ' + S.POLICY[c.policy].name + ' (' + wkLeft + ' wk left)');
      const rows = [
        ['assassin', null, O.assassin.name, L(cn + 'の戦意 +15・反戦感情 -10。疑惑度 ' + cn + ' +30・' + on + ' +10。', cn + ' morale +15, anti-war -10. Suspicion ' + cn + ' +30, ' + on + ' +10.')],
        ['rumor', null, O.rumor.name, L(cn + 'の戦意 +8。疑惑度 ' + cn + ' +10・' + on + ' +3。', cn + ' morale +8. Suspicion ' + cn + ' +10, ' + on + ' +3.')],
        ['consult', 'aggr', L('戦争コンサル【積極・攻撃的】', 'War Consulting [Aggressive]'), L('10週間、' + cn + 'の司令部を攻撃的な方針にする。装備・傭兵の相場 +0.15、前線への出動 1.8倍、押す力 +15%。その間、反戦感情が上がり(計+4.5)戦意が下がっていく(計-3)。疑惑度 ' + cn + ' +5。', 'For 10 weeks ' + cn + ' HQ turns aggressive: arms and merc prices +0.15, deployment x1.8, push +15%. Meanwhile anti-war rises (+4.5 total) and morale falls (-3 total). Suspicion ' + cn + ' +5.')],
        ['consult', 'pass', L('戦争コンサル【消極・保守的】', 'War Consulting [Cautious]'), L('10週間、' + cn + 'の司令部を保守的な方針にする。装備・傭兵の相場 -0.1、前線への出動 0.5倍、押す力 -12%(相手の大規模増援には対抗する)。その間、反戦感情が下がり(計-4.5)戦意が上がっていく(計+3)。疑惑度 ' + cn + ' +5。', 'For 10 weeks ' + cn + ' HQ turns cautious: arms and merc prices -0.1, deployment x0.5, push -12% (still counters surges). Meanwhile anti-war falls (-4.5 total) and morale rises (+3 total). Suspicion ' + cn + ' +5.')],
        ['loan', null, O.loan.name, L(cn + 'へ50万を貸す。各国1回まで、資金30万以下の国だけが受け入れる。終戦時に利息20%を付けて回収、崩壊したら回収できない。', 'Lend 500K to ' + cn + '. Once per nation; only nations with 300K or less accept. Repaid +20% at war end; lost if it collapses.')],
      ].map(([k, arg, name, d]) => {
        let why = '';
        if (g.cd[k] > 0) why = L('あと' + Math.ceil(g.cd[k] / 3) + '週で使える', 'Ready in ' + Math.ceil(g.cd[k] / 3) + ' wk') + (k === 'consult' ? L('(積極・消極で共通)', ' (shared by both)') : '');
        else if (k === 'loan' && g.loans.some(l => l.cid === c.id)) why = L(cn + 'へは融資済み', 'Already lent to ' + cn);
        else if (k === 'loan' && c.funds > S.CFG.loanLimit) why = L(cn + 'の資金が30万を超えているため受け入れない', cn + ' has over 300K and refuses');
        else if (g.money < O[k].cost) why = L('所持金が足りない', 'Not enough cash');
        const note = k === 'consult' && now ? `<div class="onow">${esc(now)}</div>` : '';
        return `<div class="oprow"><div><div class="on">${esc(name)} <span class="oc num">${fmt(O[k].cost)}</span></div><div class="od">${esc(d)}</div>${note}${why ? `<div class="why">${esc(why)}</div>` : ''}</div>
          <button class="btn" data-op="${k}"${arg ? ` data-arg="${arg}"` : ''} ${why ? 'disabled' : ''}>${L('実行', 'Do it')}</button></div>`;
      }).join('');
      h = `<div class="stamp">${stampOf(L('暗躍', 'Covert'))}</div><h2>${L(cn + 'に対して動く', 'Act on ' + cn)}</h2>
        <div class="oplist">${rows}</div>
        <div class="foot"><button class="btn" data-do="close">${L('閉じて再開', 'Close and resume')}</button></div>
        ${respHTML()}${panel(c, 'ops')}${logHTML()}`;
    }
    const keep = focus ? 0 : $('mc').scrollTop;
    showModal(h, act.cid); $('mc').scrollTop = keep;
    if (act.kind === 'sell') updatePrice();
    if (focus) { const b = $('mc').querySelector('[data-do="close"]'); if (b) b.focus(); }
  }
  // food market shown to two decimals; what lowers prices is shown as tags on each item
  function foodInfo(c, est) {
    return L('相場 ×' + est.toFixed(2) + '(兵糧' + Math.round(c.foodLv) + '%・1単位で+' + Math.round(S.foodRestore(c)) + '%)', 'Market x' + est.toFixed(2) + ' (food ' + Math.round(c.foodLv) + '%, +' + Math.round(S.foodRestore(c)) + '% per unit)');
  }
  function priceTags(c) {
    const t = [];
    if (g.t < c.priceModUntil) t.push(L('競合の参入 -20%', 'Rival dealer -20%'));
    if (c.susp >= 50) t.push(L('疑惑度50以上 -20%', 'Suspicion 50+ -20%'));
    if (c.susp >= 80) t.push(L('疑惑度80以上 取引停止', 'Suspicion 80+ trade halted'));
    return t.length ? `<span class="ptags">${t.map(x => `<span class="ptag">${esc(x)}</span>`).join('')}</span>` : '';
  }
  const sellLabel = has => !has ? L('在庫なし', 'Out of stock') : act.blocked ? L('価格を変えてください', 'Change the price') : act.m === 0 ? L('無償で渡す', 'Give for free') : L('売り込む', 'Offer');
  function updatePrice() {
    const mM = $('mMult'), mY = $('mYen'); if (!mM) return;
    mM.textContent = act.m === 0 ? L('無償', 'Free') : '×' + act.m.toFixed(2);
    const rg = $('mRange'); if (rg) rg.style.setProperty('--fill', (act.m / 2 * 100) + '%');
    mY.textContent = act.m === 0 ? '0' : fmt(Math.round(S.listPrice(g, act.item) * act.m));
    const b = $('mc').querySelector('[data-do="sell"]');
    if (b && g.inv[act.item] > 0) { b.disabled = act.blocked; b.textContent = sellLabel(true); }
  }

  // ---------- engine modals ----------
  function eventModal(m) {
    showModal(`<div class="stamp">${esc(m.stamp || (m.pre ? L('事前情報 / 国内未発表', 'Advance intel / not yet public') : L('速報', 'Breaking')))} ${S.dateOf(g.t)}</div><h2>${esc(m.title)}</h2><p>${esc(m.text)}</p>
      <div class="foot"><button class="btn primary" id="mGo">${L('確認して再開', 'OK, resume')}</button></div>`);
    $('mGo').onclick = () => { hideModal(); g.modal = null; g.paused = false; render(); };
    $('mGo').focus();
  }
  function orderModal(m) {
    const c = g.c[m.cid], it = I[m.item];
    showModal(`<div class="stamp">${L('緊急発注', 'Rush order')} / ${S.dateOf(g.t)}</div><h2>${L(c.name + 'から至急の依頼', 'Urgent request from ' + c.name)}</h2>
      <p>${esc(L(c.name + 'が' + it.name + '(' + it.sub + ')を' + m.qty + 'セット、' + m.weeks + '週以内に求めています。価格は定価の' + m.mult.toFixed(2) + '倍です(現在の相場は約' + m.fair.toFixed(2) + '倍)。', c.name + ' needs ' + m.qty + ' sets of ' + it.name + ' (' + it.sub + ') within ' + m.weeks + ' weeks at x' + m.mult.toFixed(2) + ' list (market is about x' + m.fair.toFixed(2) + ').'))}</p>
      <div class="kv"><span>${L('1セット', 'Per set')} <b>${fmt(m.unit)}</b></span><span>${L('合計', 'Total')} <b>${fmt(m.unit * m.qty)}</b></span><span>${L('現在の在庫', 'In stock')} <b>×${g.inv[m.item]}</b></span><span>${L(c.name + 'の戦況', c.name + ' land')} <b>${Math.round(S.territory(g, m.cid) * 100)}%</b></span></div>
      <p style="font-size:12px;color:var(--muted)">${L('引き受けると、在庫ができ次第自動で納品し、1セットごとに代金を受け取ります。納品のたびに疑惑度が少し下がります。すべて期限内に納品すると、疑惑度-8・戦意+3の報酬があります。期限までに揃わなければ、約束を破ったとして疑惑度が10上がります。', 'If you accept, sets ship automatically as stock allows and you are paid per set. Each delivery lowers suspicion a little. Delivering all in time gives suspicion -8 and morale +3. Missing the deadline raises suspicion by 10.')}</p>
      <div class="foot"><button class="btn" id="mNo">${L('見送る', 'Decline')}</button><button class="btn primary" id="mGo">${L('引き受ける', 'Accept')}</button></div>`, m.cid);
    $('mGo').onclick = () => { hideModal(); S.answerOrder(g, true); render(); };
    $('mNo').onclick = () => { hideModal(); S.answerOrder(g, false); render(); };
    $('mGo').focus();
  }
  function ledgerHTML(r) {
    const sp = r.supplied, oc = r.opsCount, b = r.base, en = S.LANG.cur === 'en';
    const parts = [];
    if (sp.equip) parts.push(L('装備一式' + sp.equip + '組', sp.equip + ' arms kits'));
    if (sp.merc) parts.push(L('傭兵' + fmt(sp.merc * 10000) + '人', fmt(sp.merc * 10000) + ' mercenaries'));
    if (sp.food) parts.push(L('兵糧' + sp.food + '単位', sp.food + ' ration units'));
    const ops = [['assassin', L('要人暗殺', 'assassinations')], ['rumor', L('悪評の流布', 'smear campaigns')], ['consult', L('戦争コンサル', 'consultations')], ['loan', L('融資', 'loans')]].filter(([k]) => oc[k] > 0).map(([k, n]) => en ? oc[k] + ' ' + n : n + oc[k] + '件');
    const cas = Math.round(r.cas / 100) * 100;
    let rows = `<div><span>${L('供給したもの', 'Supplied')}</span><b>${parts.length ? parts.join(L('、', ', ')) : L('なし', 'nothing')}</b></div>
      <div><span>${L('裏で動いた記録', 'Covert record')}</span><b>${ops.length ? ops.join(L('、', ', ')) : L('なし', 'none')}</b></div>`;
    let verdict = '', coda = '';
    if (r.type === 'retreat') {
      rows += `<div><span>${L('あなたが関わった期間', 'Weeks involved')}</span><b>${r.weeks}${L('週', ' wk')}</b></div><div><span>${L('その間の推計死傷者', 'Est. casualties')}</span><b>${fmt(cas)}</b></div>`;
      coda = L('あなたが去った後も、戦争は続いている。', 'The war goes on after you leave.');
    } else if (b) {
      const dw = r.weeks - b.weeks, dc = Math.round((r.cas - b.cas) / 100) * 100;
      rows += `<div><span>${L('戦争の長さ', 'War length')}</span><b>${L(r.weeks + '週(あなたがいなければ 約' + b.weeks + '週)', r.weeks + ' wk (about ' + b.weeks + ' without you)')}</b></div>
        <div><span>${L('推計死傷者', 'Est. casualties')}</span><b>${L(fmt(cas) + '人(あなたがいなければ 約' + fmt(Math.round(b.cas / 100) * 100) + '人)', fmt(cas) + ' (about ' + fmt(Math.round(b.cas / 100) * 100) + ' without you)')}</b></div>`;
      verdict = (dw > 0 ? L('あなたの商売で、戦争は' + dw + '週長引いた。', 'Your trade made the war ' + dw + ' weeks longer. ') : dw < 0 ? L('あなたの商売で、戦争は' + (-dw) + '週早く終わった。', 'Your trade ended the war ' + (-dw) + ' weeks sooner. ') : L('あなたがいてもいなくても、戦争の長さは変わらなかった。', 'With or without you, the war lasted as long. '))
        + (dc > 0 ? L('死傷者は約' + fmt(dc) + '人増えた。', 'About ' + fmt(dc) + ' more were killed or wounded.') : dc < 0 ? L('死傷者は約' + fmt(-dc) + '人少なかった。', 'About ' + fmt(-dc) + ' fewer were killed or wounded.') : '');
      coda = dc > 0 ? L('その' + fmt(dc) + '人の名は、あなたの帳簿には載らない。', 'Those ' + fmt(dc) + ' names will never appear in your ledger.') : L('利益は帳簿に残り、死者は数字として残る。', 'The profit stays in the ledger; the dead stay as numbers.');
    }
    return `<div class="stamp">${L('戦果と罪状', 'Deeds and guilt')}</div><div class="ledger">${rows}${verdict ? `<div class="verdict">${esc(verdict)}</div>` : ''}</div>${coda ? `<div class="coda">${esc(coda)}</div>` : ''}`;
  }
  function chart() {
    const h = g.history; if (h.length < 2) return '';
    const W = 560, H = 130, Tm = Math.max(60, h[h.length - 1].t), pad = 24;
    const x = t => pad + (t / Tm) * (W - pad * 2), y = v => 8 + (1 - v) * (H - 28);
    const line = f => h.map(p => x(p.t).toFixed(1) + ',' + y(f(p)).toFixed(1)).join(' ');
    let ticks = ''; for (let t = 0; t <= Tm + 0.1; t += 144) ticks += `<text x="${x(t)}" y="${H - 4}" fill="var(--muted)" font-size="10" text-anchor="middle">${L((t / 144 + 1) + '年目', 'Y' + (t / 144 + 1))}</text>`;
    return `<div class="chartbox"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${L('戦況と戦意の推移', 'Front and morale over time')}">
      <line x1="${pad}" x2="${W - pad}" y1="${y(0.5)}" y2="${y(0.5)}" stroke="var(--line)" stroke-dasharray="3 3"></line>
      <polyline points="${line(p => p.mA / 100)}" fill="none" stroke="var(--a)" stroke-width="1" opacity=".7" stroke-dasharray="4 3"></polyline>
      <polyline points="${line(p => p.mB / 100)}" fill="none" stroke="var(--b)" stroke-width="1" opacity=".7" stroke-dasharray="4 3"></polyline>
      <polyline points="${line(p => p.terr)}" fill="none" stroke="var(--brass)" stroke-width="2"></polyline>${ticks}</svg>
      <div style="font-size:11px;color:var(--muted)">${L('実線: A国の戦況(点線=拮抗)/破線: 戦意(青=A国・赤=B国)', 'Solid: A land (dotted = even) / dashed: morale (blue = A, red = B)')}</div></div>`;
  }
  function finalHTML(r) {
    if (!r.final) return '';
    const col = id => {
      const f = r.final[id], c = g.c[id], sb = f.sales || { equip: { n: 0, v: 0, free: 0 }, merc: { n: 0, v: 0, free: 0 }, food: { n: 0, v: 0, free: 0 } };
      const sl = k => { const x = sb[k]; return x.n ? short(x.v) + L('(' + (x.n - x.free) + '回' + (x.free ? '・無償' + x.free : '') + ')', ' (' + (x.n - x.free) + (x.free ? ', ' + x.free + ' free' : '') + ')') : '—'; };
      const tot = sb.equip.v + sb.merc.v + sb.food.v;
      return `<div class="fc ${id}"><h3><span>${c.name}</span>${r.loser === id ? `<small>${L('敗北', 'Defeated')}</small>` : ''}</h3>
        <div><span>${L('国土', 'Land')}</span><b>${Math.round(f.terr * 100)}%</b></div>
        <div><span>${L('戦意 / 反戦', 'Morale / anti-war')}</span><b>${Math.round(f.morale)} / ${Math.round(f.antiwar)}</b></div>
        <div><span>${L('前線 / 予備', 'Front / reserve')}</span><b>${short(f.front)} / ${short(f.reserve)}</b></div>
        <div><span>${L('装備充足率', 'Arms')}</span><b>${Math.round(f.eq * 100)}%</b></div>
        <div><span>${L('兵糧', 'Food')}</span><b>${Math.round(f.food)}%</b></div>
        <div><span>${L('資金', 'Funds')}</span><b>${short(f.funds)}</b></div>
        <div><span>${L('疑惑度', 'Suspicion')}</span><b>${Math.round(f.susp)}</b></div>
        <div class="sep"><span>${L('売上 装備', 'Sales: arms')}</span><b>${sl('equip')}</b></div>
        <div><span>${L('売上 傭兵', 'Sales: mercs')}</span><b>${sl('merc')}</b></div>
        <div><span>${L('売上 兵糧', 'Sales: rations')}</span><b>${sl('food')}</b></div>
        <div><span>${L('売上 合計', 'Sales: total')}</span><b>${short(tot)}</b></div></div>`;
    };
    return `<div class="stamp">${L('終戦時の両国', 'Both nations at the end')}</div>
      <div class="finhd"><span>${L('戦争', 'War')} <b>${esc(S.SCENARIOS[r.scKey || curSc].name)}${r.random ? L('(ランダム)', ' (random)') : ''}</b></span><span>${r.type === 'cap' ? L('期限まで戦争が続いた', 'The war ran to the deadline') : L('期限まで <b>あと' + r.weeksLeft + '週</b> を残して終結', 'Ended <b>' + r.weeksLeft + ' weeks</b> before the deadline')}</span></div>
      <div class="fin">${col('A')}${col('B')}</div>`;
  }
  function reviewItems(r) {
    const st = r.stats, out = [];
    const ln = r.loser ? g.c[r.loser].name : '', wn = r.loser ? g.c[r.loser === 'A' ? 'B' : 'A'].name : '', left = r.weeksLeft ? L('(期限まであと' + r.weeksLeft + '週)', ' (' + r.weeksLeft + ' weeks before the deadline)') : '';
    const keepMorale = L('戦意は、無償供与や相場より安い売却、要人暗殺・悪評の流布、戦争コンサルの「消極」の方針で保てます。兵糧を切らさないことも大切です。', ' Morale is kept up by free gifts, selling below market, assassinations, smear campaigns and a "Cautious" policy. Do not let food run out.');
    if (r.type === 'peace') out.push(L('両国の戦意が保たれていれば、戦争は期限まで続いていました' + left + '。', 'Had both sides kept their morale, the war would have run to the deadline' + left + '.') + keepMorale);
    else if (r.type === 'collapse' && g.endKind === 'surrender') out.push(L(ln + 'の戦意が足りず、' + ln + 'は降伏しました' + left + '。', ln + ' ran out of morale and surrendered' + left + '.') + keepMorale);
    else if (r.type === 'collapse') out.push(L(ln + 'と' + wn + 'の戦力差が大きく、' + ln + 'は戦線を押し返せないまま首都を失いました' + left + '。押す力は、劣勢側への装備・傭兵の供給、兵糧の確保、戦意の維持、戦争コンサルの「積極」の方針で高められます。資金が尽きた国には融資も使えます。', 'The gap between ' + ln + ' and ' + wn + ' was too wide; ' + ln + ' lost its capital' + left + '. Push grows with arms and mercs for the weaker side, enough food, steady morale and an "Aggressive" policy. Broke nations can take a loan.'));
    if (r.wasted >= 150000) out.push(L('売れ残った在庫に' + short(r.wasted) + 'の生産費を払いました。売れない品目は倉庫で生産を止めると、無駄を減らせます。', 'You paid ' + short(r.wasted) + ' to make stock that never sold. Pause production of items that are not selling.'));
    if (st.noneed >= 4) out.push(L('「今は必要ない」と' + st.noneed + '回断られました。優勢な国は武器を買いません。戦況を拮抗させると需要が生まれます。', 'Turned down ' + st.noneed + ' times as "not needed". Winning nations do not buy arms; a close war creates demand.'));
    if (st.refuse >= 3) out.push(L('高すぎる価格で' + st.refuse + '回拒否されました。前回の成約価格と相手の反応を目安に、戦況や装備の変化を読んで値を決めてください。', 'Refused ' + st.refuse + ' times for overpricing. Use the last deal and the buyer\'s reaction, and read changes in the war and its arms, to set your price.'));
    if (st.nofunds >= 4) out.push(L('資金不足で' + st.nofunds + '回買ってもらえませんでした。貧しい国には値引き・無償供与・融資が使えます。', st.nofunds + ' sales failed for lack of funds. Discounts, gifts and loans help poor nations.'));
    if (st.stop >= 2 || st.maxSusp >= 80) out.push(L('疑惑度が80を超え、取引が止まる場面がありました。安く売る・無償供与で疑惑度を下げられます。', 'Suspicion passed 80 and trade stopped. Cheap sales and gifts lower suspicion.'));
    if ((st.spoiled || 0) >= 2) out.push(L('兵糧を' + st.spoiled + '単位、売れないまま傷ませて廃棄しました。兵糧は、どこかの国が100%を切りそうな時だけ作ると無駄が出ません。', st.spoiled + ' ration units spoiled unsold. Make rations only when a nation is about to drop below 100%.'));
    if (r.loanLost > 0) out.push(L('融資した国が崩壊し、' + short(r.loanLost) + 'が回収できませんでした。', 'A borrower collapsed and ' + short(r.loanLost) + ' was lost.'));
    if (!out.length && r.profit > 0) out.push({ good: true, text: L('目立った無駄のない立ち回りでした。次は相場より少し高く売る、締め時を狙うなどで、さらに上を目指せます。', 'Clean play with little waste. Next, try selling a bit above market or timing the finish to score higher.') });
    if (!out.length) out.push(L('次は、各国のゲージ(装備・兵糧・国土・警戒)と前回の成約価格を見てから売ってみてください。', 'Next time, check each nation\'s gauges and the last deal price before you sell.'));
    return out.slice(0, 4).map(t => typeof t === 'string' ? `<div>${esc(t)}</div>` : `<div class="good">${esc(t.text)}</div>`).join('');
  }
  const endLabel = r => r.type === 'collapse' ? (g.endKind === 'surrender' ? L('降伏', 'Surrender') : L('首都陥落', 'Capital fallen')) : { peace: L('講和', 'Peace'), cap: L('強制講和', 'Imposed peace'), retreat: L('撤退', 'Withdrawal') }[r.type];
  function resultModal() {
    const r = g.result;
    showModal(`<div class="stamp">${L('終戦報告', 'War report')} / ${endLabel(r)} / ${S.dateOf(r.t)}${L('(' + r.weeks + '週)', ' (' + r.weeks + ' wk)')}</div><h2>${esc(r.text)}</h2>
      <div><div class="stamp">${L('利益(スコア)', 'Profit (score)')}</div><div class="big" style="color:${r.profit >= 0 ? 'var(--good)' : 'var(--bad2)'}">${r.profit >= 0 ? '+' : ''}${fmt(r.profit)}</div></div>
      ${finalHTML(r)}
      <div class="stamp">${L('帳簿', 'Ledger')}</div>
      <div class="res">
        <div><span>${L('販売の売上', 'Sales')}</span><b class="num">${fmt(r.revenue)}</b></div>
        <div><span>${L('うち兵糧', 'of which rations')}</span><b class="num">${fmt(r.foodRev)}</b></div>
        <div><span>${L('原価より高く売った売上', 'Sales above cost')}</span><b class="num">${fmt(r.acct ? r.acct.gainRev : 0)}</b></div>
        <div><span>${L('その利益', 'Their margin')}</span><b class="num">${fmt(r.acct ? r.acct.gain : 0)}</b></div>
        <div><span>${L('原価以下で売った売上', 'Sales at or below cost')}</span><b class="num">${fmt(r.acct ? r.acct.lossRev : 0)}</b></div>
        <div><span>${L('その赤字(無償供与を含む)', 'Their loss (incl. gifts)')}</span><b class="num">${fmt(r.acct ? r.acct.loss : 0)}</b></div>
        <div><span>${L('生産費', 'Production cost')}</span><b class="num">${fmt(r.spent)}</b></div>
        <div><span>${L('暗躍費', 'Covert cost')}</span><b class="num">${fmt(r.opsSpent)}</b></div>
        <div><span>${L('融資 回収/貸倒れ', 'Loans repaid/lost')}</span><b class="num">${short(r.loanRepaid)} / ${short(r.loanLost)}</b></div>
        <div><span>${L('売れ残りの生産費', 'Unsold stock cost')}</span><b class="num">${fmt(r.wasted)}</b></div>
        <div><span>${L('取引回数', 'Deals')}</span><b class="num">${r.sales}</b></div>
        <div><span>${L('断られた回数', 'Turned down')}</span><b class="num">${r.stats.noneed + r.stats.refuse + r.stats.nofunds + r.stats.stop + r.stats.nomorale}</b></div>
      </div>
      ${ledgerHTML(r)}
      <div class="stamp">${L('経緯(何が起きて、どうなったか)', 'Timeline (what happened and why)')}</div>
      <ul class="tline">${(r.timeline || []).map(e => `<li class="${e.kind}"><span class="d">${S.dateOf(e.t)}</span><span><span class="w">${esc(e.what)}</span>${e.why ? `<span class="y">${esc(e.why)}</span>` : ''}</span></li>`).join('')}</ul>
      <div class="stamp">${L('振り返り', 'Review')}</div>
      <div class="review">${reviewItems(r)}</div>
      ${chart()}
      <div class="foot"><button class="btn" id="mHome">${L('ホームに戻る', 'Home')}</button><button class="btn primary" id="mGo">${L('同じ戦争をもう一度', 'Same war again')}</button></div>`);
    $('mGo').onclick = () => { hideModal(); startGame(curSc); };
    $('mHome').onclick = () => { hideModal(); showHome(); };
    $('mGo').focus();
  }

  // ---------- game lifecycle ----------
  function setupGame(sc) {
    curSc = sc || curSc;
    S.setLang(SET.lang);
    g = S.newGame(null, { scenario: curSc }); g.paused = true; started = false; act = null; wireKey = '';
    setScales(); rebuildAll();
    FX.units = { A: [], B: [] }; FX.flashes = []; FX.ripples = []; FX.sparks = []; FX.prevPipe = { A: [], B: [] }; FX.shareLog = []; FX.lastCas = { A: null, B: null }; FX.killAcc = { A: 0, B: 0 }; FX.arrAcc = { A: 0, B: 0 }; FX.prevTransit = { A: [], B: [] }; FX.pushRate = 0;
    for (const k in effMemo) delete effMemo[k];
    render();
  }
  let fadeTimers = [];
  function clearFades() { fadeTimers.forEach(clearTimeout); fadeTimers = []; }
  function later(fn, ms) { fadeTimers.push(setTimeout(fn, ms)); }
  // start of a war: fade in from black with the war's name and date
  function startGame(sc) {
    clearFades(); hideModal(); closeHome();
    if (touch && SET.autoFull) goFull();
    mode = 'game'; setupGame(sc);
    const f = $('fade'); f.className = 'on'; $('fadeT').textContent = S.SCENARIOS[curSc].name; $('fadeS').textContent = S.dateOf(0);
    later(() => { f.className = ''; }, RM() ? 300 : 1300);
    later(() => { started = true; g.paused = false; render(); }, RM() ? 500 : 2100);
  }
  // end of a war: the screen dims in the ending's colour, then the report appears
  function endSequence() {
    const r = g.result, f = $('fade'), red = r.type === 'collapse', green = r.type === 'peace' || r.type === 'cap';
    f.className = 'on' + (red ? ' endA' : green ? ' endG' : '');
    $('fadeT').textContent = endLabel(r); $('fadeS').textContent = S.dateOf(r.t);
    later(() => { resultModal(); f.className = ''; }, RM() ? 400 : 1800);
  }
  function showHome() {
    clearFades(); act = null; hideModal(); mode = 'home'; started = false;
    if (g) g.paused = true;
    $('fade').className = ''; $('home').hidden = false; $('hpop').hidden = true;
    if (window.BSTut) window.BSTut.stop();
    applyStatic();
  }
  function closeHome() { $('home').hidden = true; $('hpop').hidden = true; }

  // ---------- home screen ----------
  const SCN_DESC = {
    s1: { ja: ['国境の山地に眠る鉱脈をめぐり、大国A国は隣の小国B国へ軍を進めた。', '兵も資金も勝るA国は、数か月で片が付くと踏んでいる。', '貧しいB国は、祖国を明け渡すまいとする兵の士気だけを頼りに、不利な戦いを続ける。', '金払いのいいA国は上客になる。一方B国の国庫はすぐに底をつき、給金の途絶えた兵は前線を去っていく。', 'B国が崩れれば戦争は終わり、商売の場も消える。', '融資や値引きで小国を延命させながら、大国からどれだけ引き出せるかが腕の見せ所だ。', '小国の資金の管理に注意が必要だろう。'],
          en: ['Over the ore beneath their border hills, the great power A marched into its small neighbour B.', 'With more men and money, A expects it all to be over in months.', 'Poor B fights on against the odds, held together by the resolve of soldiers who will not give up their homeland.', 'Free-spending A makes a fine customer. B\'s treasury soon runs dry, and unpaid soldiers walk away from the front.', 'If B collapses, the war ends and so does your trade.', 'The art lies in keeping the small nation alive with loans and discounts while drawing as much as you can from the great one.', "Keep a close eye on the small nation's money."] },
    s2: { ja: ['工場と鉄道で栄えた工業国A国は、国民の食料を輸入に頼ってきた。', '凶作で輸入が途絶えると、A国は食料自給率を高めるため、隣の農業国B国の穀倉地帯へ侵攻した。', '装備では勝るA国だが、前線の兵を養う兵糧を自前では賄えない。', '兵と食料に恵まれたB国は、旧式の武器で穀倉を守りながら、新しい装備を求め続ける。', '開戦時の国土と資金は、ほぼ互角。', '同じ品を両国に売るより、それぞれに足りないものを見極めるのが稼ぎの近道だ。', '工業国の兵糧の管理に注意が必要だろう。'],
          en: ['Industrial A, rich in factories and railways, has always imported the food it eats.', 'When a failed harvest cut off its imports, A invaded the granaries of agrarian B to feed itself.', 'A has the better arms, but cannot feed the soldiers at its front on its own.', 'B, rich in men and grain, defends its fields with old weapons and keeps asking for new ones.', 'Land and money start roughly even.', 'Rather than selling the same goods to both, the fastest profit lies in reading what each one lacks.', "Keep a close eye on the industrial nation's food."] },
  };
  function homePop(html) { const p = $('hpop'); p.innerHTML = html; p.hidden = false; }
  function homeScenarios() {
    S.setLang(SET.lang);
    homePop(`<div class="hpanel"><h2>${L('どの戦争に関わるか', 'Choose your war')}</h2>
      <div class="scards">${['s1', 's2'].map(k => { const d = SCN_DESC[k][SET.lang === 'en' ? 'en' : 'ja']; return `<div class="scard"><span class="st"><i></i>${esc(S.SCENARIOS[k].name)}</span>
        <span class="sd">${d.map((l, i) => `<p${i === d.length - 1 ? ' class="warn"' : ''}>${esc(l)}</p>`).join('')}</span><button class="btn primary go" data-scn="${k}">${L('この戦争を始める', 'Start this war')}</button></div>`; }).join('')}</div>
      <div class="foot"><button class="btn" data-hclose>${L('戻る', 'Back')}</button></div></div>`);
    $('hpop').querySelector('[data-scn]').focus();
  }
  function homeSettings() {
    const rows = [
      ['fx', L('危機の演出', 'Crisis effects'), L('降伏・陥落・講和が近い時に、画面の縁を赤や緑に点滅させる', 'Flash the screen edges red or green when defeat or peace is near')],
      ['reduce', L('動きを減らす', 'Reduce motion'), L('駒のゆらぎや点滅を抑える', 'Calm unit wobble and flashing')],
      ['autoFull', L('スマホで自動的に全画面', 'Auto full screen on phones'), L('戦争を始めた時や画面に触れた時に全画面にする', 'Go full screen when a war starts or the screen is touched')],
    ];
    homePop(`<div class="hpanel small"><h2>${L('設定', 'Settings')}</h2>
      ${rows.map(([k, l, h]) => `<div class="setrow"><div><div class="sl">${l}</div><div class="sh">${h}</div></div><button class="tog${SET[k] ? ' on' : ''}" data-set="${k}" aria-pressed="${SET[k]}" aria-label="${esc(l)}"></button></div>`).join('')}
      <div class="foot"><button class="btn primary" data-hclose>${L('閉じる', 'Close')}</button></div></div>`);
  }
  function homeLang() {
    homePop(`<div class="hpanel small"><h2>Language / 言語</h2>
      <div class="langs"><button class="btn${SET.lang === 'ja' ? ' sel' : ''}" data-lang="ja">日本語</button><button class="btn${SET.lang === 'en' ? ' sel' : ''}" data-lang="en">English</button></div>
      <div class="foot"><button class="btn primary" data-hclose>${L('閉じる', 'Close')}</button></div></div>`);
  }
  $('hNew').onclick = homeScenarios;
  $('hSet').onclick = homeSettings;
  $('hLang').onclick = homeLang;
  function homeTutorials() {
    homePop(`<div class="hpanel small"><h2>${L('チュートリアル', 'Tutorial')}</h2>
      <div class="tchoice">
        <button class="btn" data-tut="1"><b>${L('チュートリアル1 画面説明', 'Tutorial 1: The Screen')}</b><span>${L('ゲームの目的と、画面の見方', 'The goal, and how to read the screen')}</span></button>
        <button class="btn" data-tut="2"><b>${L('チュートリアル2 操作説明', 'Tutorial 2: How to Play')}</b><span>${L('販売・暗躍・生産を実際に操作する', 'Try selling, covert work and production')}</span></button>
      </div>
      <div class="foot"><button class="btn" data-hclose>${L('戻る', 'Back')}</button></div></div>`);
    $('hpop').querySelector('[data-tut]').focus();
  }
  function startTutorial(n) { if (!window.BSTut) return; closeHome(); if (touch && SET.autoFull) goFull(); window.BSTut.start(n); }
  $('hTut').onclick = homeTutorials;
  $('hpop').addEventListener('click', e => {
    if (e.target === $('hpop') || e.target.closest('[data-hclose]')) { $('hpop').hidden = true; return; }
    const sc = e.target.closest('[data-scn]'); if (sc) { startGame(sc.dataset.scn); return; }
    const tu = e.target.closest('[data-tut]'); if (tu) { startTutorial(+tu.dataset.tut); return; }
    const st = e.target.closest('[data-set]'); if (st) { const k = st.dataset.set; SET[k] = !SET[k]; saveSet(); homeSettings(); return; }
    const lg = e.target.closest('[data-lang]'); if (lg) { SET.lang = lg.dataset.lang; saveSet(); S.setLang(SET.lang); applyStatic(); homeLang(); return; }
  });

  // ---------- input ----------
  stage.addEventListener('click', e => {
    if (mode === 'home' || !g) return;
    const mo = e.target.closest('[data-more]'); if (mo) { $('c' + mo.dataset.more).classList.toggle('open'); return; }
    if (mode !== 'game' && mode !== 'tut') return;
    const op = e.target.closest('[data-open]'); if (op) { openAct(op.dataset.open, op.dataset.c); return; }
    const fq = e.target.closest('[data-food]'); if (fq) { if (fq.dataset.food === 'add') g.foodQueue = Math.min(10, g.foodQueue + 1); else g.foodQueue = Math.max(0, g.foodQueue - 1); render(); return; }
    const tog = e.target.closest('[data-tog]'); if (tog) { const k = tog.dataset.tog; g.prodOn[k] = !g.prodOn[k]; render(); return; }
    if (!act) return;
    const pk = e.target.closest('[data-pick]'); if (pk) { act.item = pk.dataset.pick; renderAct(); return; }
    const q = e.target.closest('[data-qm]'); if (q) { if (+q.dataset.qm !== act.m) act.blocked = false; act.m = +q.dataset.qm; $('mRange').value = act.m; updatePrice(); return; }
    const d = e.target.closest('[data-do]');
    if (d && d.dataset.do === 'close') { closeAct(); return; }
    if (d && d.dataset.do === 'home') { act = null; hideModal(); showHome(); return; }
    if (d && d.dataset.do === 'retreat') { act = null; hideModal(); g.paused = false; S.retreat(g); render(); return; }
    if (d && d.dataset.do === 'sell') {
      if (act.blocked) return;
      const r = S.sell(g, act.cid, act.item, act.m); act.msg = r.text; act.ok = r.ok;
      act.log.push({ ok: r.ok, text: SHORT()[act.item] + ' ' + (act.m === 0 ? L('無償', 'free') : '×' + act.m.toFixed(2)) + ' → ' + r.text });
      if (!r.ok && r.tier !== 'none') act.blocked = true;
      render(); renderAct(); return; }
    const o = e.target.closest('[data-op]'); if (o) { const r = S.covert(g, o.dataset.op, act.cid, o.dataset.arg); act.msg = r.text; act.ok = r.ok; const nm = o.dataset.op === 'consult' ? (o.dataset.arg === 'pass' ? L('戦争コンサル【消極】', 'Consulting [Cautious]') : L('戦争コンサル【積極】', 'Consulting [Aggressive]')) : O[o.dataset.op].name; act.log.push({ ok: r.ok, text: nm + ': ' + r.text }); render(); renderAct(); return; }
  });
  stage.addEventListener('input', e => { if (act && e.target.id === 'mRange') { if (+e.target.value !== act.m) act.blocked = false; act.m = +e.target.value; updatePrice(); } });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && act) { closeAct(); return; }
    if (e.code === 'Space' && mode === 'game' && !act && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && started && !g.over && !g.modal) { e.preventDefault(); g.paused = !g.paused; render(); }
  });
  $('bPause').onclick = () => { if (mode !== 'game' || !started || g.over || g.modal || act) return; g.paused = !g.paused; render(); };
  $('bHome').onclick = () => { if (mode === 'tut') { showHome(); return; } if (mode !== 'game') return; if (!started || g.over) { showHome(); return; } if (g.modal || act) return; openAct('home', null); };
  $('bRetreat').onclick = () => { if (mode === 'game') openAct('retreat', null); };
  $('bDbg').onclick = () => { dbg = !dbg; $('bDbg').classList.toggle('on', dbg); render(); if (act && act.kind !== 'home' && act.kind !== 'retreat') renderAct(); };

  // ---------- loop ----------
  let last = performance.now(), acc = 0, rAcc = 0, shown = null;
  function loop(now) {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    if (g && started && !act && mode === 'game') {
      acc += dt;
      while (acc >= 0.1) { S.step(g, 0.1); acc -= 0.1; if (g.paused) { acc = 0; break; } }
      if (g.modal && shown !== g.modal) { shown = g.modal; if (g.modal.kind === 'event') eventModal(g.modal); else if (g.modal.kind === 'order') orderModal(g.modal); else if (g.modal.kind === 'result') endSequence(); }
    }
    rAcc += dt; if (rAcc >= 0.1) { rAcc = 0; if (g && mode !== 'home') render(); }
    if (g && mode !== 'home') { if (!frontArr.length) render(); fxFrame(dt); updateVig(dt); }
    requestAnimationFrame(loop);
  }

  // ---------- API for the tutorial ----------
  window.BSUI = {
    get g() { return g; }, stage, L, short, setScales,
    tutorialGame(kind) {
      mode = 'tut'; clearFades(); closeHome(); act = null; hideModal(); setupGame('s1');
      // advance a few weeks so the map has troops and the gauges have moved
      g.prodOn.equip = true; g.paused = false; let n = 0; while (g.t < 15 && n++ < 400) { if (g.modal) { g.modal = null; g.paused = false; } S.step(g, 0.1); }
      g.modal = null; g.alertQ = []; g.paused = false; started = true; // time stays frozen: the loop only steps in game mode
      const A = g.c.A, B = g.c.B;
      // sample notices for the top centre and the news feed
      A.policy = 'aggr'; A.policyUntil = g.t + 24; B.priceMod = 0.8; B.priceModUntil = g.t + 27;
      const nw = [[L('B国の補給線が延び、前線への物資の到着が遅れている。', "B's supply lines are stretched; deliveries to the front are slow."), 'info'],
        [L('A国の司令部が方針を「積極」に切り替えた。', 'A HQ switched to an "Aggressive" strategy.'), 'op'],
        [L('B国の兵糧が減り始めている。', "B's food is starting to run low."), 'bad']];
      for (const [text, k] of nw) g.news.unshift({ t: g.t, text, kind: k });
      if (kind === 2) {
        g.inv.equip = 3; g.inv.merc = 2; g.inv.food = 0; g.foodQueue = 0; g.prodOn.equip = true; g.prodOn.merc = true; g.prodOn.food = false;
        g.money = Math.max(g.money, S.CFG.startMoney); for (const k in g.cd) g.cd[k] = 0;
        A.susp = 0; B.susp = 0; A.noNeed = false; A.estNoise = 0; A.morale = Math.max(A.morale, 50); B.morale = Math.max(B.morale, 50);
        A.funds = Math.max(A.funds, 3000000); A.policy = 'normal'; A.policyUntil = 0;
        g.fairOverride = { Aequip: 1.2, Amerc: 1.2, Afood: 1.0 }; // the tutorial sale at x1.2 is bought at market
      }
      wireKey = ''; render(); fxFrame(0.016);
    },
    get act() { return act; },
    openCard(id, open) { $('c' + id).classList.toggle('open', open); },
    home: showHome, render, get scale() { return scale; }, get lang() { return SET.lang; },
  };

  S.setLang(SET.lang); applyStatic(); fit(); setupGame('s1'); showHome();
  requestAnimationFrame(loop);
})();
