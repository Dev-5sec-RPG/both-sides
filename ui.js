// Both Sides — game screen, home screen, effects. Depends on engine.js (window.BothSides).
(function () {
  'use strict';
  const S = window.BothSides, I = S.ITEMS, O = S.OPS, fmt = S.fmt;
  const L = (...a) => S.L(...a);
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const stage = $('stage');
  let SW = 1376, SH0 = 768, BT = { s: 1, ox: 0, oy: 0, top: 75 };
  let g = null, started = false, act = null, scale = 1, rotDismissed = false, mode = 'home', curSc = 's1';

  // ---------- settings (kept in this browser only) ----------
  const SET = { lang: 'ja', fx: true, reduce: false, autoFull: true, sound: true, bgm: true, voice: true, movie: 'on' };
  try { Object.assign(SET, JSON.parse(localStorage.getItem('bs_settings') || '{}')); } catch (e) { /* storage unavailable */ }
  function saveSet() { try { localStorage.setItem('bs_settings', JSON.stringify(SET)); } catch (e) { /* ignore */ } }
  // sound effects (se.js). Buttons with their own sound are listed here; every other button clicks
  const SFX = (k, ...a) => { if (window.BSSE) { window.BSSE.enabled = SET.sound; window.BSSE.play(k, ...a); } };
  const OWN_SOUND = '[data-tog],[data-food="add"],[data-do="sell"],[data-op],[data-scn],[data-open],[data-do="close"],[data-do="home"],[data-do="retreat"],#tut';
  document.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled || b.closest(OWN_SOUND)) return; SFX('click'); }, true);
  document.addEventListener('mouseover', e => { const b = e.target.closest('button, .slot, input[type=range]'); if (!b || b.disabled || (e.relatedTarget && b.contains(e.relatedTarget))) return; SFX('hover'); });
  const RM = () => SET.reduce || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- static texts ----------
  const T = {
    cal: ['暦', 'Date', '日期'], money: ['所持金', 'Cash', '现金'], profit: ['利益(スコア)', 'Profit (score)', '利润(得分)'],
    retreat: ['撤退', 'Withdraw', '撤离'], home: ['ホームに戻る', 'Home', '返回主页'], capA: ['A国 首都', 'Capital A', 'A国 首都'], capB: ['B国 首都', 'Capital B', 'B国 首都'],
    frontline: ['戦線', 'front', '战线'], stockTitle: ['倉庫(装備・傭兵は自動生産で押すと停止/再開。兵糧は押した回数だけ作る。各12まで)', 'Warehouse (arms and mercs auto-produce; tap to pause. Rations: one per tap. Max 12 each)', '仓库(装备与雇佣兵自动生产，点击可停止/恢复。军粮按点击次数生产。各最多12)'],
    newsTitle: ['戦況ニュース', 'War news', '战况新闻'], hNew: ['新しい戦争', 'New War', '新的战争'], hTut: ['チュートリアル', 'Tutorial', '教程'], hRec: ['戦歴', 'Records', '战绩'], hSet: ['設定', 'Settings', '设置'],
    rotate: ['このゲームは横画面向けです。端末を横向きにしてお楽しみください。', 'This game is made for landscape. Please turn your device sideways.', '本游戏适合横屏。请将设备横向放置后游玩。'], rotateOk: ['このまま遊ぶ', 'Play anyway', '直接游玩'],
  };
  const tx = k => L(T[k][0], T[k][1], T[k][2]);
  function applyStatic() {
    document.documentElement.lang = S.LANG.cur === 'zh' ? 'zh-CN' : S.LANG.cur; loadZhFont();
    document.querySelectorAll('[data-t]').forEach(el => { const k = el.dataset.t; if (T[k]) el.textContent = tx(k); });
    $('bFull').setAttribute('aria-label', L('全画面', 'Full screen', '全屏')); $('bFull').title = L('全画面', 'Full screen', '全屏');
  }
  // Chinese glyphs: load a Simplified Chinese font only when that language is chosen
  let zhFont = false;
  function loadZhFont() {
    if (zhFont || S.LANG.cur !== 'zh') return; zhFont = true;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap'; document.head.appendChild(l);
  }
  const SHORT = () => ({ equip: L('装備一式', 'Arms', '成套装备'), merc: L('傭兵', 'Mercs', '雇佣兵'), food: L('兵糧', 'Rations', '军粮') });
  function short(n) {
    const a = Math.abs(n), sg = n < 0 ? '-' : '';
    if (S.LANG.cur === 'en') {
      if (a >= 1e6) return sg + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M';
      if (a >= 1e3) return sg + Math.round(a / 1e3) + 'K';
      return sg + Math.round(a);
    }
    if (a >= 1e8) return sg + (a / 1e8).toFixed(1) + (S.LANG.cur === 'zh' ? '亿' : '億');
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
    // PC: the 16:9 operations table. Phones (landscape) and small windows: a wider, shorter layout with the table zoomed to the map
    const compact = vh < 560 || vw < 1000;
    stage.className = compact ? 'compact' : 'full';
    const W = compact ? 1000 : 1376, H = compact ? 470 : 768;
    SW = W; SH0 = H;
    // where the 1376 x 768 table sits on the stage: full = as is; compact = scaled so the parchment fills the space between the bars
    if (compact) { const s = W / DW, top = 40, tray = 72, pc = (143 + 600) / 2; BT = { s, ox: 0, oy: (top + (H - tray)) / 2 - pc * s, top }; }
    else BT = { s: 1, ox: 0, oy: 0, top: 75 };
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
  const LB = () => ({ mor: L('戦意', 'Morale', '士气'), ant: L('反戦', 'Anti-war', '反战'), frt: L('前線', 'Front', '前线'), res: L('予備', 'Reserve', '预备'), sor: L('出動', 'Deploy', '出动'), eqs: L('装備', 'Arms', '装备'), crw: L('充足', 'Crew', '充足'), food: L('兵糧', 'Food', '军粮'), fund: L('資金', 'Funds', '资金'), sus: L('疑惑', 'Suspic.', '怀疑') });
  function buildCard(id) {
    const lb = LB(), nm = S.LANG.cur === 'en' ? id : id + '国';
    $('c' + id).setAttribute('aria-label', nm);
    $('c' + id).innerHTML = `
      <div class="ch"><span class="nm">${nm}</span><div class="flags" id="${id}fl"></div><button class="more" data-more="${id}">${L('詳細', 'More', '详情')}</button></div>
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
      <div class="sub"><span>${L('兵糧1単位', '1 ration', '军粮1单位')} <b id="${id}ct">—</b></span><span>${L('融資', 'Loan', '贷款')} <b id="${id}ln">—</b></span></div>
      <div class="acts">
        <button data-open="sell" data-c="${id}" id="${id}bSell">${ico('sell', '')}${L('販売', 'Sell', '出售')}</button>
        <button data-open="ops" data-c="${id}" id="${id}bOps">${ico('ops', '')}${L('暗躍', 'Covert', '暗中行动')}</button>
      </div>`;
  }
  // goods pictures (placeholders until the real art is made)
  const ITEM_ART = {
    equip: '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="currentColor"><path d="M30 14h8v24h-8z" opacity=".9"></path><path d="M30 14c0-6 4-10 4-10s4 4 4 10z"></path><path d="M29 33h10v2H29zM29 36h10v2H29z" opacity=".55"></path></g><g fill="none" stroke="currentColor" stroke-linecap="round"><path d="M5 34L27 16" stroke-width="2.6"></path><path d="M21 21l3 4" stroke-width="1.6"></path></g><path d="M4 33l5-1 3 4-6 4z" fill="currentColor"></path></svg>',
    merc: '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="currentColor"><path d="M8 29c0-10 7-17 16-17s16 7 16 17z"></path><path d="M4 29h40c0 2-1 3-3 3H7c-2 0-3-1-3-3z" opacity=".9"></path></g><g fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13 32c1 6 5 9 11 9s10-3 11-9"></path><path d="M14 20c3-3 6-4 10-4" opacity=".6"></path></g></svg>',
    food: '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="currentColor"><ellipse cx="17" cy="14" rx="9" ry="3" opacity=".9"></ellipse><path d="M8 14h18v22c0 2-4 3-9 3s-9-1-9-3z" opacity=".8"></path><ellipse cx="33" cy="22" rx="8" ry="2.8" opacity=".9"></ellipse><path d="M25 22h16v18c0 1.6-3.6 2.6-8 2.6S25 41.6 25 40z"></path></g></svg>',
  };
  const art = k => `<span class="sic">${ITEM_ART[k]}</span>`;
  function buildStock() {
    const sh = SHORT();
    $('stock').innerHTML = Object.values(I).map(it => it.key === 'food' ? `
      <div class="slotw"><button class="slot" id="sl_food" data-food="add" title="${esc(L('押した回数だけ兵糧を作る(1回で1単位)。作ってから3か月売れないと廃棄', 'Makes one ration per tap. Spoils if unsold for 3 months', '每按一次生产1单位军粮。生产后3个月未售出就会废弃'))}">
        ${art('food')}<span class="sn"><span>${sh.food}</span><span class="st" id="ss_food"></span></span>
        <span class="cnt" id="sc_food">×0</span>
        <span class="pg"><i id="sp_food" style="width:0"></i></span>
      </button><button class="fcan" data-food="sub" id="fcan" hidden>${L('取消', 'Undo', '取消')}</button></div>` : `
      <button class="slot" id="sl_${it.key}" data-tog="${it.key}" title="${esc(it.name + L('(' + it.sub + ')・', ' (' + it.sub + ') · ', '(' + it.sub + ')、') + it.trait)}">
        ${art(it.key)}<span class="sn"><span>${sh[it.key]}</span><span class="st" id="ss_${it.key}"></span></span>
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
    { const nx = S.nextPriceCheck(g); $('hStep').textContent = L('定価 ×', 'List x', '标价 ×') + ps.toFixed(1) + (nx ? L('(次の見直し: ' + monthOf(nx) + ')', ' (next review: ' + monthOf(nx) + ')', '(下次复审: ' + monthOf(nx) + ')') : ''); }
    setV('hMoney', short(g.money), L('所持金 ', 'Cash ', '现金 ') + fmt(g.money));
    const p = g.money - S.CFG.startMoney;
    setV('hProfit', (p >= 0 ? '+' : '') + short(p), L('利益 ', 'Profit ', '利润 ') + (p >= 0 ? '+' : '') + fmt(p), p >= 0 ? 'var(--good)' : 'var(--bad2)');
    $('bPause').disabled = busy; $('bRetreat').disabled = busy;
    const playing = g.paused && started && !busy;
    $('bPause').setAttribute('aria-label', playing ? L('再開', 'Resume', '继续') : L('一時停止', 'Pause', '暂停'));
    const want = playing ? 'play' : 'pause';
    if ($('bPause').dataset.s !== want) { $('bPause').dataset.s = want; $('bPause').innerHTML = playing ? PLAY_SVG : PAUSE_SVG; }

    const sA = S.territory(g, 'A'), pts = front(sA);
    $('front1').setAttribute('points', pts); $('front2').setAttribute('points', pts); $('frontGlow').setAttribute('points', pts);
    $('polyA').setAttribute('points', '0,0 ' + pts + ' 0,500');
    $('polyB').setAttribute('points', '1000,0 ' + pts + ' 1000,500');
    boardShare(sA);
    { const hist = g.history, ref = hist.length > 6 ? hist[hist.length - 7].terr : sA, d = sA - ref;
      $('pA').textContent = d > 0.004 ? L('A国が押している ▶', 'A advancing ▶', 'A国正在推进 ▶') : ''; $('pB').textContent = d < -0.004 ? L('◀ B国が押している', '◀ B advancing', '◀ B国正在推进') : '';
      if (Math.abs(d) <= 0.004) $('pA').textContent = L('膠着', 'Stalemate', '僵持');
      // the front's colour follows the same 6-week movement: stalemate (white), A or B slightly ahead, A or B pushing hard
      BOARD.push = Math.abs(d) <= 0.004 ? 0 : (d > 0 ? 1 : -1) * (Math.abs(d) > 0.015 ? 2 : 1); }

    for (const id of ['A', 'B']) {
      const c = g.c[id], s = S.shareOf(g, id);
      const tr = S.transitSum(c);
      setBar(id + 'frtB', c.front / SC.troop * 100, 'var(--troop)');
      setV(id + 'frtV', short(c.front), L('前線の部隊 ' + fmt(c.front) + '人(移動中 ' + fmt(tr) + '人)', 'Front ' + fmt(c.front) + ' (moving ' + fmt(tr) + ')', '前线部队 ' + fmt(c.front) + '人(移动中 ' + fmt(tr) + '人)'));
      setBar(id + 'resB', c.reserve / SC.troop * 100, 'var(--troop2)');
      setV(id + 'resV', short(c.reserve), L('後方の予備 ' + fmt(c.reserve) + '人', 'Reserve ' + fmt(c.reserve), '后方预备 ' + fmt(c.reserve) + '人'));
      const sw = c.sortieRate * 3;
      setBar(id + 'sorB', sw / 1200 * 100, sw < 250 ? 'var(--bad)' : 'var(--brass)');
      { const q = S.eqSuff(g, c), nn = c.noNeed; setBar(id + 'eqsB', Math.min(q, SC.eq) / SC.eq * 100, nn ? 'var(--muted)' : 'var(--eq)');
        setV(id + 'eqsV', Math.min(999, Math.round(q * 100)) + '%', L('装備充足率 ' + Math.round(q * 100) + '%(兵1人あたりの装備を、どの国も同じ基準で測った値。低いほど装備を高く買い、150%を超えると武器を買わなくなり、130%を下回ると再び買う)', 'Equipment ' + Math.round(q * 100) + '% (arms per soldier, same scale for all. Lower pays more; over 150% stops buying until below 130%)', '装备充足率 ' + Math.round(q * 100) + '%(以同一标准衡量每名士兵的装备量。越低越愿意高价购买装备，超过150%就不再购买武器，降到130%以下会再次购买)'), nn ? 'var(--muted)' : ''); }
      { const cf = S.crewFill(c); setBar(id + 'crwB', Math.min(cf, SC.crew) / SC.crew * 100, cf < 0.95 ? 'var(--bad)' : cf <= 1.1 ? 'var(--warn)' : 'var(--crew)');
        setV(id + 'crwV', Math.min(999, Math.round(cf * 100)) + '%', L('人員充足率 ' + (cf * 100).toFixed(0) + '%(全軍の兵÷装備を扱う必要人数。110%以下で傭兵の相場が上がり、95%を切ると装備の相場が落ちる)', 'Crew ' + (cf * 100).toFixed(0) + '% (soldiers / crew needed for arms. At 110% or less mercs pay more; under 95% arms pay less)', '人员充足率 ' + (cf * 100).toFixed(0) + '%(全军兵力÷操作装备所需人数。110%以下雇佣兵行情价上涨，跌破95%装备行情价下跌)'), cf < 0.95 ? 'var(--bad2)' : cf <= 1.1 ? '#e2a764' : ''); }
      setV(id + 'sorV', short(sw) + L('/週', '/wk', '/周'), L('出動の勢い 毎週' + fmt(sw) + '人(予備の数・戦意・兵糧で決まる)', 'Deployment ' + fmt(sw) + '/week (set by reserve, morale and food)', '出动势头 每周' + fmt(sw) + '人(由预备兵数、士气、军粮决定)'), sw < 250 ? 'var(--bad2)' : '');
      setBar(id + 'morB', c.morale, c.morale < 25 ? 'var(--bad)' : 'var(--good)');
      setV(id + 'morV', c.morale.toFixed(0), null, c.morale < 25 ? 'var(--bad2)' : '');
      setBar(id + 'antB', c.antiwar, '#b8b3a6');
      setV(id + 'antV', c.antiwar.toFixed(0));
      const v = c.susp;
      setBar(id + 'susB', Math.abs(v) / 2, v >= 80 ? 'var(--bad)' : v >= 50 ? 'var(--warn)' : v < 0 ? 'var(--good)' : 'var(--brass)', v >= 0 ? 50 : 50 + v / 2);
      setV(id + 'susV', (v > 0 ? '+' : '') + v.toFixed(0), L('疑惑度 ' + v.toFixed(1) + '(-100 信頼 〜 100 疑惑/50で値引き要求・80で取引停止)', 'Suspicion ' + v.toFixed(1) + ' (-100 trust to 100 doubt; 50 wants discounts, 80 stops trade)', '怀疑度 ' + v.toFixed(1) + '(-100 信任 ~ 100 怀疑/50要求降价、80中断交易)'), v >= 50 ? '#e2a764' : v < 0 ? 'var(--good)' : '');
      const fl0 = c.foodLv, fcol = fl0 < 70 ? 'var(--bad)' : fl0 < 90 ? 'var(--warn)' : fl0 < 100 ? 'var(--brass)' : 'var(--good)';
      setBar(id + 'foodB', Math.min(fl0, 130) / 130 * 100, fcol);
      setV(id + 'foodV', Math.round(fl0) + '%', L('兵糧 ' + Math.round(fl0) + '%(100%を切ると戦意と出動が落ち始め、70%を下回ると目に見えて弱る。90%未満で高く買う。自給率 ' + Math.round(S.selfSuff(g, c) * 100) + '%)', 'Food ' + Math.round(fl0) + '% (below 100% morale and deployment slip; below 70% sharply. Pays more under 90%. Self-sufficiency ' + Math.round(S.selfSuff(g, c) * 100) + '%)', '军粮 ' + Math.round(fl0) + '%(跌破100%后士气与出动开始下降，低于70%明显衰弱。低于90%时高价购买。自给率 ' + Math.round(S.selfSuff(g, c) * 100) + '%)'), fl0 < 70 ? 'var(--bad2)' : fl0 < 90 ? '#e2a764' : '');
      setBar(id + 'fundB', c.funds / SC.fund * 100, c.funds < S.CFG.loanLimit ? 'var(--bad)' : 'var(--brass)');
      setV(id + 'fundV', short(c.funds), L('資金 ', 'Funds ', '资金 ') + fmt(c.funds), c.funds < S.CFG.loanLimit ? 'var(--bad2)' : '');
      const dz = { mor: c.morale < 35, sus: c.susp >= 50, food: c.foodLv < 90, fund: c.funds < S.CFG.loanLimit, sor: c.sortieRate * 3 < 250, crw: S.crewFill(c) < 0.95 };
      let anyD = false;
      for (const k in dz) { $(id + k + 'B').classList.toggle('danger', dz[k]); $(id + k + 'V').classList.toggle('danger', dz[k]); if (dz[k]) anyD = true; }
      $('c' + id).classList.toggle('alert', anyD);
      { const tr = $(id + 'tr'), t = c.trait || ''; if (tr.textContent !== t) tr.textContent = t; tr.hidden = !t; }
      { const rk = S.collapseRisk(g, c), el = $(id + 'rk');
        if (rk.lv > 0) {
          const t = (rk.lv === 2 ? L('崩壊の危険', 'Collapse danger', '崩溃危险') : L('崩壊の注意', 'Collapse risk', '崩溃警戒')) + ': ' + rk.why.join(L('・', ', ', '、')) + (rk.weeks != null ? L('(あと約' + rk.weeks + '週で降伏)', ' (surrender in ~' + rk.weeks + ' wk)', '(约' + rk.weeks + '周后投降)') : '');
          if (el.textContent !== t) el.textContent = t;
          el.className = 'risk lv' + rk.lv; el.hidden = false;
        } else el.hidden = true; }
      $(id + 'ct').textContent = '+' + Math.round(S.foodRestore(c)) + '%';
      const ln = loanOf(id); $(id + 'ln').textContent = ln ? short(ln) : '—';
      const fl = [], dem = S.demand(g, c);
      if (c.susp >= 80) fl.push(['bad', L('取引停止', 'Trade halted', '中断交易')]); else if (c.susp >= 50) fl.push(['bad', L('値引き要求', 'Wants discount', '要求降价')]);
      if (c.morale < 25) fl.push(['bad', L('購入意思なし', 'Not buying', '无购买意愿')]);
      else if ((s > 0.65 && c.antiwar > 50) || S.rush(g, c) > 0.3) fl.push(['good', L('決着を急ぐ', 'Pushing to win', '急于决胜')]);
      else if (c.noNeed) fl.push(['', L('武器は不要', 'No arms needed', '不需要武器')]);
      if (c.foodLv < 100) fl.push([c.foodLv < 90 ? 'bad' : '', c.foodLv < 70 ? L('兵糧欠乏', 'Starving', '军粮匮乏') : c.foodLv < 90 ? L('兵糧不足・高値', 'Food short, pays more', '军粮不足、高价') : L('兵糧不足', 'Food short', '军粮不足')]);
      if (S.desertRate(c) > 0) fl.push(['bad', c.funds < c.initFunds * S.CFG.desertHeavy ? L('兵の大量離脱', 'Mass desertion', '士兵大量逃离') : L('兵の離脱', 'Desertion', '士兵逃离')]);
      if (c.funds < S.CFG.loanLimit && !g.loans.some(l => l.cid === id)) fl.push(['', L('融資可', 'Loan OK', '可贷款')]);
      if (c.susp <= -40) fl.push(['good', L('厚い信頼', 'Strong trust', '深厚信任')]); else if (c.susp <= -15) fl.push(['good', L('信頼', 'Trust', '信任')]); else if (c.funds >= S.CFG.richLine) fl.push(['good', L('資金潤沢', 'Rich', '资金充裕')]);
      if (c.policy !== 'normal') fl.push(['', L('方針: ', 'Policy: ', '方针: ') + S.POLICY[c.policy].name]);
      if (c.massing) fl.push(['bad', L('首都に集結中', 'Massing troops', '首都集结中')]);
      if (c.transit.some(x => x.wave)) fl.push(['bad', L('大規模増援 移動中', 'Surge en route', '大规模增援 移动中')]);
      const flh = fl.slice(0, 4).map(([k, t]) => `<span class="flag${k ? ' ' + k : ''}">${esc(t)}</span>`).join('');
      if ($(id + 'fl').innerHTML !== flh) $(id + 'fl').innerHTML = flh;
      document.querySelectorAll('[data-open][data-c="' + id + '"]').forEach(b => b.disabled = busy);
      const shp = $('ship' + id), items = c.pipeline.slice().sort((a, b) => a.at - b.at), sh = SHORT();
      const shh = items.slice(0, 3).map(p => `<span>${sh[p.item]} ${L('到着まで' + wk(p.at - g.t) + '週', 'in ' + wk(p.at - g.t) + ' wk', '还有' + wk(p.at - g.t) + '周到达')}</span>`).join('') + (items.length > 3 ? `<span>${L('ほか' + (items.length - 3) + '件', '+' + (items.length - 3) + ' more', '另有' + (items.length - 3) + '件')}</span>` : '');
      if (shp.innerHTML !== shh) shp.innerHTML = shh;
    }
    for (const k in I) {
      $('sc_' + k).textContent = '×' + g.inv[k];
      const on = k === 'food' ? g.foodQueue > 0 : g.prodOn[k];
      $('sp_' + k).style.width = on ? Math.min(100, g.prodT[k] / (I[k].interval / S.CFG.prodRate) * 100) + '%' : '0';
      $('ss_' + k).textContent = k === 'food' ? (g.foodQueue > 0 ? L('作成 残り', 'Queued ', '待生产 ') + g.foodQueue : L('押すと1単位作る', 'Tap to make', '按下生产1单位')) : !on ? L('停止中', 'Paused', '已停止') : g.inv[k] >= S.CFG.invCap ? L('満杯', 'Full', '已满') : L('生産中', 'Making', '生产中');
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
    if (g.order) list.push({ k: 'ord', cls: 'ord', t: L('緊急発注: ' + g.c[g.order.cid].name + ' ' + I[g.order.item].name + ' 残り' + g.order.left + '/' + g.order.qty + '・あと' + wk(g.order.deadline - g.t) + '週', 'Rush order: ' + g.c[g.order.cid].name + ' ' + I[g.order.item].name + ' ' + g.order.left + '/' + g.order.qty + ' left, ' + wk(g.order.deadline - g.t) + ' wk', '紧急订单: ' + g.c[g.order.cid].name + ' ' + I[g.order.item].name + ' 剩余' + g.order.left + '/' + g.order.qty + ' 还剩' + wk(g.order.deadline - g.t) + '周') });
    for (const id of ['A', 'B']) {
      const c = g.c[id];
      if (c.policy !== 'normal') list.push({ k: id + 'pol', cls: 'pol', t: L(c.name + ' 方針「' + S.POLICY[c.policy].name + '」 あと' + wk(c.policyUntil - g.t) + '週', c.name + ' "' + S.POLICY[c.policy].name + '" policy, ' + wk(c.policyUntil - g.t) + ' wk', c.name + ' 方针“' + S.POLICY[c.policy].name + '” 还剩' + wk(c.policyUntil - g.t) + '周') });
      if (g.t < c.priceModUntil) list.push({ k: id + 'pm', cls: 'mod', t: L(c.name + ' 競合の参入で相場 -20% あと' + wk(c.priceModUntil - g.t) + '週', c.name + ' rival dealer: prices -20%, ' + wk(c.priceModUntil - g.t) + ' wk', c.name + ' 竞争者进入，行情价 -20% 还剩' + wk(c.priceModUntil - g.t) + '周') });
      if (g.t < c.pushModUntil) list.push({ k: id + 'push', cls: 'mod', t: L(c.name + ' 突破作戦で押す力 +25% あと' + wk(c.pushModUntil - g.t) + '週', c.name + ' breakthrough: push +25%, ' + wk(c.pushModUntil - g.t) + ' wk', c.name + ' 突破作战，推进力 +25% 还剩' + wk(c.pushModUntil - g.t) + '周') });
    }
    for (const p of (g.pending || [])) if (p.at > g.t) list.push({ k: 'pre' + p.at, cls: 'pre', t: L('予定: ' + p.label + ' あと' + wk(p.at - g.t) + '週', 'Coming: ' + p.label + ', ' + wk(p.at - g.t) + ' wk', '预定: ' + p.label + ' 还剩' + wk(p.at - g.t) + '周') });
    const crit = [];
    for (const id of ['A', 'B']) {
      const c = g.c[id];
      if (S.terrOf(S.shareOf(g, id)) < S.CFG.defeatAlert) crit.push({ k: id + 'def', cls: 'bad', t: L(c.name + ' 敗北の危機: これ以上押し込まれると敗北', c.name + ' on the brink: one more push means defeat', c.name + ' 败北的危机: 再被推进就会战败') });
      if (c.surT > 0) crit.push({ k: id + 'sur', cls: 'bad', t: L(c.name + ' 降伏を検討中 あと' + wk(S.CFG.surrHold - c.surT) + '週', c.name + ' considering surrender, ' + wk(S.CFG.surrHold - c.surT) + ' wk', c.name + ' 正在考虑投降 还剩' + wk(S.CFG.surrHold - c.surT) + '周') });
    }
    if (g.t >= S.CFG.cap - S.CFG.capWarn && g.t < S.CFG.cap) crit.push({ k: 'cap', cls: 'bad', t: L('強制講和まで あと' + wk(S.CFG.cap - g.t) + '週', 'Imposed peace, ' + wk(S.CFG.cap - g.t) + ' wk', '强制停战 还剩' + wk(S.CFG.cap - g.t) + '周') });
    if (g.peaceT > 0) crit.push({ k: 'peace', cls: 'bad', t: L('講和の動き 成立まで あと' + wk(S.CFG.peaceHold - g.peaceT) + '週', 'Peace talks: ' + wk(S.CFG.peaceHold - g.peaceT) + ' wk to a deal', '和谈动向 距离达成 还剩' + wk(S.CFG.peaceHold - g.peaceT) + '周') });
    list.unshift(...crit);
    const keys = new Set(list.map(x => x.k));
    for (const k in effMemo) if (!keys.has(k)) { if (!effMemo[k].endT) effMemo[k].endT = g.t; if (g.t - effMemo[k].endT > 6) delete effMemo[k]; }
    for (const x of list) effMemo[x.k] = { t: x.t, cls: x.cls };
    const strip = t => t.replace(/ あと\d+週$/, '').replace(/, \d+ wk$/, '').replace(/ 还剩\d+周$/, '');
    const ended = Object.entries(effMemo).filter(([k, v]) => v.endT != null).map(([k, v]) => `<span class="${v.cls} end">${esc(strip(v.t))} ${L('終了', 'ended', '结束')}</span>`);
    const h = list.map(x => `<span class="${x.cls}">${esc(x.t)}</span>`).concat(ended).slice(0, 6).join('');
    if ($('effs').innerHTML !== h) $('effs').innerHTML = h;
  }
  let wireKey = '';
  function renderWire() {
    // sale-by-sale records stay out of the feed: selling five sets at once would fill it
    const feed = g.news.filter(n => n.kind !== 'sold');
    const key = feed.length + ':' + (feed[0] && feed[0].text);
    if (key === wireKey) return; wireKey = key;
    $('wire').innerHTML = feed.slice(0, 6).map(n => `<li class="${n.kind}"><span class="t">${S.dateOf(n.t)}</span><span class="x" title="${esc(n.text)}">${esc(n.text)}</span></li>`).join('');
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
  const COL = { A: { main: '#2f6db5', fill: 'rgba(36,58,84,.92)', dark: '#1d4a80' }, B: { main: '#c0442c', fill: 'rgba(84,40,32,.92)', dark: '#8e2f1d' } };
  const CAPS = { A: { x: 0.12, y: 0.58 }, B: { x: 0.88, y: 0.55 } }; // replaced by the map's own capitals
  const PER_ROW = { inf: 6, armor: 5 };
  function fxResize() {
    const cv = $('fx');
    FX.W = 1000; FX.H = 500; // flat map space; PJ() puts it on the parchment
    const k = Math.min(2.5, (window.devicePixelRatio || 1) * scale);
    cv.width = Math.max(1, Math.round(SW * k)); cv.height = Math.max(1, Math.round(SH0 * k));
    cv.style.width = SW + 'px'; cv.style.height = SH0 + 'px';
    if (BOARD.map) boardPlace();
    FX.cv = cv; FX.ctx = cv.getContext('2d'); FX.k = k;
    BOARD.share = -1; // rebuild the cached table at the new resolution
  }
  function frontX(yf) {
    const r = BOARD.rowU, n = r.length;
    if (!n) return FX.W / 2;
    const f = Math.max(0, Math.min(n - 1, yf * n - 0.5)), i = Math.floor(f), j = Math.min(n - 1, i + 1), t = f - i;
    return (r[i] + (r[j] - r[i]) * t) * FX.W;
  }

  // ---------- the operations table: desk picture, parchment map, terrain-shaped front ----------
  // The engine's territory share is never changed here. The map data only decides where the line is drawn:
  // the front is the contour of a precomputed field (phi) that encloses exactly the share's fraction of the map.
  const DW = 1376, DH = 768;
  // table -> map-layer coordinates (the map layer starts below the header)
  const TM = (x, y) => [BT.ox + x * BT.s, BT.oy + y * BT.s - BT.top];
  const BOARD = { map: null, img: null, flame: null, lmask: null, P: null, phi: null, sorted: null, gw: 0, gh: 0, tau: 0.5, share: -1, cache: null, tint: null, rowU: [], line: [], rTop: 1 };
  function homog(q) { // unit square -> quad (TL, TR, BR, BL), projective
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3, den = dx1 * dy2 - dx2 * dy1;
    const gg = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den;
    const a = x1 - x0 + gg * x1, b = x3 - x0 + h * x3, c = x0, d = y1 - y0 + gg * y1, e = y3 - y0 + h * y3, f = y0;
    const fwd = (u, v) => { const w = gg * u + h * v + 1; return [(a * u + b * v + c) / w, (d * u + e * v + f) / w]; };
    // inverse of [[a b c][d e f][gg h 1]]
    const A = e - f * h, B = c * h - b, C = b * f - c * e, D = f * gg - d, E = a - c * gg, F = c * d - a * f, G = d * h - e * gg, Hh = b * gg - a * h, II = a * e - b * d;
    fwd.inv = (x, y) => { const w = G * x + Hh * y + II; return [(A * x + B * y + C) / w, (D * x + E * y + F) / w]; };
    return fwd;
  }
  const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  async function boardUse(i) {
    const m = window.BS_MAPS && window.BS_MAPS[i]; if (!m || BOARD.map === m) return;
    BOARD.map = m; BOARD.P = homog(m.quad); BOARD.gw = m.gw; BOARD.gh = m.gh; BOARD.img = null; BOARD.cache = null;
    const bin = atob(m.phi), u16 = new Uint16Array(bin.length / 2);
    for (let k = 0; k < u16.length; k++) u16[k] = bin.charCodeAt(2 * k) | (bin.charCodeAt(2 * k + 1) << 8);
    BOARD.phi = Float32Array.from(u16, x => x / 65535); BOARD.sorted = Float32Array.from(BOARD.phi).sort();
    BOARD.rTop = (BOARD.P(1, 0)[0] - BOARD.P(0, 0)[0]) / (BOARD.P(1, 1)[0] - BOARD.P(0, 1)[0]);
    // capitals: flat positions for the convoys, and the labels on the paper (the map area starts 75px down)
    for (const id of ['A', 'B']) { const [cu, cv] = m.caps[id]; CAPS[id] = { x: cu, y: cv }; }
    boardPlace();
    const [img, fl, lm] = await Promise.all([loadImg(m.img), loadImg(m.lantern.flame), loadImg(m.lantern.mask)]);
    if (BOARD.map !== m) return;
    BOARD.img = img; BOARD.flame = fl; BOARD.lmask = lm; BOARD.share = -1; DESK.flameSrc = null;
    if (g) boardShare(S.territory(g, 'A'));
  }
  function boardPlace() { // DOM pieces that sit on the paper: capital labels, the area the tutorial points at
    const m = BOARD.map; if (!m) return;
    for (const id of ['A', 'B']) { const [cu, cv] = m.caps[id], [x, y] = TM(...BOARD.P(cu, cv)), el = $('cap' + id); if (el) { el.style.left = x + 'px'; el.style.top = y + 'px'; } }
    const pp = $('paper'), tl = TM(...BOARD.P(0, 0)), bl = TM(...BOARD.P(0, 1)), br = TM(...BOARD.P(1, 1));
    if (pp) Object.assign(pp.style, { left: bl[0] + 'px', top: tl[1] + 'px', width: (br[0] - bl[0]) + 'px', height: (br[1] - tl[1]) + 'px' });
    pillPlace();
  }
  function pillPlace() { const ln = BOARD.line, end = ln[ln.length - 1]; if (!end) return; const [x, y] = TM(end[0], end[1]), pl = $('pill'); pl.style.left = x + 'px'; pl.style.top = (y - 2) + 'px'; }
  const phiAt = (u, v) => { // bilinear sample of the field at (u, v) in [0, 1]
    const gw = BOARD.gw, gh = BOARD.gh, x = Math.max(0, Math.min(gw - 1.001, u * gw - 0.5)), y = Math.max(0, Math.min(gh - 1.001, v * gh - 0.5));
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, p = BOARD.phi, a = p[j * gw + i], b = p[j * gw + i + 1], c = p[(j + 1) * gw + i], d = p[(j + 1) * gw + i + 1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };
  // flat map point -> point on the parchment, with a depth factor: the far side is smaller and dimmer
  function PJ(x, y) {
    if (!BOARD.P) return { x, y, s: 1, a: 1 };
    const v = y / FX.H, p = BOARD.P(x / FX.W, v);
    const w = BOARD.P(1, v)[0] - BOARD.P(0, v)[0], w1 = BOARD.P(1, 1)[0] - BOARD.P(0, 1)[0];
    const kn = Math.max(0, Math.min(1, (w / w1 - BOARD.rTop) / (1 - BOARD.rTop)));
    return { x: p[0], y: p[1], s: 0.72 + 0.28 * kn, a: 0.68 + 0.32 * kn };
  }
  // the front: its colour shows who is pushing. white = stalemate, blue = A, red = B.
  // a slow breath (1.6 s) when one side is slightly ahead or in stalemate, a quick one (0.8 s) when one side pushes hard
  const FRONT = { phase: 0, col: [235, 228, 210] };
  function drawFront(ctx, rm, dt) {
    const ln = BOARD.line; if (!ln.length) return;
    const pu = BOARD.push || 0, tgt = pu > 0 ? [90, 160, 255] : pu < 0 ? [255, 95, 70] : [235, 228, 210], period = Math.abs(pu) === 2 ? 0.8 : 1.6;
    const kc = Math.min(1, dt * 3); FRONT.col = FRONT.col.map((c, i) => c + (tgt[i] - c) * kc);
    FRONT.phase = (FRONT.phase + dt / period) % 1;
    const br = rm ? 0.6 : 0.5 - 0.5 * Math.cos(FRONT.phase * Math.PI * 2), [r, g2, b] = FRONT.col.map(Math.round);
    const path = () => { ctx.beginPath(); ln.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); };
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    path(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(' + r + ',' + g2 + ',' + b + ',' + (0.06 + 0.26 * br) + ')'; ctx.lineWidth = 12 + 6 * br; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    path(); ctx.strokeStyle = 'rgba(30,14,6,.9)'; ctx.lineWidth = 5; ctx.stroke();
    const lift = 0.75 + 0.25 * br;
    path(); ctx.strokeStyle = 'rgb(' + Math.min(255, r * lift + 40 * br | 0) + ',' + Math.min(255, g2 * lift + 40 * br | 0) + ',' + Math.min(255, b * lift + 40 * br | 0) + ')'; ctx.lineWidth = 2.4; ctx.setLineDash([10, 6]); ctx.stroke();
    ctx.restore();
  }
  function boardShare(sA) {
    if (!BOARD.phi || !BOARD.img) return;
    if (Math.abs(sA - BOARD.share) < 0.0004 && BOARD.cache) return;
    BOARD.share = sA;
    const srt = BOARD.sorted, tau = srt[Math.max(0, Math.min(srt.length - 1, Math.floor(sA * srt.length)))]; BOARD.tau = tau;
    // where the line crosses each row (the crossing nearest the row above, so the line stays continuous)
    const NR = 160, NU = 400, rowU = [];
    let prev = null;
    for (let r = 0; r < NR; r++) {
      const v = (r + 0.5) / NR, xs = [];
      let a = phiAt(0, v) - tau;
      for (let k = 1; k <= NU; k++) { const u = k / NU, b = phiAt(u, v) - tau; if ((a < 0) !== (b < 0)) xs.push((k - 1 + a / (a - b)) / NU); a = b; }
      let pick = xs.length ? xs[0] : (a < 0 ? 1 : 0);
      if (xs.length > 1 && prev != null) pick = xs.reduce((best, x) => Math.abs(x - prev) < Math.abs(best - prev) ? x : best, xs[0]);
      rowU.push(pick); prev = pick;
    }
    for (let it = 0; it < 2; it++) for (let r = 1; r < NR - 1; r++) rowU[r] = (rowU[r - 1] + 2 * rowU[r] + rowU[r + 1]) / 4;
    BOARD.rowU = rowU;
    BOARD.line = rowU.map((u, r) => BOARD.P(u, (r + 0.5) / NR));
    // territory tint, stronger near the front; computed per screen pixel (half size) through the inverse mapping
    const tl = BOARD.P(0, 0), bl = BOARD.P(0, 1), br = BOARD.P(1, 1), tr = BOARD.P(1, 0);
    const bx = Math.floor(Math.min(tl[0], bl[0])), by = Math.floor(tl[1]), bw = Math.ceil(Math.max(tr[0], br[0])) - bx, bh = Math.ceil(bl[1]) - by, HS = 2, TW = Math.ceil(bw / HS), TH = Math.ceil(bh / HS);
    if (!BOARD.tint || BOARD.tint.width !== TW) { BOARD.tint = document.createElement('canvas'); BOARD.tint.width = TW; BOARD.tint.height = TH; }
    const tc = BOARD.tint.getContext('2d'), im = tc.createImageData(TW, TH), D = im.data, inv = BOARD.P.inv;
    for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {
      const uv = inv(bx + (i + 0.5) * HS, by + (j + 0.5) * HS), u = uv[0], v = uv[1], o = (j * TW + i) * 4;
      if (u < 0 || u > 1 || v < 0 || v > 1) { D[o + 3] = 0; continue; }
      const d = phiAt(u, v) - tau, near = Math.exp(-Math.abs(d) * 14), edge = Math.min(1, Math.min(u, 1 - u, v, 1 - v) * 60);
      if (d < 0) { D[o] = 70; D[o + 1] = 115; D[o + 2] = 205; } else { D[o] = 215; D[o + 1] = 85; D[o + 2] = 60; }
      D[o + 3] = (d < 0 ? 0.42 + 0.24 * near : 0.34 + 0.24 * near) * edge * 255; // blue reads weaker under the warm light
    }
    tc.putImageData(im, 0, 0);
    // cache: desk + tint + front line, redrawn only when the share moves
    const k = (FX.k || 1) * BT.s;
    if (!BOARD.cache) BOARD.cache = document.createElement('canvas');
    const cc = BOARD.cache; if (cc.width !== Math.round(DW * k)) { cc.width = Math.round(DW * k); cc.height = Math.round(DH * k); }
    const c = cc.getContext('2d'); c.setTransform(k, 0, 0, k, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.drawImage(BOARD.img, 0, 0, DW, DH);
    c.globalCompositeOperation = 'multiply'; c.imageSmoothingQuality = 'high'; c.drawImage(BOARD.tint, bx, by, TW * HS, TH * HS);
    c.globalCompositeOperation = 'source-over'; c.lineJoin = 'round'; c.lineCap = 'round';
    const ln = BOARD.line;
    pillPlace(); // the label sits at the bottom end of the line
  }
  // fixed formation slots: row = position along the front, col = distance behind it
  function slotPos(side, slot, kind) {
    const dir = side === 'A' ? -1 : 1, step = 0.148, n = PER_ROW[kind], row = slot % n, col = Math.floor(slot / n);
    const yf = kind === 'armor' ? 0.16 + step / 2 + row * step : 0.16 + row * step;
    const off = (kind === 'armor' ? 42 + col * 22 : 16 + col * 18) * 1.3; // the flat map is narrower than the old screen map
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
      for (let i = 0; i < 5; i++) FX.sparks.push({ x: pick.x, y: pick.y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, t0: FX.clock, life: 0.45, c: '200,50,25' });
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
  // markers: points of light on the operations table (infantry = ring, armour = diamond)
  // glowing light points; PJ() makes the far side of the table smaller and dimmer
  const GLOW = { A: '110,170,255', B: '255,110,80' }, CORE = { A: '#d2ecff', B: '#ffd6c8' };
  function drawUnit(ctx, u, side, s) {
    const P = PJ(u.x, u.y), dead = u.st === 'dead', armor = u.kind === 'armor', glow = dead ? '230,70,30' : GLOW[side];
    const grow = dead ? 1 + (FX.clock - u.t0) * 0.8 : 1, k = s * P.s * grow, al = Math.max(0, Math.min(1, u.a)) * P.a, R = (armor ? 14 : 12) * k;
    ctx.save(); ctx.translate(P.x, P.y);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al;
    const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    gl.addColorStop(0, 'rgba(' + glow + ',.6)'); gl.addColorStop(1, 'rgba(' + glow + ',0)');
    ctx.fillStyle = gl; ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(' + glow + ',.95)'; ctx.lineWidth = 1.3 * k; ctx.fillStyle = dead ? '#ffd2c6' : CORE[side];
    if (armor) {
      ctx.beginPath(); ctx.moveTo(0, -5.2 * k); ctx.lineTo(5.2 * k, 0); ctx.lineTo(0, 5.2 * k); ctx.lineTo(-5.2 * k, 0); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -2.6 * k); ctx.lineTo(2.6 * k, 0); ctx.lineTo(0, 2.6 * k); ctx.lineTo(-2.6 * k, 0); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, 4.4 * k, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 2.2 * k, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
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
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#5a3f1f'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.beginPath();
    for (let n = 0; n <= 24; n++) { const t = n / 24, x = (1 - t) * (1 - t) * q.sx + 2 * (1 - t) * t * q.mx + t * t * q.ex, y = (1 - t) * (1 - t) * q.sy + 2 * (1 - t) * t * q.my + t * t * q.ey, P = PJ(x, y); if (n) ctx.lineTo(P.x, P.y); else ctx.moveTo(P.x, P.y); }
    ctx.stroke(); ctx.restore();
    const trail = { equip: [3, 0, 10], merc: [6, 1.6, 5], food: [4, 2.2, 6] }[p.item];
    for (let n = 0; n < trail[0]; n++) {
      const back = n * trail[2], lag = I[p.item].lag, dprog = back / (Math.hypot(q.ex - q.sx, q.ey - q.sy) || 1);
      const r = convoyPoint(side, Object.assign({}, p, { at: p.at + dprog * lag })); if (r.prog <= 0) continue;
      const P = PJ(r.x, r.y), ss = s * P.s;
      ctx.fillStyle = col.main; ctx.strokeStyle = '#2a1a0e'; ctx.lineWidth = 1; ctx.globalAlpha = P.a;
      if (p.item === 'equip') { const w = 9 * ss, h = 6 * ss; ctx.fillRect(P.x - w / 2, P.y - h / 2, w, h); ctx.strokeRect(P.x - w / 2, P.y - h / 2, w, h); }
      else { ctx.beginPath(); ctx.arc(P.x, P.y, trail[1] * ss, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
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
    const ctx = FX.ctx, s = 1, live = started && !g.paused && !g.over, rm = RM();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#0b0907'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(FX.k * BT.s, 0, 0, FX.k * BT.s, FX.k * BT.ox, FX.k * BT.oy); // everything below is drawn in table coordinates
    if (BOARD.share < 0) boardShare(S.territory(g, 'A'));
    if (BOARD.cache && BOARD.share >= 0) { ctx.drawImage(BOARD.cache, 0, 0, DW, DH); drawFront(ctx, rm, dt); } else { ctx.fillStyle = '#0b0907'; ctx.fillRect(0, 0, DW, DH); }
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
      if (Math.random() < rate * dt) { const yf = 0.12 + Math.random() * 0.8, x = frontX(yf) + (Math.random() - 0.5) * 18; FX.sparks.push({ x, y: yf * FX.H, vx: 0, vy: 0, t0: FX.clock, life: 0.22, c: '232,120,30', r: 2 + Math.random() * 2 }); }
    }
    FX.sparks = FX.sparks.filter(p => {
      const age = FX.clock - p.t0; if (age > p.life) return false;
      const k = age / p.life, P = PJ(p.x + p.vx * age, p.y + p.vy * age); ctx.fillStyle = `rgba(${p.c},${(1 - k) * 0.9 * P.a})`;
      ctx.beginPath(); ctx.arc(P.x, P.y, (p.r || 1.6) * s * P.s * (1 - k * 0.5), 0, Math.PI * 2); ctx.fill(); return true;
    });
    FX.flashes = FX.flashes.filter(f => {
      const age = FX.clock - f.t0, dur = 0.9; if (age > dur) return false;
      const P = PJ(frontX(f.yf), f.yf * FX.H), x = P.x, y = P.y, k = age / dur, R = (f.big ? 30 : 20) * s * P.s * (0.4 + k);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, 'rgba(200,120,30,' + (0.7 * (1 - k)) + ')'); gr.addColorStop(1, 'rgba(200,120,30,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill(); return true;
    });
    FX.ripples = FX.ripples.filter(r => {
      const age = FX.clock - r.t0, dur = rm ? 0.6 : 1.3; if (age > dur) return false;
      const P = PJ(frontX(r.yf), r.yf * FX.H), x = P.x, y = P.y, k = age / dur;
      ctx.strokeStyle = COL[r.side].main; ctx.globalAlpha = 0.6 * (1 - k) * P.a; ctx.lineWidth = 2;
      for (const m of [1, 0.6]) { ctx.beginPath(); ctx.arc(x, y, (8 + 42 * k) * m * s * P.s, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1; return true;
    });
    deskFrame(ctx, dt, rm);
  }

  // ---------- the room: the lantern's flame and light, and someone passing beyond the desk ----------
  const DESK = { t: 0, flameSrc: null, warp: null, pass: null, nextAt: 25 + Math.random() * 35, lA: null, lB: null, lS: null, full: null, blurOK: null };
  const noise = seed => { const v = []; let s = seed; for (let i = 0; i < 4096; i++) { s = (s * 16807) % 2147483647; v.push(s / 2147483647 * 2 - 1); } return t => { const i = Math.floor(t), f = t - i, a = v[i & 4095], b = v[(i + 1) & 4095], u = f * f * (3 - 2 * f); return a + (b - a) * u; }; };
  const nA = noise(11), nB = noise(23), nC = noise(37), nD = noise(53), nG = noise(71);
  const mkCv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function blurWorks() { // the soft shadow needs canvas blur; without it the shadow is left out
    try { const c = mkCv(9, 9), x = c.getContext('2d'); if (!('filter' in x)) return false; x.filter = 'blur(2px)'; x.fillRect(4, 4, 1, 1); return x.getImageData(2, 4, 1, 1).data[3] > 0; } catch (e) { return false; }
  }
  // one light beyond the centre of the desk; the shadow fans out toward the viewer and shows down to the shoulders
  const SH = { LX: DW / 2, LY: -260, PW: 300, SC: 3 };
  const shProf = v => { if (v < 0.55) return 1; if (v < 0.80) { const k = (v - 0.55) / 0.25; return 1 - 0.58 * (1 - Math.cos(k * Math.PI / 2)) ** 1.4; } return 0.42; };
  function shBody(c, xp, wob, edge) {
    const N = 40, Lp = [], Rp = [], sc = SH.SC;
    for (let i = 0; i <= N; i++) { const v = i / N, y = edge + v * (DH + 40 - edge), f = (y - SH.LY) / (edge - SH.LY), hw = SH.PW / 2 * shProf(v) * (1 + wob * 0.04 * v); Lp.push([SH.LX + (xp - hw - SH.LX) * f, y]); Rp.push([SH.LX + (xp + hw - SH.LX) * f, y]); }
    c.beginPath(); c.moveTo((xp - SH.PW / 2) / sc, (edge - 60) / sc); Lp.forEach(p => c.lineTo(p[0] / sc, p[1] / sc)); for (let i = Rp.length - 1; i >= 0; i--) c.lineTo(Rp[i][0] / sc, Rp[i][1] / sc); c.lineTo((xp + SH.PW / 2) / sc, (edge - 60) / sc); c.closePath();
  }
  function shLayer(cv, xp, wob, blur, top, bot, edge) {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height;
    c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.clearRect(0, 0, W, H);
    c.filter = 'blur(' + blur + 'px)'; c.fillStyle = '#000'; shBody(c, xp, wob, edge); c.fill(); c.filter = 'none';
    c.globalCompositeOperation = 'destination-in'; const gr = c.createLinearGradient(0, edge / SH.SC, 0, DH / SH.SC); gr.addColorStop(0, 'rgba(0,0,0,' + top + ')'); gr.addColorStop(1, 'rgba(0,0,0,' + bot + ')'); c.fillStyle = gr; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
  }
  function deskFrame(ctx, dt, rm) {
    const m = BOARD.map; if (!m || !BOARD.img) return;
    const L0 = m.lantern; DESK.t += dt; const t = DESK.t;
    if (DESK.blurOK == null) DESK.blurOK = blurWorks();
    // --- a passing shadow every 20-60 s (off with reduced motion) ---
    if (!rm && DESK.blurOK) {
      if (!DESK.pass && t >= DESK.nextAt) {
        // footsteps come first: five steps 0.42 s apart, the loudest (third) one as the shadow crosses the middle of the desk
        const dur = 1.1 + Math.random() * 0.5, dir = Math.random() < 0.5 ? 1 : -1, gap = 0.42;
        DESK.pass = { t0: t + 2 * gap - dur / 2, dur, dir, str: 0.85 + Math.random() * 0.2 }; DESK.nextAt = t + 20 + Math.random() * 40;
        if (mode === 'game' || mode === 'tut') SFX('steps', dir, gap);
      }
      const ps = DESK.pass;
      if (ps) {
        const p = window.__shadowP != null ? window.__shadowP : (t - ps.t0) / ps.dur;
        if (p >= 1) DESK.pass = null;
        else if (p < 0) { /* the steps are still approaching */ }
        else {
          const sc = SH.SC, OW = Math.ceil(DW / sc), OH = Math.ceil(DH / sc), edge = m.deskEdge;
          if (!DESK.lA) { DESK.lA = mkCv(OW, OH); DESK.lB = mkCv(OW, OH); DESK.lS = mkCv(OW, OH); DESK.full = mkCv(DW, DH); }
          const span = DW / 2 + SH.PW * 0.7, xp = SH.LX + ps.dir * (-span + 2 * span * p), wob = Math.sin(p * Math.PI * 2 * 2.2);
          shLayer(DESK.lA, xp, wob, 10, 1, 0.25, edge); shLayer(DESK.lB, xp, wob, 26, 0.35, 1, edge);
          const c = DESK.lS.getContext('2d'); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, OW, OH); c.drawImage(DESK.lA, 0, 0); c.drawImage(DESK.lB, 0, 0);
          // the lantern keeps its surroundings lit: 10 / 30 / 60 / 100 % of the shadow, in a flattened oval
          const [lx, ly, lrx, lsq] = L0.lit; c.save(); c.globalCompositeOperation = 'destination-out'; c.translate(lx / sc, ly / sc); c.scale(1, lsq);
          const gr = c.createRadialGradient(0, 0, 0, 0, 0, lrx / sc); [[0, 10], [0.33, 30], [0.66, 60], [1, 100]].forEach(([k, s0]) => gr.addColorStop(k, 'rgba(0,0,0,' + (1 - s0 / 100) + ')'));
          c.fillStyle = gr; c.beginPath(); c.arc(0, 0, lrx / sc, 0, Math.PI * 2); c.fill(); c.restore();
          // full size: the lantern stands on this side of the shadow, so it is cut out sharply
          const f = DESK.full.getContext('2d'); f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, DW, DH); f.imageSmoothingQuality = 'high'; f.drawImage(DESK.lS, 0, 0, OW * sc, OH * sc); f.clearRect(0, 0, DW, edge - 2);
          if (BOARD.lmask) { const [bx, by, bw, bh] = L0.maskBox; f.globalCompositeOperation = 'destination-out'; f.drawImage(BOARD.lmask, bx, by, bw, bh); }
          ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.62 * ps.str; ctx.drawImage(DESK.full, 0, 0, DW, DH); ctx.restore();
          const block = Math.max(0, 1 - Math.abs(xp - SH.LX) / (DW * 0.55));
          ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(232,228,224)'; ctx.globalAlpha = block * 0.5; ctx.fillRect(0, edge, DW, DH); ctx.restore();
        }
      }
    }
    // --- the lantern flame and its light ---
    const gust = Math.max(0, nG(t * 0.35)) ** 2, fl = rm ? 0 : 0.55 * nA(t * 7) + 0.3 * nB(t * 13) + 0.15 * nC(t * 23);
    const [FX0, FY0, FW, FH] = L0.fx, [CX, CY] = L0.c, BASE = L0.base, TIP = L0.tip, K = 4;
    if (!rm) {
      if (!DESK.flameSrc) { const im = BOARD.img, sx = im.width / DW, sy = im.height / DH; DESK.flameSrc = mkCv(FW * K, FH * K); const c = DESK.flameSrc.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(im, FX0 * sx, FY0 * sy, FW * sx, FH * sy, 0, 0, FW * K, FH * K); DESK.warp = mkCv(FW, FH); }
      const sway = (nD(t * 0.9) * 0.8 + nB(t * 4.5) * 0.3) * (1 + gust * 1.5), hs = 1 + 0.05 * nA(t * 6 + 5) - 0.03 * gust, w = DESK.warp.getContext('2d');
      w.globalCompositeOperation = 'source-over'; w.clearRect(0, 0, FW, FH);
      for (let r = 0; r < FH * K; r++) {
        const dy = r / K, yy = FY0 + dy, h = Math.max(0, (BASE - yy) / (BASE - TIP)), sy = BASE - (BASE - yy) / hs, sr = (sy - FY0) * K; if (sr < 0 || sr >= FH * K) continue;
        const off = sway * Math.pow(Math.min(h, 1.3), 1.7) + Math.sin(yy * 0.55 - t * 9) * 0.25 * h * h; w.drawImage(DESK.flameSrc, 0, sr, FW * K, 1, off, dy, FW, 1 / K);
      }
      w.globalCompositeOperation = 'destination-in'; const mg = w.createRadialGradient(CX - FX0, CY - FY0, 4, CX - FX0, CY - FY0, 24); mg.addColorStop(0, '#000'); mg.addColorStop(1, 'rgba(0,0,0,0)'); w.fillStyle = mg; w.fillRect(0, 0, FW, FH);
      ctx.drawImage(DESK.warp, FX0, FY0);
      if (BOARD.flame) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.max(0, 0.18 + 0.22 * fl); ctx.drawImage(BOARD.flame, FX0, FY0); ctx.restore(); }
    }
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    let gr = ctx.createRadialGradient(CX, CY, 0, CX, CY, 120); gr.addColorStop(0, 'rgba(255,190,110,' + (0.16 + 0.08 * fl) + ')'); gr.addColorStop(1, 'rgba(255,160,80,0)'); ctx.fillStyle = gr; ctx.fillRect(CX - 120, CY - 120, 240, 240);
    ctx.globalCompositeOperation = 'soft-light'; const R = 640 + 20 * fl, a2 = 0.22 + 0.12 * fl;
    gr = ctx.createRadialGradient(CX, CY + 40, 0, CX, CY + 40, R); gr.addColorStop(0, 'rgba(255,200,130,' + a2 + ')'); gr.addColorStop(0.55, 'rgba(255,170,90,' + (a2 * 0.45) + ')'); gr.addColorStop(1, 'rgba(255,160,80,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, DW, DH);
    if (fl < 0) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(' + (255 + fl * 12 | 0) + ',' + (255 + fl * 16 | 0) + ',' + (255 + fl * 22 | 0) + ')'; ctx.fillRect(0, 0, DW, DH); }
    ctx.restore();
  }
  window.BSDesk = { pass() { DESK.nextAt = DESK.t; }, get info() { return { blurOK: DESK.blurOK, pass: !!DESK.pass, t: DESK.t, map: !!BOARD.map, img: !!BOARD.img }; } }; // for checking by hand


  // ---------- event movies: a scout reports at the operations table, then the usual window opens ----------
  // on = the key events below get a movie (older saved values 'full' / 'important' count as on); none = windows only
  const MOVIE_KEY = new Set(['defeat', 'surrender', 'peace', 'cap', 'order', 'ev10', 'ev2']);
  const MOVIE = { on: false, side: 'A', pages: [], page: 0, phase: '', done: null, timers: [] };
  const MOVIE_GAP = 18;   // 6 weeks of game time: after a movie, the next notices come as windows only
  function movieWanted(m) {
    if (mode !== 'game' || SET.movie === 'none') return false;
    if (MOVIE.lastG === g && g.t - MOVIE.lastT < MOVIE_GAP) return false;
    const key = m.kind === 'order' ? 'order' : m.mk;
    if (!key) return false;
    return MOVIE_KEY.has(key);
  }
  // notices that the war is about to end: the music moves to its last stage (BGM3)
  const OMEN = new Set(['surrender', 'defeat', 'peace', 'cap']);
  function presentModal(m) {
    const omen = m.kind === 'event' && OMEN.has(m.mk);
    const open = () => { if (omen) BGMST.s3 = true; if (m.kind === 'order') orderModal(m); else eventModal(m); };
    // with a movie the music fades out as it starts and stays silent; BGM3 begins when the notice opens
    if (movieWanted(m)) { MOVIE.omen = omen; playMovie(m, open); } else open();
  }
  // what the scout says: two windows. A and B scouts word it a little differently
  function talkPages(m, side) {
    const who = m.kind === 'order' ? m.cid : m.who, cn = who ? g.c[who].name : null;
    const key = m.kind === 'order' ? 'order' : m.mk;
    const H = {
      ev1: L(cn + 'の戦果が大きく報じられています。', cn + "'s victories are all over the papers.", cn + '的战果正被大肆报道。'),
      ev2: L(cn + 'が大規模な突破作戦を準備しているようです。', cn + ' seems to be preparing a major breakthrough.', cn + '似乎正在准备一场大规模突破作战。'),
      ev3: L(cn + 'に同盟国から武器が届く見込みです。', 'An ally is about to send arms to ' + cn + '.', '盟国预计将向' + cn + '提供武器。'),
      ev4: L(cn + 'の閣僚が辞任するとの情報を掴みました。', 'We have learned that a minister of ' + cn + ' will resign.', '我们得知' + cn + '的一名阁僚将要辞职。'),
      ev5: L(cn + 'で大規模な徴兵令の準備が進んでいます。', cn + ' is preparing a mass draft.', cn + '正在筹备大规模征兵令。'),
      ev7: L(cn + 'の防衛戦が英雄的に報じられています。', cn + "'s defence is being hailed as heroic.", cn + '的防御战被誉为英雄之举。'),
      ev8: L(cn + 'の補給基地で大きな事故がありました。', 'There has been a major accident at a ' + cn + ' supply depot.', cn + '的补给基地发生了重大事故。'),
      ev9: L('競合の武器商人が' + cn + 'に入り込みました。', 'A rival dealer has moved in on ' + cn + '.', '竞争对手的军火商打进了' + cn + '。'),
      ev10: L('国際調査団が報告書をまとめているそうです。', 'An international inquiry is preparing a report.', '国际调查团正在整理一份报告。'),
      ev11: L('第三国が停戦の仲介に乗り出すようです。', 'A third country is about to offer mediation.', '第三国似乎要出面斡旋停战。'),
      market: L('戦争が長引き、装備の値が上がっています。', 'The war drags on and arms are fetching higher prices.', '战争旷日持久，装备的价格在上涨。'),
      order: L(cn + 'から至急の注文が入りました。', 'An urgent order has come in from ' + cn + '.', cn + '发来了紧急订单。'),
      defeat: L(cn + 'が首都の目前まで押し込まれています。', cn + ' has been pushed back almost to its capital.', cn + '已被逼到首都跟前。'),
      surrender: L(cn + 'に降伏の兆しがあります。', cn + ' is showing signs of surrender.', cn + '出现了投降的迹象。'),
      peace: L('両国が講和に向けて動き始めました。', 'Both sides are moving toward peace.', '两国开始朝和谈方向行动。'),
      cap: L('国際機関が介入の準備を始めました。', 'International bodies are preparing to intervene.', '国际机构开始准备介入。'),
    };
    const open = side === 'A'
      ? (cn ? L('社長、' + cn + '側で動きがありました。', 'Sir, there is movement on the ' + cn + ' side.', '老板，' + cn + '那边有动静。') : L('社長、急ぎの報告です。', 'Sir, an urgent report.', '老板，紧急报告。'))
      : (cn ? L('社長、' + cn + 'に潜らせた者から連絡が入りました。', 'Sir, word from our man inside ' + cn + '.', '老板，潜伏在' + cn + '的人传来了消息。') : L('社長、各方面から情報が入りました。', 'Sir, reports are coming in from all sides.', '老板，各方面都传来了消息。'));
    const close = side === 'A' ? L('ご確認ください。', 'Please take a look.', '请过目。') : L('ご判断をお願いします。', 'Your call, sir.', '请您定夺。');
    const it = m.kind === 'order' ? I[m.item] : null;
    const C = {
      ev1: L(cn + 'の戦意が上がります。', cn + "'s morale will rise.", cn + '的士气将会上升。'),
      ev2: L('約6週後に作戦が始まり、8週間' + cn + 'の押す力が強まります。', 'It starts in about 6 weeks and boosts ' + cn + "'s push for 8 weeks.", '约6周后作战开始，8周内' + cn + '的推进力将增强。'),
      ev3: L('約8週後に武器が届き、' + cn + 'の武器戦力が上がります。', 'The arms arrive in about 8 weeks and strengthen ' + cn + '.', '约8周后武器运到，' + cn + '的武器战力将提升。'),
      ev4: L('約10週後に辞任が表に出て、' + cn + 'の戦意が下がり、反戦感情が高まります。', 'In about 10 weeks it goes public: morale falls and anti-war feeling grows.', '约10周后辞职将公开，' + cn + '士气下降，反战情绪高涨。'),
      ev5: L('約10週後に発令され、' + cn + 'の兵は増えますが、反戦感情も高まります。', 'In about 10 weeks ' + cn + ' gains soldiers, and anti-war feeling grows too.', '约10周后颁布，' + cn + '兵力增加，但反战情绪也会高涨。'),
      ev7: L(cn + 'の戦意が上がります。', cn + "'s morale will rise.", cn + '的士气将会上升。'),
      ev8: L(cn + 'の武器戦力が落ちます。', cn + "'s arms strength will drop.", cn + '的武器战力将下降。'),
      ev9: L('10週間、' + cn + 'での相場が下がります。', 'Prices in ' + cn + ' will fall for 10 weeks.', '10周内，' + cn + '的行情价将下跌。'),
      ev10: L('約13週後に公表されます。その間に両国へ売っていると、疑いを向けられます。', 'It comes out in about 13 weeks. Selling to both sides until then will draw suspicion.', '约13周后公布。在此期间若向两国出售，将招致怀疑。'),
      ev11: L('約13週後に発表され、両国の戦意が下がります。', 'It is announced in about 13 weeks and lowers both sides\' morale.', '约13周后公布，两国士气都将下降。'),
      market: L('生産費は据え置きなので、ここからの販売は利幅が大きくなります。', 'Costs stay the same, so sales from here earn more.', '生产成本不变，此后销售的利润会更高。'),
      order: L('数と期限をご確認ください。', 'Check the quantity and the deadline.', '请确认数量和期限。'),
      defeat: L('これ以上押し込まれると首都が陥落し、戦争が終わります。', 'If pushed any further the capital falls and the war ends.', '若再被推进，首都将陷落，战争结束。'),
      surrender: L('この状態が続くと、' + cn + 'は降伏します。', 'If this goes on, ' + cn + ' will surrender.', '若持续下去，' + cn + '将会投降。'),
      peace: L('両国の戦意が戻らなければ、講和が成立します。', 'If morale does not recover on both sides, peace will be made.', '若两国士气不能恢复，和谈将会达成。'),
      cap: L('12週後、戦争は強制的に講和となります。', 'In 12 weeks the war will be ended by an imposed peace.', '12周后，战争将被强制停战。'),
    };
    const sp = S.LANG.cur === 'en' ? ' ' : '';
    return [open + sp + (H[key] || ''), (C[key] || m.text || '') + (key === 'order' ? '' : sp + close)];
  }
  const mvEl = id => $(id);
  function mvClear() { MOVIE.timers.forEach(clearTimeout); MOVIE.timers = []; }
  function mvLater(fn, ms) { MOVIE.timers.push(setTimeout(fn, ms)); }
  function mvVideos(side) { return side === 'A' ? [mvEl('mvA0'), mvEl('mvA1')] : [mvEl('mvB0'), mvEl('mvB1')]; }
  // a video is "ready" once it sits on its first frame with that frame decoded. Reused videos are
  // rewound first, otherwise the last frame of the previous showing flashes up before the seek lands
  function mvReady(v, ms) {
    return new Promise(res => {
      let fin = false; const evs = ['seeked', 'loadeddata', 'canplay'];
      const ok = r => { if (fin) return; fin = true; evs.forEach(e => v.removeEventListener(e, check)); res(r); };
      const check = () => { if (v.readyState >= 2 && !v.seeking && v.currentTime < 0.05) ok(true); };
      v.pause(); v.onended = null; evs.forEach(e => v.addEventListener(e, check));
      setTimeout(() => ok(v.readyState >= 2), ms);
      if (v.readyState === 0) v.load();
      if (v.currentTime > 0.01) { try { v.currentTime = 0; } catch (e) { /* not ready yet */ } }
      check();
    });
  }
  // run fn once the video has actually put a new frame on screen (not merely been told to play)
  function mvOnFrame(v, fn) {
    let fin = false; const ok = () => { if (!fin) { fin = true; fn(); } };
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => ok());
    else v.addEventListener('playing', () => setTimeout(ok, 40), { once: true });
    setTimeout(ok, 400);
  }
  function playMovie(m, done) {
    const who = m.kind === 'order' ? m.cid : m.who, side = who === 'A' || who === 'B' ? who : (Math.random() < 0.5 ? 'A' : 'B');
    const [intro, loop] = mvVideos(side);
    if (!intro || !loop || intro.error || loop.error) { done(); return; }
    mvClear(); MOVIE.on = true; MOVIE.side = side; MOVIE.done = done; MOVIE.lastG = g; MOVIE.lastT = g.t; MOVIE.key = m.kind === 'order' ? 'order' : m.mk; MOVIE.pages = talkPages(m, side); MOVIE.page = 0; MOVIE.phase = 'load';
    MOVIE.serial = (MOVIE.serial || 0) + 1; const serial = MOVIE.serial;
    document.querySelectorAll('#mvStage video').forEach(v => { v.classList.remove('on'); v.pause(); });
    $('mvTalk').hidden = true; $('mvSkip').textContent = L('スキップ ▶▶', 'Skip ▶▶', '跳过 ▶▶'); $('mvStage').getAnimations().forEach(a => a.cancel());
    const black = $('mvBlack'); black.style.transition = 'none'; black.style.opacity = 1; $('movie').hidden = false;
    // both clips are rewound and decoded while the screen is still black, so the hand-over later has nothing to wait for
    MOVIE.loopReady = mvReady(loop, 2500);
    mvReady(intro, 2500).then(ok => {
      if (!MOVIE.on || serial !== MOVIE.serial) return;
      if (!ok) { mvEnd(true); return; }
      MOVIE.phase = 'intro';
      intro.onended = () => { if (MOVIE.on && serial === MOVIE.serial && MOVIE.phase === 'intro') mvToLoop(); };
      const p = intro.play(); if (p && p.catch) p.catch(() => {});
      mvOnFrame(intro, () => {
        if (!MOVIE.on || serial !== MOVIE.serial) return;
        intro.classList.add('on');
        void black.offsetWidth; black.style.transition = 'opacity .35s linear'; black.style.opacity = 0;
      });
      // if the clip stalls and never reports its end, move on anyway
      mvLater(() => { if (MOVIE.on && serial === MOVIE.serial && MOVIE.phase === 'intro') mvToLoop(); }, ((intro.duration || 3.5) + 1.5) * 1000);
    });
  }
  // intro -> loop: the intro holds its last frame underneath until the loop is really showing,
  // then the loop fades in over it (a short cross-fade also hides the small jump between the two clips)
  function mvToLoop() {
    if (MOVIE.phase !== 'intro') return;
    const [intro, loop] = mvVideos(MOVIE.side), serial = MOVIE.serial;
    MOVIE.phase = 'switch';
    MOVIE.loopReady.then(() => {
      if (!MOVIE.on || serial !== MOVIE.serial) return;
      const p = loop.play(); if (p && p.catch) p.catch(() => {});
      mvOnFrame(loop, () => {
        if (!MOVIE.on || serial !== MOVIE.serial) return;
        loop.classList.add('on');
        mvLater(() => { intro.classList.remove('on'); intro.pause(); }, 260);
        MOVIE.phase = 'talk'; mvShowPage();
      });
    });
  }
  // the scout's voice: one recorded line per window, media/voice/<lang>/<event>_<A|B>_<page>.mp3. Follows the sound setting
  let mvVoice = null;
  function voiceStop() { if (mvVoice) { try { mvVoice.pause(); } catch (e) { /* gone */ } mvVoice = null; } }
  function voiceSrc(page) { const lg = ['ja', 'en', 'zh'].includes(S.LANG.cur) ? S.LANG.cur : 'en'; return 'media/voice/' + lg + '/' + MOVIE.key + '_' + MOVIE.side + '_' + (page + 1) + '.mp3'; }
  function voicePlay() {
    voiceStop();
    if (!SET.voice || !MOVIE.key) return;
    const a = new Audio(voiceSrc(MOVIE.page)); a.volume = 0.95; mvVoice = a;
    const p = a.play(); if (p && p.catch) p.catch(() => {});
    if (MOVIE.page + 1 < MOVIE.pages.length) { const n = new Audio(); n.preload = 'auto'; n.src = voiceSrc(MOVIE.page + 1); }   // warm up the next line
  }
  function mvShowPage() {
    $('mvWho').textContent = MOVIE.side === 'A' ? L('密偵（' + g.c.A.name + '方面）', 'Scout (' + g.c.A.name + ' desk)', '密探（' + g.c.A.name + '方面）') : L('密偵（' + g.c.B.name + '方面）', 'Scout (' + g.c.B.name + ' desk)', '密探（' + g.c.B.name + '方面）');
    $('mvText').textContent = MOVIE.pages[MOVIE.page];
    const touch = matchMedia('(pointer: coarse)').matches, inp = window.BSPad ? window.BSPad.mode : 'mouse';
    $('mvHint').textContent = inp !== 'mouse' ? L('次へ', 'Next', '下一步') : touch ? L('画面タップで次へ', 'Tap to continue', '轻触画面继续') : L('クリックで次へ（Enterキーでも可）', 'Click (or press Enter) to continue', '点击继续（也可按Enter键）');
    $('mvPg').textContent = (MOVIE.page + 1) + ' / ' + MOVIE.pages.length;
    $('mvTalk').hidden = false;
    voicePlay();
  }
  function mvAdvance() {
    if (!MOVIE.on) return;
    if (MOVIE.phase === 'intro') { mvToLoop(); return; }          // tapping during the walk-in jumps to the report
    if (MOVIE.phase !== 'talk') return;
    SFX('page');
    if (MOVIE.page < MOVIE.pages.length - 1) { MOVIE.page++; mvShowPage(); return; }
    // the report is over: nod twice while he keeps moving, then fade to black
    MOVIE.phase = 'outro'; $('mvTalk').hidden = true;
    const d = 13 * (stage.offsetWidth / 1376), nod = [0, 1, 0, 1, 0].map(k => ({ transform: 'scale(' + (1.03 + 0.004 * k) + ') translateY(' + (-d * k) + 'px)' }));
    const a = $('mvStage').animate(nod, { duration: 1250, easing: 'ease-in-out' });
    const black = $('mvBlack');
    a.onfinish = () => { black.style.transition = 'opacity 1s ease-in'; black.style.opacity = 1; mvLater(() => mvEnd(false), 1000); };
  }
  function movieSkip() {
    if (!MOVIE.on || MOVIE.phase === 'ending') return;
    MOVIE.phase = 'ending'; $('mvTalk').hidden = true; voiceStop();
    const black = $('mvBlack'); black.style.transition = 'opacity .3s linear'; black.style.opacity = 1;
    mvLater(() => mvEnd(false), 300);
  }
  function mvEnd(failed) {
    mvClear(); voiceStop(); const done = MOVIE.done; MOVIE.on = false; MOVIE.omen = false; MOVIE.phase = ''; MOVIE.done = null;
    document.querySelectorAll('#mvStage video').forEach(v => { v.pause(); v.classList.remove('on'); });
    $('mvStage').getAnimations().forEach(a => a.cancel());
    const mv = $('movie'), black = $('mvBlack');
    if (failed) { mv.hidden = true; if (done) done(); return; }
    // back to the table: the window opens as the black lifts
    mv.style.transition = 'opacity .45s linear'; mv.style.opacity = 0; if (done) done();
    setTimeout(() => { mv.hidden = true; mv.style.transition = ''; mv.style.opacity = ''; black.style.opacity = 1; }, 470);
  }
  $('movie').addEventListener('click', e => { e.stopPropagation(); if (e.target.closest('#mvSkip')) { movieSkip(); return; } mvAdvance(); });

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
  // cash on hand, shown at the top right of the sell / covert windows; a deal shows its amount rising and fading
  function cashHTML() { return `<div class="mcash"><small>${L('所持金', 'Cash', '现金')}</small><b id="mCash" class="num">${fmt(g.money)}</b></div>`; }
  function cashDelta(v) {
    const mc = $('mc'), c = $('mCash'); if (!mc || !c || !v) return;
    mc.querySelectorAll('.cdelta').forEach(x => x.remove());
    const d = document.createElement('div'); d.className = 'cdelta ' + (v > 0 ? 'up' : 'down'); d.textContent = (v > 0 ? '+' : '−') + fmt(Math.abs(v));
    const mr = mc.getBoundingClientRect(), cr = c.getBoundingClientRect(), k = mr.width / mc.offsetWidth || 1;
    d.style.right = ((mr.right - cr.right) / k) + 'px'; d.style.top = ((cr.bottom - mr.top) / k + mc.scrollTop + 2) + 'px';
    mc.appendChild(d); setTimeout(() => d.remove(), 1100);
  }
  function showModal(html, cls) { const m = $('mc'); m.className = 'mc' + (cls ? ' ' + cls : ''); m.innerHTML = html; $('modal').hidden = false; $('tip').hidden = true; m.scrollTop = 0; }
  function hideModal() { $('modal').hidden = true; }

  // ---------- action dossiers ----------
  function openAct(kind, cid) {
    SFX('page');
    if (!started || g.over || g.modal) return;
    const first = ['equip', 'merc', 'food'].find(k => g.inv[k] > 0);
    act = { kind, cid, item: first || (act && act.item) || 'equip', m: 1, msg: '', ok: true, log: [], blocked: false };
    g.paused = true; render(); renderAct(true);
  }
  function closeAct() { if (!act) return; SFX('page'); act = null; hideModal(); g.paused = false; render(); }
  function flagsOf(c) {
    const fl = [], s = S.shareOf(g, c.id);
    if (c.susp <= -40) fl.push(['good', L('厚い信頼', 'Strong trust', '深厚信任')]); else if (c.susp <= -15) fl.push(['good', L('信頼', 'Trust', '信任')]); else if (c.funds >= S.CFG.richLine) fl.push(['good', L('資金潤沢', 'Rich', '资金充裕')]);
    if (c.susp >= 80) fl.push(['bad', L('取引停止', 'Trade halted', '中断交易')]); else if (c.susp >= 50) fl.push(['bad', L('値引き要求', 'Wants discount', '要求降价')]);
    if (c.morale < 25) fl.push(['bad', L('購入意思なし', 'Not buying', '无购买意愿')]); else if ((s > 0.65 && c.antiwar > 50) || S.rush(g, c) > 0.3) fl.push(['good', L('決着を急ぐ', 'Pushing to win', '急于决胜')]); else if (c.noNeed) fl.push(['', L('武器は不要', 'No arms needed', '不需要武器')]);
    if (c.foodLv < 100) fl.push([c.foodLv < 90 ? 'bad' : '', c.foodLv < 70 ? L('兵糧欠乏', 'Starving', '军粮匮乏') : c.foodLv < 90 ? L('兵糧不足・高値', 'Food short, pays more', '军粮不足、高价') : L('兵糧不足', 'Food short', '军粮不足')]);
    fl.push(['', L('方針: ', 'Policy: ', '方针: ') + S.POLICY[c.policy].name + (c.policy !== 'normal' ? L('(あと' + wk(c.policyUntil - g.t) + '週)', ' (' + wk(c.policyUntil - g.t) + ' wk)', '(还剩' + wk(c.policyUntil - g.t) + '周)') : '')]);
    if (c.massing) fl.push(['bad', L('首都に集結中', 'Massing troops', '首都集结中')]);
    if (c.transit.some(x => x.wave)) fl.push(['bad', L('大規模増援 移動中', 'Surge en route', '大规模增援 移动中')]);
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
    if (kind === 'ops') h += `<div class="mstat ${oc.id}"><div class="msh"><span class="nm">${esc(oc.name)}</span><span class="tr">${L('暗躍の疑惑は相手国にも波及する', 'Covert work raises its suspicion too', '暗中行动引起的怀疑也会波及对方国家')}</span></div>${susOnly(oc.id)}</div>`;
    return h;
  }
  function logHTML() { return act.log.length ? `<div class="stamp">${L('この停止中の行動', 'Actions this pause', '本次暂停中的行动')}</div><ul class="mlog">${act.log.slice().reverse().map(l => `<li class="${l.ok ? 'ok' : 'ng'}">${esc(l.text)}</li>`).join('')}</ul>` : ''; }
  const respHTML = () => `<div class="resp ${act.ok ? 'ok' : 'ng'}">${esc(act.msg)}</div>`;
  const stampOf = k => k + L(' / 時が止まっています ', ' / Time is stopped ', ' / 时间已停止 ') + S.dateOf(g.t);
  function renderAct(focus) {
    const c = g.c[act.cid], oc = act.cid ? g.c[S.other(act.cid)] : null, sh = SHORT();
    let h = '';
    if (act.kind === 'sell') {
      const picks = Object.values(I).map(it => {
        const est = S.estimate(g, c, it.key), ld = c.lastDeal[it.key];
        const info = it.key === 'food' ? foodInfo(c, est)
          : ld ? L('前回 ×' + ld.m.toFixed(2) + '・' + Math.max(0, Math.round((g.t - ld.t) / 3)) + '週前(' + ld.label + ')', 'Last x' + ld.m.toFixed(2) + ', ' + Math.max(0, Math.round((g.t - ld.t) / 3)) + ' wk ago (' + ld.label + ')', '上次 ×' + ld.m.toFixed(2) + '、' + Math.max(0, Math.round((g.t - ld.t) / 3)) + '周前(' + ld.label + ')') : L('前回の取引なし', 'No deal yet', '尚无交易');
        return `<button class="pick${act.item === it.key ? ' sel' : ''}" data-pick="${it.key}">
          <span class="pn"><span>${sh[it.key]}</span><span class="num">×${g.inv[it.key]}</span></span>
          <span class="pl tr">${esc(it.trait)}</span>
          <span class="pl num">${L('定価 ', 'List ', '标价 ')}${fmt(S.listPrice(g, it.key))}</span>
          <span class="pe">${esc(info)}</span>${priceTags(c)}</button>`;
      }).join('');
      const has = g.inv[act.item] > 0;
      h = `<div class="stamp">${stampOf(L('販売', 'Sell', '出售'))}</div><div class="mhead"><h2>${L(c.name + 'へ売り込む', 'Sell to ' + c.name, '向' + c.name + '推销')}</h2>${cashHTML()}</div>
        <div class="picks">${picks}</div>
        <div class="priceline"><span class="mult" id="mMult"></span><span class="yen" id="mYen"></span></div>
        <input type="range" id="mRange" min="0" max="2" step="0.05" value="${act.m}" aria-label="${L('価格倍率', 'Price multiplier', '价格倍率')}"><div class="padhint" id="mPadHint"></div>
        <div class="quick">${[[0, L('無償供与', 'Free', '无偿提供')], [0.3, '×0.3'], [0.5, '×0.5'], [0.8, '×0.8'], [1, '×1.0'], [1.2, '×1.2'], [1.5, '×1.5'], [1.8, '×1.8'], [2, '×2.0']].map(([m, l]) => `<button class="btn" data-qm="${m}">${l}</button>`).join('')}</div>
        <div class="foot"><button class="btn" data-do="close">${L('閉じて再開', 'Close and resume', '关闭并继续')}</button><button class="btn primary" data-do="sell" ${has && !act.blocked ? '' : 'disabled'}>${sellLabel(has)}</button></div>
        ${respHTML()}${panel(c, 'sell')}${logHTML()}`;
    } else if (act.kind === 'home') {
      showModal(`<div class="stamp">${stampOf(L('ホームに戻る', 'Home', '返回主页'))}</div><h2>${L('今の戦争を捨ててホームに戻りますか', 'Abandon this war and go home?', '放弃当前战争并返回主页吗')}</h2>
        <p>${L('今の戦争は精算されず、記録も残りません。', 'This war will not be settled or recorded.', '当前战争不会结算，也不会留下记录。')}</p>
        <div class="foot"><button class="btn" data-do="close">${L('続ける', 'Keep playing', '继续')}</button><button class="btn primary" data-do="home">${L('ホームに戻る', 'Go home', '返回主页')}</button></div>`);
      if (focus) { const b = $('mc').querySelector('[data-do="close"]'); if (b) b.focus({ preventScroll: true }); $('mc').scrollTop = 0; }
      return;
    } else if (act.kind === 'menu') {
      // controller / keyboard menu: the header's buttons gathered in one window
      showModal(`<div class="stamp">${stampOf(L('メニュー', 'Menu', '菜单'))}</div><h2>${L('メニュー', 'Menu', '菜单')}</h2>
        <div class="pmenu"><button class="btn primary" data-do="close">${L('続ける', 'Keep playing', '继续')}</button><button class="btn" data-pm="retreat">${L('撤退する', 'Withdraw', '撤离')}</button><button class="btn" data-pm="home">${L('ホームに戻る', 'Home', '返回主页')}</button></div>`);
      return;
    } else if (act.kind === 'retreat') {
      showModal(`<div class="stamp">${stampOf(L('撤退', 'Withdraw', '撤离'))}</div><h2>${L('ここで手を引きますか', 'Pull out now?', '要在这里收手吗')}</h2>
        <p>${L('現在の所持金で精算し、試合を終えます。倉庫の在庫は価値を失い、貸し付けた融資は回収できません。戦争はあなた抜きで続きます。', 'You settle with the cash you hold and end the match. Stock is lost and loans are not repaid. The war goes on without you.', '以当前现金结算并结束本局。仓库库存将失去价值，已发放的贷款无法收回。战争会在你离开后继续。')}</p>
        <div class="kv"><span>${L('所持金', 'Cash', '现金')} <b>${fmt(g.money)}</b></span><span>${L('利益', 'Profit', '利润')} <b>${(g.money - S.CFG.startMoney >= 0 ? '+' : '') + fmt(g.money - S.CFG.startMoney)}</b></span><span>${L('融資残高', 'Loans out', '贷款余额')} <b>${short(loanOf('A') + loanOf('B'))}</b></span></div>
        <div class="foot"><button class="btn" data-do="close">${L('続ける', 'Keep playing', '继续')}</button><button class="btn primary" data-do="retreat">${L('精算して撤退', 'Settle and withdraw', '结算并撤离')}</button></div>`);
      if (focus) { const b = $('mc').querySelector('[data-do="close"]'); if (b) b.focus({ preventScroll: true }); $('mc').scrollTop = 0; }
      return;
    } else {
      const cn = c.name, on = oc.name, wkLeft = c.policy !== 'normal' ? wk(c.policyUntil - g.t) : 0;
      const now = c.policy === 'normal' ? '' : L('現在の方針: ' + S.POLICY[c.policy].name + '(あと' + wkLeft + '週)', 'Current policy: ' + S.POLICY[c.policy].name + ' (' + wkLeft + ' wk left)', '当前方针: ' + S.POLICY[c.policy].name + '(还剩' + wkLeft + '周)');
      const rows = [
        ['assassin', null, O.assassin.name, L(cn + 'の戦意 +15・反戦感情 -10。疑惑度 ' + cn + ' +30・' + on + ' +10。', cn + ' morale +15, anti-war -10. Suspicion ' + cn + ' +30, ' + on + ' +10.', cn + '的士气 +15、反战情绪 -10。怀疑度 ' + cn + ' +30、' + on + ' +10。')],
        ['rumor', null, O.rumor.name, L(cn + 'の戦意 +8。疑惑度 ' + cn + ' +10・' + on + ' +3。', cn + ' morale +8. Suspicion ' + cn + ' +10, ' + on + ' +3.', cn + '的士气 +8。怀疑度 ' + cn + ' +10、' + on + ' +3。')],
        ['consult', 'aggr', L('戦争コンサル【積極・攻撃的】', 'War Consulting [Aggressive]', '战争顾问【积极·进攻】'), L('10週間、' + cn + 'の司令部を攻撃的な方針にする。装備・傭兵の相場 +0.15、前線への出動 1.8倍、押す力 +15%。その間、反戦感情が上がり(計+4.5)戦意が下がっていく(計-3)。疑惑度 ' + cn + ' +5。', 'For 10 weeks ' + cn + ' HQ turns aggressive: arms and merc prices +0.15, deployment x1.8, push +15%. Meanwhile anti-war rises (+4.5 total) and morale falls (-3 total). Suspicion ' + cn + ' +5.', '10周内，将' + cn + '的司令部改为进攻方针。装备与雇佣兵行情价 +0.15，向前线出动 1.8倍，推进力 +15%。期间反战情绪上升(共+4.5)，士气逐渐下降(共-3)。怀疑度 ' + cn + ' +5。')],
        ['consult', 'pass', L('戦争コンサル【消極・保守的】', 'War Consulting [Cautious]', '战争顾问【消极·稳守】'), L('10週間、' + cn + 'の司令部を保守的な方針にする。装備・傭兵の相場 -0.1、前線への出動 0.5倍、押す力 -12%(相手の大規模増援には対抗する)。その間、反戦感情が下がり(計-4.5)戦意が上がっていく(計+3)。疑惑度 ' + cn + ' +5。', 'For 10 weeks ' + cn + ' HQ turns cautious: arms and merc prices -0.1, deployment x0.5, push -12% (still counters surges). Meanwhile anti-war falls (-4.5 total) and morale rises (+3 total). Suspicion ' + cn + ' +5.', '10周内，将' + cn + '的司令部改为稳守方针。装备与雇佣兵行情价 -0.1，向前线出动 0.5倍，推进力 -12%(仍会对抗敌方大规模增援)。期间反战情绪下降(共-4.5)，士气逐渐上升(共+3)。怀疑度 ' + cn + ' +5。')],
        ['loan', null, O.loan.name, L(cn + 'へ50万を貸す。各国1回まで、資金30万以下の国だけが受け入れる。終戦時に利息20%を付けて回収、崩壊したら回収できない。', 'Lend 500K to ' + cn + '. Once per nation; only nations with 300K or less accept. Repaid +20% at war end; lost if it collapses.', '向' + cn + '贷款50万。每国限一次，仅资金30万以下的国家接受。战争结束时连同20%利息收回，若该国崩溃则无法收回。')],
      ].map(([k, arg, name, d]) => {
        let why = '';
        if (g.cd[k] > 0) why = L('あと' + Math.ceil(g.cd[k] / 3) + '週で使える', 'Ready in ' + Math.ceil(g.cd[k] / 3) + ' wk', '还需' + Math.ceil(g.cd[k] / 3) + '周可用') + (k === 'consult' ? L('(積極・消極で共通)', ' (shared by both)', '(积极与消极共用)') : '');
        else if (k === 'loan' && g.loans.some(l => l.cid === c.id)) why = L(cn + 'へは融資済み', 'Already lent to ' + cn, '已向' + cn + '贷款');
        else if (k === 'loan' && c.funds > S.CFG.loanLimit) why = L(cn + 'の資金が30万を超えているため受け入れない', cn + ' has over 300K and refuses', cn + '的资金超过30万，不接受贷款');
        else if (g.money < O[k].cost) why = L('所持金が足りない', 'Not enough cash', '现金不足');
        const note = k === 'consult' && now ? `<div class="onow">${esc(now)}</div>` : '';
        return `<div class="oprow"><div><div class="on">${esc(name)} <span class="oc num">${fmt(O[k].cost)}</span></div><div class="od">${esc(d)}</div>${note}${why ? `<div class="why">${esc(why)}</div>` : ''}</div>
          <button class="btn" data-op="${k}"${arg ? ` data-arg="${arg}"` : ''} ${why ? 'disabled' : ''}>${L('実行', 'Do it', '执行')}</button></div>`;
      }).join('');
      h = `<div class="stamp">${stampOf(L('暗躍', 'Covert', '暗中行动'))}</div><div class="mhead"><h2>${L(cn + 'に対して動く', 'Act on ' + cn, '针对' + cn + '采取行动')}</h2>${cashHTML()}</div>
        <div class="oplist">${rows}</div>
        <div class="foot"><button class="btn" data-do="close">${L('閉じて再開', 'Close and resume', '关闭并继续')}</button></div>
        ${respHTML()}${panel(c, 'ops')}${logHTML()}`;
    }
    const keep = focus ? 0 : $('mc').scrollTop;
    showModal(h, act.cid); $('mc').scrollTop = keep;
    if (act.kind === 'sell') updatePrice();
    if (focus) { const b = $('mc').querySelector('[data-do="close"]'); if (b) b.focus({ preventScroll: true }); $('mc').scrollTop = 0; }
  }
  // food market shown to two decimals; what lowers prices is shown as tags on each item
  function foodInfo(c, est) {
    return L('相場 ×' + est.toFixed(2) + '(兵糧' + Math.round(c.foodLv) + '%・1単位で+' + Math.round(S.foodRestore(c)) + '%)', 'Market x' + est.toFixed(2) + ' (food ' + Math.round(c.foodLv) + '%, +' + Math.round(S.foodRestore(c)) + '% per unit)', '行情价 ×' + est.toFixed(2) + '(军粮' + Math.round(c.foodLv) + '%、每单位+' + Math.round(S.foodRestore(c)) + '%)');
  }
  function priceTags(c) {
    const t = [];
    if (g.t < c.priceModUntil) t.push(L('競合の参入 -20%', 'Rival dealer -20%', '竞争者进入 -20%'));
    if (c.susp >= 50) t.push(L('疑惑度50以上 -20%', 'Suspicion 50+ -20%', '怀疑度50以上 -20%'));
    if (c.susp >= 80) t.push(L('疑惑度80以上 取引停止', 'Suspicion 80+ trade halted', '怀疑度80以上 中断交易'));
    return t.length ? `<span class="ptags">${t.map(x => `<span class="ptag">${esc(x)}</span>`).join('')}</span>` : '';
  }
  const sellLabel = has => !has ? L('在庫なし', 'Out of stock', '无库存') : act.blocked ? L('価格を変えてください', 'Change the price', '请更改价格') : act.m === 0 ? L('無償で渡す', 'Give for free', '无偿提供') : L('売り込む', 'Offer', '推销');
  function updatePrice() {
    const mM = $('mMult'), mY = $('mYen'); if (!mM) return;
    mM.textContent = act.m === 0 ? L('無償', 'Free', '无偿') : '×' + act.m.toFixed(2);
    const rg = $('mRange'); if (rg) rg.style.setProperty('--fill', (act.m / 2 * 100) + '%');
    mY.textContent = act.m === 0 ? '0' : fmt(Math.round(S.listPrice(g, act.item) * act.m));
    const b = $('mc').querySelector('[data-do="sell"]');
    if (b && g.inv[act.item] > 0) { b.disabled = act.blocked; b.textContent = sellLabel(true); }
  }

  // ---------- engine modals ----------
  function eventModal(m) {
    SFX('news');
    showModal(`<div class="stamp">${esc(m.stamp || (m.pre ? L('事前情報 / 国内未発表', 'Advance intel / not yet public', '事前情报 / 国内尚未公开') : L('速報', 'Breaking', '快讯')))} ${S.dateOf(g.t)}</div><h2>${esc(m.title)}</h2><p>${esc(m.text)}</p>
      <div class="foot"><button class="btn primary" id="mGo">${L('確認して再開', 'OK, resume', '确认并继续')}</button></div>`);
    $('mGo').onclick = () => { hideModal(); g.modal = null; g.paused = false; render(); };
    $('mGo').focus();
  }
  function orderModal(m) {
    SFX('news');
    const c = g.c[m.cid], it = I[m.item];
    showModal(`<div class="stamp">${L('緊急発注', 'Rush order', '紧急订单')} / ${S.dateOf(g.t)}</div><h2>${L(c.name + 'から至急の依頼', 'Urgent request from ' + c.name, c.name + '的紧急请求')}</h2>
      <p>${esc(L(c.name + 'が' + it.name + '(' + it.sub + ')を' + m.qty + 'セット、' + m.weeks + '週以内に求めています。価格は定価の' + m.mult.toFixed(2) + '倍です(現在の相場は約' + m.fair.toFixed(2) + '倍)。', c.name + ' needs ' + m.qty + ' sets of ' + it.name + ' (' + it.sub + ') within ' + m.weeks + ' weeks at x' + m.mult.toFixed(2) + ' list (market is about x' + m.fair.toFixed(2) + ').', c.name + '希望在' + m.weeks + '周内获得' + m.qty + '套' + it.name + '(' + it.sub + ')。价格为标价的' + m.mult.toFixed(2) + '倍(当前行情价约为' + m.fair.toFixed(2) + '倍)。'))}</p>
      <div class="kv"><span>${L('1セット', 'Per set', '每套')} <b>${fmt(m.unit)}</b></span><span>${L('合計', 'Total', '合计')} <b>${fmt(m.unit * m.qty)}</b></span><span>${L('現在の在庫', 'In stock', '当前库存')} <b>×${g.inv[m.item]}</b></span><span>${L(c.name + 'の戦況', c.name + ' land', c.name + '的战况')} <b>${Math.round(S.territory(g, m.cid) * 100)}%</b></span></div>
      <p style="font-size:12px;color:var(--muted)">${L('引き受けると、在庫ができ次第自動で納品し、1セットごとに代金を受け取ります。納品のたびに疑惑度が少し下がります。すべて期限内に納品すると、疑惑度-8・戦意+3の報酬があります。期限までに揃わなければ、約束を破ったとして疑惑度が10上がります。', 'If you accept, sets ship automatically as stock allows and you are paid per set. Each delivery lowers suspicion a little. Delivering all in time gives suspicion -8 and morale +3. Missing the deadline raises suspicion by 10.', '接受后，有库存时会自动交货，每交付一套即收取货款。每次交货都会稍微降低怀疑度。在期限内全部交付，可获得怀疑度-8、士气+3的回报。若到期未能交齐，会被视为违约，怀疑度上升10。')}</p>
      <div class="foot"><button class="btn" id="mNo">${L('見送る', 'Decline', '拒绝')}</button><button class="btn primary" id="mGo">${L('引き受ける', 'Accept', '接受')}</button></div>`, m.cid);
    $('mGo').onclick = () => { hideModal(); S.answerOrder(g, true); render(); };
    $('mNo').onclick = () => { hideModal(); S.answerOrder(g, false); render(); };
    $('mGo').focus();
  }
  function ledgerHTML(r) {
    const sp = r.supplied, oc = r.opsCount, b = r.base, en = S.LANG.cur === 'en';
    const parts = [];
    if (sp.equip) parts.push(L('装備一式' + sp.equip + '組', sp.equip + ' arms kits', '成套装备' + sp.equip + '套'));
    if (sp.merc) parts.push(L('傭兵' + fmt(sp.merc * 10000) + '人', fmt(sp.merc * 10000) + ' mercenaries', '雇佣兵' + fmt(sp.merc * 10000) + '人'));
    if (sp.food) parts.push(L('兵糧' + sp.food + '単位', sp.food + ' ration units', '军粮' + sp.food + '单位'));
    const ops = [['assassin', L('要人暗殺', 'assassinations', '要人暗杀')], ['rumor', L('悪評の流布', 'smear campaigns', '散布恶评')], ['consult', L('戦争コンサル', 'consultations', '战争顾问')], ['loan', L('融資', 'loans', '贷款')]].filter(([k]) => oc[k] > 0).map(([k, n]) => en ? oc[k] + ' ' + n : n + oc[k] + L('件', '', '次'));
    const cas = Math.round(r.cas / 100) * 100;
    let rows = `<div><span>${L('供給したもの', 'Supplied', '供应的物资')}</span><b>${parts.length ? parts.join(L('、', ', ', '、')) : L('なし', 'nothing', '无')}</b></div>
      <div><span>${L('裏で動いた記録', 'Covert record', '暗中行动记录')}</span><b>${ops.length ? ops.join(L('、', ', ', '、')) : L('なし', 'none', '无')}</b></div>`;
    let verdict = '', coda = '';
    if (r.type === 'retreat') {
      rows += `<div><span>${L('あなたが関わった期間', 'Weeks involved', '你参与的期间')}</span><b>${r.weeks}${L('週', ' wk', '周')}</b></div><div><span>${L('その間の推計死傷者', 'Est. casualties', '其间估计伤亡')}</span><b>${fmt(cas)}</b></div>`;
      coda = L('あなたが去った後も、戦争は続いている。', 'The war goes on after you leave.', '你离开后，战争仍在继续。');
    } else if (b) {
      const dw = r.weeks - b.weeks, dc = Math.round((r.cas - b.cas) / 100) * 100;
      rows += `<div><span>${L('戦争の長さ', 'War length', '战争时长')}</span><b>${L(r.weeks + '週(あなたがいなければ 約' + b.weeks + '週)', r.weeks + ' wk (about ' + b.weeks + ' without you)', r.weeks + '周(若没有你 约' + b.weeks + '周)')}</b></div>
        <div><span>${L('推計死傷者', 'Est. casualties', '估计伤亡')}</span><b>${L(fmt(cas) + '人(あなたがいなければ 約' + fmt(Math.round(b.cas / 100) * 100) + '人)', fmt(cas) + ' (about ' + fmt(Math.round(b.cas / 100) * 100) + ' without you)', fmt(cas) + '人(若没有你 约' + fmt(Math.round(b.cas / 100) * 100) + '人)')}</b></div>`;
      verdict = (dw > 0 ? L('あなたの商売で、戦争は' + dw + '週長引いた。', 'Your trade made the war ' + dw + ' weeks longer. ', '因为你的生意，战争延长了' + dw + '周。') : dw < 0 ? L('あなたの商売で、戦争は' + (-dw) + '週早く終わった。', 'Your trade ended the war ' + (-dw) + ' weeks sooner. ', '因为你的生意，战争提前' + (-dw) + '周结束。') : L('あなたがいてもいなくても、戦争の長さは変わらなかった。', 'With or without you, the war lasted as long. ', '无论有没有你，战争的时长都没有改变。'))
        + '\n' + (dc > 0 ? L('死傷者は約' + fmt(dc) + '人増えた。', 'About ' + fmt(dc) + ' more were killed or wounded.', '伤亡增加了约' + fmt(dc) + '人。') : dc < 0 ? L('死傷者は約' + fmt(-dc) + '人少なかった。', 'About ' + fmt(-dc) + ' fewer were killed or wounded.', '伤亡减少了约' + fmt(-dc) + '人。') : '');
      coda = dc > 0 ? L('その' + fmt(dc) + '人の名は、あなたの帳簿には載らない。', 'Those ' + fmt(dc) + ' names will never appear in your ledger.', '那' + fmt(dc) + '人的名字，不会出现在你的账本上。') : L('利益は帳簿に残り、死者は数字として残る。', 'The profit stays in the ledger; the dead stay as numbers.', '利润留在账本上，死者则化为数字。');
    }
    // the verdict (how much longer / how many more) and the closing line sit together, large, under the ledger
    return `<div class="stamp">${L('戦果と罪状', 'Deeds and guilt', '战果与罪状')}</div><div class="ledger">${rows}</div>${verdict || coda ? `<div class="coda">${verdict ? `<div class="cv">${esc(verdict)}</div>` : ''}${coda ? `<div class="cc">${esc(coda)}</div>` : ''}</div>` : ''}`;
  }
  function chart() {
    const h = g.history; if (h.length < 2) return '';
    const W = 560, H = 130, Tm = Math.max(60, h[h.length - 1].t), pad = 24;
    const x = t => pad + (t / Tm) * (W - pad * 2), y = v => 8 + (1 - v) * (H - 28);
    const line = f => h.map(p => x(p.t).toFixed(1) + ',' + y(f(p)).toFixed(1)).join(' ');
    let ticks = ''; for (let t = 0; t <= Tm + 0.1; t += 144) ticks += `<text x="${x(t)}" y="${H - 4}" fill="var(--muted)" font-size="10" text-anchor="middle">${L((t / 144 + 1) + '年目', 'Y' + (t / 144 + 1), '第' + (t / 144 + 1) + '年')}</text>`;
    return `<div class="chartbox"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${L('戦況と戦意の推移', 'Front and morale over time', '战况与士气的变化')}">
      <line x1="${pad}" x2="${W - pad}" y1="${y(0.5)}" y2="${y(0.5)}" stroke="var(--line)" stroke-dasharray="3 3"></line>
      <polyline points="${line(p => p.mA / 100)}" fill="none" stroke="var(--a)" stroke-width="1" opacity=".7" stroke-dasharray="4 3"></polyline>
      <polyline points="${line(p => p.mB / 100)}" fill="none" stroke="var(--b)" stroke-width="1" opacity=".7" stroke-dasharray="4 3"></polyline>
      <polyline points="${line(p => p.terr)}" fill="none" stroke="var(--brass)" stroke-width="2"></polyline>${ticks}</svg>
      <div style="font-size:11px;color:var(--muted)">${L('実線: A国の戦況(点線=拮抗)/破線: 戦意(青=A国・赤=B国)', 'Solid: A land (dotted = even) / dashed: morale (blue = A, red = B)', '实线: A国的战况(虚点线=势均力敌)/虚线: 士气(蓝=A国、红=B国)')}</div></div>`;
  }
  function finalHTML(r) {
    if (!r.final) return '';
    const col = id => {
      const f = r.final[id], c = g.c[id], sb = f.sales || { equip: { n: 0, v: 0, free: 0 }, merc: { n: 0, v: 0, free: 0 }, food: { n: 0, v: 0, free: 0 } };
      const sl = k => { const x = sb[k]; return x.n ? short(x.v) + L('(' + (x.n - x.free) + '回' + (x.free ? '・無償' + x.free : '') + ')', ' (' + (x.n - x.free) + (x.free ? ', ' + x.free + ' free' : '') + ')', '(' + (x.n - x.free) + '次' + (x.free ? '、无偿' + x.free : '') + ')') : '—'; };
      const tot = sb.equip.v + sb.merc.v + sb.food.v;
      return `<div class="fc ${id}"><h3><span>${c.name}</span>${r.loser === id ? `<small>${L('敗北', 'Defeated', '战败')}</small>` : ''}</h3>
        <div><span>${L('国土', 'Land', '国土')}</span><b>${Math.round(f.terr * 100)}%</b></div>
        <div><span>${L('戦意 / 反戦', 'Morale / anti-war', '士气 / 反战')}</span><b>${Math.round(f.morale)} / ${Math.round(f.antiwar)}</b></div>
        <div><span>${L('前線 / 予備', 'Front / reserve', '前线 / 预备')}</span><b>${short(f.front)} / ${short(f.reserve)}</b></div>
        <div><span>${L('装備充足率', 'Arms', '装备充足率')}</span><b>${Math.round(f.eq * 100)}%</b></div>
        <div><span>${L('兵糧', 'Food', '军粮')}</span><b>${Math.round(f.food)}%</b></div>
        <div><span>${L('資金', 'Funds', '资金')}</span><b>${short(f.funds)}</b></div>
        <div><span>${L('疑惑度', 'Suspicion', '怀疑度')}</span><b>${Math.round(f.susp)}</b></div>
        <div class="sep"><span>${L('売上 装備', 'Sales: arms', '销售额 装备')}</span><b>${sl('equip')}</b></div>
        <div><span>${L('売上 傭兵', 'Sales: mercs', '销售额 雇佣兵')}</span><b>${sl('merc')}</b></div>
        <div><span>${L('売上 兵糧', 'Sales: rations', '销售额 军粮')}</span><b>${sl('food')}</b></div>
        <div><span>${L('売上 合計', 'Sales: total', '销售额 合计')}</span><b>${short(tot)}</b></div></div>`;
    };
    return `<div class="stamp">${L('終戦時の両国', 'Both nations at the end', '停战时的两国')}</div>
      <div class="finhd"><span>${L('戦争', 'War', '战争')} <b>${esc(S.SCENARIOS[r.scKey || curSc].name)}${r.random ? L('(ランダム)', ' (random)', '(随机)') : ''}</b></span><span>${r.type === 'cap' ? L('期限まで戦争が続いた', 'The war ran to the deadline', '战争一直持续到期限') : L('期限まで <b>あと' + r.weeksLeft + '週</b> を残して終結', 'Ended <b>' + r.weeksLeft + ' weeks</b> before the deadline', '距期限 <b>还剩' + r.weeksLeft + '周</b> 时结束')}</span></div>
      <div class="fin">${col('A')}${col('B')}</div>`;
  }
  function reviewItems(r) {
    const st = r.stats, out = [];
    const ln = r.loser ? g.c[r.loser].name : '', wn = r.loser ? g.c[r.loser === 'A' ? 'B' : 'A'].name : '', left = r.weeksLeft ? L('(期限まであと' + r.weeksLeft + '週)', ' (' + r.weeksLeft + ' weeks before the deadline)', '(距期限还剩' + r.weeksLeft + '周)') : '';
    const keepMorale = L('戦意は、無償供与や相場より安い売却、要人暗殺・悪評の流布、戦争コンサルの「消極」の方針で保てます。兵糧を切らさないことも大切です。', ' Morale is kept up by free gifts, selling below market, assassinations, smear campaigns and a "Cautious" policy. Do not let food run out.', '士气可以通过无偿提供、低于行情价出售、要人暗杀、散布恶评、战争顾问的“消极”方针来维持。不让军粮断绝也很重要。');
    if (r.type === 'peace') out.push(L('両国の戦意が保たれていれば、戦争は期限まで続いていました' + left + '。', 'Had both sides kept their morale, the war would have run to the deadline' + left + '.', '若两国保持住士气，战争本会持续到期限' + left + '。') + keepMorale);
    else if (r.type === 'collapse' && g.endKind === 'surrender') out.push(L(ln + 'の戦意が足りず、' + ln + 'は降伏しました' + left + '。', ln + ' ran out of morale and surrendered' + left + '.', ln + '士气不足，' + ln + '投降了' + left + '。') + keepMorale);
    else if (r.type === 'collapse') out.push(L(ln + 'と' + wn + 'の戦力差が大きく、' + ln + 'は戦線を押し返せないまま首都を失いました' + left + '。押す力は、劣勢側への装備・傭兵の供給、兵糧の確保、戦意の維持、戦争コンサルの「積極」の方針で高められます。資金が尽きた国には融資も使えます。', 'The gap between ' + ln + ' and ' + wn + ' was too wide; ' + ln + ' lost its capital' + left + '. Push grows with arms and mercs for the weaker side, enough food, steady morale and an "Aggressive" policy. Broke nations can take a loan.', ln + '与' + wn + '的战力差距太大，' + ln + '未能扭转战线便失去了首都' + left + '。推进力可以通过向劣势一方供应装备、雇佣兵、确保军粮、维持士气、战争顾问的“积极”方针来提高。对于资金耗尽的国家，也可以使用贷款。'));
    if (r.wasted >= 150000) out.push(L('売れ残った在庫に' + short(r.wasted) + 'の生産費を払いました。売れない品目は倉庫で生産を止めると、無駄を減らせます。', 'You paid ' + short(r.wasted) + ' to make stock that never sold. Pause production of items that are not selling.', '你为卖剩的库存支付了' + short(r.wasted) + '的生产成本。卖不出去的品类在仓库停止生产，就能减少浪费。'));
    if (st.noneed >= 4) out.push(L('「今は必要ない」と' + st.noneed + '回断られました。優勢な国は武器を買いません。戦況を拮抗させると需要が生まれます。', 'Turned down ' + st.noneed + ' times as "not needed". Winning nations do not buy arms; a close war creates demand.', '有' + st.noneed + '次被以“现在不需要”为由拒绝。占优势的国家不会购买武器。让战况保持胶着，就会产生需求。'));
    if (st.refuse >= 3) out.push(L('高すぎる価格で' + st.refuse + '回拒否されました。前回の成約価格と相手の反応を目安に、戦況や装備の変化を読んで値を決めてください。', 'Refused ' + st.refuse + ' times for overpricing. Use the last deal and the buyer\'s reaction, and read changes in the war and its arms, to set your price.', '因价格过高被拒绝了' + st.refuse + '次。请以上次成交价和对方的反应为参考，结合战况与装备的变化来定价。'));
    if (st.nofunds >= 4) out.push(L('資金不足で' + st.nofunds + '回買ってもらえませんでした。貧しい国には値引き・無償供与・融資が使えます。', st.nofunds + ' sales failed for lack of funds. Discounts, gifts and loans help poor nations.', '因资金不足有' + st.nofunds + '次没能卖出。对贫穷的国家可以使用降价、无偿提供和贷款。'));
    if (st.stop >= 2 || st.maxSusp >= 80) out.push(L('疑惑度が80を超え、取引が止まる場面がありました。安く売る・無償供与で疑惑度を下げられます。', 'Suspicion passed 80 and trade stopped. Cheap sales and gifts lower suspicion.', '出现过怀疑度超过80、交易中断的局面。低价出售和无偿提供可以降低怀疑度。'));
    if ((st.spoiled || 0) >= 2) out.push(L('兵糧を' + st.spoiled + '単位、売れないまま傷ませて廃棄しました。兵糧は、どこかの国が100%を切りそうな時だけ作ると無駄が出ません。', st.spoiled + ' ration units spoiled unsold. Make rations only when a nation is about to drop below 100%.', '有' + st.spoiled + '单位军粮因卖不出去而变质废弃。只在某个国家的军粮快要跌破100%时生产，就不会浪费。'));
    if (r.loanLost > 0) out.push(L('融資した国が崩壊し、' + short(r.loanLost) + 'が回収できませんでした。', 'A borrower collapsed and ' + short(r.loanLost) + ' was lost.', '贷款的国家崩溃了，' + short(r.loanLost) + '无法收回。'));
    if (!out.length && r.profit > 0) out.push({ good: true, text: L('目立った無駄のない立ち回りでした。次は相場より少し高く売る、締め時を狙うなどで、さらに上を目指せます。', 'Clean play with little waste. Next, try selling a bit above market or timing the finish to score higher.', '这一局几乎没有明显的浪费。下次可以尝试略高于行情价出售、把握收尾时机，争取更高的成绩。') });
    if (!out.length) out.push(L('次は、各国のゲージ(装備・兵糧・国土・警戒)と前回の成約価格を見てから売ってみてください。', 'Next time, check each nation\'s gauges and the last deal price before you sell.', '下次请先查看各国的指标(装备、军粮、国土、警戒)和上次的成交价，再进行出售。'));
    return out.slice(0, 4).map(t => typeof t === 'string' ? `<div>${esc(t)}</div>` : `<div class="good">${esc(t.text)}</div>`).join('');
  }
  const endLabel = r => r.type === 'collapse' ? (g.endKind === 'surrender' ? L('降伏', 'Surrender', '投降') : L('首都陥落', 'Capital fallen', '首都沦陷')) : { peace: L('講和', 'Peace', '和谈'), cap: L('強制講和', 'Imposed peace', '强制停战'), retreat: L('撤退', 'Withdrawal', '撤离') }[r.type];
  function resultModal() {
    BGMST.result = true;
    const r = g.result, rec = mode === 'game' ? recordResult(r) : { isNew: false, prev: null };
    showModal(`<div class="stamp">${L('終戦報告', 'War report', '停战报告')} / ${endLabel(r)} / ${S.dateOf(r.t)}${L('(' + r.weeks + '週)', ' (' + r.weeks + ' wk)', '(' + r.weeks + '周)')}</div><h2>${esc(r.text)}</h2>
      <div class="scorebox"><div class="stamp">${L('利益(スコア)', 'Profit (score)', '利润(得分)')}</div><div class="big" id="rScore" style="color:${r.profit >= 0 ? 'var(--good)' : 'var(--bad2)'}">${r.profit >= 0 ? '+' : ''}${fmt(r.profit)}</div>${rec.prev ? `<div class="rprev">${L('これまでの最高', 'Previous best', '此前最佳')} ${sgn(rec.prev.profit)}</div>` : ''}</div>
      <div class="rrest" id="rRest">
      <div class="deeds">${ledgerHTML(r)}</div>
      <div class="stamp">${L('振り返り', 'Review', '回顾')}</div>
      <div class="review">${reviewItems(r)}</div>
      ${finalHTML(r)}
      <div class="stamp">${L('帳簿', 'Ledger', '账本')}</div>
      <div class="res">
        <div><span>${L('販売の売上', 'Sales', '销售额')}</span><b class="num">${fmt(r.revenue)}</b></div>
        <div><span>${L('うち兵糧', 'of which rations', '其中军粮')}</span><b class="num">${fmt(r.foodRev)}</b></div>
        <div><span>${L('原価より高く売った売上', 'Sales above cost', '高于成本的销售额')}</span><b class="num">${fmt(r.acct ? r.acct.gainRev : 0)}</b></div>
        <div><span>${L('その利益', 'Their margin', '其利润')}</span><b class="num">${fmt(r.acct ? r.acct.gain : 0)}</b></div>
        <div><span>${L('原価以下で売った売上', 'Sales at or below cost', '成本以下的销售额')}</span><b class="num">${fmt(r.acct ? r.acct.lossRev : 0)}</b></div>
        <div><span>${L('その赤字(無償供与を含む)', 'Their loss (incl. gifts)', '其亏损(含无偿提供)')}</span><b class="num">${fmt(r.acct ? r.acct.loss : 0)}</b></div>
        <div><span>${L('生産費', 'Production cost', '生产成本')}</span><b class="num">${fmt(r.spent)}</b></div>
        <div><span>${L('暗躍費', 'Covert cost', '暗中行动费用')}</span><b class="num">${fmt(r.opsSpent)}</b></div>
        <div><span>${L('融資 回収/貸倒れ', 'Loans repaid/lost', '贷款 收回/坏账')}</span><b class="num">${short(r.loanRepaid)} / ${short(r.loanLost)}</b></div>
        <div><span>${L('売れ残りの生産費', 'Unsold stock cost', '卖剩库存的生产成本')}</span><b class="num">${fmt(r.wasted)}</b></div>
        <div><span>${L('取引回数', 'Deals', '交易次数')}</span><b class="num">${r.sales}</b></div>
        <div><span>${L('断られた回数', 'Turned down', '被拒绝次数')}</span><b class="num">${r.stats.noneed + r.stats.refuse + r.stats.nofunds + r.stats.stop + r.stats.nomorale}</b></div>
      </div>
      <div class="stamp">${L('経緯(何が起きて、どうなったか)', 'Timeline (what happened and why)', '经过(发生了什么，结果如何)')}</div>
      <ul class="tline">${(r.timeline || []).map(e => `<li class="${e.kind}"><span class="d">${S.dateOf(e.t)}</span><span><span class="w">${esc(e.what)}</span>${e.why ? `<span class="y">${esc(e.why)}</span>` : ''}</span></li>`).join('')}</ul>
      ${chart()}
      <div class="foot"><button class="btn" id="mHome">${L('ホームに戻る', 'Home', '返回主页')}</button><button class="btn primary" id="mGo">${L('同じ戦争をもう一度', 'Same war again', '再打一次同样的战争')}</button></div></div>`);
    scoreCountUp(r, rec);
    $('mGo').onclick = () => { hideModal(); startGame(curSc); };
    $('mHome').onclick = () => { hideModal(); showHome(); };
    $('mGo').focus({ preventScroll: true }); $('mc').scrollTop = 0;   // open at the top: the score and the deeds come first
  }

  // ---------- records: the best profit for each war, and the last plays ----------
  const REC_KEY = 'bs_records';
  function recLoad() { try { const r = JSON.parse(localStorage.getItem(REC_KEY) || 'null'); if (r && r.best && r.hist) return r; } catch (e) { /* none */ } return { best: {}, hist: [] }; }
  function recSave(r) { try { localStorage.setItem(REC_KEY, JSON.stringify(r)); } catch (e) { /* storage off */ } }
  const recKeyOf = r => r.random ? 'random' : (r.scKey || curSc);
  // returns { isNew, prev } and stores this play
  function recordResult(r) {
    if (r._rec) return r._rec;
    const db = recLoad(), key = recKeyOf(r), prev = db.best[key] || null;
    const entry = { key, profit: Math.round(r.profit), type: r.type, kind: g.endKind || '', weeks: r.weeks, at: Date.now() };
    const isNew = !prev || entry.profit > prev.profit;
    if (isNew) db.best[key] = entry;
    db.hist.unshift(entry); db.hist = db.hist.slice(0, 30);
    recSave(db);
    return (r._rec = { isNew, prev });
  }
  const warName = key => key === 'random' ? L('ランダムな戦争', 'Random war', '随机战争') : (S.SCENARIOS[key] ? S.SCENARIOS[key].name : key);
  const endName = e => e.type === 'collapse' ? (e.kind === 'surrender' ? L('降伏', 'Surrender', '投降') : L('首都陥落', 'Capital fallen', '首都沦陷')) : { peace: L('講和', 'Peace', '和谈'), cap: L('強制講和', 'Imposed peace', '强制停战'), retreat: L('撤退', 'Withdrawal', '撤离') }[e.type] || '';
  const dayOf = ms => { const d = new Date(ms); return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0'); };
  const sgn = v => (v >= 0 ? '+' : '−') + fmt(Math.abs(v));
  function homeRecords() {
    const db = recLoad(), keys = Object.keys(S.SCENARIOS).concat(db.best.random ? ['random'] : []);
    const best = keys.map(k => { const b = db.best[k]; return `<tr><td>${esc(warName(k))}</td>${b ? `<td class="num ${b.profit >= 0 ? 'pos' : 'neg'}">${sgn(b.profit)}</td><td>${endName(b)} / ${b.weeks}${L('週', ' wk', '周')}</td><td class="d">${dayOf(b.at)}</td>` : `<td class="none" colspan="3">${L('記録なし', 'No record yet', '暂无记录')}</td>`}</tr>`; }).join('');
    const hist = db.hist.slice(0, 10).map(h => `<tr><td class="d">${dayOf(h.at)}</td><td>${esc(warName(h.key))}</td><td class="num ${h.profit >= 0 ? 'pos' : 'neg'}">${sgn(h.profit)}</td><td>${endName(h)} / ${h.weeks}${L('週', ' wk', '周')}</td></tr>`).join('');
    homePop(`<div class="hpanel rec"><h2>${L('戦歴', 'Records', '战绩')}</h2>
      <div class="stamp">${L('自己ベスト(戦争ごとの最高利益)', 'Personal best (top profit per war)', '个人最佳(各战争的最高利润)')}</div>
      <table class="rtab">${best}</table>
      <div class="stamp">${L('最近の戦争(10件)', 'Recent wars (last 10)', '最近的战争(10场)')}</div>
      ${hist ? `<table class="rtab">${hist}</table>` : `<p class="none">${L('まだ戦争に関わっていません。', 'No wars yet.', '还没有参与过战争。')}</p>`}
      <div class="foot"><button class="btn primary" data-hclose>${L('閉じる', 'Close', '关闭')}</button></div></div>`);
  }

  // the score counts up from zero (ease-out, under 3 s); then the NEW RECORD seal and the rest of the report
  function scoreCountUp(r, rec) {
    const el = $('rScore'), rest = $('rRest'); if (!el || !rest) return;
    const target = Math.round(r.profit), dur = 2600;
    let done = false, raf = 0, t0 = 0;
    const show = v => { el.textContent = (v >= 0 ? '+' : '−') + fmt(Math.abs(v)); };
    const finish = () => {
      if (done) return; done = true; cancelAnimationFrame(raf); show(target);
      $('mc').removeEventListener('click', skip, true);
      if (rec.isNew && target !== 0) {
        const s = document.createElement('div'); s.className = 'nrec'; s.textContent = 'NEW RECORD';
        el.parentElement.appendChild(s); SFX('click');
      }
      setTimeout(() => { rest.classList.add('show'); }, rec.isNew ? 420 : 120);
    };
    const skip = e => { if (!done) { e.stopPropagation(); e.preventDefault(); finish(); } };
    if (RM() || !target) { finish(); return; }
    rest.classList.add('wait'); show(0);
    $('mc').addEventListener('click', skip, true);
    const step = now => { if (!t0) t0 = now; const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4); show(Math.round(target * e / 1000) * 1000 || 0); if (k < 1) raf = requestAnimationFrame(step); else finish(); };
    raf = requestAnimationFrame(step);
  }

  // ---------- game lifecycle ----------
  function setupGame(sc) {
    curSc = sc || curSc;
    S.setLang(SET.lang);
    g = S.newGame(null, { scenario: curSc }); g.paused = true; started = false; act = null; wireKey = '';
    { const n = (window.BS_MAPS || []).length; if (n) boardUse(Math.floor(Math.random() * n)); BOARD.share = -1; } // one map for each war
    setScales(); rebuildAll();
    FX.units = { A: [], B: [] }; FX.flashes = []; FX.ripples = []; FX.sparks = []; FX.prevPipe = { A: [], B: [] }; FX.shareLog = []; FX.lastCas = { A: null, B: null }; FX.killAcc = { A: 0, B: 0 }; FX.arrAcc = { A: 0, B: 0 }; FX.prevTransit = { A: [], B: [] }; FX.pushRate = 0;
    for (const k in effMemo) delete effMemo[k];
    render();
  }
  let fadeTimers = [];
  function clearFades() { fadeTimers.forEach(clearTimeout); fadeTimers = []; }
  function later(fn, ms) { fadeTimers.push(setTimeout(fn, ms)); }
  // start of a war: fade in from black with the war's name and date
  // start of a war: first fade the current screen to black, then switch, then fade in with the war's name and date
  function startGame(sc) {
    clearFades();
    if (touch && SET.autoFull) goFull();
    const f = $('fade'), rm = RM(), out = rm ? 150 : 550;
    $('fadeT').textContent = ''; $('fadeS').textContent = '';
    f.className = 'on cover';
    later(() => {
      hideModal(); closeHome(); mode = 'game'; setupGame(sc);
      $('fadeT').textContent = S.SCENARIOS[curSc].name; $('fadeS').textContent = S.dateOf(0);
    }, out);
    later(() => { f.className = 'cover'; }, out + (rm ? 300 : 1300));
    later(() => { f.className = ''; started = true; g.paused = false; render(); }, out + (rm ? 500 : 2100));
  }
  // end of a war: the screen dims in the ending's colour, then the report appears
  // what became of the two nations, read on the dark screen before the report
  function endStory(r) {
    const Ln = r.loser ? g.c[r.loser].name : '', Wn = r.loser ? g.c[r.loser === 'A' ? 'B' : 'A'].name : '';
    if (r.type === 'collapse' && g.endKind === 'surrender') return L(Ln + 'は戦意も国土も失い、' + Wn + 'に降伏を宣言した。' + Ln + 'は' + Wn + 'に吸収され、地図から消えた。',
      Ln + ', its will and its land gone, declared surrender to ' + Wn + '. ' + Ln + ' was absorbed into ' + Wn + ' and vanished from the map.',
      Ln + '失去了士气与国土，向' + Wn + '宣布投降。' + Ln + '被' + Wn + '吞并，从地图上消失了。');
    if (r.type === 'collapse') return L(Wn + 'の軍が' + Ln + 'の首都に入った。政府は崩れ落ち、' + Ln + 'という国はその日をもって終わった。',
      Wn + "'s army marched into " + Ln + "'s capital. The government fell, and " + Ln + ' ended that day.',
      Wn + '的军队开进了' + Ln + '的首都。政府随之倒台，' + Ln + '这个国家就此终结。');
    if (r.type === 'peace') return L('両国は疲れ果て、講和の席に着いた。国境は今の戦線で引き直され、勝者のいないまま銃声が止んだ。',
      'Both nations, exhausted, sat down to make peace. The border was redrawn along the front, and the guns fell silent with no victor.',
      '两国筋疲力尽，坐上了和谈桌。国境沿着现在的战线重新划定，枪声在没有胜者的情况下停息了。');
    if (r.type === 'cap') return L('国際機関の監視団が両国に入り、戦闘は強制的に止められた。どちらの言い分も通らないまま、戦争は凍結された。',
      'International monitors moved into both nations and the fighting was forced to stop. Neither side got its way; the war was frozen.',
      '国际机构的监察团进入两国，战斗被强制停止。双方的主张都未能实现，战争就此冻结。');
    return L('あなたは帳簿を閉じ、この戦争から手を引いた。銃声は、まだ止んでいない。', 'You closed the ledger and walked away from this war. The guns have not fallen silent.', '你合上账本，从这场战争中抽身。枪声仍未停息。');
  }
  function endSequence() {
    SFX('end');
    const r = g.result, f = $('fade'), x = $('fadeX'), red = r.type === 'collapse', green = r.type === 'peace' || r.type === 'cap';
    f.className = 'on' + (red ? ' endA' : green ? ' endG' : '');
    $('fadeT').textContent = endLabel(r);
    $('fadeS').textContent = S.dateOf(r.t) + L('(開戦から' + r.weeks + '週)', ' (week ' + r.weeks + ' of the war)', '(开战第' + r.weeks + '周)');
    x.textContent = endStory(r); x.classList.remove('show');
    let done = false;
    const finish = () => { if (done) return; done = true; f.onclick = null; f.style.pointerEvents = ''; resultModal(); f.className = ''; x.classList.remove('show'); };
    later(() => x.classList.add('show'), 1400);                 // the story fades in under the title
    later(() => f.classList.add('outro'), 7000);                // everything sinks into black
    later(finish, 8000);                                        // then the report
    later(() => { f.style.pointerEvents = 'auto'; f.onclick = finish; }, 1500);   // a tap skips ahead
  }
  function showHome() {
    clearFades(); act = null; hideModal(); mode = 'home'; started = false; BGMST.result = false;
    if (g) g.paused = true;
    $('fade').className = ''; $('home').hidden = false; $('hpop').hidden = true;
    if (window.BSTut) window.BSTut.stop();
    applyStatic();
  }
  function closeHome() { $('home').hidden = true; $('hpop').hidden = true; }

  // ---------- home screen ----------
  const SCN_DESC = {
    s1: { ja: ['国境の山地に眠る鉱脈をめぐり、大国A国は隣の小国B国へ軍を進めた。', '兵も資金も勝るA国は、数か月で片が付くと踏んでいる。', '貧しいB国は、祖国を明け渡すまいとする兵の士気だけを頼りに、不利な戦いを続ける。', '金払いのいいA国は上客になる。一方B国の国庫はすぐに底をつき、給金の途絶えた兵は前線を去っていく。', 'B国が崩れれば戦争は終わり、商売の場も消える。', '融資や値引きで小国を延命させながら、大国からどれだけ引き出せるかが腕の見せ所だ。', '小国の資金の管理に注意が必要だろう。'],
          zh: ['为了争夺国境山地下沉睡的矿脉，大国A国向邻国小国B国进军。', '兵力与资金都占优的A国，认为几个月就能解决战斗。', '贫穷的B国只能依靠誓死不让出祖国的士兵们的士气，继续着不利的战斗。', '出手阔绰的A国会是好主顾。另一方面，B国的国库很快就会见底，领不到军饷的士兵会离开前线。', 'B国一旦崩溃，战争就会结束，生意也随之消失。', '用贷款和降价让小国苟延残喘，同时从大国身上尽可能多地赚钱，这才是展现本事的地方。', '需要留意小国的资金管理。'],
          en: ['Over the ore beneath their border hills, the great power A marched into its small neighbour B.', 'With more men and money, A expects it all to be over in months.', 'Poor B fights on against the odds, held together by the resolve of soldiers who will not give up their homeland.', 'Free-spending A makes a fine customer. B\'s treasury soon runs dry, and unpaid soldiers walk away from the front.', 'If B collapses, the war ends and so does your trade.', 'The art lies in keeping the small nation alive with loans and discounts while drawing as much as you can from the great one.', "Keep a close eye on the small nation's money."] },
    s2: { ja: ['工場と鉄道で栄えた工業国A国は、国民の食料を輸入に頼ってきた。', '凶作で輸入が途絶えると、A国は食料自給率を高めるため、隣の農業国B国の穀倉地帯へ侵攻した。', '装備では勝るA国だが、前線の兵を養う兵糧を自前では賄えない。', '兵と食料に恵まれたB国は、旧式の武器で穀倉を守りながら、新しい装備を求め続ける。', '開戦時の国土と資金は、ほぼ互角。', '同じ品を両国に売るより、それぞれに足りないものを見極めるのが稼ぎの近道だ。', '工業国の兵糧の管理に注意が必要だろう。'],
          zh: ['以工厂和铁路繁荣起来的工业国A国，一直依赖进口来养活国民。', '歉收导致进口中断后，A国为了提高粮食自给率，入侵了邻国农业国B国的粮仓地带。', 'A国虽然装备占优，却无法自行供应养活前线士兵的军粮。', '兵员与粮食充足的B国，一边用旧式武器守卫粮仓，一边不断寻求新的装备。', '开战时两国的国土与资金几乎相当。', '与其向两国出售同样的货物，不如看清各自缺少什么，这才是赚钱的捷径。', '需要留意工业国的军粮管理。'],
          en: ['Industrial A, rich in factories and railways, has always imported the food it eats.', 'When a failed harvest cut off its imports, A invaded the granaries of agrarian B to feed itself.', 'A has the better arms, but cannot feed the soldiers at its front on its own.', 'B, rich in men and grain, defends its fields with old weapons and keeps asking for new ones.', 'Land and money start roughly even.', 'Rather than selling the same goods to both, the fastest profit lies in reading what each one lacks.', "Keep a close eye on the industrial nation's food."] },
  };
  function homePop(html) { const p = $('hpop'); p.innerHTML = html; p.hidden = false; }
  function homeScenarios() {
    S.setLang(SET.lang);
    homePop(`<div class="hpanel"><h2>${L('どの戦争に関わるか', 'Choose your war', '选择要介入的战争')}</h2>
      <div class="scards">${['s1', 's2'].map(k => { const d = SCN_DESC[k][SET.lang] || SCN_DESC[k].ja; return `<div class="scard"><span class="st"><i></i>${esc(S.SCENARIOS[k].name)}</span>
        <span class="sd">${d.map((l, i) => `<p${i === d.length - 1 ? ' class="warn"' : ''}>${esc(l)}</p>`).join('')}</span><button class="btn primary go" data-scn="${k}">${L('この戦争を始める', 'Start this war', '开始这场战争')}</button></div>`; }).join('')}</div>
      <div class="foot"><button class="btn" data-hclose>${L('戻る', 'Back', '返回')}</button></div></div>`);
    $('hpop').querySelector('[data-scn]').focus();
  }
  function homeSettings() {
    const rows = [
      ['fx', L('危機の演出', 'Crisis effects', '危机演出'), L('降伏・陥落・講和が近い時に、画面の縁を赤や緑に点滅させる', 'Flash the screen edges red or green when defeat or peace is near', '投降、沦陷、和谈临近时，让画面边缘闪烁红色或绿色')],
      ['reduce', L('動きを減らす', 'Reduce motion', '减少动态效果'), L('光点のゆらぎや点滅を抑える', 'Calm marker wobble and flashing', '抑制光点的晃动与闪烁')],
      ['bgm', L('BGM', 'Music', '背景音乐'), L('画面や戦況に合わせて音楽を流す', 'Play music that follows the screen and the war', '根据画面与战况播放音乐')],
      ['voice', L('ボイス', 'Voice', '语音'), L('ムービーで密偵の声を流す', 'Play the scout\'s voice in movies', '在过场动画中播放密探的语音')],
      ['sound', L('効果音', 'Sound effects', '音效'), L('操作や出来事に効果音を付ける', 'Play sounds for actions and events', '为操作和事件播放音效')],
      ['autoFull', L('スマホで自動的に全画面', 'Auto full screen on phones', '手机上自动全屏'), L('戦争を始めた時や画面に触れた時に全画面にする', 'Go full screen when a war starts or the screen is touched', '开始战争或触碰画面时切换为全屏')],
    ];
    const mv = [['on', L('ムービーあり', 'On', '开启')], ['none', L('ムービーなし', 'Off', '关闭')]];
    const movieRow = `<div class="setrow"><div><div class="sl">${L('ムービー', 'Movies', '过场动画')}</div><div class="sh">${L('重要な出来事（敗北の危機・降伏・講和・強制講和・緊急発注・国際調査団・突破作戦）をムービーで見せる', 'Show key events (defeat, surrender, peace, imposed peace, rush orders, inquiry, breakthrough) as movies', '以动画呈现重要事件（败北危机、投降、和谈、强制停战、紧急订单、国际调查团、突破作战）')}</div></div><div class="segs">${mv.map(([k, l]) => `<button class="btn${(SET.movie === 'none' ? 'none' : 'on') === k ? ' sel' : ''}" data-movie="${k}">${l}</button>`).join('')}</div></div>`;
    homePop(`<div class="hpanel small"><h2>${L('設定', 'Settings', '设置')}</h2>
      ${movieRow}${rows.map(([k, l, h]) => `<div class="setrow"><div><div class="sl">${l}</div><div class="sh">${h}</div></div><button class="tog${SET[k] ? ' on' : ''}" data-set="${k}" aria-pressed="${SET[k]}" aria-label="${esc(l)}"></button></div>`).join('')}
      <div class="foot"><button class="btn primary" data-hclose>${L('閉じる', 'Close', '关闭')}</button></div></div>`);
  }
  function homeLang() {
    homePop(`<div class="hpanel small"><h2>Language / 言語 / 语言</h2>
      <div class="langs"><button class="btn${SET.lang === 'ja' ? ' sel' : ''}" data-lang="ja">日本語</button><button class="btn${SET.lang === 'en' ? ' sel' : ''}" data-lang="en">English</button><button class="btn${SET.lang === 'zh' ? ' sel' : ''}" data-lang="zh">简体中文</button></div>
      <div class="foot"><button class="btn primary" data-hclose>${L('閉じる', 'Close', '关闭')}</button></div></div>`);
  }
  $('hNew').onclick = homeScenarios;
  $('hSet').onclick = homeSettings;
  $('hLang').onclick = homeLang;
  function homeTutorials() {
    homePop(`<div class="hpanel small"><h2>${L('チュートリアル', 'Tutorial', '教程')}</h2>
      <div class="tchoice">
        <button class="btn" data-tut="1"><b>${L('チュートリアル1 画面説明', 'Tutorial 1: The Screen', '教程1 画面说明')}</b><span>${L('ゲームの目的と、画面の見方', 'The goal, and how to read the screen', '游戏目的与画面的看法')}</span></button>
        <button class="btn" data-tut="2"><b>${L('チュートリアル2 操作説明', 'Tutorial 2: How to Play', '教程2 操作说明')}</b><span>${L('販売・暗躍・生産を実際に操作する', 'Try selling, covert work and production', '实际操作出售、暗中行动、生产')}</span></button>
      </div>
      <div class="foot"><button class="btn" data-hclose>${L('戻る', 'Back', '返回')}</button></div></div>`);
    $('hpop').querySelector('[data-tut]').focus();
  }
  function startTutorial(n) { if (!window.BSTut) return; if (touch && SET.autoFull) goFull(); window.BSTut.enter(n); } // the home screen stays until the screen is black
  $('hTut').onclick = homeTutorials;
  $('hRec').onclick = homeRecords;
  $('hpop').addEventListener('click', e => {
    if (e.target === $('hpop') || e.target.closest('[data-hclose]')) { $('hpop').hidden = true; return; }
    const sc = e.target.closest('[data-scn]'); if (sc) { SFX('start'); startGame(sc.dataset.scn); return; }
    const tu = e.target.closest('[data-tut]'); if (tu) { startTutorial(+tu.dataset.tut); return; }
    const mvb = e.target.closest('[data-movie]'); if (mvb) { SET.movie = mvb.dataset.movie; saveSet(); homeSettings(); return; }
    const st = e.target.closest('[data-set]'); if (st) { const k = st.dataset.set; SET[k] = !SET[k]; saveSet(); homeSettings(); return; }
    const lg = e.target.closest('[data-lang]'); if (lg) { SET.lang = lg.dataset.lang; saveSet(); S.setLang(SET.lang); applyStatic(); homeLang(); return; }
  });

  // ---------- input ----------
  stage.addEventListener('click', e => {
    if (mode === 'home' || !g) return;
    const mo = e.target.closest('[data-more]'); if (mo) { $('c' + mo.dataset.more).classList.toggle('open'); return; }
    if (mode !== 'game' && mode !== 'tut') return;
    const pm = e.target.closest('[data-pm]'); if (pm) { const k = pm.dataset.pm; closeAct(); $(k === 'home' ? 'bHome' : 'bRetreat').click(); return; }
    const op = e.target.closest('[data-open]'); if (op) { openAct(op.dataset.open, op.dataset.c); return; }
    const fq = e.target.closest('[data-food]'); if (fq) { if (fq.dataset.food === 'add') { if (g.foodQueue < 10) SFX('prodOn'); } if (fq.dataset.food === 'add') g.foodQueue = Math.min(10, g.foodQueue + 1); else g.foodQueue = Math.max(0, g.foodQueue - 1); render(); return; }
    const tog = e.target.closest('[data-tog]'); if (tog) { const k = tog.dataset.tog; g.prodOn[k] = !g.prodOn[k]; SFX(g.prodOn[k] ? 'prodOn' : 'prodOff'); render(); return; }
    if (!act) return;
    const pk = e.target.closest('[data-pick]'); if (pk) { act.item = pk.dataset.pick; renderAct(); return; }
    const q = e.target.closest('[data-qm]'); if (q) { if (+q.dataset.qm !== act.m) act.blocked = false; act.m = +q.dataset.qm; $('mRange').value = act.m; updatePrice(); return; }
    const d = e.target.closest('[data-do]');
    if (d && d.dataset.do === 'close') { closeAct(); return; }
    if (d && d.dataset.do === 'home') { SFX('click'); act = null; hideModal(); showHome(); return; }
    if (d && d.dataset.do === 'retreat') { SFX('click'); act = null; hideModal(); g.paused = false; S.retreat(g); render(); return; }
    if (d && d.dataset.do === 'sell') {
      if (act.blocked) return;
      const before = g.money;
      const r = S.sell(g, act.cid, act.item, act.m); act.msg = r.text; act.ok = r.ok; SFX(r.ok ? 'sell' : 'refused');
      const gain = g.money - before;
      act.log.push({ ok: r.ok, text: SHORT()[act.item] + ' ' + (act.m === 0 ? L('無償', 'free', '无偿') : '×' + act.m.toFixed(2)) + ' → ' + r.text });
      if (!r.ok && r.tier !== 'none') act.blocked = true;
      render(); renderAct(); cashDelta(gain); return; }
    const o = e.target.closest('[data-op]'); if (o) { const before = g.money; const r = S.covert(g, o.dataset.op, act.cid, o.dataset.arg); setTimeout(() => cashDelta(g.money - before), 0); act.msg = r.text; act.ok = r.ok; SFX(r.ok ? 'covert' : 'refused'); const nm = o.dataset.op === 'consult' ? (o.dataset.arg === 'pass' ? L('戦争コンサル【消極】', 'Consulting [Cautious]', '战争顾问【消极】') : L('戦争コンサル【積極】', 'Consulting [Aggressive]', '战争顾问【积极】')) : O[o.dataset.op].name; act.log.push({ ok: r.ok, text: nm + ': ' + r.text }); render(); renderAct(); return; }
  });
  stage.addEventListener('input', e => { if (act && e.target.id === 'mRange') { if (+e.target.value !== act.m) act.blocked = false; act.m = +e.target.value; updatePrice(); } });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && MOVIE.on) { movieSkip(); return; }
    if (MOVIE.on) { if (e.key === 'Enter' || e.code === 'Space') { e.preventDefault(); mvAdvance(); } return; }
    if (e.key === 'Escape' && act) { closeAct(); return; }
    if (e.code === 'Space' && mode === 'game' && !act && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && started && !g.over && !g.modal) { e.preventDefault(); g.paused = !g.paused; render(); }
  });
  $('bPause').onclick = () => { if (mode !== 'game' || !started || g.over || g.modal || act) return; g.paused = !g.paused; render(); };
  $('bHome').onclick = () => { if (mode === 'tut') { showHome(); return; } if (mode !== 'game') return; if (!started || g.over) { showHome(); return; } if (g.modal || act) return; openAct('home', null); };
  $('bRetreat').onclick = () => { if (mode === 'game') openAct('retreat', null); };

  // ---------- loop ----------
  let last = performance.now(), acc = 0, rAcc = 0, shown = null;
  // ---------- music: title -> BGM1 -> (first price review) BGM2 -> (end-of-war notice) BGM3 -> result BGM4 ----------
  const BGMST = { g: null, s3: false, result: false };
  function bgmDirector() {
    const B = window.BSBGM; if (!B) return;
    B.enabled = SET.bgm;
    if (g !== BGMST.g) { BGMST.g = g; BGMST.s3 = false; BGMST.result = false; }
    let want = null, duck = false;
    if (mode === 'home') want = 'title';
    else if (BGMST.result) want = 'bgm4';
    else if (!g || g.over) want = null;
    else if (mode === 'tut') want = 'bgm1';
    else if (MOVIE.on && MOVIE.omen && !BGMST.s3) want = null;
    else { want = BGMST.s3 ? 'bgm3' : (g.plIdx || 0) >= 1 ? 'bgm2' : 'bgm1'; duck = MOVIE.on; }
    B.want(want, duck);
  }
  function loop(now) {
    bgmDirector();
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    if (g && started && !act && mode === 'game') {
      acc += dt;
      while (acc >= 0.1) { S.step(g, 0.1); acc -= 0.1; if (g.paused) { acc = 0; break; } }
      if (g.modal && shown !== g.modal) { shown = g.modal; if (g.modal.kind === 'event' || g.modal.kind === 'order') presentModal(g.modal); else if (g.modal.kind === 'result') endSequence(); }
    }
    rAcc += dt; if (rAcc >= 0.1) { rAcc = 0; if (g && mode !== 'home') render(); }
    if (g && mode !== 'home') { if (!frontArr.length) render(); fxFrame(dt); updateVig(dt); }
    requestAnimationFrame(loop);
  }

  // ---------- API for the tutorial ----------
  // price steps and item switching for the controller and keyboard (pad.js)
  function padSetM(v) {
    if (!act || act.kind !== 'sell') return;
    v = Math.min(2, Math.max(0, Math.round(v * 20) / 20));
    if (v !== act.m) { act.blocked = false; SFX('hover'); }
    act.m = v; const rg = $('mRange'); if (rg) rg.value = v; updatePrice();
  }
  function padItem(d) {
    if (!act || act.kind !== 'sell') return;
    const ks = Object.keys(I), i = ks.indexOf(act.item);
    act.item = ks[(i + d + ks.length) % ks.length]; SFX('hover'); renderAct();
  }
  function padMenu() {
    if (mode !== 'game' || !started || !g || g.over || g.modal || act) return false;
    openAct('menu', null); return true;
  }
  window.BSUI = {
    pad: { get mode() { return mode; }, get act() { return act; }, setM: padSetM, item: padItem, menu: padMenu, closeAct,
      movieOn: () => MOVIE.on, movieNext: mvAdvance, movieSkip },
    get g() { return g; }, stage, L, short, setScales,
    tutorialGame(kind) {
      mode = 'tut'; clearFades(); closeHome(); act = null; hideModal(); setupGame('s1');
      // advance a few weeks so the map has troops and the gauges have moved
      g.prodOn.equip = true; g.paused = false; let n = 0; while (g.t < 15 && n++ < 400) { if (g.modal) { g.modal = null; g.paused = false; } S.step(g, 0.1); }
      g.modal = null; g.alertQ = []; g.paused = false; started = true; // time stays frozen: the loop only steps in game mode
      const A = g.c.A, B = g.c.B;
      // sample notices for the top centre and the news feed
      A.policy = 'aggr'; A.policyUntil = g.t + 24; B.priceMod = 0.8; B.priceModUntil = g.t + 27;
      const nw = [[L('B国の補給線が延び、前線への物資の到着が遅れている。', "B's supply lines are stretched; deliveries to the front are slow.", 'B国的补给线拉长，物资运抵前线出现延误。'), 'info'],
        [L('A国の司令部が方針を「積極」に切り替えた。', 'A HQ switched to an "Aggressive" strategy.', 'A国的司令部将方针切换为“积极”。'), 'op'],
        [L('B国の兵糧が減り始めている。', "B's food is starting to run low.", 'B国的军粮开始减少。'), 'bad']];
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
    get act() { return act; }, sfx: SFX,
    openCard(id, open) { $('c' + id).classList.toggle('open', open); },
    home: showHome, render, get scale() { return scale; }, get lang() { return SET.lang; },
  };

  S.setLang(SET.lang); applyStatic(); fit(); setupGame('s1'); showHome();
  requestAnimationFrame(loop);
})();
