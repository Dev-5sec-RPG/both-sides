// Both Sides — background music. One looping track at a time; a change of track fades the old one out (1 s)
// and then starts the new one. Seamless loops through Web Audio when the files can be read as data
// (served over http(s), or in the desktop app); otherwise falls back to <audio loop>.
(() => {
  // per-track gain: brings every track to about the same loudness (≈ -24 LUFS), under the voice and effects
  const TRACKS = {
    title: { src: 'media/bgm/title.ogg', gain: 0.32 },
    bgm1: { src: 'media/bgm/bgm1.ogg', gain: 0.41 },
    bgm2: { src: 'media/bgm/bgm2.ogg', gain: 0.41 },
    bgm3: { src: 'media/bgm/bgm3.ogg', gain: 0.37 },
    bgm4: { src: 'media/bgm/bgm4.ogg', gain: 0.42 },
  };
  const FADE_OUT = 1.0, FADE_IN = 0.4, DUCK = 0.45;
  let ac = null, master = null, mode = null;   // mode: 'wa' (Web Audio) or 'el' (<audio>)
  const buf = {}, loading = {};
  let cur = null;          // { name, stop(t), setGain(v, t) }
  let wantName = null, wantDuck = false, enabled = true, switching = false, unlocked = false;

  function ctx() {
    if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ac = new C(); master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination); }
    return ac;
  }
  function load(name) {
    if (buf[name] || loading[name]) return loading[name] || Promise.resolve(buf[name]);
    loading[name] = new Promise(res => {
      const x = new XMLHttpRequest();
      try { x.open('GET', TRACKS[name].src); x.responseType = 'arraybuffer'; } catch (e) { res(null); return; }
      x.onload = () => {
        if (!x.response || !x.response.byteLength || !ctx()) { res(null); return; }
        ac.decodeAudioData(x.response, b => { buf[name] = b; res(b); }, () => res(null));
      };
      x.onerror = () => res(null);
      try { x.send(); } catch (e) { res(null); }
    });
    return loading[name];
  }
  // ---- one playing track, either kind ----
  function startWA(name, level) {
    const g = ac.createGain(), s = ac.createBufferSource();
    s.buffer = buf[name]; s.loop = true; s.connect(g); g.connect(master);
    const t = ac.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + FADE_IN);
    s.start();
    return { name, setGain(v) { const n = ac.currentTime; g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.linearRampToValueAtTime(v, n + 0.5); },
      stop(sec) { const n = ac.currentTime; g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.linearRampToValueAtTime(0, n + sec); try { s.stop(n + sec + 0.05); } catch (e) { /* stopped */ } } };
  }
  function startEL(name, level) {
    const a = new Audio(TRACKS[name].src); a.loop = true; a.volume = 0; let target = level, timer = null;
    const ramp = (to, sec, then) => { clearInterval(timer); const from = a.volume, t0 = performance.now();
      timer = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / (sec * 1000)); a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k >= 1) { clearInterval(timer); if (then) then(); } }, 30); };
    const p = a.play(); if (p && p.catch) p.catch(() => { unlocked = false; });
    ramp(target, FADE_IN);
    return { name, el: a, setGain(v) { target = v; ramp(v, 0.5); }, stop(sec) { ramp(0, sec, () => { a.pause(); a.src = ''; }); } };
  }
  function level(name) { return TRACKS[name].gain * (wantDuck ? DUCK : 1); }
  async function start(name) {
    if (mode === null) { const c = ctx(); const b = c ? await load(name) : null; mode = b ? 'wa' : 'el'; }
    if (mode === 'wa') { if (!buf[name]) await load(name); if (!buf[name]) { mode = 'el'; return startEL(name, level(name)); } if (ac.state === 'suspended') { try { await ac.resume(); } catch (e) { /* needs a gesture */ } } return startWA(name, level(name)); }
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
  // browsers only allow sound after the first tap / key press
  function unlock() {
    if (unlocked) return; unlocked = true;
    const c = ctx(); if (c && c.state === 'suspended') c.resume().catch(() => {});
    lastKey = ''; settle();
  }
  ['pointerdown', 'keydown', 'touchend'].forEach(ev => window.addEventListener(ev, unlock, { capture: true }));
  // the desktop app starts with sound allowed
  if (navigator.userActivation && navigator.userActivation.hasBeenActive) unlocked = true;
  try { const c = ctx(); if (c && c.state === 'running') unlocked = true; } catch (e) { /* no audio */ }
  for (const k in TRACKS) setTimeout(() => load(k), 300);
  window.BSBGM = {
    want,
    get playing() { return cur ? cur.name : null; },
    get mode() { return mode; },
    set enabled(v) { v = !!v; if (v !== enabled) { enabled = v; lastKey = ''; settle(); } },
    get enabled() { return enabled; },
  };
})();
