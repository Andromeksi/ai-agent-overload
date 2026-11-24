// audio.js — AI AGENT OVERLOAD: WebAudio-synthesized retro arcade SFX.
// No audio files, no copyrighted music. All functions are safe to call
// before init() (they no-op until an AudioContext exists).
(function () {
  'use strict';
  var ctx = null;
  var master = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    if (!ctx) return;
    try {
      var t0 = ctx.currentTime + (when || 0);
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      g.gain.setValueAtTime(vol || 0.5, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) {}
  }

  function noise(dur, vol, when, lowpass) {
    if (!ctx) return;
    try {
      var t0 = ctx.currentTime + (when || 0);
      var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.4, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      var node = src;
      if (lowpass) {
        var f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = lowpass;
        src.connect(f); node = f;
      }
      node.connect(g); g.connect(master);
      src.start(t0);
    } catch (e) {}
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  window.SFX = {
    init: function () {
      ensure();
      resume();
    },
    // Rising two-note chirp.
    collect: function () {
      if (!ctx) return; resume();
      tone(660, 0.08, 'square', 0.45, 0);
      tone(990, 0.12, 'square', 0.45, 0.07);
    },
    // Harsh buzz + noise thud.
    hit: function () {
      if (!ctx) return; resume();
      tone(160, 0.25, 'sawtooth', 0.6, 0, 55);
      noise(0.18, 0.5, 0, 900);
    },
    // Happy arpeggio.
    powerup: function () {
      if (!ctx) return; resume();
      var notes = [523, 659, 784, 1047];
      for (var i = 0; i < notes.length; i++) tone(notes[i], 0.12, 'triangle', 0.5, i * 0.07);
    },
    // Low alarm: two descending siren blasts.
    boss: function () {
      if (!ctx) return; resume();
      tone(220, 0.35, 'sawtooth', 0.55, 0, 110);
      tone(220, 0.35, 'sawtooth', 0.55, 0.4, 110);
      noise(0.3, 0.3, 0, 500);
    },
    click: function () {
      if (!ctx) return; resume();
      tone(880, 0.05, 'square', 0.3, 0);
    },
    // Descending notes.
    gameover: function () {
      if (!ctx) return; resume();
      var notes = [392, 330, 262, 196];
      for (var i = 0; i < notes.length; i++) tone(notes[i], 0.22, 'triangle', 0.5, i * 0.18);
    },
    win: function () {
      if (!ctx) return; resume();
      var notes = [523, 659, 784, 1047, 1319];
      for (var i = 0; i < notes.length; i++) tone(notes[i], 0.15, 'square', 0.4, i * 0.09);
    }
  };

  // init() on first user gesture, so the AudioContext is allowed to start.
  function onGesture() { try { window.SFX.init(); } catch (e) {} }
  document.addEventListener('click', onGesture, { once: false });
  document.addEventListener('keydown', onGesture, { once: false });
  document.addEventListener('touchstart', onGesture, { once: false, passive: true });
})();
