// Both Sides — tutorials. 1: the screen. 2: hands-on (sell, covert work, production).
// The screen is darkened except the target. Tap anywhere to continue; in hands-on steps only the lit control works.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const ui = () => window.BSUI;
  const L = (ja, en) => ui().L(ja, en);
  const g = () => ui().g;
  const act = () => ui().act;
  const sellOpen = id => { const a = act(); return !!a && a.kind === 'sell' && a.cid === id; };
  const opsOpen = id => { const a = act(); return !!a && a.kind === 'ops' && a.cid === id; };
  const soldOnce = () => { const a = act(); return !!a && a.kind === 'sell' && a.log.some(l => l.ok); };

  // t: CSS selector(s), or 'A:mor' style gauge row. grp: steps in the same group glide instead of popping.
  // wait: hands-on step, done when it returns true. need: the step only makes sense while this holds (used when going back).
  const T1 = [
    { t: null, ja: ['あなたは武器商人', '戦争をしている2つの国の両方に、武器・傭兵・兵糧を売って稼ぐゲームです。スコアは最後に残った利益です。'], en: ['You are an arms dealer', 'Sell arms, mercenaries and rations to both nations at war. Your score is the profit you end with.'] },
    { t: null, ja: ['戦争の終わり方', '戦争は「首都陥落」「降伏」「講和」「強制講和(約3年で国際機関が介入)」のどれかで終わります。戦争が終われば商売も終わり。長く続くほど稼ぐ機会は増えます。'], en: ['How wars end', 'A war ends by a fallen capital, a surrender, a peace deal, or an imposed peace (about 3 years in). When it ends, so does your trade. The longer it lasts, the more you can earn.'] },
    { t: null, ja: ['危機の合図', '終わりが近づくと画面の縁が点滅します。赤は首都陥落や降伏、緑は講和の兆しです。残り3週間を切ると点滅が速くなります。'], en: ['Warning signs', 'When the end is near, the screen edges flash. Red means a capital or surrender is at risk, green means peace is coming. The flashing speeds up in the last 3 weeks.'] },
    { t: '.topbar', ja: ['画面上部', '日付と戦争の進み具合、所持金、利益が並びます。3秒で1週間が進みます。'], en: ['Top bar', 'Date, war progress, cash and profit. Every 3 seconds is one week.'] },
    { t: '#hMoney,#hProfit', pad: 6, ja: ['所持金と利益', '販売で増え、生産や暗躍で減ります。利益がそのままスコアになります。'], en: ['Cash and profit', 'Sales add to it; production and covert work cost money. Profit is your score.'] },
    { t: '#hStep', pad: 4, ja: ['定価', '品物の定価です。時期によって見直されます。売値は定価に倍率を掛けて決まります。'], en: ['List price', 'The list price of goods, reviewed over time. Your selling price is a multiple of it.'] },
    { t: '.terrain,#pill', pad: 0, ja: ['戦線', '左がA国、右がB国の領土です。押す力の強い側へ戦線が動き、首都まで押し込まれた国が負けます。光点は前線の部隊(輪が歩兵、菱形が機甲)、首都から伸びる点線は輸送中の品です。'], en: ['The front', 'A holds the left, B the right. The front moves toward the weaker side; a nation pushed back to its capital loses. Points of light are troops (rings: infantry, diamonds: armour); dotted lines from the capitals are goods in transit.'] },
    { t: '#cA', ja: ['国の状態', '各国のカードに、その国の状態が並びます。上の札は今の様子です(値引き要求・武器は不要など)。'], en: ['Nation status', 'Each card shows a nation\'s state. The tags at the top tell you its current mood (wants discount, no arms needed, and so on).'] },
    { t: 'A:mor', grp: 'rows', ja: ['戦意', '戦争を続ける気力です。戦意が低いと武器を買わず、両国とも下がれば講和に向かいます。安売りや無償供与、暗躍で上がります。'], en: ['Morale', 'The will to fight. Low morale means no buying, and if both drop, peace talks begin. Cheap sales, gifts and covert work raise it.'] },
    { t: 'A:frt', grp: 'rows', ja: ['前線', '戦っている兵の数です。多いほど戦線を押す力が強くなり、戦闘や離脱で減ります。'], en: ['Front', 'Soldiers in combat. More soldiers push harder; battle and desertion wear them down.'] },
    { t: 'A:eqs', grp: 'rows', ja: ['装備', '兵1人あたりの装備の量です。少ないほど装備一式を高く買い、多すぎると「武器は不要」になります。'], en: ['Arms', 'Arms per soldier. The lower it is, the more they pay for arms kits; too high and they stop buying.'] },
    { t: 'A:crw', grp: 'rows', ja: ['充足', '装備を扱える兵が足りているかです。低いと傭兵を高く買い、95%を切ると装備の価値が落ちます。'], en: ['Crew', 'Whether there are enough soldiers to use the arms. Low crew pays more for mercenaries; below 95% arms are worth less.'] },
    { t: 'A:food', grp: 'rows', ja: ['兵糧', '軍の食料です。100%を切ると戦意と出動が落ち、90%未満なら兵糧を高く買います。自給できない国は放っておくと減っていきます。'], en: ['Food', 'The army\'s food. Below 100% morale and deployment fall; below 90% they pay more for rations. Nations that cannot feed themselves run down over time.'] },
    { t: 'A:fund', grp: 'rows', ja: ['資金', '国の財布です。税収で増え、購入や兵の維持で減ります。尽きると買えなくなり、兵が離れていきます。'], en: ['Funds', 'The nation\'s purse. Taxes fill it; purchases and upkeep drain it. When it runs dry, buying stops and soldiers desert.'] },
    { t: 'A:sus', grp: 'rows', ja: ['疑惑度', 'あなたが両方に売っていると疑う度合いです。高値の販売や暗躍で上がり、50で値引き要求、80で取引停止。安売りや無償供与で下がります。'], en: ['Suspicion', 'How sure they are you deal with both sides. High prices and covert work raise it; at 50 they want discounts, at 80 they stop trading. Cheap sales and gifts lower it.'] },
    { t: '#cA .more', pad: 4, open: true, ja: ['詳細', '「詳細」を押すと、反戦感情・予備兵・出動の勢いなどの細かい数値も見られます。'], en: ['More', 'Tap "More" to see finer details such as anti-war feeling, reserves and deployment.'] },
    { t: '#effs', pad: 6, ja: ['予定と効果', '期限付きの効果や、予告された出来事がここに出ます。降伏や講和が近づいた時の通知もここに残ります。'], en: ['Effects and schedule', 'Timed effects and announced events appear here, along with warnings when surrender or peace is near.'] },
    { t: '#wireBox', ja: ['戦況ニュース', '戦争で起きたことが流れます。売り時を探す手がかりになります。'], en: ['War news', 'What is happening in the war. A good place to spot selling chances.'] },
    { t: '#stockBox', ja: ['倉庫', '作った品の在庫が並びます。生産の止め方や兵糧の作り方は、チュートリアル2を参照してください。'], en: ['Warehouse', 'Your stock of goods. To learn how to pause production or make rations, see Tutorial 2.'] },
    { t: '#cA .acts', pad: 4, ja: ['販売と暗躍', '各国への販売と暗躍活動ができるボタンです。これを開いている間は時間が止まります。詳しい操作はチュートリアル2を参照してください。'], en: ['Sell and Covert', 'Buttons to sell to each nation and to act in secret. Time stops while they are open. See Tutorial 2 for how to use them.'] },
    { t: '#bPause', pad: 4, ja: ['一時停止', 'いつでも時間を止められます。スペースキーでも止まります。'], en: ['Pause', 'Stop time at any moment. The space bar works too.'] },
    { t: '#bRetreat', pad: 4, ja: ['撤退', 'その時点の所持金で精算して手を引きます。在庫と融資は失われます。'], en: ['Withdraw', 'Settle with the cash you hold and walk away. Stock and loans are lost.'] },
    { t: null, end: 1, ja: ['画面説明は以上です', '続けてチュートリアル2で、販売や暗躍を実際に操作してみましょう。'], en: ['That is the screen', 'Next, try selling and covert work yourself in Tutorial 2.'] },
  ];
  const T2 = [
    { t: null, ja: ['操作説明', '実際に操作してみましょう。チュートリアル中は時間が止まっています。'], en: ['How to play', 'Let\'s try it for real. Time is stopped during the tutorial.'] },
    { t: '#AbSell', pad: 4, wait: () => sellOpen('A'), ja: ['販売を開く', 'A国の「販売」を押してください。'], en: ['Open Sell', 'Tap "Sell" on Nation A.'] },
    { t: '.picks', need: () => sellOpen('A'), ja: ['品目を選ぶ', '売る品目を選ぶ欄です。在庫の数、定価、前回の取引や相場が出ます。今回は選ばれている装備一式を売ります。'], en: ['Pick an item', 'Choose what to sell here. It shows stock, list price, the last deal and the market. This time, sell the selected Arms Kit.'] },
    { t: '#mc .priceline,#mRange,#mc .quick', need: () => sellOpen('A'), wait: () => { const a = act(); return !!a && a.kind === 'sell' && Math.abs(a.m - 1.2) < 0.001; }, ja: ['価格を決める', '価格を定価の1.2倍にしてください。スライダーを動かすか、「×1.2」を押します。'], en: ['Set the price', 'Set the price to x1.2 of list. Drag the slider or tap "x1.2".'] },
    { t: '#mc [data-do="sell"]', pad: 4, need: () => sellOpen('A'), wait: soldOnce, ja: ['売り込む', '「売り込む」を押してください。'], en: ['Make the offer', 'Tap "Offer".'] },
    { t: '#mc .resp', need: () => sellOpen('A') && soldOnce(), ja: ['相場どおりに売れた', '相場どおりの価格だったので、A国は普通に買いました。相場より高すぎると断られ、安く売ると疑惑度が下がり戦意が上がります。'], en: ['Sold at market', 'The price matched the market, so A bought it. Price too high and they refuse; sell cheap and suspicion falls while morale rises.'] },
    { t: '#mc .mstat', need: () => sellOpen('A'), ja: ['相手国の状態', '下には売り込む国の状態が出ます。カードと同じ並びなので、売りながら確かめられます。'], en: ['Buyer status', 'The buyer\'s status is shown below, in the same order as its card, so you can check it while you sell.'] },
    { t: '#mc [data-do="close"]', pad: 4, wait: () => !act(), ja: ['販売を閉じる', '「閉じて再開」を押してください。通常はここで時間が再び動き出します。'], en: ['Close', 'Tap "Close and resume". Normally time starts again here.'] },
    { t: '#BbOps', pad: 4, wait: () => opsOpen('B'), ja: ['暗躍を開く', '次は暗躍です。B国の「暗躍」を押してください。'], en: ['Open Covert', 'Now covert work. Tap "Covert" on Nation B.'] },
    { t: '#mc .oplist', need: () => opsOpen('B'), ja: ['暗躍の一覧', '要人暗殺・悪評の流布・戦争コンサル・融資で、裏から戦争を動かします。どれも疑惑度が上がります。'], en: ['Covert actions', 'Assassination, smear campaigns, war consulting and loans steer the war from the shadows. All of them raise suspicion.'] },
    { t: '#mc .oprow:first-child', need: () => opsOpen('B'), wait: () => g().opsCount.assassin > 0, ja: ['要人暗殺', '「要人暗殺」の「実行」を押してください。'], en: ['Assassination', 'Tap "Do it" for Assassination.'] },
    { t: '#mc .resp', need: () => opsOpen('B') && g().opsCount.assassin > 0, ja: ['暗躍の結果', 'B国の戦意が上がり、疑惑度はB国とA国の両方で上がりました。暗躍は戦況を変えられる一方、疑われる代償があります。'], en: ['The result', 'B\'s morale rose, and suspicion rose in both B and A. Covert work can turn the war, at the price of suspicion.'] },
    { t: '#mc [data-do="close"]', pad: 4, wait: () => !act(), ja: ['暗躍を閉じる', '「閉じて再開」を押してください。'], en: ['Close', 'Tap "Close and resume".'] },
    { t: '#sl_merc', pad: 4, wait: () => !g().prodOn.merc, ja: ['生産を止める', '倉庫では、装備一式と傭兵が自動で作られます。傭兵の枠を押して、生産を止めてください。'], en: ['Pause production', 'Arms kits and mercenaries are made automatically. Tap the Mercs slot to pause it.'] },
    { t: '#stockBox', ja: ['生産の停止', '傭兵の生産が止まりました。生産にはお金がかかり、売れ残りは損になります。売れそうにない品は止めておきましょう。もう一度押すと再開します。'], en: ['Production paused', 'Mercenary production has stopped. Production costs money and unsold stock is a loss, so pause what will not sell. Tap again to resume.'] },
    { t: '#sl_food', pad: 4, wait: () => g().foodQueue > 0 || g().inv.food > 0, ja: ['兵糧を作る', '兵糧は自動では作られません。兵糧の枠を押して、1単位作ってください。'], en: ['Make rations', 'Rations are not made automatically. Tap the Rations slot to make one unit.'] },
    { t: '#stockBox', ja: ['兵糧の注意', '兵糧は押した回数だけ作られます。作ってから3か月売れないと傷んで廃棄されるので、兵糧が減ってきた国がある時だけ作りましょう。間違えたら「取消」で戻せます。'], en: ['About rations', 'One ration is made per tap. Unsold rations spoil after 3 months, so make them only when a nation is running low. Tap "Undo" if you made a mistake.'] },
    { t: null, end: 2, ja: ['操作説明は以上です', 'ホームの「新しい戦争」から、戦争を選んで始めましょう。'], en: ['You are ready', 'Choose a war from "New War" on the home screen.'] },
  ];

  let STEPS = T1, cur = 1, i = 0, on = false, busy = false, shownAt = 0, poll = null, lastRect = null, waitHit = false;
  const RM = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function els(step) {
    const st = ui().stage;
    if (/^[AB]:/.test(step.t)) { const [id, key] = step.t.split(':'), lb = $(id + key + 'L'); return [lb, lb && lb.previousElementSibling, $(id + key + 'B'), $(id + key + 'V')]; }
    return step.t.split(',').map(s => st.querySelector(s));
  }
  function rectOf(step) {
    if (!step.t) return null;
    const st = ui().stage, sr = st.getBoundingClientRect(), k = ui().scale;
    const list = els(step).filter(e => e && e.getClientRects().length);
    if (!list.length) return null;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const e of list) { const r = e.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
    const p = step.pad == null ? 4 : step.pad;
    return { x: (x0 - sr.left) / k - p, y: (y0 - sr.top) / k - p, w: (x1 - x0) / k + p * 2, h: (y1 - y0) / k + p * 2 };
  }
  // bring targets inside the sell/covert window into view
  function reveal(step) {
    if (!step.t || !step.t.startsWith('#mc')) return;
    const e = els(step)[0]; if (!e) return;
    const mc = $('mc'), er = e.getBoundingClientRect(), mr = mc.getBoundingClientRect();
    if (er.top < mr.top || er.bottom > mr.bottom) mc.scrollTop += er.top - mr.top - 12;
  }

  function build() {
    $('tut').innerHTML = `<div class="spot none"></div><div class="ring" hidden></div><div class="blk b0"></div><div class="blk b1"></div><div class="blk b2"></div><div class="blk b3"></div>
      <button class="btn thome" data-th>${L('ホームに戻る', 'Home')}</button>
      <button class="btn tback" data-tp aria-label="${L('戻る', 'Back')}">←</button>
      <div class="tbox" role="dialog" aria-live="polite"><span class="tlab">${cur === 1 ? L('チュートリアル1 画面説明', 'TUTORIAL 1 · THE SCREEN') : L('チュートリアル2 操作説明', 'TUTORIAL 2 · HOW TO PLAY')}</span>
      <h3></h3><p></p><div class="tend"></div><div class="tfoot"><span class="thint"></span><span class="pg"></span></div></div>`;
  }
  // dark mask with a hole: the four blockers leave only the target clickable in hands-on steps
  function mask(r, open) {
    const W = ui().stage.offsetWidth, H = ui().stage.offsetHeight, b = [...$('tut').querySelectorAll('.blk')], spot = $('tut').querySelector('.spot'), ring = $('tut').querySelector('.ring');
    const box = { left: r ? r.x + 'px' : 0, top: r ? r.y + 'px' : 0, width: r ? r.w + 'px' : 0, height: r ? r.h + 'px' : 0 };
    if (r) { spot.classList.remove('none'); Object.assign(spot.style, box); }
    else spot.classList.add('none');
    // hands-on: the lit frame pulses (grows slowly, snaps back)
    spot.classList.toggle('act', !!(r && open)); ring.hidden = !(r && open); if (r && open) Object.assign(ring.style, box);
    const set = (el, x, y, w, h) => Object.assign(el.style, { left: x + 'px', top: y + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, h) + 'px' });
    if (r && open) {
      set(b[0], 0, 0, W, r.y); set(b[1], 0, r.y + r.h, W, H - r.y - r.h);
      set(b[2], 0, r.y, r.x, r.h); set(b[3], r.x + r.w, r.y, W - r.x - r.w, r.h);
    } else { set(b[0], 0, 0, W, H); for (let n = 1; n < 4; n++) set(b[n], 0, 0, 0, 0); }
  }
  function place(r) {
    const tb = $('tut').querySelector('.tbox'), W = ui().stage.offsetWidth, H = ui().stage.offsetHeight;
    const bw = tb.offsetWidth, bh = tb.offsetHeight, m = 14;
    let x, y;
    if (!r) { x = (W - bw) / 2; y = (H - bh) / 2; }
    else {
      const cands = [{ x: r.x + r.w + m, y: r.y }, { x: r.x - bw - m, y: r.y }, { x: r.x, y: r.y + r.h + m }, { x: r.x, y: r.y - bh - m }];
      const fits = c => c.x >= 6 && c.y >= 6 && c.x + bw <= W - 6 && c.y + bh <= H - 6;
      const c = cands.map(c => ({ x: Math.max(6, Math.min(W - bw - 6, c.x)), y: Math.max(6, Math.min(H - bh - 6, c.y)) }))
        .find(c => fits(c) && !(c.x < r.x + r.w && c.x + bw > r.x && c.y < r.y + r.h && c.y + bh > r.y));
      if (c) { x = c.x; y = c.y; } else { x = (W - bw) / 2; y = H - bh - 10; }
    }
    tb.style.left = x + 'px'; tb.style.top = y + 'px';
  }
  function fill() {
    const s = STEPS[i], tx = ui().lang === 'en' ? s.en : s.ja, box = $('tut'), tb = box.querySelector('.tbox');
    ui().openCard('A', !!s.open);
    tb.querySelector('h3').textContent = tx[0]; tb.querySelector('p').textContent = tx[1];
    tb.querySelector('.pg').textContent = (i + 1) + ' / ' + STEPS.length;
    const hint = tb.querySelector('.thint');
    hint.textContent = s.end ? '' : s.wait ? L('光っている所を操作してください', 'Use the highlighted control') : L('画面をタップ(PCならクリック)で次へ', 'Tap the screen (click on PC) to continue');
    hint.className = 'thint' + (s.wait ? ' act' : '');
    tb.querySelector('.tend').innerHTML = s.end === 1
      ? `<button class="btn" data-th>${L('ホームに戻る', 'Home')}</button><button class="btn primary" data-t2>${L('チュートリアル2 操作説明に進む', 'Go to Tutorial 2: How to Play')}</button>`
      : s.end === 2 ? `<button class="btn primary" data-th>${L('ホームに戻る', 'Home')}</button>` : '';
    box.querySelector('.tback').hidden = !prevIndex();
    reveal(s);
    const r = rectOf(s); lastRect = r; waitHit = false;
    mask(r, !!s.wait); place(r);
  }
  function go(ni) {
    if (ni < 0 || ni >= STEPS.length || busy) return;
    const prev = STEPS[i], next = STEPS[ni], box = $('tut'), tb = box.querySelector('.tbox');
    const glide = prev !== next && prev.grp && prev.grp === next.grp;
    const x0 = tb.offsetLeft, y0 = tb.offsetTop;
    const ghost = tb.cloneNode(true); ghost.classList.add('ghost'); ghost.classList.remove('glide', 'out');
    tb.classList.toggle('glide', !!glide);
    i = ni; fill();
    const same = (!prev.t && !next.t) || (Math.abs(tb.offsetLeft - x0) < 24 && Math.abs(tb.offsetTop - y0) < 24);
    if (glide || same || RM()) { shownAt = performance.now(); return; }
    // the old window shrinks away (0.2 s), then the new one grows from nothing at its place (0.2 s)
    busy = true; box.appendChild(ghost);
    tb.style.transition = 'none'; tb.classList.add('out'); void tb.offsetWidth; tb.style.transition = '';
    requestAnimationFrame(() => ghost.classList.add('out'));
    setTimeout(() => {
      ghost.remove(); tb.classList.remove('out');
      setTimeout(() => { busy = false; shownAt = performance.now(); }, 200);
    }, 200);
  }
  const skip = s => (s.wait && s.wait()) || (s.need && !s.need());
  function prevIndex() { let j = i - 1; while (j >= 0 && skip(STEPS[j])) j--; return j >= 0 ? j + 1 : 0; } // 0 = none
  function next() { if (busy || STEPS[i].wait || STEPS[i].end) return; if (performance.now() - shownAt < 300) return; go(i + 1); }
  function back() { if (busy) return; const p = prevIndex(); if (p) go(p - 1); }
  function tick() {
    if (!on || busy) return;
    const s = STEPS[i];
    // follow the target if it moves or appears (the sell/covert window redraws itself)
    const r = rectOf(s);
    const moved = !!r !== !!lastRect || (r && lastRect && (Math.abs(r.x - lastRect.x) > 1 || Math.abs(r.y - lastRect.y) > 1 || Math.abs(r.w - lastRect.w) > 1 || Math.abs(r.h - lastRect.h) > 1));
    if (moved) { lastRect = r; mask(r, !!s.wait); place(r); }
    if (s.wait && !waitHit && s.wait()) { waitHit = true; setTimeout(() => { if (on && STEPS[i] === s) go(i + 1); }, 350); }
  }

  function start(n) {
    cur = n === 2 ? 2 : 1; STEPS = cur === 2 ? T2 : T1; i = 0; on = true; busy = false;
    ui().tutorialGame(cur);
    const box = $('tut'); box.hidden = false; build(); fill();
    const tb = box.querySelector('.tbox'); tb.classList.add('out'); void tb.offsetWidth; tb.classList.remove('out');
    shownAt = performance.now() + 200;
    clearInterval(poll); poll = setInterval(tick, 120);
  }
  function stop() { if (!on) return; on = false; clearInterval(poll); $('tut').hidden = true; $('tut').innerHTML = ''; ui().openCard('A', false); }
  function home() { stop(); ui().home(); }
  // switching tutorials: black out, swap, fade back in
  // entering a tutorial (from home or from tutorial 1): black out with its title, swap, fade back in
  function enter(n) {
    if (on && busy) return;
    const f = $('fade'), rm = RM();
    $('fadeT').textContent = n === 2 ? L('チュートリアル2', 'Tutorial 2') : L('チュートリアル1', 'Tutorial 1');
    $('fadeS').textContent = n === 2 ? L('操作説明', 'How to Play') : L('画面説明', 'The Screen');
    busy = true; f.className = 'on tutc';
    setTimeout(() => { stop(); start(n); busy = true; }, rm ? 150 : 600);
    setTimeout(() => { f.className = 'tutc'; }, rm ? 400 : 1500);
    setTimeout(() => { f.className = ''; busy = false; shownAt = performance.now(); }, rm ? 600 : 2100);
  }
  const toT2 = () => enter(2);
  $('tut').addEventListener('click', e => {
    if (e.target.closest('[data-th]')) { home(); return; }
    if (e.target.closest('[data-t2]')) { toT2(); return; }
    if (e.target.closest('[data-tp]')) { back(); return; }
    if (e.target.closest('.blk') || e.target.closest('.tbox')) next();
  });
  document.addEventListener('keydown', e => {
    if (!on) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') back();
    else if (e.key === 'Escape') home();
  });
  window.BSTut = { start, enter, stop, relayout() { if (on && !busy) fill(); } };
})();
