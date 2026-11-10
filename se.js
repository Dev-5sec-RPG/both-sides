// Both Sides — sound effects. All sounds are synthesised with the Web Audio API; no audio files.
//  1 hover  2 click  3 prodOn (production on / make rations)  4 prodOff  5 sell (also when refused)  6 covert  7 start (war begins)
//  8 page (open/close a window, tutorial next)  9 refused  10 news (news flash, warnings)  11 end (war over)
//  12 steps (footsteps of the passing shadow, stereo)
window.BSSE = (() => {
  let ac = null, master = null, verb = null, vol = 0.8;
  function init() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = vol;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ac.destination);
    // a room: a generated impulse response, darker toward the tail
    const len = ac.sampleRate * 2.4, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len; lp += (Math.random() * 2 - 1 - lp) * (0.5 - 0.42 * t); d[i] = lp * Math.pow(1 - t, 2.6); } }
    verb = ac.createConvolver(); verb.buffer = ir; const vg = ac.createGain(); vg.gain.value = 0.55; verb.connect(vg); vg.connect(master);
  }
  const now = () => ac.currentTime;
  let noiseBuf = null;
  function noise() { if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }
  function out(node, gain, wet) { const g = ac.createGain(); g.gain.value = gain; node.connect(g); g.connect(master); if (wet && verb) { const w = ac.createGain(); w.gain.value = wet; node.connect(w); w.connect(verb); } return g; }
  function env(g, t, a, peak, d, sus = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(sus, t + a + d); }
  // short filtered noise tick
  function tick(t, freq, q, dur, level, type = 'bandpass', wet = 0) {
    const n = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q; n.connect(f); f.connect(g); out(g, 1, wet);
    env(g, t, 0.001, level, dur); n.start(t); n.stop(t + dur + 0.05);
  }
  function tone(t, freq, type, dur, level, wet = 0, attack = 0.005, detune = 0) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
    o.connect(g); out(g, 1, wet); env(g, t, attack, level, dur); o.start(t); o.stop(t + attack + dur + 0.05); return o;
  }
  // a struck metal partial set (bell, coin)
  function metal(t, base, ratios, dur, level, wet) { ratios.forEach((r, i) => tone(t, base * r, 'sine', dur * (1 - i * 0.12), level / (1 + i * 0.7), wet, 0.002)); }
  // brass voice: detuned saws through a lowpass that opens with the note (no electronic sheen)
  function brass(t, freq, dur, level, wet = 0.5) {
    const g = ac.createGain(), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(freq * 1.2, t); f.frequency.linearRampToValueAtTime(freq * 4.5, t + 0.12); f.frequency.linearRampToValueAtTime(freq * 3.0, t + dur);
    const vib = ac.createOscillator(), vg = ac.createGain(); vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(freq * 0.006, t + dur * 0.6); vib.connect(vg);
    [-7, 0, 6].forEach(dt => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = dt; vg.connect(o.frequency); o.connect(f); o.start(t); o.stop(t + dur + 0.6); });
    vib.start(t); vib.stop(t + dur + 0.6);
    f.connect(g); out(g, 1, wet);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level, t + 0.07); g.gain.setValueAtTime(level, t + dur * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
  }
  function timpani(t, freq, level) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(freq * 1.4, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
    o.connect(g); out(g, 1, 0.5); env(g, t, 0.003, level, 1.4); o.start(t); o.stop(t + 1.6);
    tick(t, 300, 0.8, 0.12, level * 0.5, 'lowpass', 0.3);
  }
  const S = {
    // ① cursor on a button: a dry, tiny "chi"
    hover() { const t = now(); tick(t, 5200, 6, 0.018, 0.12); },
    // ② click: a lower, rounder two-part "chi-kit" with a little body
    click() { const t = now(); tick(t, 2300, 3, 0.022, 0.3); tick(t + 0.045, 1500, 2.5, 0.03, 0.36); tick(t + 0.045, 260, 1, 0.03, 0.18, 'lowpass'); },
    // ③ production on / making rations: a rifle being cocked. bolt back (sharp metal), a short scrape, bolt home (heavier)
    prodOn() {
      // a pump-action reload: "ja" = the fore-end racked back (a noisy metal slide), "kit" = slammed home (a short, bright clack)
      const t = now();
      const slide = (t0, dur, freqs, q, level, body) => {
        const n = noise(), g = ac.createGain(); out(g, 1, 0.06);
        freqs.forEach(fq => { const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = q; n.connect(f); f.connect(g); });
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(level, t0 + 0.004); g.gain.exponentialRampToValueAtTime(level * 0.45, t0 + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        n.start(t0); n.stop(t0 + dur + 0.02);
        if (body) tick(t0, 190, 1, dur * 0.7, body, 'lowpass');
      };
      slide(t, 0.085, [1150, 1830, 2700, 3900], 9, 0.55, 0.35);
      tick(t + 0.075, 2200, 2, 0.015, 0.35);
      // a short gap of about 0.04 s after the slide stops, then the clack ("ja" - pause - "kit")
      slide(t + 0.21, 0.04, [2400, 3600, 5100], 12, 0.6, 0.25);
      tick(t + 0.21, 4200, 3, 0.012, 0.5); metal(t + 0.21, 2400, [1, 1.5, 2.1], 0.05, 0.05, 0.08);
    },
    // ④ production off: just "ka" "chi"
    prodOff() { const t = now(); tick(t, 1700, 4, 0.024, 0.42); metal(t, 1700, [1, 2.3], 0.03, 0.04); tick(t + 0.075, 3100, 5, 0.02, 0.36); metal(t + 0.075, 3100, [1, 1.9], 0.03, 0.035); },
    // ⑤ sale (every answer to an offer, refusal included): a key click, the pen writing the entry, then the seal pressed down
    //    timed to the ledger row: the line is written in 0.3 s and the seal lands at about 0.43 s
    sell() {
      const t = now(), sr = ac.sampleRate;
      tone(t, 1900, 'sine', 0.03, 0.3, 0, 0.001);
      // pen: noise kept between about 2 and 6 kHz, pulsing with the strokes
      const pd = 0.32, n = Math.round(sr * pd), b = ac.createBuffer(1, n, sr), d = b.getChannelData(0), ph = Math.random() * 6;
      let lo = 0, lo2 = 0;
      for (let i = 0; i < n; i++) {
        const x = Math.random() * 2 - 1; lo += 0.25 * (x - lo); lo2 += 0.55 * ((x - lo) - lo2);
        const tt = i / sr, st = 0.55 + 0.45 * Math.abs(Math.sin(2 * Math.PI * 7.5 * tt + ph));
        d[i] = lo2 * st * Math.min(1, tt / 0.03) * Math.min(1, (pd - tt) / 0.06);
      }
      const ps = ac.createBufferSource(), pg = ac.createGain(); ps.buffer = b; pg.gain.value = 0.3; ps.connect(pg); out(pg, 1, 0.04); ps.start(t + 0.01);
      // seal: a falling low thump with a dull tap on paper
      const ts = t + 0.42, o = ac.createOscillator(), og = ac.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(225, ts); o.frequency.exponentialRampToValueAtTime(95, ts + 0.06); o.frequency.exponentialRampToValueAtTime(58, ts + 0.2);
      o.connect(og); out(og, 1, 0.08); og.gain.setValueAtTime(0.0001, ts); og.gain.exponentialRampToValueAtTime(0.95, ts + 0.003); og.gain.exponentialRampToValueAtTime(0.0001, ts + 0.2); o.start(ts); o.stop(ts + 0.24);
      tick(ts, 1800, 0.7, 0.03, 0.4, 'lowpass');
    },
    // ⑥ covert action: only the low cluster swelling in the dark
    covert() {
      const t = now();
      [[73.4, 0.12], [77.8, 0.1], [110, 0.07], [155.6, 0.05]].forEach(([fq, lv]) => { const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = fq; f.type = 'lowpass'; f.frequency.setValueAtTime(200, t); f.frequency.linearRampToValueAtTime(700, t + 0.7); f.frequency.linearRampToValueAtTime(250, t + 1.6);
        o.connect(f); f.connect(g); out(g, 1, 0.6); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(lv, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8); o.start(t); o.stop(t + 1.9); });
    },
    // ⑦ start of a war: only the first three notes (timpani, then horns G - C - Eb over low brass), the last held
    start() {
      const t = now() + 0.05, q = 0.42, H = (n, d, at, lv = 0.07) => brass(t + at * q, 440 * Math.pow(2, (n - 69) / 12), d * q, lv * 0.65);
      timpani(t, 65.4, 0.38); timpani(t + 0.12, 65.4, 0.27); timpani(t + 0.24, 65.4, 0.34);
      H(55, 1, 0.6); H(60, 1, 1.6); H(63, 3.2, 2.6); H(43, 2, 0.6, 0.06); H(48, 3.2, 2.6, 0.06);
      timpani(t + 2.6 * q, 65.4, 0.3);
    },
    // ⑧ opening and closing the sell / covert window, tutorial "next": a page turning
    page() { const t = now(); const n = noise(), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'highpass'; f.frequency.value = 1500; n.connect(f); f.connect(g); out(g, 1, 0.1); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); n.start(t); n.stop(t + 0.25); },
    // ⑨ offer refused: a firm low thud and two muted low brass notes falling a semitone
    refused() { const t = now(); tick(t, 150, 1, 0.14, 0.7, 'lowpass', 0.2); brass(t + 0.02, 130.8, 0.16, 0.08, 0.3); brass(t + 0.2, 123.5, 0.32, 0.08, 0.35); },
    // ⑩ news flash, and warnings of surrender / peace / imposed peace
    news() { const t = now(); [0, 0.07, 0.14].forEach(d => tick(t + d, 3000, 8, 0.02, 0.18)); metal(t + 0.22, 1760, [1, 2.4], 0.25, 0.05, 0.3); },
    // ⑫ footsteps of the person passing beyond the desk: five heel strikes "kotsu", quiet - loud - quiet,
    //    panned from one ear to the other (dir 1 = left to right). Far steps are duller and wetter
    steps(dir = 1, gap = 0.42) {
      const t0 = now() + 0.02, lv = [0.2, 0.48, 1, 0.48, 0.2], pan = [-0.85, -0.45, 0, 0.45, 0.85];
      for (let i = 0; i < 5; i++) {
        const t = t0 + i * gap + (Math.random() - 0.5) * 0.03, far = 1 - lv[i], L = lv[i] * 0.33;   // kept quiet: an extra, not a feature (0.55 before, -40%)
        const p = ac.createStereoPanner ? ac.createStereoPanner() : null, bus = ac.createGain(), lp = ac.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 5200 - far * 3600; bus.connect(lp);
        if (p) { p.pan.value = pan[i] * dir; lp.connect(p); p.connect(master); } else lp.connect(master);
        if (verb) { const w = ac.createGain(); w.gain.value = 0.2 + far * 0.25; lp.connect(w); w.connect(verb); }
        // heel: a hard click; then the wooden floor answering
        const n = noise(), bp = ac.createBiquadFilter(), g = ac.createGain(); bp.type = 'bandpass'; bp.frequency.value = 2100 + Math.random() * 300; bp.Q.value = 1.4;
        n.connect(bp); bp.connect(g); g.connect(bus); env(g, t, 0.001, L * 0.5, 0.03); n.start(t); n.stop(t + 0.06);
        const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(230, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.06);
        o.connect(og); og.connect(bus); env(og, t, 0.002, L * 0.45, 0.07); o.start(t); o.stop(t + 0.1);
        const n2 = noise(), lp2 = ac.createBiquadFilter(), g2 = ac.createGain(); lp2.type = 'lowpass'; lp2.frequency.value = 600;
        n2.connect(lp2); lp2.connect(g2); g2.connect(bus); env(g2, t + 0.004, 0.002, L * 0.25, 0.05); n2.start(t + 0.004); n2.stop(t + 0.08);
      }
    },
    // ⑪ the war ends (before the report): a low bell, a second softer strike, a long hum dying away
    end() {
      const t = now();
      metal(t, 82.4, [1, 1.5, 2.0, 2.97, 4.1], 3.2, 0.2, 0.7); tone(t, 41.2, 'sine', 3, 0.16, 0.5, 0.01);
      const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 41.2; f.type = 'lowpass'; f.frequency.value = 140; o.connect(f); f.connect(g); out(g, 1, 0.8);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8); o.start(t); o.stop(t + 3.9);
    },
  };
  let on = true, lastHover = 0;
  return {
    play(k, ...a) {
      if (!on || !S[k]) return;
      try {
        init(); if (ac.state === 'suspended') ac.resume();
        if (k === 'hover') { const n = performance.now(); if (n - lastHover < 40) return; lastHover = n; }
        S[k](...a);
      } catch (e) { /* audio unavailable */ }
    },
    set enabled(v) { on = !!v; }, get enabled() { return on; },
    set volume(v) { vol = v; if (master) master.gain.value = v; },
  };
})();
