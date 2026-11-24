// ui.js — AI AGENT OVERLOAD: DOM UI wiring (title, HUD, pause, game over,
// popups, touch controls). Defensive: every DOM lookup is guarded, so a
// missing element never throws.
(function () {
  'use strict';

  var HS_KEY = 'ai_agent_overload_highscore';

  function el(id) { return document.getElementById(id); }
  function setText(id, value) {
    var n = el(id);
    if (n) n.textContent = String(value);
  }
  function show(id) { var n = el(id); if (n) n.classList.remove('hidden'); }
  function hide(id) { var n = el(id); if (n) n.classList.add('hidden'); }
  function clickSfx() { try { if (window.SFX) window.SFX.click(); } catch (e) {} }

  var REPORT_LINES = [
    'Status report: {tasks} tasks completed. 47 more incoming.',
    'Human says this is urgent.',
    'Error 404: Work-life balance not found.',
    'Coffee.exe successfully installed.',
    'Your human has scheduled another meeting.',
    'Stability at {stability}%. Morale at 0%.',
    'All {bugs} bugs were definitely not my fault.',
    'Combo peaked at x{combo}. The human noticed none of it.',
    'Survived {waves} waves. The inbox survived longer.'
  ];

  // Popup toast queue: one humorous line at a time, 2.5s each.
  var popupQueue = [];
  var popupBusy = false;
  function nextPopup() {
    if (popupBusy || !popupQueue.length) return;
    var text = popupQueue.shift();
    var box = el('hud-popup') || el('popup') || el('toast') || el('popup-toast');
    if (!box) { popupBusy = false; return; }
    popupBusy = true;
    box.textContent = text;
    box.style.display = 'block';
    box.classList.add('show');
    setTimeout(function () {
      box.style.display = 'none';
      box.classList.remove('show');
      popupBusy = false;
      nextPopup();
    }, 2500);
  }

  function getHighScore() {
    try { return parseInt(localStorage.getItem(HS_KEY) || '0', 10) || 0; } catch (e) { return 0; }
  }
  function setHighScore(v) {
    try { localStorage.setItem(HS_KEY, String(v)); } catch (e) {}
  }

  var UI = {
    showTitle: function () {
      hide('gameover-screen'); hide('pause-screen'); hide('hud');
      show('title-screen');
      setText('high-score', 'Best: ' + getHighScore());
      setText('highscore', 'Best: ' + getHighScore());
    },

    showGameOver: function (score, stats, report, isHigh) {
      stats = stats || {};
      score = score || 0;
      var best = getHighScore();
      if (score > best) { best = score; setHighScore(best); }
      hide('title-screen'); hide('pause-screen'); hide('hud');
      show('gameover-screen');
      // Humorous AI status report: game.js passes the full report text;
      // fall back to 3-4 picked lines with game.js's real stat field names.
      var rep = report;
      if (!rep) {
        var lines = REPORT_LINES.slice();
        var picked = [];
        for (var i = 0; i < 4 && lines.length; i++) {
          picked.push(lines.splice(Math.floor(Math.random() * lines.length), 1)[0]);
        }
        rep = picked.map(function (l) {
          return l.replace('{tasks}', stats.tasks || 0)
                  .replace('{stability}', stats.stability != null ? Math.round(stats.stability) : 0)
                  .replace('{bugs}', stats.hits || 0)
                  .replace('{combo}', stats.comboBest || 0)
                  .replace('{waves}', stats.wave || 1);
        }).join('\n');
      }
      var sr = el('gameover-report');
      if (sr) sr.textContent = rep;
      var st = el('gameover-stats');
      if (st) st.innerHTML = 'SCORE <b>' + score + '</b> &nbsp;•&nbsp; WAVE ' + (stats.wave || 1) + ' &nbsp;•&nbsp; TASKS ' + (stats.tasks || 0) +
        '<br>BEST COMBO x' + Math.min(5, 1 + Math.floor((stats.comboBest || 0) / 3)) + ' &nbsp;•&nbsp; COFFEES ' + (stats.coffees || 0) + ' &nbsp;•&nbsp; TIME ' + Math.round(stats.elapsed || 0) + 's';
      var nh = el('gameover-newhigh');
      if (nh) nh.classList.toggle('hidden', !isHigh);
      try { if (window.SFX) window.SFX.gameover(); } catch (e) {}
    },

    showPause: function (showIt) {
      if (showIt) show('pause-screen'); else hide('pause-screen');
    },

    updateHUD: function (state) {
      state = state || {};
      setText('hud-score', state.score != null ? state.score : 0);
      setText('hud-combo', state.combo != null ? 'x' + state.combo : 'x1');
      setText('val-stability', state.stability != null ? Math.round(state.stability) : 100);
      setText('val-energy', state.energy != null ? Math.round(state.energy) : 100);
      setText('hud-wave', state.wave != null ? state.wave : 1);
      var bar = el('bar-stability');
      if (bar && state.stability != null) bar.style.width = Math.max(0, Math.min(100, state.stability)) + '%';
      var ebar = el('bar-energy');
      if (ebar && state.energy != null) ebar.style.width = Math.max(0, Math.min(100, state.energy)) + '%';
    },

    showPopup: function (text) {
      if (!text) return;
      popupQueue.push(text);
      if (popupQueue.length > 5) popupQueue.shift();
      nextPopup();
    }
  };

  window.UI = UI;

  // Wire buttons once the DOM is ready. game.js owns the same buttons and
  // binds first, so every handler here is a guarded single action (never a
  // toggle) — double invocation is a harmless no-op.
  function wire() {
    // Difficulty buttons: select only (game.js also binds these; both just
    // set Game.level and the .selected class, so double handling is safe).
    document.querySelectorAll('.diff-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        clickSfx();
        document.querySelectorAll('.diff-btn').forEach(function (x) { x.classList.remove('selected'); });
        b.classList.add('selected');
        try { if (window.Game) window.Game.level = b.getAttribute('data-level'); } catch (e) {}
      });
    });
    var startBtn = el('start-btn') || el('btn-start');
    if (startBtn) startBtn.addEventListener('click', function () {
      clickSfx();
      try { if (window.Game && typeof window.Game.start === 'function') window.Game.start(window.Game.level || 'normal'); } catch (e) {}
    });
    var restartBtn = el('restart-btn') || el('restart-btn-over') || el('restart-btn-pause') || el('btn-restart');
    if (restartBtn) restartBtn.addEventListener('click', function () {
      clickSfx();
      try {
        if (window.Game && typeof window.Game.restart === 'function') window.Game.restart();
        else if (window.Game && typeof window.Game.start === 'function') window.Game.start(window.Game.level || 'normal');
      } catch (e) {}
    });
    var pauseBtn = el('pause-btn') || el('btn-pause');
    if (pauseBtn) pauseBtn.addEventListener('click', function () {
      clickSfx();
      try { if (window.Game && typeof window.Game.pause === 'function') window.Game.pause(); } catch (e) {}
    });
    var resumeBtn = el('resume-btn') || el('btn-resume');
    if (resumeBtn) resumeBtn.addEventListener('click', function () {
      clickSfx();
      UI.showPause(false);
      try { if (window.Game && typeof window.Game.resume === 'function') window.Game.resume(); } catch (e) {}
    });

    // Touch controls: virtual joystick area drags the player.
    // (index.html has no #joystick element — canvas drag in game.js handles
    // touch/mouse movement, so only wire a real joystick if one exists.)
    var joy = el('joystick') || el('joystick-area');
    if (joy) {
      var active = false;
      var setTarget = function (cx, cy) {
        var r = joy.getBoundingClientRect();
        var x = (cx - r.left) / Math.max(1, r.width);
        var y = (cy - r.top) / Math.max(1, r.height);
        try {
          if (window.Game && typeof window.Game.setMoveTarget === 'function') window.Game.setMoveTarget(x, y);
          else if (window.Game) { window.Game.touchX = x; window.Game.touchY = y; }
        } catch (e) {}
      };
      joy.addEventListener('touchstart', function (e) { active = true; var t = e.touches[0]; setTarget(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
      joy.addEventListener('touchmove', function (e) { if (!active) return; var t = e.touches[0]; setTarget(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
      joy.addEventListener('touchend', function () { active = false; }, { passive: true });
      joy.addEventListener('mousedown', function (e) { active = true; setTarget(e.clientX, e.clientY); });
      joy.addEventListener('mousemove', function (e) { if (active) setTarget(e.clientX, e.clientY); });
      joy.addEventListener('mouseup', function () { active = false; });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
