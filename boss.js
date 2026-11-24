// boss.js — AI AGENT OVERLOAD: final boss + difficulty modifiers.
// Self-contained and defensive: every cross-call to window.Game / window.SFX
// is guarded, so this file works even if game.js is not loaded yet.
(function () {
  'use strict';

  function game() { return window.Game || null; }
  function popup(text) {
    try {
      var g = game();
      if (g && typeof g.showPopup === 'function') g.showPopup(text);
      else if (window.UI && typeof window.UI.showPopup === 'function') window.UI.showPopup(text);
    } catch (e) {}
  }
  function sfx(name) {
    try { if (window.SFX && typeof window.SFX[name] === 'function') window.SFX[name](); } catch (e) {}
  }

  var Boss = {
    active: false,
    hp: 10,
    maxHp: 10,
    x: 0,
    y: 70,
    dir: 1,
    t: 0,
    spawnT: 0,
    flash: 0,
    w: 340,
    h: 150,

    start: function () {
      this.active = true;
      this.hp = this.maxHp;
      this.t = 0;
      this.spawnT = 1.2;
      this.flash = 0;
      try {
        var c = document.getElementById('game-canvas') || document.querySelector('canvas');
        this.x = c ? c.width / 2 : 400;
      } catch (e) { this.x = 400; }
      this.y = 70;
      sfx('boss');
      popup('FINAL BOSS: HUMAN CHANGED THE REQUIREMENTS');
    },

    // Called by game.js on task collect while the boss is active.
    takeHit: function () {
      if (!this.active) return;
      this.hp -= 1;
      this.flash = 0.25;
      sfx('hit');
      if (this.hp <= 0) {
        this.active = false;
        this.hp = 0;
        sfx('win');
        popup('REQUIREMENTS DEFEATED! The human is satisfied. For now.');
        try {
          var g = game();
          if (g && typeof g.bossDefeated === 'function') g.bossDefeated();
          else if (g && typeof g.addScore === 'function') g.addScore(500);
        } catch (e) {}
      }
    },

    // Called by game.js when the boss is defeated (keeps Boss state in sync).
    defeat: function () {
      this.active = false;
      this.hp = 0;
    },

    update: function (dt) {
      if (!this.active) return;
      dt = dt || 0.016;
      this.t += dt;
      if (this.flash > 0) this.flash -= dt;
      // Drift side to side.
      var width = 800;
      try {
        var c = document.getElementById('game-canvas') || document.querySelector('canvas');
        if (c) width = c.width;
      } catch (e) {}
      this.x += this.dir * 90 * dt;
      if (this.x < this.w / 2 + 10) { this.x = this.w / 2 + 10; this.dir = 1; }
      if (this.x > width - this.w / 2 - 10) { this.x = width - this.w / 2 - 10; this.dir = -1; }
      this.y = 70 + Math.sin(this.t * 1.6) * 14;
      // Periodically spawn exploding error bursts aimed at the player.
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 1.6;
        try {
          var g = game();
          if (g && typeof g.spawnBossBurst === 'function') g.spawnBossBurst(this.x, this.y + this.h / 2);
          else if (g && typeof g.spawnError === 'function') g.spawnError(this.x, this.y + this.h / 2);
        } catch (e) {}
      }
    },

    draw: function (ctx) {
      if (!this.active || !ctx) return;
      var x = this.x - this.w / 2, y = this.y - this.h / 2;
      ctx.save();
      // Screen body.
      ctx.fillStyle = this.flash > 0 ? '#ff5577' : '#111133';
      ctx.strokeStyle = '#ff2e88';
      ctx.lineWidth = 4;
      ctx.fillRect(x, y, this.w, this.h);
      ctx.strokeRect(x, y, this.w, this.h);
      // Stand.
      ctx.fillStyle = '#222244';
      ctx.fillRect(this.x - 8, y + this.h, 16, 26);
      ctx.fillRect(this.x - 50, y + this.h + 24, 100, 8);
      // Screen text.
      ctx.fillStyle = '#00ffcc';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('HUMAN CHANGED', this.x, y + 38);
      ctx.fillText('THE REQUIREMENTS', this.x, y + 60);
      ctx.fillStyle = '#ffcc00';
      ctx.font = '13px monospace';
      ctx.fillText('please redo everything :)', this.x, y + 84);
      // HP bar.
      ctx.fillStyle = '#330011';
      ctx.fillRect(x + 16, y + this.h - 22, this.w - 32, 10);
      ctx.fillStyle = '#ff2e88';
      ctx.fillRect(x + 16, y + this.h - 22, (this.w - 32) * Math.max(0, this.hp / this.maxHp), 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('BOSS HP ' + this.hp + '/' + this.maxHp, this.x, y + this.h - 26);
      ctx.restore();
    }
  };

  var MOD_LIST = [
    { id: 'DOUBLE_TASKS', name: 'DOUBLE TASKS', description: 'Twice the tasks, twice the panic.',
      apply: function (g) { try { if (g) g.taskRate = (g.taskRate || 1) * 2; } catch (e) {} } },
    { id: 'BUG_SWARM', name: 'BUG SWARM', description: 'Bugs everywhere. Good luck.',
      apply: function (g) { try { if (g) g.bugRate = (g.bugRate || 1) * 2; } catch (e) {} } },
    { id: 'SLOW_MO', name: 'SLOW-MO', description: 'Everything moves in slow motion. The deadlines do not.',
      apply: function (g) { try { if (g) g.speedFactor = 0.6; } catch (e) {} } },
    { id: 'SPAM_STORM', name: 'SPAM STORM', description: 'A storm of spam emails floods the office.',
      apply: function (g) { try { if (g) g.spamRate = (g.spamRate || 1) * 2; } catch (e) {} } },
    { id: 'MEETING_MADNESS', name: 'MEETING MADNESS', description: 'Another meeting. That could have been an email.',
      apply: function (g) { try { if (g) g.meetingRate = (g.meetingRate || 1) * 2; } catch (e) {} } }
  ];

  var Modifiers = {
    current: null,
    list: MOD_LIST,
    roll: function () {
      var m = MOD_LIST[Math.floor(Math.random() * MOD_LIST.length)];
      this.current = m;
      try { if (m && typeof m.apply === 'function') m.apply(game()); } catch (e) {}
      popup('NEW MODIFIER: ' + m.name + ' — ' + m.description);
      return m;
    }
  };

  window.Boss = Boss;
  window.Modifiers = Modifiers;
})();
