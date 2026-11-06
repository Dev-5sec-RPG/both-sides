// Both Sides — provisional tutorial. Darkens the screen, lights up one target, explains it.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  // target: CSS selector(s) on the game screen, or a row key like 'A:mor' (icon + label + bar + value of that gauge)
  const STEPS = [
    { t: null, ja: ['あなたは武器商人', '戦争をしている2つの国の両方に、武器・傭兵・兵糧を売って稼ぐゲームです。スコアは最後に残った利益です。'], en: ['You are an arms dealer', 'Sell arms, mercenaries and rations to both nations at war. Your score is the profit you end with.'] },
    { t: null, ja: ['戦争の終わり方', '戦争は「首都陥落」「降伏」「講和」「強制講和(約3年で国際機関が介入)」のどれかで終わります。戦争が終われば商売も終わり。長く続くほど稼ぐ機会は増えます。'], en: ['How wars end', 'A war ends by a fallen capital, a surrender, a peace deal, or an imposed peace (about 3 years in). When it ends, so does your trade. The longer it lasts, the more you can earn.'] },
    { t: null, ja: ['危機の合図', '終わりが近づくと画面の縁が点滅します。赤は首都陥落や降伏、緑は講和の兆しです。残り3週間を切ると点滅が速くなります。'], en: ['Warning signs', 'When the end is near, the screen edges flash. Red means a capital or surrender is at risk, green means peace is coming. The flashing speeds up in the last 3 weeks.'] },
    { t: '.topbar', ja: ['画面上部', '日付と戦争の進み具合、所持金、利益が並びます。3秒で1週間が進みます。'], en: ['Top bar', 'Date, war progress, cash and profit. Every 3 seconds is one week.'] },
    { t: '#hMoney,#hProfit', pad: 6, ja: ['所持金と利益', '販売で増え、生産や暗躍で減ります。利益がそのままスコアになります。'], en: ['Cash and profit', 'Sales add to it; production and covert work cost money. Profit is your score.'] },
    { t: '#hStep', pad: 4, ja: ['定価', '品物の定価は時期によって見直されます。売値は定価に倍率を掛けて決めます。'], en: ['List price', 'List prices are reviewed over time. You set your price as a multiple of the list price.'] },
    { t: '.terrain,#pill', pad: 0, ja: ['戦線', '左がA国、右がB国の領土です。押す力の強い側へ戦線が動き、首都まで押し込まれた国が負けます。'], en: ['The front', 'A holds the left, B the right. The front moves toward the weaker side; a nation pushed back to its capital loses.'] },
    { t: '#cA', ja: ['国の状態', '各国のカードに、その国の状態が並びます。上の札は今の様子です(値引き要求・武器は不要など)。'], en: ['Nation status', 'Each card shows a nation\'s state. The tags at the top tell you its current mood (wants discount, no arms needed, and so on).'] },
    { t: 'A:mor', ja: ['戦意', '戦争を続ける気力です。戦意が低いと武器を買わず、両国とも下がれば講和に向かいます。安売りや無償供与、暗躍で上げられます。'], en: ['Morale', 'The will to fight. Low morale means no buying, and if both drop, peace talks begin. Cheap sales, gifts and covert work raise it.'] },
    { t: 'A:frt', ja: ['前線', '戦っている兵の数です。多いほど戦線を押す力が強くなり、戦闘や離脱で減ります。'], en: ['Front', 'Soldiers in combat. More soldiers push harder; battle and desertion wear them down.'] },
    { t: 'A:eqs', ja: ['装備', '兵1人あたりの装備の量です。少ないほど装備一式を高く買い、多すぎると「武器は不要」になります。'], en: ['Arms', 'Arms per soldier. The lower it is, the more they pay for arms kits; too high and they stop buying.'] },
    { t: 'A:crw', ja: ['充足', '装備を扱える兵が足りているかです。低いと傭兵を高く買い、95%を切ると装備の価値が落ちます。'], en: ['Crew', 'Whether there are enough soldiers to use the arms. Low crew pays more for mercenaries; below 95% arms are worth less.'] },
    { t: 'A:food', ja: ['兵糧', '軍の食料です。100%を切ると戦意と出動が落ち、90%未満なら兵糧を高く買います。自給できない国は放っておくと減っていきます。'], en: ['Food', 'The army\'s food. Below 100% morale and deployment fall; below 90% they pay more for rations. Nations that cannot feed themselves run down over time.'] },
    { t: 'A:fund', ja: ['資金', '国の財布です。税収で増え、購入や兵の維持で減ります。尽きると買えなくなり、兵が離れていきます。'], en: ['Funds', 'The nation\'s purse. Taxes fill it; purchases and upkeep drain it. When it runs dry, buying stops and soldiers desert.'] },
    { t: 'A:sus', ja: ['疑惑度', 'あなたが両方に売っていると疑う度合いです。高値の販売や暗躍で上がり、50で値引き要求、80で取引停止。安売りや無償供与で下がります。'], en: ['Suspicion', 'How sure they are you deal with both sides. High prices and covert work raise it; at 50 they want discounts, at 80 they stop trading. Cheap sales and gifts lower it.'] },
    { t: '#cA .more', pad: 4, open: true, ja: ['詳細', '「詳細」を押すと、反戦感情・予備兵・出動の勢いなどの細かい数値も見られます。'], en: ['More', 'Tap "More" to see finer details such as anti-war feeling, reserves and deployment.'] },
    { t: '#effs', pad: 6, ja: ['予定と効果', '期限付きの効果や、予告された出来事がここに出ます。危機の通知もここに残ります。'], en: ['Effects and schedule', 'Timed effects and announced events appear here, along with crisis warnings.'] },
    { t: '#stockBox', ja: ['倉庫', '装備と傭兵は自動で生産され、押すと止まります。兵糧は押した回数だけ作り、3か月売れないと傷みます。生産にはお金がかかり、売れ残りは損になります。'], en: ['Warehouse', 'Arms and mercenaries are made automatically; tap to pause. Rations are made one per tap and spoil after 3 months. Production costs money, and unsold stock is a loss.'] },
    { t: '#wireBox', ja: ['戦況ニュース', '戦争で起きたことが流れます。売り時を探す手がかりになります。'], en: ['War news', 'What is happening in the war. A good place to spot selling chances.'] },
    { t: '#AbSell', pad: 4, ja: ['販売', '品物と価格を選んで売り込みます。相場より高すぎると断られ、安く売ると疑惑度が下がり戦意が上がります。販売中は時間が止まります。'], en: ['Sell', 'Pick an item and a price and make an offer. Too far above market and they refuse; selling cheap lowers suspicion and raises morale. Time stops while you sell.'] },
    { t: '#AbOps', pad: 4, ja: ['暗躍', '要人暗殺・悪評の流布・戦争コンサル・融資で、裏から戦争を動かします。疑惑度は上がります。'], en: ['Covert', 'Assassinations, smear campaigns, war consulting and loans steer the war from the shadows. They raise suspicion.'] },
    { t: '#bPause', pad: 4, ja: ['一時停止', 'いつでも時間を止められます。スペースキーでも止まります。'], en: ['Pause', 'Stop time at any moment. The space bar works too.'] },
    { t: '#bRetreat', pad: 4, ja: ['撤退', 'その時点の所持金で精算して手を引きます。在庫と融資は失われます。'], en: ['Withdraw', 'Settle with the cash you hold and walk away. Stock and loans are lost.'] },
    { t: null, ja: ['準備完了', 'コツは、戦争を長引かせつつ、それぞれの国が足りないものを見極めて売ることです。ホームの「新しい戦争」から始めましょう。'], en: ['Ready', 'The trick is to keep the war going while selling each nation what it lacks. Start from "New War" on the home screen.'] },
  ];
  let i = 0, on = false;
  const ui = () => window.BSUI;
  const L = (ja, en) => ui().L(ja, en);

  function rectOf(step) {
    const st = ui().stage, sr = st.getBoundingClientRect(), k = ui().scale;
    let els;
    if (/^[AB]:/.test(step.t)) {
      const [id, key] = step.t.split(':');
      const lb = $(id + key + 'L'); els = [lb, lb && lb.previousElementSibling, $(id + key + 'B'), $(id + key + 'V')];
    } else els = step.t.split(',').map(s => st.querySelector(s));
    els = els.filter(e => e && e.getClientRects().length);
    if (!els.length) return null;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const e of els) { const r = e.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
    const p = step.pad == null ? 4 : step.pad;
    return { x: (x0 - sr.left) / k - p, y: (y0 - sr.top) / k - p, w: (x1 - x0) / k + p * 2, h: (y1 - y0) / k + p * 2 };
  }
  function draw() {
    const box = $('tut'), s = STEPS[i], en = ui().lang === 'en', tx = en ? s.en : s.ja;
    ui().openCard('A', !!s.open);
    const r = s.t ? rectOf(s) : null;
    box.innerHTML = `<div class="spot${r ? '' : ' none'}"></div>
      <button class="btn thome" data-th>${L('ホームに戻る', 'Home')}</button>
      <div class="tbox" role="dialog" aria-live="polite"><h3>${tx[0]}</h3><p>${tx[1]}</p>
      <div class="tnav"><span class="pg">${i + 1} / ${STEPS.length}</span>
      <button class="btn" data-tp ${i === 0 ? 'disabled' : ''}>${L('戻る', 'Back')}</button>
      <button class="btn primary" data-tn>${i === STEPS.length - 1 ? L('終わる', 'Finish') : L('次へ', 'Next')}</button></div></div>`;
    const spot = box.querySelector('.spot'), tb = box.querySelector('.tbox'), W = ui().stage.offsetWidth, H = ui().stage.offsetHeight;
    if (r) Object.assign(spot.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    // place the message box beside the target, never on top of it
    const bw = tb.offsetWidth, bh = tb.offsetHeight, m = 12;
    let x, y;
    if (!r) { x = (W - bw) / 2; y = (H - bh) / 2; }
    else {
      const cands = [
        { x: r.x + r.w + m, y: r.y }, { x: r.x - bw - m, y: r.y },
        { x: r.x, y: r.y + r.h + m }, { x: r.x, y: r.y - bh - m },
      ];
      const fits = c => c.x >= 6 && c.y >= 6 && c.x + bw <= W - 6 && c.y + bh <= H - 6;
      const c = cands.map(c => ({ x: Math.max(6, Math.min(W - bw - 6, c.x)), y: Math.max(6, Math.min(H - bh - 6, c.y)) }))
        .find(c => fits(c) && !(c.x < r.x + r.w && c.x + bw > r.x && c.y < r.y + r.h && c.y + bh > r.y));
      if (c) { x = c.x; y = c.y; } else { x = (W - bw) / 2; y = H - bh - 10; }
    }
    tb.style.left = x + 'px'; tb.style.top = y + 'px';
    const nb = box.querySelector('[data-tn]'); if (nb) nb.focus();
  }
  function start() { i = 0; on = true; ui().tutorialGame(); $('tut').hidden = false; draw(); }
  function stop() { if (!on) return; on = false; $('tut').hidden = true; $('tut').innerHTML = ''; }
  $('tut').addEventListener('click', e => {
    if (e.target.closest('[data-th]')) { stop(); ui().openCard('A', false); ui().home(); return; }
    if (e.target.closest('[data-tp]')) { if (i > 0) { i--; draw(); } return; }
    if (e.target.closest('[data-tn]')) { if (i < STEPS.length - 1) { i++; draw(); } else { stop(); ui().openCard('A', false); ui().home(); } }
  });
  document.addEventListener('keydown', e => {
    if (!on) return;
    if (e.key === 'ArrowRight') { $('tut').querySelector('[data-tn]').click(); }
    else if (e.key === 'ArrowLeft' && i > 0) { i--; draw(); }
    else if (e.key === 'Escape') { $('tut').querySelector('[data-th]').click(); }
  });
  window.BSTut = { start, stop, relayout() { if (on) draw(); } };
})();
