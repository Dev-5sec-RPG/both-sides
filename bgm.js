// Both Sides — background music. One looping track at a time; a change of track fades the old one out (1 s)
// and then starts the new one. Seamless loops through Web Audio when the files can be read as data
// (served over http(s), or in the desktop app); otherwise falls back to <audio loop>.
(() => {
  // per-track gain: brings every track to about the same loudness (≈ -24 LUFS), under the voice and effects
  // len: samples at 44.1 kHz (the loop length). Each track has an .ogg and an .m4a (AAC) copy: browsers that cannot
  // read Ogg (Safari before iOS 18.4 / macOS 15.4) use the .m4a
  const TRACKS = {
    title: { src: 'media/bgm/title', gain: 0.32, len: 2116800 },
    bgm1: { src: 'media/bgm/bgm1', gain: 0.41, len: 2822400 },
    bgm2: { src: 'media/bgm/bgm2', gain: 0.41, len: 4233600 },
    bgm3: { src: 'media/bgm/bgm3', gain: 0.37, len: 2116800 },
    bgm4: { src: 'media/bgm/bgm4', gain: 0.42, len: 2822400 },
  };
  const OGG = (() => { try { return !!new Audio().canPlayType('audio/ogg; codecs="vorbis"'); } catch (e) { return false; } })();
  // phones: only the playing track and the next one are kept decoded (all five would take about 50 MB)
  const NEXT = { title: 'bgm1', bgm1: 'bgm2', bgm2: 'bgm3', bgm3: 'bgm4', bgm4: 'title' };
  function keepOnly(name) { for (const k in TRACKS) if (k !== name && k !== NEXT[name]) { delete buf[k]; delete loading[k]; } load(NEXT[name]); }
  const fileOf = (name, ext) => TRACKS[name].src + '.' + (ext || (OGG ? 'ogg' : 'm4a'));
  const FADE_OUT = 1.0, FADE_IN = 0.4, DUCK = 0.45;
  let ac = null, master = null, mode = null;   // mode: 'wa' (Web Audio) or 'el' (<audio>)
  const buf = {}, loading = {};
  let cur = null;          // { name, stop(t), setGain(v, t) }
  let wantName = null, wantDuck = false, enabled = true, switching = false, unlocked = false;

  function ctx() {
    if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ac = new C(); master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination); }
    return ac;
  }
  function fetchDecode(url) {
    return new Promise(res => {
      const x = new XMLHttpRequest();
      try { x.open('GET', url); x.responseType = 'arraybuffer'; } catch (e) { res(null); return; }
      x.onload = () => {
        if (!x.response || !x.response.byteLength || !ctx()) { res(null); return; }
        try { const p = ac.decodeAudioData(x.response, b => res(b), () => res(null)); if (p && p.catch) p.catch(() => res(null)); } catch (e) { res(null); }
      };
      x.onerror = () => res(null);
      try { x.send(); } catch (e) { res(null); }
    });
  }
  function load(name) {
    if (buf[name] || loading[name]) return loading[name] || Promise.resolve(buf[name]);
    // the Ogg first where it is supported; if it cannot be decoded, the AAC copy
    loading[name] = fetchDecode(fileOf(name)).then(b => b || (OGG ? fetchDecode(fileOf(name, 'm4a')) : null)).then(b => { if (b) buf[name] = b; return b; });
    return loading[name];
  }
  // ---- one playing track, either kind ----
  function startWA(name, level) {
    const g = ac.createGain(), s = ac.createBufferSource();
    const b = buf[name], n = Math.round(TRACKS[name].len * b.sampleRate / 44100);
    // an AAC copy may keep the encoder's lead-in (up to 1024 samples) and pad the end: loop only the music itself
    const lead = b.length > n ? Math.min(1024, b.length - n) : 0;
    s.buffer = b; s.loop = true; s.connect(g); g.connect(master);
    if (b.length !== n) { s.loopStart = lead / b.sampleRate; s.loopEnd = (lead + Math.min(n, b.length - lead)) / b.sampleRate; }
    const t = ac.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + FADE_IN);
    s.start(0, lead / b.sampleRate);
    return { name, setGain(v) { const n = ac.currentTime; g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.linearRampToValueAtTime(v, n + 0.5); },
      stop(sec) { const n = ac.currentTime; g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.linearRampToValueAtTime(0, n + sec); try { s.stop(n + sec + 0.05); } catch (e) { /* stopped */ } } };
  }
  function startEL(name, level) {
    const a = new Audio(fileOf(name)); a.loop = true; a.volume = 0; let target = level, timer = null;
    const ramp = (to, sec, then) => { clearInterval(timer); const from = a.volume, t0 = performance.now();
      timer = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / (sec * 1000)); a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k >= 1) { clearInterval(timer); if (then) then(); } }, 30); };
    const p = a.play(); if (p && p.catch) p.catch(() => { unlocked = false; });
    ramp(target, FADE_IN);
    return { name, el: a, setGain(v) { target = v; ramp(v, 0.5); }, stop(sec) { ramp(0, sec, () => { a.pause(); a.src = ''; }); } };
  }
  function level(name) { return TRACKS[name].gain * (wantDuck ? DUCK : 1); }
  async function start(name) {
    if (mode === null) { const c = ctx(); const b = c ? await load(name) : null; mode = b ? 'wa' : 'el'; }
    if (mode === 'wa') { if (!buf[name]) await load(name); if (!buf[name]) { mode = 'el'; return startEL(name, level(name)); } if (ac.state === 'suspended') { try { await ac.resume(); } catch (e) { /* needs a gesture */ } } const t = startWA(name, level(name)); keepOnly(name); return t; }
    return startEL(name, level(name));
  }
  // bring what is playing in line with what is wanted
  async function settle() {
    if (switching) return;
    const target = enabled ? wantName : null;
    if (cur && cur.name === target) { cur.setGain(level(target)); return; }
    switching = true;
    try {
      if (cur) { cur.stop(FADE_OUT); cur = null; await new Promise(r => setTimeout(r, FADE_OUT * 1000)); }
      else if (!unlocked) return;
      const t = enabled ? wantName : null;
      if (t && unlocked) cur = await start(t);
    } finally { switching = false; }
    // the wish changed while switching: go again (only when sound is allowed, or nothing could start anyway)
    if (unlocked && (enabled ? wantName : null) !== (cur ? cur.name : null)) setTimeout(settle, 0);
  }
  let lastKey = '';
  function want(name, duck) {
    const key = (enabled ? name : '') + '|' + (duck ? 1 : 0);
    wantName = name || null; wantDuck = !!duck;
    if (key === lastKey) return; lastKey = key; settle();
  }
  // browsers only allow sound after a tap / click / key press. Phones count the end of a tap (touchend, click), not its
  // start, so every such event tries again until the audio is really running (iOS also suspends it after a call or
  // when the app was in the background).
  function go() { if (!unlocked) { unlocked = true; lastKey = ''; settle(); } }
  function unlock() {
    const c = ctx();
    if (!c) { go(); return; }
    if (c.state !== 'running') {
      try { const p = c.resume(); if (p && p.then) p.then(() => { if (c.state === 'running') go(); }).catch(() => {}); } catch (e) { /* not now */ }
      try { const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); } catch (e) { /* older iOS needs a sound started inside the tap */ }
    }
    if (c.state === 'running') go();
    if (cur && cur.el && cur.el.paused) { const p = cur.el.play(); if (p && p.catch) p.catch(() => {}); }
  }
  ['touchend', 'click', 'pointerup', 'mousedown', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, { capture: true }));
  // the desktop app starts with sound allowed
  if (navigator.userActivation && navigator.userActivation.hasBeenActive) unlocked = true;
  try { const c = ctx(); if (c && c.state === 'running') unlocked = true; } catch (e) { /* no audio */ }
  setTimeout(() => { load('title'); load('bgm1'); }, 300);
  window.BSBGM = {
    want,
    get playing() { return cur ? cur.name : null; },
    get mode() { return mode; },
    set enabled(v) { v = !!v; if (v !== enabled) { enabled = v; lastKey = ''; settle(); } },
    get enabled() { return enabled; },
  };
})();
