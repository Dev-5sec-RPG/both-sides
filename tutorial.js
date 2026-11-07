// Both Sides — tutorials. 1: the screen. 2: hands-on (sell, covert work, production).
// The screen is darkened except the target. Tap anywhere to continue; in hands-on steps only the lit control works.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const ui = () => window.BSUI;
  const L = (...a) => ui().L(...a);
  const g = () => ui().g;
  const act = () => ui().act;
  const sellOpen = id => { const a = act(); return !!a && a.kind === 'sell' && a.cid === id; };
  const opsOpen = id => { const a = act(); return !!a && a.kind === 'ops' && a.cid === id; };
  const soldOnce = () => { const a = act(); return !!a && a.kind === 'sell' && a.log.some(l => l.ok); };

  // t: CSS selector(s), or 'A:mor' style gauge row. grp: steps in the same group glide instead of popping.
  // wait: hands-on step, done when it returns true. need: the step only makes sense while this holds (used when going back).
  const T1 = [
    { t: null, ja: ['あなたは武器商人', '戦争をしている2つの国の両方に、武器・傭兵・兵糧を売って稼ぐゲームです。スコアは最後に残った利益です。'], en: ['You are an arms dealer', 'Sell arms, mercenaries and rations to both nations at war. Your score is the profit you end with.'], zh: ['你是军火商', '这是一款同时向交战的两个国家出售武器、雇佣兵和军粮来赚钱的游戏。得分就是最后剩下的利润。'] },
    { t: null, ja: ['戦争の終わり方', '戦争は「首都陥落」「降伏」「講和」「強制講和(約3年で国際機関が介入)」のどれかで終わります。戦争が終われば商売も終わり。長く続くほど稼ぐ機会は増えます。'], en: ['How wars end', 'A war ends by a fallen capital, a surrender, a peace deal, or an imposed peace (about 3 years in). When it ends, so does your trade. The longer it lasts, the more you can earn.'], zh: ['战争如何结束', '战争会以“首都沦陷”“投降”“和谈”“强制停战(约3年后国际机构介入)”之一结束。战争结束，生意也就结束了。战争持续越久，赚钱的机会越多。'] },
    { t: null, ja: ['危機の合図', '終わりが近づくと画面の縁が点滅します。赤は首都陥落や降伏、緑は講和の兆しです。残り3週間を切ると点滅が速くなります。'], en: ['Warning signs', 'When the end is near, the screen edges flash. Red means a capital or surrender is at risk, green means peace is coming. The flashing speeds up in the last 3 weeks.'], zh: ['危机信号', '结局临近时，画面边缘会闪烁。红色代表首都沦陷或投降，绿色代表和谈的征兆。剩余不足3周时闪烁会加快。'] },
    { t: '.topbar', ja: ['画面上部', '日付と戦争の進み具合、所持金、利益が並びます。3秒で1週間が進みます。'], en: ['Top bar', 'Date, war progress, cash and profit. Every 3 seconds is one week.'], zh: ['画面上方', '这里显示日期、战争进度、现金和利润。每3秒过去1周。'] },
    { t: '#hMoney,#hProfit', pad: 6, ja: ['所持金と利益', '販売で増え、生産や暗躍で減ります。利益がそのままスコアになります。'], en: ['Cash and profit', 'Sales add to it; production and covert work cost money. Profit is your score.'], zh: ['现金与利润', '出售会增加，生产和暗中行动会减少。利润就是你的得分。'] },
    { t: '#hStep', pad: 4, ja: ['定価', '品物の定価です。時期によって見直されます。売値は定価に倍率を掛けて決まります。'], en: ['List price', 'The list price of goods, reviewed over time. Your selling price is a multiple of it.'], zh: ['标价', '商品的标价。会随时期复审。售价由标价乘以倍率决定。'] },
    { t: '.terrain,#pill', pad: 0, ja: ['戦線', '左がA国、右がB国の領土です。押す力の強い側へ戦線が動き、首都まで押し込まれた国が負けます。光点は前線の部隊(輪が歩兵、菱形が機甲)、首都から伸びる点線は輸送中の品です。'], en: ['The front', 'A holds the left, B the right. The front moves toward the weaker side; a nation pushed back to its capital loses. Points of light are troops (rings: infantry, diamonds: armour); dotted lines from the capitals are goods in transit.'], zh: ['战线', '左边是A国、右边是B国的领土。战线会朝推进力弱的一方移动，被推到首都的国家就会战败。光点是前线部队(圆环为步兵，菱形为装甲)，从首都延伸出的虚线是运输中的货物。'] },
    { t: '#cA', ja: ['国の状態', '各国のカードに、その国の状態が並びます。上の札は今の様子です(値引き要求・武器は不要など)。'], en: ['Nation status', 'Each card shows a nation\'s state. The tags at the top tell you its current mood (wants discount, no arms needed, and so on).'], zh: ['国家状态', '各国的卡片上列出该国的状态。上方的标签显示当前的情况(要求降价、不需要武器等)。'] },
    { t: 'A:mor', grp: 'rows', ja: ['戦意', '戦争を続ける気力です。戦意が低いと武器を買わず、両国とも下がれば講和に向かいます。安売りや無償供与、暗躍で上がります。'], en: ['Morale', 'The will to fight. Low morale means no buying, and if both drop, peace talks begin. Cheap sales, gifts and covert work raise it.'], zh: ['士气', '继续战争的意志。士气低就不会购买武器，两国都下降则会走向和谈。低价出售、无偿提供和暗中行动可以提升士气。'] },
    { t: 'A:frt', grp: 'rows', ja: ['前線', '戦っている兵の数です。多いほど戦線を押す力が強くなり、戦闘や離脱で減ります。'], en: ['Front', 'Soldiers in combat. More soldiers push harder; battle and desertion wear them down.'], zh: ['前线', '正在作战的兵力。越多推进力越强，会因战斗和逃离而减少。'] },
    { t: 'A:eqs', grp: 'rows', ja: ['装備', '兵1人あたりの装備の量です。少ないほど装備一式を高く買い、多すぎると「武器は不要」になります。'], en: ['Arms', 'Arms per soldier. The lower it is, the more they pay for arms kits; too high and they stop buying.'], zh: ['装备', '每名士兵的装备量。越少越愿意高价购买成套装备，太多则会变成“不需要武器”。'] },
    { t: 'A:crw', grp: 'rows', ja: ['充足', '装備を扱える兵が足りているかです。低いと傭兵を高く買い、95%を切ると装備の価値が落ちます。'], en: ['Crew', 'Whether there are enough soldiers to use the arms. Low crew pays more for mercenaries; below 95% arms are worth less.'], zh: ['充足', '能操作装备的士兵是否足够。偏低时会高价购买雇佣兵，跌破95%时装备的价值会下降。'] },
    { t: 'A:food', grp: 'rows', ja: ['兵糧', '軍の食料です。100%を切ると戦意と出動が落ち、90%未満なら兵糧を高く買います。自給できない国は放っておくと減っていきます。'], en: ['Food', 'The army\'s food. Below 100% morale and deployment fall; below 90% they pay more for rations. Nations that cannot feed themselves run down over time.'], zh: ['军粮', '军队的粮食。跌破100%后士气与出动下降，低于90%时会高价购买军粮。不能自给的国家放着不管就会逐渐减少。'] },
    { t: 'A:fund', grp: 'rows', ja: ['資金', '国の財布です。税収で増え、購入や兵の維持で減ります。尽きると買えなくなり、兵が離れていきます。'], en: ['Funds', 'The nation\'s purse. Taxes fill it; purchases and upkeep drain it. When it runs dry, buying stops and soldiers desert.'], zh: ['资金', '国家的钱袋。靠税收增加，因购买和养兵减少。耗尽后就无法购买，士兵也会离开。'] },
    { t: 'A:sus', grp: 'rows', ja: ['疑惑度', 'あなたが両方に売っていると疑う度合いです。高値の販売や暗躍で上がり、50で値引き要求、80で取引停止。安売りや無償供与で下がります。'], en: ['Suspicion', 'How sure they are you deal with both sides. High prices and covert work raise it; at 50 they want discounts, at 80 they stop trading. Cheap sales and gifts lower it.'], zh: ['怀疑度', '对方怀疑你同时向两边出售的程度。高价出售和暗中行动会使其上升，50时要求降价，80时中断交易。低价出售和无偿提供可以降低。'] },
    { t: '#cA .more', pad: 4, open: true, ja: ['詳細', '「詳細」を押すと、反戦感情・予備兵・出動の勢いなどの細かい数値も見られます。'], en: ['More', 'Tap "More" to see finer details such as anti-war feeling, reserves and deployment.'], zh: ['详情', '按“详情”可以查看反战情绪、预备兵、出动势头等更细的数值。'] },
    { t: '#effs', pad: 6, ja: ['予定と効果', '期限付きの効果や、予告された出来事がここに出ます。降伏や講和が近づいた時の通知もここに残ります。'], en: ['Effects and schedule', 'Timed effects and announced events appear here, along with warnings when surrender or peace is near.'], zh: ['预定与效果', '有期限的效果和已预告的事件会显示在这里。投降或和谈临近时的通知也会留在这里。'] },
    { t: '#wireBox', ja: ['戦況ニュース', '戦争で起きたことが流れます。売り時を探す手がかりになります。'], en: ['War news', 'What is happening in the war. A good place to spot selling chances.'], zh: ['战况新闻', '这里会显示战争中发生的事情。是寻找出售时机的线索。'] },
    { t: '#stockBox', ja: ['倉庫', '作った品の在庫が並びます。生産の止め方や兵糧の作り方は、チュートリアル2を参照してください。'], en: ['Warehouse', 'Your stock of goods. To learn how to pause production or make rations, see Tutorial 2.'], zh: ['仓库', '这里列出已生产货物的库存。停止生产和制作军粮的方法请参考教程2。'] },
    { t: '#cA .acts', pad: 4, ja: ['販売と暗躍', '各国への販売と暗躍活動ができるボタンです。これを開いている間は時間が止まります。詳しい操作はチュートリアル2を参照してください。'], en: ['Sell and Covert', 'Buttons to sell to each nation and to act in secret. Time stops while they are open. See Tutorial 2 for how to use them.'], zh: ['出售与暗中行动', '这是向各国出售和进行暗中行动的按钮。打开期间时间会停止。详细操作请参考教程2。'] },
    { t: '#bPause', pad: 4, ja: ['一時停止', 'いつでも時間を止められます。スペースキーでも止まります。'], en: ['Pause', 'Stop time at any moment. The space bar works too.'], zh: ['暂停', '随时可以让时间停止。空格键也可以暂停。'] },
    { t: '#bRetreat', pad: 4, ja: ['撤退', 'その時点の所持金で精算して手を引きます。在庫と融資は失われます。'], en: ['Withdraw', 'Settle with the cash you hold and walk away. Stock and loans are lost.'], zh: ['撤离', '以当时的现金结算并收手。库存与贷款将会损失。'] },
    { t: null, end: 1, ja: ['画面説明は以上です', '続けてチュートリアル2で、販売や暗躍を実際に操作してみましょう。'], en: ['That is the screen', 'Next, try selling and covert work yourself in Tutorial 2.'], zh: ['画面说明到此结束', '接下来在教程2中实际操作出售和暗中行动吧。'] },
  ];
  const T2 = [
    { t: null, ja: ['操作説明', '実際に操作してみましょう。チュートリアル中は時間が止まっています。'], en: ['How to play', 'Let\'s try it for real. Time is stopped during the tutorial.'], zh: ['操作说明', '我们来实际操作一下。教程期间时间是停止的。'] },
    { t: '#AbSell', pad: 4, wait: () => sellOpen('A'), ja: ['販売を開く', 'A国の「販売」を押してください。'], en: ['Open Sell', 'Tap "Sell" on Nation A.'], zh: ['打开出售', '请按A国的“出售”。'] },
    { t: '.picks', need: () => sellOpen('A'), ja: ['品目を選ぶ', '売る品目を選ぶ欄です。在庫の数、定価、前回の取引や相場が出ます。今回は選ばれている装備一式を売ります。'], en: ['Pick an item', 'Choose what to sell here. It shows stock, list price, the last deal and the market. This time, sell the selected Arms Kit.'], zh: ['选择品类', '这里选择要出售的品类。会显示库存数量、标价、上次交易和行情价。这次出售已选中的成套装备。'] },
    { t: '#mc .priceline,#mRange,#mc .quick', need: () => sellOpen('A'), wait: () => { const a = act(); return !!a && a.kind === 'sell' && Math.abs(a.m - 1.2) < 0.001; }, ja: ['価格を決める', '価格を定価の1.2倍にしてください。スライダーを動かすか、「×1.2」を押します。'], en: ['Set the price', 'Set the price to x1.2 of list. Drag the slider or tap "x1.2".'], zh: ['决定价格', '请把价格设为标价的1.2倍。拖动滑块，或按“×1.2”。'] },
    { t: '#mc [data-do="sell"]', pad: 4, need: () => sellOpen('A'), wait: soldOnce, ja: ['売り込む', '「売り込む」を押してください。'], en: ['Make the offer', 'Tap "Offer".'], zh: ['推销', '请按“推销”。'] },
    { t: '#mc .resp', need: () => sellOpen('A') && soldOnce(), ja: ['相場どおりに売れた', '相場どおりの価格だったので、A国は普通に買いました。相場より高すぎると断られ、安く売ると疑惑度が下がり戦意が上がります。'], en: ['Sold at market', 'The price matched the market, so A bought it. Price too high and they refuse; sell cheap and suspicion falls while morale rises.'], zh: ['按行情价成交', '价格与行情价相符，所以A国照常购买了。比行情价高太多会被拒绝，低价出售则会降低怀疑度、提升士气。'] },
    { t: '#mc .mstat', need: () => sellOpen('A'), ja: ['相手国の状態', '下には売り込む国の状態が出ます。カードと同じ並びなので、売りながら確かめられます。'], en: ['Buyer status', 'The buyer\'s status is shown below, in the same order as its card, so you can check it while you sell.'], zh: ['对方国家的状态', '下方显示推销对象国的状态。顺序与卡片相同，可以边出售边确认。'] },
    { t: '#mc [data-do="close"]', pad: 4, wait: () => !act(), ja: ['販売を閉じる', '「閉じて再開」を押してください。通常はここで時間が再び動き出します。'], en: ['Close', 'Tap "Close and resume". Normally time starts again here.'], zh: ['关闭出售', '请按“关闭并继续”。通常在这里时间会再次开始流动。'] },
    { t: '#BbOps', pad: 4, wait: () => opsOpen('B'), ja: ['暗躍を開く', '次は暗躍です。B国の「暗躍」を押してください。'], en: ['Open Covert', 'Now covert work. Tap "Covert" on Nation B.'], zh: ['打开暗中行动', '接下来是暗中行动。请按B国的“暗中行动”。'] },
    { t: '#mc .oplist', need: () => opsOpen('B'), ja: ['暗躍の一覧', '要人暗殺・悪評の流布・戦争コンサル・融資で、裏から戦争を動かします。どれも疑惑度が上がります。'], en: ['Covert actions', 'Assassination, smear campaigns, war consulting and loans steer the war from the shadows. All of them raise suspicion.'], zh: ['暗中行动一览', '通过要人暗杀、散布恶评、战争顾问、贷款，从幕后操纵战争。所有行动都会提高怀疑度。'] },
    { t: '#mc .oprow:first-child', need: () => opsOpen('B'), wait: () => g().opsCount.assassin > 0, ja: ['要人暗殺', '「要人暗殺」の「実行」を押してください。'], en: ['Assassination', 'Tap "Do it" for Assassination.'], zh: ['要人暗杀', '请按“要人暗杀”的“执行”。'] },
    { t: '#mc .resp', need: () => opsOpen('B') && g().opsCount.assassin > 0, ja: ['暗躍の結果', 'B国の戦意が上がり、疑惑度はB国とA国の両方で上がりました。暗躍は戦況を変えられる一方、疑われる代償があります。'], en: ['The result', 'B\'s morale rose, and suspicion rose in both B and A. Covert work can turn the war, at the price of suspicion.'], zh: ['暗中行动的结果', 'B国的士气上升了，而B国和A国的怀疑度都上升了。暗中行动能改变战况，代价是被怀疑。'] },
    { t: '#mc [data-do="close"]', pad: 4, wait: () => !act(), ja: ['暗躍を閉じる', '「閉じて再開」を押してください。'], en: ['Close', 'Tap "Close and resume".'], zh: ['关闭暗中行动', '请按“关闭并继续”。'] },
    { t: '#sl_merc', pad: 4, wait: () => !g().prodOn.merc, ja: ['生産を止める', '倉庫では、装備一式と傭兵が自動で作られます。傭兵の枠を押して、生産を止めてください。'], en: ['Pause production', 'Arms kits and mercenaries are made automatically. Tap the Mercs slot to pause it.'], zh: ['停止生产', '仓库会自动生产成套装备和雇佣兵。请按雇佣兵的格子，停止生产。'] },
    { t: '#stockBox', ja: ['生産の停止', '傭兵の生産が止まりました。生産にはお金がかかり、売れ残りは損になります。売れそうにない品は止めておきましょう。もう一度押すと再開します。'], en: ['Production paused', 'Mercenary production has stopped. Production costs money and unsold stock is a loss, so pause what will not sell. Tap again to resume.'], zh: ['生产已停止', '雇佣兵的生产停止了。生产需要花钱，卖不出去就是亏损。不太可能卖出的货物就先停掉吧。再按一次即可恢复。'] },
    { t: '#sl_food', pad: 4, wait: () => g().foodQueue > 0 || g().inv.food > 0, ja: ['兵糧を作る', '兵糧は自動では作られません。兵糧の枠を押して、1単位作ってください。'], en: ['Make rations', 'Rations are not made automatically. Tap the Rations slot to make one unit.'], zh: ['制作军粮', '军粮不会自动生产。请按军粮的格子，制作1单位。'] },
    { t: '#stockBox', ja: ['兵糧の注意', '兵糧は押した回数だけ作られます。作ってから3か月売れないと傷んで廃棄されるので、兵糧が減ってきた国がある時だけ作りましょう。間違えたら「取消」で戻せます。'], en: ['About rations', 'One ration is made per tap. Unsold rations spoil after 3 months, so make them only when a nation is running low. Tap "Undo" if you made a mistake.'], zh: ['关于军粮', '每按一次制作1单位军粮。生产后3个月未售出就会变质废弃，所以只在有国家军粮减少时再制作。做错了可以按“取消”撤回。'] },
    { t: null, end: 2, ja: ['操作説明は以上です', 'ホームの「新しい戦争」から、戦争を選んで始めましょう。'], en: ['You are ready', 'Choose a war from "New War" on the home screen.'], zh: ['操作说明到此结束', '从主页的“新的战争”中选择一场战争开始吧。'] },
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
      <button class="btn thome" data-th>${L('ホームに戻る', 'Home', '返回主页')}</button>
      <button class="btn tback" data-tp aria-label="${L('戻る', 'Back', '返回')}">←</button>
      <div class="tbox" role="dialog" aria-live="polite"><span class="tlab">${cur === 1 ? L('チュートリアル1 画面説明', 'TUTORIAL 1 · THE SCREEN', '教程1 画面说明') : L('チュートリアル2 操作説明', 'TUTORIAL 2 · HOW TO PLAY', '教程2 操作说明')}</span>
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
    const s = STEPS[i], tx = s[ui().lang] || s.ja, box = $('tut'), tb = box.querySelector('.tbox');
    ui().openCard('A', !!s.open);
    tb.querySelector('h3').textContent = tx[0]; tb.querySelector('p').textContent = tx[1];
    tb.querySelector('.pg').textContent = (i + 1) + ' / ' + STEPS.length;
    const hint = tb.querySelector('.thint');
    hint.textContent = s.end ? '' : s.wait ? L('光っている所を操作してください', 'Use the highlighted control', '请操作发光的位置') : L('画面をタップ(PCならクリック)で次へ', 'Tap the screen (click on PC) to continue', '点击画面继续');
    hint.className = 'thint' + (s.wait ? ' act' : '');
    tb.querySelector('.tend').innerHTML = s.end === 1
      ? `<button class="btn" data-th>${L('ホームに戻る', 'Home', '返回主页')}</button><button class="btn primary" data-t2>${L('チュートリアル2 操作説明に進む', 'Go to Tutorial 2: How to Play', '进入教程2 操作说明')}</button>`
      : s.end === 2 ? `<button class="btn primary" data-th>${L('ホームに戻る', 'Home', '返回主页')}</button>` : '';
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
    $('fadeT').textContent = n === 2 ? L('チュートリアル2', 'Tutorial 2', '教程2') : L('チュートリアル1', 'Tutorial 1', '教程1');
    $('fadeS').textContent = n === 2 ? L('操作説明', 'How to Play', '操作说明') : L('画面説明', 'The Screen', '画面说明');
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
