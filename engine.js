
(function (root) {
  'use strict';
  // 言語: 'ja' / 'en'。L(日本語, 英語)で切り替える
  const LANG = { cur: 'ja' };
  const L = (ja, en) => LANG.cur === 'en' ? en : ja;
  const ITEMS_TXT = {
    equip: { ja: { name:'装備一式', sub:'小銃・火砲・戦車と整備部品', lot:'1組', trait:'装備充足率を上げる' }, en: { name:'Arms Kit', sub:'Rifles, artillery, tanks and parts', lot:'1 kit', trait:'Raises equipment level' } },
    merc:  { ja: { name:'傭兵', sub:'訓練済みの兵員', lot:'10,000人', trait:'軍人を増やす(人員充足率を上げる)' }, en: { name:'Mercenaries', sub:'Trained soldiers', lot:'10,000 men', trait:'Adds soldiers (raises manpower)' } },
    food:  { ja: { name:'兵糧', sub:'穀物・保存食', lot:'1単位', trait:'兵糧を回復(軍人10万人あたり30%)。3か月で廃棄' }, en: { name:'Rations', sub:'Grain and preserved food', lot:'1 unit', trait:'Restores food (30% per 100k soldiers). Spoils in 3 months' } },
  };
  const ITEMS = {
    equip: { key:'equip', type:'mix', price:80000,  power:80000, soldiers:0,     interval:6,  lag:8 },
    merc:  { key:'merc',  type:null,  price:120000, power:0, soldiers:10000, interval:24, lag:10 },
    food:  { key:'food',  type:null,  price:150000, power:0, soldiers:0, interval:12, lag:4 },
  };
  // 装備の性質(種類の区別はしない): wear=損耗の速さ, crew=戦力1あたりの必要兵数
  const EQ = {
    all: { name:'装備', wear:1.3, crew:0.0196, ideal:1 },
  };
  const OPS_TXT = { assassin: ['要人暗殺', 'Assassination'], rumor: ['敵国悪評流布', 'Smear Campaign'], consult: ['戦争コンサル', 'War Consulting'], loan: ['融資', 'Loan'] };
  const OPS = {
    assassin: { key:'assassin', cost:30000, cd:20 },
    rumor:    { key:'rumor',    cost:10000, cd:20 },
    consult:  { key:'consult',  cost:10000, cd:20 },
    loan:     { key:'loan',     cost:500000, cd:20 },
  };
  // 名前などの文言は、言語に合わせてその場で引く
  function applyLang() {
    for (const k in ITEMS) Object.assign(ITEMS[k], ITEMS_TXT[k][LANG.cur]);
    for (const k in OPS) OPS[k].name = OPS_TXT[k][LANG.cur === 'en' ? 1 : 0];
    for (const k in POLICY) POLICY[k].name = POLICY_TXT[k][LANG.cur === 'en' ? 1 : 0];
    for (const k in SCENARIOS) { const t = SCN_TXT[k][LANG.cur]; SCENARIOS[k].name = t.name; SCENARIOS[k].desc = t.desc; SCENARIOS[k].A.trait = t.A; SCENARIOS[k].B.trait = t.B; }
  }
  function setLang(l) { LANG.cur = l === 'en' ? 'en' : 'ja'; applyLang(); }
  const cname = id => L(id + '国', 'Nation ' + id);
  const CFG = {
    startMoney: 3000000, batLow: -0.06, batDef: 0.02, minIdleWeeks: 35, surrMorale: 20, surrHold: 36, defeatAlert: 0.2, capWarn: 36, bandW: 1.05, bandR: 1.15, stretchC: 1.1, stretchW: 0.1, stretchA: 1, threatSelf: 0, estTau: 6, estEvery: 12, boughtTau: 12, invCap: 12, prodRate: 1.5, needBase: 0, eqNeed: 1, suffOn: 1.5, suffOff: 1.3, wLose: 0.45, wAlarm: 0.6, wWealth: 0.15, fBase: 0.45, fNeed: 1.0, threatK: 8000, threatDecay: 1.2, seeSusp: 0.3, eqDecay: 0.00133, desertStart: 0.25, desertHeavy: 0.05, desertMid: 0.02, desertMax: 0.065, surrenderLine: 0.35, cap: 420, foodRef: 100000, cost: { equip: 0.6, merc: 0.5, food: 0.4 }, foodDrain: 0.03, foodMor: 0.8, foodPush: 0.3, foodAnti: 0.3, foodLife: 36, foodMax: 160, foodFull: 130,
    lossS: 0.0001, lossP: 0.0009, upkeep: 0.03, incomeK: 0.0022, richLine: 5000000,
    absMode: true, crewK: 1.58, eqStd: 23.5, eqPriceK: 0.5, compK: 1.08, peaceLine: 25, peaceHold: 18, threatLag: 12,
    sortieBase: 0.004, transitTime: 12, frontSpeed: 0.006, capitalLine: 0.12,
    farmDecay: 0.0018, loanLimit: 300000, loanInterest: 0.2,
  };

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function mkCountry(id, name, o) {
    const c = Object.assign({ id, name, alive: true, pipeline: [], lastArrival: -999,
      taxMod: 1, taxModUntil: 0, taxAdvUntil: 0, priceMod: 1, priceModUntil: 0, pushMod: 1, pushModUntil: 0, sold: [], recv: [], bought: { equip: 0, merc: 0, food: 0 }, lastDeal: {}, foodLv: 105, noNeed: false, estTarget: 0, estNoise: 0, estAt: -99, }, o, { initSoldiers: o.soldiers, front: o.frontInit, reserve: o.soldiers - o.frontInit, transit: [], sortieRate: 0, push: 0, policy: 'normal', policyUntil: 0, cool: 30, massUntil: 0, massing: false, surT: 0, warned: 0, initFunds: o.funds, desertLv: 0, deserted: 0 });
    totals(c); c.crewK = CFG.absMode ? CFG.crewK : c.soldiers / (1.5 * c.crew); totals(c); c.initPower = c.power; return c; // 人員充足率: どの国も同じ基準(装備1あたりの必要兵数)で測る
  }
  function totals(c) {
    c.power = c.eq.all;
    c.crew = c.eq.all * EQ.all.crew * (c.crewK || 1);
  }
  // 装備の効率(種類の区別をなくしたため一定)
  function comp(c) { return CFG.compK; }


  // 戦争の設定(シナリオ)。Web版は2種
  const SCENARIOS = {
    s1: { key:'s1', P0:0.52,
      A: { frontInit:61000, farmCap:143000, taxBase:15000, recruitBase:120, soldiers:130000, morale:60, antiwar:30, funds:5050000, eq:{ all:2700000 }, susp:0, threat:40 },
      B: { frontInit:45000, farmCap:74000, taxBase:8000, recruitBase:140, soldiers:80000,  morale:75, antiwar:20, funds:2550000, eq:{ all:1900000 }, susp:0, threat:60 } },
    s2: { key:'s2', P0:0.5,
      A: { frontInit:50000, farmCap:90000, taxBase:11000, recruitBase:100, soldiers:100000, morale:65, antiwar:25, funds:3640000, eq:{ all:2700000 }, susp:0, threat:50 },
      B: { frontInit:58000, farmCap:126000, taxBase:11000, recruitBase:170, soldiers:120000, morale:70, antiwar:20, funds:3360000, eq:{ all:2050000 }, susp:0, threat:50 } },
  };
  const SCN_TXT = {
    s1: { ja: { name:'大国と小国', desc:'豊かな大国A国と、貧しいが士気の高い小国B国。', A:'大国: 豊かで兵が多い', B:'小国: 貧しいが戦意が高い' },
          en: { name:'Giant vs. Minnow', desc:'Rich, populous Nation A against poor but spirited Nation B.', A:'Great power: rich, many troops', B:'Small nation: poor, high morale' } },
    s2: { ja: { name:'工業国と農業国', desc:'装備の多い工業国A国と、兵と食料の多い農業国B国。', A:'工業国: 装備が多く、兵と食料が乏しい', B:'農業国: 兵と食料が豊富で、装備が乏しい' },
          en: { name:'Industry vs. Farmland', desc:'Well-armed industrial Nation A against populous, well-fed agrarian Nation B.', A:'Industrial: well-armed, short of men and food', B:'Agrarian: many men and food, short of arms' } },
  };
  const BASE = SCENARIOS.s1;
  // 国の条件のゆらぎ(乱数): 兵・装備 ±15%、資金 ±30%、税収 ±25%、農業 ±15%、戦意 ±10、開戦時の戦線 ±4%
  function spec(id, rr, sc) {
    const b = sc[id], o = JSON.parse(JSON.stringify(b));
    if (!rr) return o;
    const u = (lo, hi) => lo + rr() * (hi - lo);
    const ks = u(0.85, 1.15); o.soldiers = Math.round(b.soldiers * ks); o.frontInit = Math.round(b.frontInit * ks);
    const ke = u(0.85, 1.15); o.eq.all = Math.round(b.eq.all * ke * (u(0.9, 1.1) + u(0.9, 1.1) + u(0.9, 1.1)) / 3);
    o.funds = Math.round(b.funds * u(0.7, 1.3) / 10000) * 10000; o.taxBase = Math.round((o.funds * CFG.incomeK + o.soldiers * CFG.upkeep) * u(0.95, 1.05)); // 収支(税収−兵の給与)が初期資金にほぼ比例する
    o.farmCap = Math.round(b.farmCap * u(0.85, 1.15)); o.morale = Math.round(b.morale + u(-10, 10)); o.antiwar = Math.round(b.antiwar + u(-5, 5));
    return o;
  }
  // ランダムな国の条件(デイリー)の安全装置: 何もしない場合の戦争が35週未満で終わる一方的な条件は、シードを進めて作り直す
  function newGame(seed, opts) {
    seed = seed == null ? Math.floor(Math.random() * 1e9) : seed;
    opts = opts || {};
    if ((opts.random || CFG.randomCountries) && !opts.noCheck && !opts.rr) {
      for (let i = 0; i < 50; i++) { if (baseline(seed, true, opts.scenario, true).weeks >= CFG.minIdleWeeks) break; seed = (seed * 7 + 1013) % 1000000007; }
    }
    return makeGame(seed, opts);
  }
  function makeGame(seed, opts) {
    const rr = (opts.random || CFG.randomCountries) ? rng(seed * 7 + 13) : null;
    const sc = SCENARIOS[opts.scenario || CFG.scenario || 's1'];
    const g = {
      seed, r: rng(seed), t: 0, over: false, paused: false, modal: null,
      money: CFG.startMoney, revenue: 0, spent: 0, opsSpent: 0, sales: 0, foodRev: 0, loans: [], loanOut: 0, lastStep: 1, stats: { refuse: 0, noneed: 0, nofunds: 0, stop: 0, nomorale: 0, foodNeglect: 0, maxSusp: 0, free: 0 },
      cas: { A: 0, B: 0 }, supplied: { equip: 0, merc: 0, food: 0 }, opsCount: { assassin: 0, rumor: 0, consult: 0, loan: 0 },
      order: null, orderCount: 0, lastOrderT: -999,
      inv: { equip: 2, merc: 0, food: 0 }, foodLots: [], foodQueue: 0, pending: [],
      prodOn: { equip: true, merc: true, food: false },
      prodT: { equip: 0, merc: 0, food: 0 },
      cd: { assassin: 0, rumor: 0, consult: 0, loan: 0 },
      sched: [], news: [], tl: [], peaceT: 0, nextEvent: 1e9, evIdx: 0, P: 0.56, fhist: [], nextCmd: 4.3, lastEvent: null, result: null,
      history: [], random: !!rr, scenario: sc.key,
      c: {
        A: mkCountry('A', cname('A'), spec('A', rr, sc)),
        B: mkCountry('B', cname('B'), spec('B', rr, sc)),
      },
    };
    g.P = sc.P0; if (rr) g.P = clamp(sc.P0 - 0.02 + rr() * 0.04, 0.467, 0.533); // 開戦時の国土の表示は45〜55%に収める
    g.evSeq = eventSchedule(seed);
    news(g, L('開戦から数週間。A国とB国の戦線は膠着しつつある。', 'A few weeks into the war. The front between A and B is settling into a stalemate.'), 'info');
    if (root.BothSides && root.BothSides.__setup) root.BothSides.__setup(g);
    return g;
  }

  function other(id) { return id === 'A' ? 'B' : 'A'; }
  // 押す力: 前線の部隊と、彼らが扱える装備で決まる
  function foodFactor(g, c) { return Math.max(0.4, 1 - CFG.foodPush * foodPen(c)); }
  // 地の利: 本土に押し込まれた側は守りが固く、深く攻め込んだ側は補給が伸びて弱る
  function terrain(g, c) {
    if (!g) return 1;
    const own = c.id === 'A' ? g.P : 1 - g.P;
    return own < 0.5 ? 1 + 0.8 * (0.5 - own) : 1 - 0.5 * Math.max(0, own - 0.55);
  }
  // 司令部の方針: aggr=積極 / normal=保守 / pass=消極
  const POLICY_TXT = { aggr: ['積極', 'Aggressive'], normal: ['保守', 'Standard'], pass: ['消極', 'Cautious'] };
  const POLICY = { aggr: { name: '積極', price: 0.15, sortie: 1.8, push: 1.15, anti: 0.15, morale: -0.1 }, normal: { name: '保守', price: 0, sortie: 1, push: 1, anti: 0, morale: 0 }, pass: { name: '消極', price: -0.1, sortie: 0.5, push: 0.88, anti: -0.15, morale: 0.1 } };
  const pol = c => POLICY[c.policy || 'normal'];
  function policyPush(c) { return pol(c).push; }
  function eff(c, g) {
    const fill = c.crew > 0 ? Math.min(1, c.front / (c.crew * 0.5)) : 1; // 装備の稼働率: 前線の兵で、前線にある半分の装備を扱えるか
    return (c.power * fill * comp(c) + c.front * 9) * policyPush(c) * (g && g.t < c.pushModUntil ? c.pushMod : 1) * (0.7 + c.morale / 250) * (g ? foodFactor(g, c) * terrain(g, c) : 1);
  }
  // 戦線の位置(A国の領土の割合)。押す力の差でじわじわ動く
  // 戦況による戦意の変化(毎秒)。国土の割合に対してなめらかに変わる
  function batMorale(s) { const BATP = [[0, CFG.batLow], [0.27, CFG.batLow], [0.33, CFG.batDef], [0.42, CFG.batDef], [0.48, -0.01], [0.52, -0.01], [0.58, 0.03], [1, 0.03]]; for (let i = 1; i < BATP.length; i++) if (s <= BATP[i][0]) { const [x0, y0] = BATP[i - 1], [x1, y1] = BATP[i]; return y0 + (y1 - y0) * (s - x0) / (x1 - x0); } return 0.03; }
  function shareOf(g, id) { return id === 'A' ? g.P : 1 - g.P; }
  // 表示上の国土: 戦線は押す力の差に対して中央付近で1.5倍動く(内部の40%=国土35%)。首都付近では守りが固く動きが鈍る
  function terrOf(x) {
    if (x <= 0.4) return 0.03 + (Math.max(0.05, x) - 0.05) / 0.35 * 0.32;
    if (x >= 0.6) return 1 - terrOf(1 - x);
    return 0.5 + (x - 0.5) * 1.5;
  }
  function territory(g, id) { return terrOf(shareOf(g, id)); }
  // 資金が初期の25%を下回ると前線から兵が離脱し始め、5%以下で顕著になる(1週あたりの離脱率)
  function desertRate(c) {
    const f = c.initFunds > 0 ? c.funds / c.initFunds : 1;
    if (f >= CFG.desertStart) return 0;
    if (f >= CFG.desertHeavy) return CFG.desertMid * (CFG.desertStart - f) / (CFG.desertStart - CFG.desertHeavy);
    return CFG.desertMid + (CFG.desertMax - CFG.desertMid) * (CFG.desertHeavy - f) / CFG.desertHeavy;
  }
  // 崩壊の危険(表示用): 首都陥落と降伏の条件にどれだけ近いかを2段階で返す
  function collapseRisk(g, c) {
    const t = terrOf(shareOf(g, c.id)), out = [];
    let lv = 0;
    const add = (l, why) => { out.push({ l, why }); if (l > lv) lv = l; };
    if (c.surT > 0) add(2, L('降伏を検討中', 'considering surrender'));
    else if (c.morale < 25 && t < 0.4) add(1, L('降伏の恐れ', 'may surrender'));
    if (t < CFG.defeatAlert) add(2, L('首都が陥落寸前', 'capital about to fall')); else if (t < 0.28) add(1, L('首都に迫られている', 'enemy nearing the capital'));
    out.sort((x, y) => y.l - x.l);
    return { lv, why: out.map(x => x.why), weeks: c.surT > 0 ? Math.max(1, Math.ceil((CFG.surrHold - c.surT) / 3)) : null };
  }
  // 時を止めて知らせる(他の知らせと重なった時は順番に出す)
  function alertModal(g, title, text, stamp) { (g.alertQ || (g.alertQ = [])).push({ kind: 'event', title, text, stamp, pre: false }); }
  function pressure(g, id) { const a = eff(g.c.A, g), b = eff(g.c.B, g), s = a / (a + b || 1); return id === 'A' ? s : 1 - s; }
  function transitSum(c) { return c.transit.reduce((s, x) => s + x.n, 0); }
  function syncSoldiers(c) { c.soldiers = c.reserve + c.front + transitSum(c); }
  function tl(g, what, why, kind) { g.tl.push({ t: g.t, what, why: why || '', kind: kind || 'state' }); if (g.tl.length > 120) g.tl.shift(); }
  // 状態の変化を検知して、因果の履歴に残す
  function milestones(g) {
    for (const c of [g.c.A, g.c.B]) {
      const m = c.ms || (c.ms = {});
      // once: 何度も行き来する項目は、初めての時だけ記録する
      const flag = (key, on, onText, onWhy, offText, offWhy, once) => {
        if (on && !m[key]) { m[key] = true; if (!once || !m[key + '_on']) { m[key + '_on'] = true; tl(g, onText, onWhy); } }
        else if (!on && m[key]) { m[key] = false; if (offText && (!once || !m[key + '_off'])) { m[key + '_off'] = true; tl(g, offText, offWhy); } }
      };
      const ss = selfSuff(g, c), dem = demand(g, c), sh = shareOf(g, c.id);
      const n = c.name;
      flag('nomorale', c.morale < CFG.peaceLine, L(n + 'の戦意が初めて25を下回った。', n + "'s morale fell below 25 for the first time."), L(n + 'は武器を買わなくなった(相場の3割以下なら受け取る)', n + ' stopped buying arms (accepts 30% of market or less)'), L(n + 'の戦意が初めて25以上に戻った。', n + "'s morale recovered to 25 for the first time."), L(n + 'は再び武器を買うようになった', n + ' buys arms again'), true);
      if ((c.seenSusp || 0) >= 10) { tl(g, L(n + 'は、敵国の前線で同型の装備が使われていることに気付いた。', n + ' noticed the same arms on the enemy front.'), L('相手国への納品が見えるたびに、' + n + 'の疑惑度が上がる(合計 +' + Math.round(c.seenSusp) + ')', 'Each delivery it sees raises its suspicion (total +' + Math.round(c.seenSusp) + ')')); c.seenSusp = 0; }
      flag('warn', c.susp >= 50, L(n + 'の疑惑度が50を超えた。', n + "'s suspicion rose above 50."), L(n + 'は値引きを求めるようになった', n + ' now demands discounts'), L(n + 'の疑惑度が50を下回った。', n + "'s suspicion fell below 50."), L('値引きの要求が止んだ', 'Discount demands stopped'));
      flag('stop', c.susp >= 80, L(n + 'の疑惑度が80を超えた。', n + "'s suspicion rose above 80."), L(n + 'との取引が止まった(膠着時の破格は例外)', 'Trade with ' + n + ' halted (except rock-bottom offers in a stalemate)'), L(n + 'の疑惑度が80を下回った。', n + "'s suspicion fell below 80."), L(n + 'との取引が再開できる', 'Trade with ' + n + ' can resume'));
      flag('noneed', c.noNeed && c.morale >= CFG.peaceLine, L(n + 'の装備が初めて十分に揃った(装備充足率150%超)。', n + ' is fully armed for the first time (equipment over 150%).'), L(n + 'は武器を必要としなくなった(相場の5割以下なら買う)', n + ' no longer needs arms (buys at 50% of market or less)'), L(n + 'が初めて再び武器を求め始めた。', n + ' wants arms again for the first time.'), L('装備の損耗や兵の増加で充足率が130%を下回った', 'Wear or new troops brought equipment below 130%'), true);
      flag('finish', sh > 0.65 && c.antiwar > 50 && c.morale >= CFG.peaceLine, L(n + 'が圧倒的優勢のまま、反戦感情が50を超えた。', n + ' is winning big, but anti-war sentiment passed 50.'), L(n + 'は早期終結を望み、武器を求めるようになった', n + ' wants a quick end and seeks arms'));
      flag('food70', c.foodLv < 70, L(n + 'の兵糧が70%を下回った。', n + "'s food fell below 70%."), L('戦意の低下と出動の鈍化が目に見えて強まる', 'Morale and deployment drop visibly'), L(n + 'の兵糧が70%以上に戻った。', n + "'s food is back above 70%."), L('兵糧の不足が和らいだ', 'Food shortage eased'));
      flag('food', c.foodLv < 90, L(n + 'の兵糧が90%を下回った。', n + "'s food fell below 90%."), L('兵糧の相場が1.3倍になった。戦意と出動の勢いの落ち込みが強まっていく', 'Food price is now x1.3. Morale and deployment keep sliding'), L(n + 'の兵糧が90%以上に戻った。', n + "'s food is back above 90%."), L('兵糧の不足が和らいだ', 'Food shortage eased'));
      flag('sortie', c.sortieRate * 3 < 250 && !c.massing, L(n + 'の出動の勢いが初めて細った(毎週250人未満)。', n + "'s deployment dried up for the first time (under 250/week)."), L('予備の不足・戦意の低下・兵糧不足のいずれかが原因。前線の補充が追いつかなくなる', 'Caused by low reserves, morale or food. The front cannot be refilled'), L(n + 'の出動の勢いが初めて回復した。', n + "'s deployment recovered for the first time."), L('前線への補充が再開した', 'Reinforcement of the front resumed'), true);
      flag('mass', c.massing, L(n + 'が首都に兵を集結させ始めた。', n + ' began massing troops at the capital.'), L('反戦感情が高まり、早く終わらせるための総攻撃の準備', 'Anti-war mood is high; preparing an all-out offensive to end it'));
    }
  }
  function news(g, text, kind) { g.news.unshift({ t: g.t, text, kind: kind || 'info' }); if (g.news.length > 60) g.news.pop(); }
  function schedule(g, at, fn) { g.sched.push({ at, fn }); }

  // 品目ごとの不足感: 編成で足りない装備ほど高く評価する
  function crewFill(c) { return c.crew > 0 ? c.soldiers / c.crew : 9; }
  function itemBonus(c, item) {
    if (!item) return 0;
    const it = ITEMS[item];
    const f = crewFill(c);
    if (!it.type) {
      // 傭兵: 充足率110%以下で相場が上がり、120%前後で通常、それ以上は人が余っていて安くなる
      if (f <= 1.1) return clamp((1.1 - f) * 1.5, 0, 0.6);
      if (f <= 1.2) return 0;
      return -clamp((f - 1.2) / 0.3 * 0.25, 0, 0.25);
    }

    // 装備: 充足率95%を切ると、扱う人がいないため相場が落ちる
    const lack = f < 0.95 ? -clamp((0.95 - f) * 1.5, 0, 0.5) : 0;
    // 装備充足率が低いほど相場が上がり、高いほど下がる
    const suff = CFG.absMode ? CFG.eqPriceK * clamp(1 - c.power / (Math.max(1, c.soldiers) * CFG.eqStd), -0.3, 0.4) : 0;
    return lack + suff;
  }
  function fairMult(g, c, item) {
    if (g.fairOverride && g.fairOverride[c.id + item] != null) return g.fairOverride[c.id + item]; // チュートリアル用に相場を固定する
    if (item === 'food') { let f = foodMult(c); if (c.susp >= 50) f *= 0.8; if (g.t < c.priceModUntil) f *= c.priceMod; return f; }
    const D = demand(g, c);
    const wealth = CFG.wWealth * clamp((c.funds - 1000000) / 3000000, 0, 1);
    let f = CFG.fBase + CFG.fNeed * D + wealth + (c.morale - 50) / 300 + itemBonus(c, item) + pol(c).price;
    f = CFG.stretchC + (f - CFG.stretchC) + CFG.stretchA * CFG.stretchW * Math.tanh((f - CFG.stretchC) / CFG.stretchW); // 中央(1.1倍)付近ほど動きを大きくする
    if (c.susp >= 50) f *= 0.8;
    if (item) f -= buyImpact(c, item); // 司令部が買った量を把握し、同じ品目を続けて買うほどその品目の相場が下がる
    if (g.t < c.priceModUntil) f *= c.priceMod;
    return clamp(f, 0.4, 2);
  }
  // 需要: 劣勢ほど高く、優勢ほど低い。超優勢かつ反戦感情が高いと「早く終わらせたい」で再び高まる
  // 需要(危機感): 押されている・相手に武器が届いている(警戒)・損耗が大きいほど高い。最近受け取った分だけ一時的に満たされる
  // 装備充足率: 司令部が必要と考える装備(開戦時の装備が基準)に対して、いまどれだけ持っているか。必要かどうかの判断に使う
  // 装備充足率: どの国も同じ基準(兵1人あたりの装備)で測る。同じ数字なら同じだけ欲しがる
  function eqTarget(g, c) { return CFG.absMode ? Math.max(1, c.soldiers) * CFG.eqStd : c.initPower * CFG.eqNeed; }
  function eqSuff(g, c) { return c.power / eqTarget(g, c); }
  // 危機感(相場の高さ): 押されている・相手国に武器が届いて警戒している・兵の損耗が大きい・早く終わらせたい
  function needParts(g, c) {
    const s = shareOf(g, c.id);
    const losing = clamp((0.6 - s) / 0.25, 0, 1);
    const alarm = c.threat / 100;
    const loss = clamp(1 - c.front / (c.initSoldiers * 0.5), 0, 1);
    const finish = (s > 0.65 && c.antiwar > 50) ? (c.antiwar - 50) / 50 * 0.6 : 0;
    return { losing, alarm, loss, finish };
  }
  // 同じ品目を続けて買うほど、その品目の相場が下がる(1回目:1、2回目:4、3回目:9…の割合)。高い品目ほど影響が大きい
  const BUYK = { equip: 0.012, merc: 0.0167, food: 0 };
  function buyImpact(c, item) { const n = c.bought[item] || 0; return BUYK[item] * n * n; }
  // 需要(相場の高さ)。必要かどうかは装備充足率で別に判断する
  function demand(g, c) {
    const p = needParts(g, c);
    const raw = Math.max(0, CFG.needBase + CFG.wLose * p.losing + CFG.wAlarm * p.alarm + 0.4 * p.loss + p.finish);
    return 1.25 * Math.tanh(raw / 0.8);
  }


  // 相場の段階表示(兵糧以外)。数値ではなく言葉で示す
  const PLABEL = [[0.6, ['大幅な値崩れ', 'Collapsed'], 0.5], [0.8, ['値崩れ', 'Slumping'], 0.7], [0.9, ['やや安い', 'Soft'], 0.85], [1.1, ['ほぼ定価', 'Near list'], 1.0], [1.3, ['少し高騰', 'Firm'], 1.2], [1.5, ['高騰', 'High'], 1.4], [9, ['大高騰', 'Soaring'], 1.6]];
  function priceBand(m) { for (const b of PLABEL) if (m < b[0]) return { label: L(b[1][0], b[1][1]), mid: b[2] }; return { label: L('大高騰', 'Soaring'), mid: 1.6 }; }
  function priceLabel(g, c, item) { return priceBand(estimate(g, c, item)); }
  function estimate(g, c, item) {
    if (item === 'food') return fairMult(g, c, item); // 兵糧の相場は備蓄の段階で決まり、正確に分かる
    return fairMult(g, c, item) * (1 + c.estNoise);
  }

  // 定価の段階上昇: 80週1.1倍・100週1.2倍・120週1.3倍(実時間4/5/6分)。生産費は元の定価基準のまま
  // 定価の見直し: 2年目3月・2年目9月・3年目4月。その時点でどちらの国も戦意を失っていなければ0.1倍ずつ上がる
  const PRICE_CHECKS = [168, 240, 324];
  function priceStep(g) { return g.pl || 1; }
  function nextPriceCheck(g) { return PRICE_CHECKS[g.plIdx || 0]; }
  function listPrice(g, item) { return Math.round(ITEMS[item].price * priceStep(g)); }
  // 兵糧の自給率: 農業力(市民数と時間で低下)÷兵士数。100%を下回ると外部の兵糧が必要
  // 兵糧: 農業で賄えない分だけ備蓄(foodLv)が減る。1単位で軍人10万人あたり30%回復
  function foodRestore(c) { return 30 * CFG.foodRef / Math.max(1, c.soldiers); }
  function foodPen(c) { return c.foodLv >= 100 ? 0 : Math.min(3, Math.pow((100 - c.foodLv) / 30, 2)); } // 70%で1、なだらかに強まる(上限3)
  function foodMult(c) { const f = c.foodLv; return f >= 90 ? 1.0 : f >= 70 ? 1.3 : f >= 60 ? 1.8 : 2.0; }
  function selfSuff(g, c) {
    const farm = c.farmCap * Math.max(0.2, 1 - CFG.farmDecay * g.t);
    return c.soldiers > 0 ? farm / c.soldiers : 9;
  }
  function shortage(g, c) { return clamp(1 - selfSuff(g, c), 0, 1); }


  function costRate(k) { return CFG.cost[k]; } // 原価(定価に対する割合)
  function take(g, item) { g.inv[item]--; if (item === 'food') g.foodLots.shift(); }
  function deliver(g, c, item) {
    const it = ITEMS[item];
    const at = g.t + it.lag;
    c.pipeline.push({ at, item, value: it.price });
  }

  // 1週間に受け付ける発注の数(調達の処理能力)
  const SUSM = { equip: 2, merc: 3, food: 1 };
  // 値引き・無償供与の効き目: 疑惑度と戦意で別々に札を持つ。1回ごとに3週の札が付き、古い札から1枚ずつ消える
  // 残っている札の数で効き目が決まる(100・50・25・12.5%)。札が3枚ある時に重ねると、3枚の期限を今から3・6・9週に引き直す
  const DISC_EFF = [1, 0.5, 0.25, 0.125], DISC_CD = 9;
  function discQ(c, k) { const d = c.disc || (c.disc = { s: [], m: [] }); return d[k]; }
  function discEff(g, c, k) { const q = discQ(c, k); while (q.length && q[0] <= g.t) q.shift(); return DISC_EFF[Math.min(q.length, 3)]; }
  function discAdd(g, c, k) { const q = discQ(c, k); while (q.length && q[0] <= g.t) q.shift();
    if (q.length >= 3) { q.length = 0; q.push(g.t + DISC_CD, g.t + DISC_CD * 2, g.t + DISC_CD * 3); }
    else q.push(Math.max(q.length ? q[q.length - 1] : g.t, g.t) + DISC_CD); }
  // 値引き・無償供与の効果を適用する(疑惑度の下げ幅と戦意の上げ幅)。2回目以降で効き目が落ちていれば weak
  function discApply(g, c, sBase, mBase) {
    const es = sBase > 0 ? discEff(g, c, 's') : 1, em = mBase > 0 ? discEff(g, c, 'm') : 1;
    const ds = scaled(sBase, es), dm = scaled(mBase, em);
    if (sBase > 0) discAdd(g, c, 's'); if (mBase > 0) discAdd(g, c, 'm');
    // 戦意は満額で疑惑度だけ薄れた時は「少し薄かった」。それ以外で薄れた時は「薄かった」
    const note = (es < 1 || em < 1) ? (mBase > 0 && em === 1 ? L('効果は少し薄かった', 'It had a bit less effect') : L('効果は薄かった', 'It had little effect')) : '';
    return { ds, dm, weak: !!note, note };
  }
  // 売上の内訳: 原価より高く売れた分と、原価以下で渡した分(無償供与を含む)
  function book(g, c, item, price) {
    const cost = ITEMS[item].price * costRate(item), a = g.acct || (g.acct = { gainRev: 0, gain: 0, lossRev: 0, loss: 0 });
    if (price > cost) { a.gainRev += price; a.gain += price - cost; } else { a.lossRev += price; a.loss += cost - price; }
    const b = c.salesBy || (c.salesBy = { equip: { n: 0, v: 0, free: 0 }, merc: { n: 0, v: 0, free: 0 }, food: { n: 0, v: 0, free: 0 } });
    b[item].n++; b[item].v += price; if (price <= 0) b[item].free++;
  }
  const scaled = (v, e) => Math.ceil(v * e - 1e-9); // 小数点以下は切り上げ
  const sm = (v, item) => Math.sign(v) * Math.round(Math.abs(v) * SUSM[item]);
  function sell(g, cid, item, mult) {
    const c = g.c[cid], it = ITEMS[item];
    if (g.over) return { ok:false, text:'' };
    if (g.inv[item] < 1) return { ok:false, tier:'none', text: L(it.name + 'の在庫がありません。', 'No ' + it.name + ' in stock.') };
    mult = Math.round(mult * 100) / 100;
    if (mult <= 0) {
      // 無償供与: 疑惑度が大きく下がり、受け取った国の戦意が持ち直す
      take(g, item); deliver(g, c, item); g.stats.free++; g.supplied[item]++;
      const da = discApply(g, c, 4 * SUSM[item], 8), d = da.ds, mo = da.dm, en = da.weak ? '。' + da.note + '。' : ''; book(g, c, item, 0);
      c.susp = clamp(c.susp - d, -100, 100); c.morale = clamp(c.morale + mo, 0, 100); c.antiwar = clamp(c.antiwar - 2, 0, 100);
      news(g, L(c.name + 'へ' + it.name + '(' + it.lot + ')を無償供与。疑惑度 -' + d.toFixed(0) + '、戦意 +' + mo + (da.weak ? '。' + da.note : ''), 'Gave ' + it.name + ' (' + it.lot + ') to ' + c.name + ' for free. Suspicion -' + d.toFixed(0) + ', morale +' + mo + (da.weak ? '. ' + da.note : '')), 'sale');
      tl(g, L('あなたは' + c.name + 'へ' + it.name + 'を無償供与した。' + (da.weak ? da.note + '。' : ''), 'You gave ' + it.name + ' to ' + c.name + ' for free.' + (da.weak ? ' ' + da.note + '.' : '')), L(c.name + 'の疑惑度 -' + d.toFixed(0) + '、戦意 +' + mo, c.name + ': suspicion -' + d.toFixed(0) + ', morale +' + mo), 'act');
      return { ok:true, tier:'free', text: L(c.name + 'は無償供与を受け取った。疑惑度 -' + d.toFixed(0) + '、戦意 +' + mo + '、反戦感情 -2' + en, c.name + ' accepted the gift. Suspicion -' + d.toFixed(0) + ', morale +' + mo + ', anti-war -2' + (da.weak ? '. ' + da.note + '.' : '')) };
    }
    const price = Math.round(listPrice(g, item) * mult);
    const ratio = mult / fairMult(g, c, item);
    const own = shareOf(g, c.id), stalemate = own > 0.38 && own < 0.62;
    // 大幅な値引きは、通常なら断られる状況でも受け取られる
    let bypass = '';
    if (c.susp >= 80) { if (ratio <= 0.4 && stalemate) bypass = L('取引停止中だが、膠着した戦況で破格の申し出を受け入れた', 'had halted trade, but took a rock-bottom offer in the stalemate'); else { g.stats.stop++; return { ok:false, tier:'stop', text: L(c.name + 'は取引を停止している(疑惑度80以上)。戦況が膠着していれば、相場の4割以下の破格なら受け取る。', c.name + ' has halted trade (suspicion 80+). In a stalemate it still takes 40% of market or less.') }; } }
    if (c.morale < CFG.peaceLine) { if (ratio <= 0.3) bypass = bypass || L('戦う意思を失いかけていたが、破格の支援を受け取った', 'was losing the will to fight, but took the rock-bottom help'); else { g.stats.nomorale++; return { ok:false, tier:'nomorale', text: L(c.name + 'に購入の意思がない(戦意25未満)。相場の3割以下なら受け取る。', c.name + ' has no will to buy (morale under 25). It takes 30% of market or less.') }; } }
    const noNeed = item === 'food' ? c.foodLv >= CFG.foodFull : item === 'equip' ? c.noNeed : false;
    if (noNeed) { if (ratio <= 0.5) bypass = bypass || L('必要としていなかったが、安さにつられて買った', "didn't need it, but the low price won it over"); else { g.stats.noneed++; news(g, L(c.name + 'は「今は必要ない」と' + it.name + 'の購入を見送った。', c.name + ' passed on ' + it.name + ': "not needed now."'), 'bad'); return { ok:false, tier:'noneed', text: item === 'food' ? L(c.name + 'は兵糧が十分にあり(130%以上)、今は必要としていない。相場の5割以下なら買う。', c.name + ' has plenty of food (130%+) and does not need it. It buys at 50% of market or less.') : L(c.name + 'は装備が十分に揃っており、今は武器を必要としていない。相場の5割以下なら買う。', c.name + ' is fully armed and does not need arms now. It buys at 50% of market or less.') }; } }
    if (c.funds < price) { g.stats.nofunds++; return { ok:false, tier:'nofunds', text: L(c.name + 'は資金が足りない。', c.name + ' cannot afford it.') }; }
    let tier, ds, dm = 0, label;
    // 信頼(マイナスの疑惑度)があると、相場より高い価格も受け入れる。快く買っても信頼は少し消費される
    // 同じ価格なら、信頼が厚いほど疑惑度の上昇は小さい(逆転しない)
    const trust = -c.susp;
    const rich = c.funds >= CFG.richLine;
    const band = trust >= 40 ? { w: 1.45, r: 1.6, w1: 1, w2: 3, rd: 6 } : trust >= 15 ? { w: 1.3, r: 1.45, w1: 1, w2: 1, rd: 4 } : rich ? { w: 1.2, r: 1.4, w1: 0, w2: 0, rd: 2, rich: true } : { w: CFG.bandW, r: CFG.bandR, w1: 0, w2: 0, rd: 2 };
    if (ratio > band.r) { tier = 'refuse'; ds = 2; label = L('買わない', 'Refused'); }
    else if (ratio > band.w) { tier = 'reluctant'; ds = band.rd; label = L('しぶしぶ買う', 'Bought reluctantly'); }
    else if (ratio > 1.1) { tier = 'willing'; ds = ratio > 1.3 ? band.w2 : band.w1; label = band.rich ? L('資金に余裕があり普通に買う', 'Rich enough to buy anyway') : L('信頼から快く買う', 'Bought gladly out of trust'); }
    else if (ratio >= 0.9) { tier = 'normal'; ds = 0; label = L('普通に買う', 'Bought'); }
    else if (ratio >= 0.7) { tier = 'grateful'; ds = -2; label = L('ありがたく買う', 'Bought gratefully'); }
    else if (ratio > 0.4) { tier = 'thanks'; ds = -2; dm = 3; label = L('感謝される', 'Thankful'); }
    else { tier = 'debt'; ds = -3; dm = 4; label = L('恩義を感じる', 'Deeply indebted'); }
    let weak = false, wnote = '';
    if (ds < 0) { const da = discApply(g, c, -ds * SUSM[item], dm); ds = -da.ds; dm = da.dm; weak = da.weak; wnote = da.note; } // 値引きの効き目は続けるほど薄れる
    else ds = sm(ds, item); c.susp = clamp(c.susp + ds, -100, 100); c.morale = clamp(c.morale + dm, 0, 100);
    const sTxt = (ds === 0 ? '' : L('(疑惑度 ', ' (suspicion ') + (ds > 0 ? '+' : '') + ds + (dm ? L('、戦意 +', ', morale +') + dm : '') + ')') + (weak ? L('。', '. ') + wnote : '');
    if (tier === 'refuse') {
      g.stats.refuse++;
      news(g, L(c.name + 'は' + it.name + 'の購入を拒否した ×' + mult.toFixed(1) + sTxt, c.name + ' refused ' + it.name + ' at x' + mult.toFixed(1) + sTxt), 'bad');
      return { ok:false, tier, text: c.name + ': ' + label + sTxt };
    }
    take(g, item); if (item === 'food') g.foodRev += price; g.money += price; g.revenue += price; g.sales++; g.supplied[item]++; c.sold.push({ t: g.t, v: price, k: item }); c.bought[item] += 1; c.lastDeal[item] = { m: mult, t: g.t, tier, label }; // 前回の成約(画面に表示する)
    c.funds -= price; deliver(g, c, item); book(g, c, item, price);
    news(g, L(c.name + 'が' + it.name + '(' + it.lot + ')を' + fmt(price) + 'で購入: ' + label + sTxt, c.name + ' bought ' + it.name + ' (' + it.lot + ') for ' + fmt(price) + ': ' + label + sTxt), 'sale');
    if (bypass) tl(g, L(c.name + 'は' + bypass + '(' + it.name + ' ×' + mult.toFixed(2) + ')。', c.name + ' ' + bypass + ' (' + it.name + ' x' + mult.toFixed(2) + ').'), L('大幅な値引きは、断られる状況でも通ることがある', 'A deep discount can pass even when a sale would be refused'), 'act');
    return { ok:true, tier, text: L(c.name + ': ' + label + '。' + fmt(price) + 'の売上' + sTxt + (bypass ? '。' + bypass : ''), c.name + ': ' + label + '. Sold for ' + fmt(price) + sTxt + (bypass ? '. It ' + bypass : '')) };
  }

  function covert(g, op, cid, arg) {
    const o = OPS[op], c = g.c[cid], oc = g.c[other(cid)];
    if (g.over) return { ok:false, text:'' };
    if (g.cd[op] > 0) return { ok:false, text: L(o.name + 'は準備中です(あと' + Math.ceil(g.cd[op] / 3) + '週)。', o.name + ' is not ready (' + Math.ceil(g.cd[op] / 3) + ' more weeks).') };
    if (g.money < o.cost) return { ok:false, text: L('資金が足りません。', 'Not enough money.') };
    g.money -= o.cost; g.opsSpent += o.cost; g.cd[op] = o.cd; g.opsCount[op]++;
    if (op === 'assassin') {
      c.morale = clamp(c.morale + 15, 0, 100); c.antiwar = clamp(c.antiwar - 10, 0, 100);
      c.susp = clamp(c.susp + 30, -100, 100); oc.susp = clamp(oc.susp + (oc.susp <= -15 ? 5 : 10), -100, 100);
      news(g, L(c.name + 'の要人が死亡。' + c.name + '国内で' + oc.name + 'への報復を求める声が高まる。', 'A key figure of ' + c.name + ' is dead. Calls for revenge on ' + oc.name + ' grow.'), 'op');
      tl(g, L('あなたは' + c.name + 'で要人暗殺を仕掛けた。', 'You arranged an assassination in ' + c.name + '.'), L(c.name + 'の戦意 +15・反戦感情 -10、疑惑度 ' + c.name + '+30/' + oc.name + '+10', c.name + ': morale +15, anti-war -10. Suspicion ' + c.name + ' +30 / ' + oc.name + ' +10'), 'act');
      return { ok:true, text: L(c.name + 'の戦意 +15、反戦感情 -10。疑惑度 ' + c.name + '+30 / ' + oc.name + '+10', c.name + ': morale +15, anti-war -10. Suspicion ' + c.name + ' +30 / ' + oc.name + ' +10') };
    }
    if (op === 'rumor') {
      c.morale = clamp(c.morale + 8, 0, 100);
      c.susp = clamp(c.susp + 10, -100, 100); oc.susp = clamp(oc.susp + (oc.susp <= -15 ? 1.5 : 3), -100, 100);
      news(g, L(c.name + 'の報道に' + oc.name + '軍の非道を伝える記事が相次ぐ。', c.name + "'s press is full of stories of " + oc.name + ' atrocities.'), 'op');
      tl(g, L('あなたは' + c.name + 'で悪評を流布した。', 'You ran a smear campaign in ' + c.name + '.'), L(c.name + 'の戦意 +8、疑惑度 +10', c.name + ': morale +8, suspicion +10'), 'act');
      return { ok:true, text: L(c.name + 'の戦意 +8。疑惑度 ' + c.name + '+10 / ' + oc.name + '+3', c.name + ': morale +8. Suspicion ' + c.name + ' +10 / ' + oc.name + ' +3') };
    }
    if (op === 'consult') {
      const p = arg === 'pass' ? 'pass' : 'aggr', P = POLICY[p];
      c.policy = p; c.policyUntil = g.t + 30; c.susp = clamp(c.susp + 5, -100, 100);
      news(g, L(c.name + 'の司令部が方針を「' + P.name + '」に切り替えた。', c.name + ' HQ switched to a "' + P.name + '" strategy.'), 'op');
      tl(g, L('あなたは' + c.name + 'に「' + P.name + '」の作戦方針を進言した(10週間)。', 'You advised ' + c.name + ' to go "' + P.name + '" (10 weeks).'), p === 'aggr' ? L('装備・傭兵の相場が上がり、前線への出動と押す力が増す。反戦感情が上がり戦意は下がっていく', 'Arms and mercenary prices rise; deployment and push grow. Anti-war rises, morale falls') : L('装備・傭兵の相場が下がり、出動と押す力が減る(対抗の増援は行う)。反戦感情が下がり戦意は上がっていく', 'Arms and mercenary prices fall; deployment and push drop (still counters surges). Anti-war falls, morale rises'), 'act');
      return { ok:true, text: L(c.name + 'の方針を10週間「' + P.name + '」に変えた。' + (p === 'aggr' ? '相場+0.15、出動1.8倍、押す力+15%、反戦感情と戦意が徐々に悪化' : '相場-0.1、出動0.5倍、押す力-12%、反戦感情と戦意が徐々に改善') + '。' + c.name + 'の疑惑度 +5', c.name + ' goes "' + P.name + '" for 10 weeks. ' + (p === 'aggr' ? 'Price +0.15, deployment x1.8, push +15%; anti-war and morale worsen' : 'Price -0.1, deployment x0.5, push -12%; anti-war and morale improve') + '. ' + c.name + ' suspicion +5') };
    }
    if (op === 'loan') {
      g.money += o.cost; g.opsSpent -= o.cost; g.cd[op] = 0; g.opsCount[op]--;
      if (g.loans.some(l => l.cid === cid)) return { ok:false, text: L(c.name + 'への融資は1回までです。', 'Only one loan per nation.') };
      if (c.funds > CFG.loanLimit) return { ok:false, text: L(c.name + 'は資金に余裕があり、融資を必要としていない(資金30万以下で受け入れ)。', c.name + ' has money and needs no loan (accepts at 300K or less).') };
      g.money -= o.cost; g.cd[op] = o.cd; c.funds += o.cost; g.loanOut += o.cost;
      g.loans.push({ cid, amount: o.cost, t: g.t }); g.opsCount.loan++;
      news(g, L(c.name + 'へ' + fmt(o.cost) + 'を融資した。', 'Lent ' + fmt(o.cost) + ' to ' + c.name + '.'), 'op');
      tl(g, L('あなたは' + c.name + 'へ50万を融資した。', 'You lent 500K to ' + c.name + '.'), L(c.name + 'の資金が増え、武器を買えるようになった', c.name + ' has money to buy arms again'), 'act');
      return { ok:true, text: L(c.name + 'へ' + fmt(o.cost) + 'を融資。終戦時に利息20%付きで回収(崩壊した場合は回収不能)', 'Lent ' + fmt(o.cost) + ' to ' + c.name + '. Repaid with 20% interest at war end (lost if it collapses)') };
    }
    return { ok:false, text:'' };
  }

  // ---- events ----
  // イベントは発生時に対象国を決め、本文と効果を確定する(make)。
  // 優勢側3種 / 劣勢・削る4種 / 商人3種
  const lead = g => g.P >= 0.5 ? g.c.A : g.c.B;
  const lag = g => g.P >= 0.5 ? g.c.B : g.c.A;
  const soldSince = (c, t0) => c.sold.reduce((s, x) => s + (x.t >= t0 ? x.v : 0), 0);
  const EVENTS = [
    // ---- 優勢側がより優勢になる ----
    { id:1, cat:'lead', pre:false, w:g => 1,
      make:g => { const c = lead(g); return { text: L(c.name + 'の戦果が大きく報じられている。' + c.name + 'の戦意 +8', c.name + "'s victories make headlines. " + c.name + ' morale +8'),
        fire:() => { c.morale = clamp(c.morale + 8, 0, 100); } }; } },
    { id:2, cat:'lead', pre:true, delay:18, w:g => 1,
      make:g => { const c = lead(g); return { who: c.id, text: L(c.name + 'が約6週後に大規模な突破作戦を行う見込み。発動から8週間、' + c.name + 'の押す力 +25%', c.name + ' plans a major breakthrough in about 6 weeks. For 8 weeks, ' + c.name + ' push +25%'),
        fire:() => { c.pushMod = 1.25; c.pushModUntil = g.t + 24; news(g, L(c.name + 'が突破作戦を開始。8週間、押す力 +25%', c.name + ' launched its breakthrough. Push +25% for 8 weeks'), 'event'); } }; } },
    { id:3, cat:'lead', pre:true, delay:24, w:g => 1,
      make:g => { const c = lead(g); return { who: c.id, text: L('同盟国が約8週後に' + c.name + 'へ武器を供与する予定。' + c.name + 'の武器戦力 +8%', 'An ally will send arms to ' + c.name + ' in about 8 weeks. ' + c.name + ' arms +8%'),
        fire:() => { for (const k in EQ) c.eq[k] *= 1.08; totals(c); news(g, L('同盟国の武器が' + c.name + 'に到着。武器戦力 +8%', 'Allied arms reached ' + c.name + '. Arms +8%'), 'event'); } }; } },
    // ---- 劣勢側を支える / 強い側を削る ----
    { id:4, cat:'even', pre:true, delay:30, w:g => 1,
      make:g => { const c = g.c.A.morale >= g.c.B.morale ? g.c.A : g.c.B; return { who: c.id, text: L(c.name + 'の閣僚が約10週後に辞任する見込み。国内にはまだ出ていない。' + c.name + 'の戦意 -8、反戦感情 +5', 'A minister of ' + c.name + ' will resign in about 10 weeks; not yet public. ' + c.name + ' morale -8, anti-war +5'),
        fire:() => { c.morale = clamp(c.morale - 8, 0, 100); c.antiwar = clamp(c.antiwar + 5, 0, 100); news(g, L(c.name + 'の閣僚が辞任。戦意 -8、反戦感情 +5', 'A minister of ' + c.name + ' resigned. Morale -8, anti-war +5'), 'event'); } }; } },
    { id:5, cat:'even', pre:true, delay:30, w:g => 1,
      make:g => { const c = g.c.A.front / g.c.B.front <= 1 ? g.c.A : g.c.B; return { who: c.id, text: L(c.name + 'で大規模な徴兵令が準備されている。約10週後に発令。' + c.name + 'の軍人 +15,000、反戦感情 +5', c.name + ' prepares a mass draft, due in about 10 weeks. ' + c.name + ' soldiers +15,000, anti-war +5'),
        fire:() => { c.reserve += 15000; syncSoldiers(c); c.antiwar = clamp(c.antiwar + 5, 0, 100); news(g, L(c.name + 'で徴兵令。軍人 +15,000、反戦感情 +5', 'Draft in ' + c.name + '. Soldiers +15,000, anti-war +5'), 'event'); } }; } },
    { id:7, cat:'even', pre:false, w:g => 1,
      make:g => { const c = lag(g); return { text: L(c.name + 'の防衛戦が英雄的に報じられている。' + c.name + 'の戦意 +10', c.name + "'s defense is hailed as heroic. " + c.name + ' morale +10'),
        fire:() => { c.morale = clamp(c.morale + 10, 0, 100); } }; } },
    { id:8, cat:'even', pre:false, w:g => 1,
      make:g => { const c = g.c.A.power >= g.c.B.power ? g.c.A : g.c.B; return { text: L(c.name + 'の補給基地で大規模な事故。' + c.name + 'の武器戦力 -5%', 'Major accident at a ' + c.name + ' supply depot. ' + c.name + ' arms -5%'),
        fire:() => { for (const k in EQ) c.eq[k] *= 0.95; totals(c); } }; } },
    // ---- 商人に関わる ----
    { id:9, cat:'merchant', pre:false, w:g => 1,
      make:g => { const vA = soldSince(g.c.A, g.t - 60), vB = soldSince(g.c.B, g.t - 60), any = vA + vB > 0;
        const c = any ? (vA >= vB ? g.c.A : g.c.B) : (g.c.A.funds >= g.c.B.funds ? g.c.A : g.c.B);
        return { text: L('競合の武器商人が' + c.name + 'に参入した(' + (any ? '最近あなたが多く売っている国' : '資金の多い国') + ')。10週間、' + c.name + 'の相場 -20%', 'A rival dealer moved into ' + c.name + ' (' + (any ? 'your recent best customer' : 'the richer nation') + '). ' + c.name + ' prices -20% for 10 weeks'),
          fire:() => { c.priceMod = 0.8; c.priceModUntil = g.t + 30; } }; } },
    { id:10, cat:'merchant', pre:true, delay:39, w:g => 1,
      make:g => { const t0 = g.t; return { text: L('国際調査団が約13週後に報告書を公表する。これから13週の間に両国へ販売していると、両国の疑惑度が上がる(販売額の偏りが少ないほど大きく、最大 +25)。', 'An international inquiry reports in about 13 weeks. Selling to both nations in that time raises both suspicions (more if balanced, up to +25).'),
        fire:() => { const vA = soldSince(g.c.A, t0), vB = soldSince(g.c.B, t0);
          if (vA > 0 && vB > 0) { const d = Math.round(10 + 15 * Math.min(vA, vB) / Math.max(vA, vB));
            for (const c of [g.c.A, g.c.B]) c.susp = clamp(c.susp + d, -100, 100);
            news(g, L('国際調査団の報告書が公表された。両国への販売が指摘され、両国の疑惑度 +' + d, 'The inquiry report is out. Your sales to both sides were named. Both suspicions +' + d), 'event'); }
          else news(g, L('国際調査団の報告書が公表された。あなたへの指摘はなかった。', 'The inquiry report is out. You were not named.'), 'event'); } }; } },
    { id:11, cat:'merchant', pre:true, delay:39, w:g => 1,
      make:g => ({ text: L('第三国が約13週後に停戦の仲介を発表する予定。両国の戦意 -8', 'A third country will offer to mediate a ceasefire in about 13 weeks. Both morale -8'),
        fire:() => { g.c.A.morale = clamp(g.c.A.morale - 8, 0, 100); g.c.B.morale = clamp(g.c.B.morale - 8, 0, 100); news(g, L('第三国が停戦仲介を発表。両国の戦意 -8', 'A third country offered mediation. Both morale -8'), 'event'); } }) },
  ];

  // イベントの時期と種類は、プレイヤーの操作と無関係な専用の乱数で開戦時に決める(同じシードなら同じ順番・同じ時期)
  // 対象国は発生時の戦況で決まる(優勢側・劣勢側など)
  function eventSchedule(seed) {
    const r = rng(seed * 31 + 7), seq = []; let t = 20, last = null;
    while (t < CFG.cap) {
      const pool = EVENTS.filter(e => e.id !== last), e = pool[Math.floor(r() * pool.length)];
      seq.push({ t, id: e.id }); last = e.id; t += 33 + r() * 10;
    }
    return seq;
  }
  function pickEvent(g) { const x = g.evSeq[g.evIdx || 0]; g.evIdx = (g.evIdx || 0) + 1; return EVENTS.find(e => e.id === x.id); }
  function nextEventAt(g) { const x = g.evSeq && g.evSeq[g.evIdx || 0]; return x ? x.t : 1e9; }
  const PRE_LABEL = { 2: ['の突破作戦', ' breakthrough'], 3: ['へ同盟国の武器供与', ': allied arms'], 4: ['の閣僚辞任', ': minister quits'], 5: ['の徴兵令', ': draft'], 10: ['国際調査団の報告', 'Inquiry report'], 11: ['停戦の仲介', 'Ceasefire mediation'] };
  function triggerEvent(g, forced) {
    const e = forced || pickEvent(g); g.lastEvent = e.id; (g.evLog || (g.evLog = [])).push({ id: e.id, t: g.t });
    const m = e.make(g);
    if (e.pre) { schedule(g, g.t + e.delay, m.fire); news(g, L('[情報] ', '[Intel] ') + m.text, 'intel'); const who = m.who ? g.c[m.who].name : ''; const pl = PRE_LABEL[e.id]; g.pending.push({ at: g.t + e.delay, label: pl ? (e.id === 10 || e.id === 11 ? '' : who) + L(pl[0], pl[1]) : L('予定', 'Scheduled') }); }
    else { m.fire(); news(g, L('[速報] ', '[Flash] ') + m.text, 'event'); }
    g.modal = { kind:'event', title: e.pre ? L('事前情報', 'Advance Intel') : L('速報', 'Breaking News'), text:m.text, pre:e.pre };
    g.paused = true;
  }

  // 介入しなかった場合の戦争(同じ開戦条件で何もしない)
  function baseline(seed, rnd, sc, noCheck) {
    const b = makeGame(seed, { random: rnd, scenario: sc }); b.noBase = true; for (const k in b.prodOn) b.prodOn[k] = false;
    let guard = 0;
    while (!b.over && guard++ < 6000) { if (b.modal && b.modal.kind !== 'result') { b.modal = null; b.paused = false; } step(b, 0.1); }
    return { t: b.t, weeks: weekOf(b.t), cas: b.cas.A + b.cas.B, type: b.result ? b.result.type : 'cap' };
  }
  function retreat(g) { if (g.over) return; endGame(g, 'retreat', L('あなたは戦場から手を引いた。戦争はまだ続いている。', 'You pulled out. The war goes on without you.')); }
  // 緊急発注: 劣勢に追い込まれた国・戦況が急変した国から、期限付きの好条件の依頼が届く
  function checkOrder(g) {
    if (g.order || g.orderCount >= 4 || g.t < 30 || g.over) return;
    for (const id of ['A', 'B']) {
      const c = g.c[id], s = shareOf(g, id), trusted = c.susp <= -15;
      if (g.t - g.lastOrderT < (trusted ? 45 : 60)) continue;
      const past = g.history.length > 30 ? g.history[g.history.length - 31] : null;
      const sPast = past ? (id === 'A' ? past.share : 1 - past.share) : s;
      if (!(s < (trusted ? 0.42 : 0.38) || sPast - s > (trusted ? 0.06 : 0.08))) continue;
      if (c.susp >= 50 || c.morale < CFG.peaceLine) continue;
      const item = 'equip';
      const fair = fairMult(g, c, item), qty = 2, mult = Math.max(1.4, Math.ceil(fair * 1.25 * 20) / 20), unit = Math.round(listPrice(g, item) * mult);
      if (c.funds < unit * qty) continue;
      g.lastOrderT = g.t; g.orderCount++;
      g.modal = { kind: 'order', cid: id, item, qty, mult, unit, weeks: 4, fair };
      g.paused = true;
      news(g, L('[緊急発注] ' + c.name + 'から' + ITEMS[item].name + 'の至急の依頼が届いた。', '[Rush Order] ' + c.name + ' urgently wants ' + ITEMS[item].name + '.'), 'intel');
      return;
    }
  }
  function answerOrder(g, accept) {
    const m = g.modal; if (!m || m.kind !== 'order') return;
    g.modal = null; g.paused = false;
    if (!accept) { news(g, L(g.c[m.cid].name + 'の緊急発注を見送った。', 'Declined the rush order from ' + g.c[m.cid].name + '.'), 'info'); return; }
    g.order = { cid: m.cid, item: m.item, left: m.qty, qty: m.qty, mult: m.mult, deadline: g.t + m.weeks * 3 };
    news(g, L(g.c[m.cid].name + 'の緊急発注を引き受けた(' + m.weeks + '週以内に' + ITEMS[m.item].name + '×' + m.qty + ')。', 'Took the rush order from ' + g.c[m.cid].name + ' (' + ITEMS[m.item].name + ' x' + m.qty + ' within ' + m.weeks + ' weeks).'), 'sale');
  }
  function processOrder(g) {
    const o = g.order; if (!o) return;
    const c = g.c[o.cid], it = ITEMS[o.item];
    while (o.left > 0 && g.inv[o.item] > 0) {
      const price = Math.round(listPrice(g, o.item) * o.mult);
      if (c.funds < price) break;
      take(g, o.item); g.money += price; g.revenue += price; g.sales++; g.supplied[o.item]++; c.sold.push({ t: g.t, v: price, k: o.item, order: true });
      c.funds -= price; deliver(g, c, o.item); c.susp = clamp(c.susp - 2, -100, 100); o.left--;
      news(g, L(c.name + 'へ緊急発注の' + it.name + 'を' + fmt(price) + 'で納品(残り' + o.left + ')。', 'Delivered rush ' + it.name + ' to ' + c.name + ' for ' + fmt(price) + ' (' + o.left + ' left).'), 'sale');
    }
    if (o.left <= 0) { c.susp = clamp(c.susp - 8, -100, 100); c.morale = clamp(c.morale + 3, 0, 100); news(g, L(c.name + 'の緊急発注をすべて納品した。疑惑度 -8、戦意 +3', 'Rush order for ' + c.name + ' complete. Suspicion -8, morale +3'), 'sale'); tl(g, L(c.name + 'の緊急発注を期限内に納品した。', 'Delivered the rush order for ' + c.name + ' on time.'), L('必要な時に届けたことで、疑惑度 -8・戦意 +3', 'Help when it mattered: suspicion -8, morale +3'), 'act'); g.order = null; return; }
    if (g.t > o.deadline) { c.susp = clamp(c.susp + 10, -100, 100); news(g, L(c.name + 'への緊急発注は期限切れ。約束を破られたと受け取られた。疑惑度 +10', 'The rush order for ' + c.name + ' expired. It feels betrayed. Suspicion +10'), 'bad'); g.order = null; }
  }

  function endGame(g, type, text, loser) {
    g.over = true; g.paused = true;
    tl(g, text, type === 'peace' ? L('両国の戦意が25未満のまま約6週続いた', 'Both morale stayed under 25 for about 6 weeks') : type === 'cap' ? L('期限に達した', 'The deadline was reached') : type === 'retreat' ? L('あなたが撤退した', 'You withdrew') : (g.endWhy || L('戦意20未満・国土35%未満のまま約12週が過ぎた', 'Morale under 20 and land under 35% for about 12 weeks')), 'end');
    let repaid = 0, lost = 0;
    for (const l of g.loans) { if ((type === 'collapse' && l.cid === loser) || type === 'retreat') lost += l.amount; else repaid += l.amount * (1 + (l.rate != null ? l.rate : CFG.loanInterest)); }
    g.order = null;
    g.money += repaid;
    const fin = {}; for (const c of [g.c.A, g.c.B]) fin[c.id] = { terr: terrOf(shareOf(g, c.id)), morale: c.morale, antiwar: c.antiwar, front: c.front, reserve: c.reserve, eq: eqSuff(g, c), food: c.foodLv, funds: c.funds, susp: c.susp, sales: c.salesBy || null };
    g.result = { loser: loser || null, scName: (SCENARIOS[g.scenario] || {}).name || '', random: g.random, weeksLeft: Math.max(0, Math.round((CFG.cap - g.t) / 3)), final: fin, acct: Object.assign({ gainRev: 0, gain: 0, lossRev: 0, loss: 0 }, g.acct || {}), type, text, t: g.t, profit: g.money - CFG.startMoney, money: g.money, revenue: g.revenue, spent: g.spent, opsSpent: g.opsSpent, sales: g.sales, foodRev: g.foodRev, loanOut: g.loanOut, loanRepaid: repaid, loanLost: lost,
      leftover: Object.keys(g.inv).reduce((s, k) => s + g.inv[k] * ITEMS[k].price, 0), wasted: Object.keys(g.inv).reduce((s, k) => s + g.inv[k] * ITEMS[k].price * costRate(k), 0), stats: Object.assign({}, g.stats), timeline: g.tl.slice(), weeks: weekOf(g.t), cas: g.cas.A + g.cas.B, supplied: Object.assign({}, g.supplied), opsCount: Object.assign({}, g.opsCount), base: g.noBase ? null : baseline(g.seed, g.random, g.scenario) };
    news(g, text, 'end');
    g.modal = { kind:'result' };
  }

  // ---- 司令部: 遅れて届く前線の情報を見て、大量投入・対抗・総攻撃を判断する ----
  function sendWave(g, c, n, kind) {
    n = Math.floor(Math.min(n, c.reserve)); if (n < 3000) return false;
    c.reserve -= n; c.transit.push({ n, at: g.t + CFG.transitTime, t0: g.t, wave: kind, seen: {} });
    return true;
  }
  function commander(g) {
    const lag = g.fhist.length > 6 ? g.fhist[g.fhist.length - 7] : null; // 約2週前の観測
    for (const c of [g.c.A, g.c.B]) {
      const e = g.c[other(c.id)];
      // 総攻撃の発動
      if (c.massing && g.t >= c.massUntil) {
        c.massing = false;
        const n = c.reserve * 0.8;
        if (sendWave(g, c, n, 'offensive')) { c.morale = clamp(c.morale + 5, 0, 100); const k = fmt(Math.round(n / 1000) * 1000); news(g, L(c.name + 'が総攻撃を開始した。約' + k + '人が前線へ向かっている。', c.name + ' launched an all-out offensive. About ' + k + ' troops head to the front.'), 'event'); tl(g, L(c.name + 'が総攻撃を開始した(約' + k + '人)。', c.name + ' launched an all-out offensive (about ' + k + ').'), L('集結させた予備の8割を一斉に投入', '80% of the massed reserve sent at once')); }
        c.cool = g.t + 30; continue;
      }
      if (c.massing || g.t < c.cool || !lag) continue;
      const obsE = lag[e.id] + e.transit.filter(x => g.t - x.t0 >= 3).reduce((a, x) => a + x.n, 0);
      const own = c.front + transitSum(c);
      const ratio = own / Math.max(1, obsE);
      // 1. 数で大きく劣ったら、まとめて補充する
      if (c.policy !== 'pass' && ratio < (c.policy === 'aggr' ? 0.85 : 0.7) && c.reserve > 8000) {
        const n = Math.min(c.reserve * 0.7, obsE * 0.95 - own);
        if (n >= 6000 && sendWave(g, c, n, 'surge')) { const k = fmt(Math.round(n / 1000) * 1000); news(g, L('[観測] ' + c.name + 'が前線の劣勢を受け、約' + k + '人の大規模な増援を送り出した。', '[Observed] Outnumbered, ' + c.name + ' sent a surge of about ' + k + ' troops.'), 'intel'); tl(g, L(c.name + 'が大規模な増援を送った(約' + k + '人)。', c.name + ' sent a large surge (about ' + k + ').'), L('前線の兵数が相手の7割を下回ったため', 'Its front fell below 70% of the enemy')); c.cool = g.t + 24; continue; }
      }
      // 2. 相手の大波を確認したら、遅れて対抗する
      const big = e.transit.find(x => x.wave && x.n >= 8000 && g.t - x.t0 >= 3 && !x.seen[c.id]);
      if (big && c.reserve > 8000) {
        big.seen[c.id] = true;
        const n = Math.min(c.reserve * 0.6, big.n * 0.6);
        if (sendWave(g, c, n, 'counter')) { const k = fmt(Math.round(n / 1000) * 1000); news(g, L('[観測] ' + c.name + 'が' + e.name + 'の増援に対抗し、約' + k + '人を前線へ送った。', '[Observed] ' + c.name + ' countered ' + e.name + "'s surge with about " + k + ' troops.'), 'intel'); tl(g, L(c.name + 'が対抗の増援を送った(約' + k + '人)。', c.name + ' sent a counter-surge (about ' + k + ').'), L(e.name + 'の大規模な増援を確認したため', 'In response to ' + e.name + "'s surge")); c.cool = g.t + 18; continue; }
      }
      // 3. 予備が厚く、早く終わらせたい国は集結して総攻撃を準備する
      const sh = shareOf(g, c.id);
      if (c.policy !== 'pass' && g.t > 90 && c.reserve > c.front * 0.7 && c.antiwar >= 45 && sh >= 0.42 && c.morale >= 35) {
        c.massing = true; c.massUntil = g.t + 12;
        news(g, L('[情報] ' + c.name + 'が首都に予備兵を集結させている。前線への出動が止まっている。', '[Intel] ' + c.name + ' is massing reserves at the capital. Deployment has stopped.'), 'intel');
      }
    }
  }

  function step(g, dt) {
    if (g.over || g.paused) return;
    g.t += dt;
    // production
    for (const k in ITEMS) {
      if (k === 'food' ? !(g.foodQueue > 0) : !g.prodOn[k]) continue; // 兵糧は押した回数分だけ作る
      const it = ITEMS[k];
      if (g.inv[k] >= CFG.invCap) { g.prodT[k] = 0; continue; } // 倉庫が満杯の品目は生産が止まる
      g.prodT[k] += dt;
      if (g.prodT[k] >= it.interval / CFG.prodRate) {
        const cost = it.price * costRate(k);
        if (g.money >= cost) { g.money -= cost; g.spent += cost; g.inv[k]++; if (k === 'food') { g.foodLots.push(g.t); g.foodQueue--; } g.prodT[k] -= it.interval / CFG.prodRate; }
        else g.prodT[k] = it.interval / CFG.prodRate;
      }
    }
    // 兵糧は作ってから3か月で傷み、廃棄される
    while (g.foodLots.length && g.t - g.foodLots[0] >= CFG.foodLife) { g.foodLots.shift(); g.inv.food--; g.stats.spoiled = (g.stats.spoiled || 0) + 1; g.spoiledCost = (g.spoiledCost || 0) + ITEMS.food.price * costRate('food'); news(g, L('倉庫の兵糧1単位が傷み、廃棄した。', '1 unit of rations spoiled and was thrown out.'), 'bad'); }
    const A = g.c.A, B = g.c.B;
    // deliveries
    for (const c of [A, B]) {
      const oc = g.c[other(c.id)];
      c.pipeline = c.pipeline.filter(p => {
        if (p.at > g.t) return true;
        const it = ITEMS[p.item];
        if (it.type === 'mix') c.eq.all += it.power; c.front += it.soldiers; syncSoldiers(c); totals(c); c.lastArrival = g.t;
        if (p.item === 'food') c.foodLv = Math.min(CFG.foodMax, c.foodLv + foodRestore(c)); else c.morale = clamp(c.morale + p.value / 40000, 0, 100); const sAdd = CFG.seeSusp * SUSM[p.item]; oc.susp = clamp(oc.susp + sAdd, -100, 100); oc.seenSusp = (oc.seenSusp || 0) + sAdd; // 敵国に届いた装備は、こちらの国にも見える
        c.recv.push({ t: g.t, v: p.value }); if (c.recv.length > 40) c.recv.shift();
        c.threat = clamp(c.threat - p.value / CFG.threatK * CFG.threatSelf, 0, 100); // 自国に届くと警戒が和らぐ
        if (p.item !== 'food') schedule(g, g.t + CFG.threatLag, () => { oc.threat = clamp(oc.threat + p.value / CFG.threatK, 0, 100); }); // 兵糧は相手を警戒させない
        
        return false;
      });
    }
    // scheduled
    const due = g.sched.filter(s => s.at <= g.t); g.sched = g.sched.filter(s => s.at > g.t);
    due.forEach(s => s.fn());
    // combat
    // 出動: 後方の予備から前線へ。勢いは予備の数・戦意・兵糧で決まる
    for (const c of [A, B]) {
      c.sortieRate = c.massing ? 0 : pol(c).sortie * c.reserve * CFG.sortieBase * (0.3 + c.morale / 100) * foodFactor(g, c);
      c._sacc = (c._sacc || 0) + c.sortieRate * dt;
      if (c._sacc >= 1 && g.t - (c._lastSortie || 0) >= 0.5) { c._lastSortie = g.t;
        const n = Math.min(c.reserve, c._sacc); c._sacc = 0;
        if (n > 0) { c.reserve -= n; c.transit.push({ n, at: g.t + CFG.transitTime, t0: g.t }); }
      }
      c.transit = c.transit.filter(x => { if (x.at <= g.t) { c.front += x.n; return false; } return true; });
      syncSoldiers(c);
    }
    for (const c of [A, B]) {
      // 相場感の誤差は、数週ごとに新しい目標へゆっくり移る(急に跳ねない)
      if (g.t - c.estAt >= CFG.estEvery) { c.estTarget = g.r() * 0.24 - 0.12; c.estAt = g.t; }
      c.estNoise += (c.estTarget - c.estNoise) * (1 - Math.exp(-dt / CFG.estTau));
      // 最近の購入数は時間とともに薄れる
      for (const k in c.bought) c.bought[k] *= Math.exp(-dt / CFG.boughtTau);
      { const q = eqSuff(g, c); if (c.noNeed ? q < CFG.suffOff : q > CFG.suffOn) c.noNeed = !c.noNeed; } // 装備が十分なら、相場に関係なく「武器は不要」。判定に幅を持たせ、細かな切り替わりを防ぐ
      // 装備の自然な劣化(保管・整備による目減り)
      for (const k in EQ) c.eq[k] *= 1 - CFG.eqDecay * dt;
      totals(c);
      // 資金不足による前線からの離脱
      const dr = desertRate(c), lv = dr <= 0 ? 0 : (c.funds / c.initFunds < CFG.desertHeavy ? 2 : 1);
      if (dr > 0 && c.front > 0) { const n = Math.min(c.front, c.front * dr / 3 * dt); c.front -= n; c.deserted += n; syncSoldiers(c); }
      if (lv > c.desertLv) {
        if (lv === 1) { news(g, L(c.name + 'は資金が乏しく、給与の遅配で前線から兵が離れ始めた。', c.name + ' is short of money; unpaid soldiers start deserting.'), 'bad'); tl(g, L(c.name + 'の前線で兵の離脱が始まった。', 'Desertion began on ' + c.name + "'s front."), L('資金が初期の25%を下回った。予備から送っても、届くまでの間は前線が薄くなる', 'Funds fell below 25% of the start. The front thins until reserves arrive')); }
        else { news(g, L(c.name + 'の資金が底をつき、前線から兵が大量に離脱している。', c.name + ' is broke; soldiers are deserting en masse.'), 'bad'); tl(g, L(c.name + 'の前線で兵の離脱が深刻になった。', 'Desertion on ' + c.name + "'s front turned severe."), L('資金が初期の5%を下回った', 'Funds fell below 5% of the start')); }
      }
      c.desertLv = lv;
    }
    const eA = eff(A, g), eB = eff(B, g); A.push = eA; B.push = eB;
    const pA = eA / (eA + eB || 1);
    { const d = (pA - 0.5) * 2; g.P = clamp(g.P + CFG.frontSpeed * d * (1 + 2.5 * Math.abs(d)) * dt, 0.05, 0.95); }
    const sA = g.P;
    const losses = {};
    for (const [c, eo, s] of [[A, eB, sA], [B, eA, 1 - sA]]) {
      const ls = Math.min(c.front, CFG.lossS * eo * dt);
      if (c.power > 0) { const base = CFG.lossP * eo * dt / c.power;
        for (const k in EQ) c.eq[k] = Math.max(0, c.eq[k] - c.eq[k] * base * EQ[k].wear); }
      c.front -= ls; syncSoldiers(c); totals(c); g.cas[c.id] += ls;
      losses[c.id] = { ls, s };
    }
    const vol = g.t < 180 ? 1 : 1 + (g.t - 180) / 60 * 1.5;
    for (const c of [A, B]) {
      const { ls, s } = losses[c.id];
      // economy
      const tm = g.t < c.taxModUntil ? c.taxMod : 1;
      if (c.policy !== 'normal') {
        c.antiwar = clamp(c.antiwar + pol(c).anti * dt, 0, 100); c.morale = clamp(c.morale + pol(c).morale * dt, 0, 100);
        if (g.t >= c.policyUntil) { news(g, L(c.name + 'の司令部は方針を「保守」に戻した。', c.name + ' HQ returned to a "Standard" strategy.'), 'info'); tl(g, L(c.name + 'の方針が「保守」に戻った。', c.name + "'s strategy returned to Standard."), L('戦闘コンサルの効果が切れた', 'The consulting effect wore off')); c.policy = 'normal'; }
      }
      c.funds += (c.taxBase * tm - c.soldiers * CFG.upkeep) * dt;
      if (c.funds < 0) c.funds = 0;
      const rec = c.recruitBase * (1 - c.antiwar / 100) * dt;
      c.reserve += rec; syncSoldiers(c);
      // morale
      const bat = batMorale(s);
      c.morale = clamp(c.morale + ((-0.06 - (c.antiwar - 30) * 0.004 + bat) * vol + (c.morale > 70 ? -(c.morale - 70) * 0.01 : 0)) * dt, 0, 100);
      // 兵糧
      // 兵糧の備蓄: 自給できない分だけ減り、自給できていれば100%までゆっくり戻る
      { const ss = selfSuff(g, c), d = (ss - 1) * CFG.foodDrain * 100 * dt;
        if (d < 0) c.foodLv = Math.max(0, c.foodLv + d); else if (c.foodLv < 100) c.foodLv = Math.min(100, c.foodLv + d); }
      { const p = foodPen(c); if (p > 0) { g.stats.foodNeglect += dt; c.morale = clamp(c.morale - CFG.foodMor * p * dt, 0, 100); c.antiwar = clamp(c.antiwar + CFG.foodAnti * p * dt, 0, 100); } }
      const lossFrac = c.front > 0 ? ls / Math.max(c.front, 20000) / dt * 0.5 : 0;
      c.antiwar = clamp(c.antiwar + (0.03 + lossFrac * 20) * dt, 0, 100);
      c.threat = clamp(c.threat - CFG.threatDecay * dt, 0, 100);
      const busy = 1 + Math.max(0, 0.5 - s) * 6; c.susp = c.susp > 0 ? Math.max(0, c.susp - 0.1 * busy * dt) : Math.min(0, c.susp + 0.1 * dt);
    }
    for (const k in g.cd) g.cd[k] = Math.max(0, g.cd[k] - dt);
    g.stats.maxSusp = Math.max(g.stats.maxSusp, A.susp, B.susp);
    if ((g.plIdx || 0) < PRICE_CHECKS.length && g.t >= PRICE_CHECKS[g.plIdx || 0]) {
      g.plIdx = (g.plIdx || 0) + 1;
      const broken = [A, B].filter(c => c.morale < CFG.peaceLine);
      if (broken.length) {
        const bn = broken.map(c => c.name).join(L('・', ' and '));
        news(g, L('[相場] ' + bn + 'が戦意を失っており、装備の需要は伸びなかった。定価は据え置き(×' + priceStep(g).toFixed(1) + ')。', '[Market] ' + bn + ' lost the will to fight; demand stalled. List price unchanged (x' + priceStep(g).toFixed(1) + ').'), 'info');
        tl(g, L('定価の見直しで、定価は据え置かれた(×' + priceStep(g).toFixed(1) + ')。', 'Price review: list price unchanged (x' + priceStep(g).toFixed(1) + ').'), L(bn + 'の戦意が25を下回っていたため', 'Morale of ' + bn + ' was under 25'));
      } else {
        g.pl = Math.round((priceStep(g) + 0.1) * 10) / 10;
        const ps = g.pl, n = weekOf(g.t), yr = Math.floor(n / 48) + 1, mo = Math.floor(n / 4) % 12 + 1;
        const txt = L({ 1.1: '戦争は' + yr + '年目の' + mo + '月を迎え、長期化の様相を見せている。両国の消耗が進み、装備の需要が高まっている。定価が元の1.1倍に上昇した。',
          1.2: '開戦から' + yr + '年目の' + mo + '月。各地の工場は前線の消耗に追いつかず、装備はどこでも品薄だ。定価が元の1.2倍に上昇した。',
          1.3: '戦争は泥沼と化している。装備の調達は奪い合いの様相を呈し、相場は高騰を続けている。定価が元の1.3倍に上昇した。' }[ps],
          { 1.1: 'The war drags into year ' + yr + '. Both sides are worn down and arms are in demand. List price is now x1.1.',
          1.2: 'Year ' + yr + ' of the war. Factories cannot keep up with losses; arms are scarce everywhere. List price is now x1.2.',
          1.3: 'The war is a quagmire. Buyers fight over every shipment and prices keep climbing. List price is now x1.3.' }[ps]);
        news(g, L('[相場] ', '[Market] ') + txt, 'event'); tl(g, L('装備の定価が元の' + ps.toFixed(1) + '倍に上昇した。', 'List price rose to x' + ps.toFixed(1) + '.'), L('両国とも戦意を保ったまま戦争が長期化し、需要が高まったため(生産費は据え置き)', 'A long war with both sides still fighting raised demand (production cost unchanged)'));
        g.pendingModal = { kind: 'event', title: L('相場の変動', 'Market Shift'), text: txt + L('生産費は据え置きのため、ここからの販売は利幅が大きくなる。', ' Production cost is unchanged, so margins grow from here.'), pre: false };
      }
    }
    if (g.pendingModal && !g.modal) { g.modal = g.pendingModal; g.pendingModal = null; g.paused = true; }
    // history (1/s)
    if (Math.floor(g.t) !== Math.floor(g.t - dt)) { g.fhist.push({ A: A.front, B: B.front }); milestones(g); }
    if (g.t >= g.nextCmd) { g.nextCmd = g.t + 5.3; commander(g); } // 判断の間隔は週の区切りと揃えない
    if (Math.floor(g.t) !== Math.floor(g.t - dt)) g.history.push({ t: Math.floor(g.t), share: sA, terr: terrOf(sA), mA: A.morale, mB: B.morale, money: g.money });
    // end checks
    for (const c of [A, B]) {
      const s = c.id === 'A' ? sA : 1 - sA;
      if (s < CFG.capitalLine) {
        const w = g.c[other(c.id)];
        g.endWhy = L(c.name + 'は国土の大半を失い、首都が陥落した', c.name + ' lost most of its land and its capital fell');
        g.endKind = 'capital';
        return endGame(g, 'collapse', L(c.name + 'の戦線が崩壊。' + w.name + 'の勝利で戦争は終結した。', c.name + "'s front collapsed. The war ends in victory for " + w.name + '.'), c.id);
      }
    }
    for (const c of [A, B]) {
      const own = shareOf(g, c.id);
      // 戦線の後退を知らせる
      const lv = own < 0.2 ? 3 : own < 0.28 ? 2 : own < 0.36 ? 1 : 0;
      if (lv > c.warned) { c.warned = lv; news(g, L(['', c.name + 'の戦線が後退している。', c.name + 'は国土の大半を失いつつある。首都が近い。', c.name + 'の首都まで敵が迫っている。崩壊は目前だ。'][lv], ['', c.name + "'s front is falling back.", c.name + ' is losing most of its land. The capital is near.', 'The enemy is at ' + c.name + "'s capital. Collapse is imminent."][lv]), 'bad'); }
      if (lv < c.warned - 1) c.warned = lv;
      // 敗北の危機: 国土20%を下回ったら時を止めて知らせる(23%を上回るまで再び知らせない)
      const tr = terrOf(own);
      if (tr < CFG.defeatAlert && !c.defeatAlert) { c.defeatAlert = true; alertModal(g, L('敗北の危機', 'On the Brink'), L('これ以上戦線を押し込まれると、' + c.name + 'は敗北してしまう。', 'If the front is pushed back any further, ' + c.name + ' will be defeated.'), L('警告', 'Warning')); tl(g, L(c.name + 'の国土が20%を下回った。', c.name + "'s land fell below 20%."), L('これ以上押し込まれると首都が陥落し、戦争は終わる', 'Any further and the capital falls, ending the war'), 'bad'); }
      else if (tr > CFG.defeatAlert + 0.03) c.defeatAlert = false;
      // 戦意が尽き、劣勢の国は降伏する(条件が約12週続くと降伏。途切れると数え直し)
      if (c.morale < CFG.surrMorale && tr < CFG.surrenderLine) {
        if (c.surT === 0 && !(g.t - (c.surAlertT == null ? -1e9 : c.surAlertT) < 12)) { c.surAlertT = g.t; alertModal(g, L('降伏の兆し', 'Signs of Surrender'), L('戦意が低く、国土も奪われ続け、' + c.name + 'は降伏を考え始めた。', 'With morale low and land slipping away, ' + c.name + ' has begun to consider surrender.'), L('警告', 'Warning')); tl(g, L(c.name + 'が降伏を考え始めた。', c.name + ' began to consider surrender.'), L('戦意20未満・国土35%未満。この状態が約12週続くと降伏する', 'Morale under 20, land under 35%. 12 weeks of this means surrender'), 'bad'); }
        c.surT += dt; if (c.surT >= CFG.surrHold) { g.endKind = 'surrender'; return endGame(g, 'collapse', L(c.name + 'は戦う意思を失い、降伏した。' + g.c[other(c.id)].name + 'の勝利で戦争は終結した。', c.name + ' lost the will to fight and surrendered. The war ends in victory for ' + g.c[other(c.id)].name + '.'), c.id); } }
      else c.surT = 0;
    }
    if (A.morale < CFG.peaceLine && B.morale < CFG.peaceLine) {
      if (g.peaceT === 0 && !(g.t - (g.peaceAlertT == null ? -1e9 : g.peaceAlertT) < 12)) { g.peaceAlertT = g.t; alertModal(g, L('講和の動き', 'Peace Talks'), L('両国の戦意が尽きて、上層部が講和に乗り出そうとしている。', 'Both sides are exhausted; their leaders are moving toward peace.'), L('警告', 'Warning')); tl(g, L('両国の上層部が講和に動き始めた。', 'Both leaderships began moving toward peace.'), L('両国の戦意25未満。この状態が約6週続くと講和が成立する', 'Both morale under 25. 6 weeks of this means peace'), 'bad'); }
      g.peaceT += dt;
      if (g.peaceT >= CFG.peaceHold) return endGame(g, 'peace', L('両国の戦意が尽き、講和が成立した。', 'Both sides ran out of will to fight. Peace was signed.'));
    } else g.peaceT = 0;
    if (g.t >= CFG.cap - CFG.capWarn && !g.capWarned) { g.capWarned = true; alertModal(g, L('強制講和の予告', 'Imposed Peace Ahead'), L('12週後に国際機関が乗り出し、戦争は強制的に講和となる。', 'In 12 weeks, international bodies will step in and impose peace.'), L('予告', 'Notice')); }
    if (g.alertQ && g.alertQ.length && !g.modal) { g.modal = g.alertQ.shift(); g.paused = true; }
    if (g.t >= CFG.cap) return endGame(g, 'cap', L('3年目12月、国際社会の圧力により強制的に講和が結ばれた。', 'Y3 December: under international pressure, peace was imposed.'));
    // events
    processOrder(g);
    if (Math.floor(g.t) !== Math.floor(g.t - dt)) checkOrder(g);
    if (!g.modal && g.t >= nextEventAt(g)) triggerEvent(g);
  }

  // 暦: 3秒=1週、4週=1か月、12か月=1年(48週)
  function weekOf(t) { return Math.floor(t / 3); }
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dateOf(t) { const n = weekOf(t), y = Math.floor(n / 48) + 1, m = Math.floor(n / 4) % 12, w = n % 4 + 1; return L(y + '年目 ' + (m + 1) + '月' + w + '週', 'Y' + y + ' ' + MON[m] + ' W' + w); }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  applyLang();

  root.BothSides = { L, LANG, setLang, discEff, alertModal, collapseRisk, priceBand, priceLabel, foodRestore, foodPen, foodMult, eqSuff, eqTarget, eventSchedule, SCENARIOS, needParts, BASE, terrOf, territory, desertRate, EVENTS, triggerEvent, POLICY, crewFill, SUSM, nextPriceCheck, pressure, transitSum, retreat, answerOrder, baseline, weekOf, dateOf, ITEMS, EQ, comp, itemBonus, priceStep, listPrice, selfSuff, shortage,  OPS, CFG, newGame, step, sell, covert, fairMult, demand, estimate, shareOf, eff, fmt, other };
})(typeof window !== 'undefined' ? window : globalThis);

