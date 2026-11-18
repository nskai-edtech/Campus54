/*
 * Campus 54: Rock Run. Dodge and shoot down rocks across the solar system.
 * Runs entirely in the browser. Scores are saved on the device first and sent
 * to /api/score when online; anything unsent is retried when the connection
 * returns. Nothing here can slow the main site: this file only loads on /play.
 */
(function () {
  "use strict";

  // ---------- language ----------
  var LANG = (function () {
    var q = new URLSearchParams(location.search).get("lang");
    if (q === "en" || q === "fr") return q;
    try { var s = localStorage.getItem("c54-lang"); if (s === "en" || s === "fr") return s; } catch (e) {}
    return (navigator.language || "en").slice(0, 2) === "fr" ? "fr" : "en";
  })();
  var T = {
    en: {
      title: "ROCK RUN", sub: "Dodge and shoot the rocks. Reach Neptune.",
      nick: "Your name", play: "▶ PLAY", again: "▶ PLAY AGAIN",
      how: "Move: arrow keys, A/D or drag your finger. Your ship fires by itself.",
      over: "GAME OVER", score: "SCORE", best: "YOUR BEST", level: "PLANET", lives: "LIVES",
      players: "TOP PLAYERS", loading: "Loading ranking…",
      offline: "You are offline. Scores are saved on this phone and sent when you reconnect.",
      unavailable: "Ranking unavailable right now. Your scores are safe on this device.",
      pending: "score(s) waiting to be sent", sent: "Score sent. Rank #", saved: "Saved on this device.",
      empty: "No scores yet. Be the first.", back: "← Back to Campus 54", paused: "PAUSED · tap to continue",
      needNick: "Enter a name (2-16 letters or numbers).", taken: "That name is taken. Pick another one, then press Play.", arrive: "ARRIVING AT"
    },
    fr: {
      title: "ROCK RUN", sub: "Esquive et détruis les rochers. Atteins Neptune.",
      nick: "Ton nom", play: "▶ JOUER", again: "▶ REJOUER",
      how: "Bouger : flèches, A/D ou glisse ton doigt. Ton vaisseau tire tout seul.",
      over: "PARTIE TERMINÉE", score: "SCORE", best: "TON RECORD", level: "PLANÈTE", lives: "VIES",
      players: "MEILLEURS JOUEURS", loading: "Chargement du classement…",
      offline: "Tu es hors ligne. Les scores sont gardés sur ce téléphone et envoyés à la reconnexion.",
      unavailable: "Classement indisponible pour le moment. Tes scores sont gardés sur cet appareil.",
      pending: "score(s) en attente d’envoi", sent: "Score envoyé. Rang n°", saved: "Gardé sur cet appareil.",
      empty: "Aucun score pour l’instant. Sois le premier.", back: "← Retour à Campus 54", paused: "PAUSE · touche pour continuer",
      needNick: "Entre un nom (2 à 16 lettres ou chiffres).", taken: "Ce nom est déjà pris. Choisis-en un autre, puis appuie sur Jouer.", arrive: "ARRIVÉE SUR"
    }
  }[LANG];
  document.documentElement.lang = LANG;
  document.querySelectorAll("[data-t]").forEach(function (el) { el.textContent = T[el.getAttribute("data-t")]; });

  // ---------- storage (works offline) ----------
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var playerId = store.get("c54-player-id", null);
  if (!playerId) {
    playerId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(36).slice(2, 12));
    store.set("c54-player-id", playerId);
  }

  // ---------- UI ----------
  var $ = function (id) { return document.getElementById(id); };
  var nickIn = $("nick"), msg = $("msg"), menu = $("menu"), hud = $("hud");
  nickIn.value = store.get("c54-nick", "");
  $("bestv").textContent = store.get("c54-best", 0);

  // ---------- planets ----------
  var PLANETS = [
    { name: "MERCURY", fr: "MERCURE", c1: "#9A8F86", c2: "#6E655E", rock: "#B8AEA5" },
    { name: "VENUS", fr: "VÉNUS", c1: "#E3B65C", c2: "#B88A33", rock: "#E8C27A" },
    { name: "EARTH", fr: "TERRE", c1: "#2E7BD6", c2: "#2FA44F", rock: "#8C7B6B" },
    { name: "MARS", fr: "MARS", c1: "#D2512C", c2: "#8E2F17", rock: "#C9663F" },
    { name: "JUPITER", fr: "JUPITER", c1: "#D9A877", c2: "#9C6B45", rock: "#C79A6E" },
    { name: "SATURN", fr: "SATURNE", c1: "#E8D08F", c2: "#B79C55", rock: "#D8C188" },
    { name: "URANUS", fr: "URANUS", c1: "#7FD6DA", c2: "#4BA3A8", rock: "#9EDFE2" },
    { name: "NEPTUNE", fr: "NEPTUNE", c1: "#3D5BD9", c2: "#273B99", rock: "#6E86E6" }
  ];
  var LEVEL_SECONDS = 25;

  // ---------- canvas ----------
  var cv = $("game"), ctx = cv.getContext("2d");
  var W = 0, H = 0, S = 1; // S = pixel unit
  function resize() {
    var r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    S = Math.max(3, Math.round(Math.min(W, H) / 80));
  }
  window.addEventListener("resize", resize);

  var stars = [];
  for (var i = 0; i < 90; i++) stars.push({ x: Math.random(), y: Math.random(), z: Math.random() * 0.8 + 0.2 });

  // ---------- state ----------
  var st = null, raf = 0, last = 0, keys = {}, touchX = null;

  function newGame() {
    return {
      x: W / 2, lives: 3, score: 0, t: 0, level: 0, inv: 0, cool: 0, spawn: 0.4,
      rocks: [], shots: [], bits: [], banner: 2.2, over: false, paused: false
    };
  }

  function addRock(size, x, y, vx, vy) {
    var r = [14, 9, 5][size] * S * 0.55;
    var pts = [], n = 9;
    for (var k = 0; k < n; k++) pts.push(r * (0.75 + Math.random() * 0.3));
    st.rocks.push({ size: size, x: x, y: y, vx: vx, vy: vy, r: r, pts: pts, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 2 });
  }

  function spawnRock() {
    var lv = st.level, big = Math.random() < 0.55 ? 0 : (Math.random() < 0.7 ? 1 : 2);
    var speed = (H * 0.16) * (1 + lv * 0.14) * (big === 0 ? 0.8 : big === 1 ? 1 : 1.25);
    addRock(big, Math.random() * W, -20, (Math.random() - 0.5) * W * 0.12, speed * (0.8 + Math.random() * 0.4));
  }

  function burst(x, y, color, n) {
    for (var k = 0; k < n; k++) {
      var a = Math.random() * 6.28, v = (40 + Math.random() * 160);
      st.bits.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, c: color });
    }
  }

  // ---------- update ----------
  function update(dt) {
    if (st.over || st.paused) return;
    st.t += dt;
    var lv = Math.max(0, Math.min(PLANETS.length - 1, Math.floor(st.t / LEVEL_SECONDS)));
    if (lv !== st.level) { st.level = lv; st.banner = 2.2; st.score += 500 * lv; }
    if (st.banner > 0) st.banner -= dt;

    // ship
    var speed = W * 0.9, shipY = H - 14 * S;
    if (keys.left) st.x -= speed * dt;
    if (keys.right) st.x += speed * dt;
    if (touchX != null) st.x += (touchX - st.x) * Math.min(1, dt * 14);
    st.x = Math.max(6 * S, Math.min(W - 6 * S, st.x));
    if (st.inv > 0) st.inv -= dt;

    // auto-fire
    st.cool -= dt;
    if (st.cool <= 0) { st.shots.push({ x: st.x, y: shipY - 6 * S }); st.cool = 0.16; }
    for (var i = st.shots.length - 1; i >= 0; i--) { st.shots[i].y -= H * 1.4 * dt; if (st.shots[i].y < -10) st.shots.splice(i, 1); }

    // rocks
    st.spawn -= dt;
    var every = Math.max(0.22, 0.9 - st.level * 0.09);
    if (st.spawn <= 0) { spawnRock(); st.spawn = every * (0.6 + Math.random() * 0.8); }
    var P = PLANETS[st.level];
    for (var j = st.rocks.length - 1; j >= 0; j--) {
      var r = st.rocks[j];
      r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.vr * dt;
      if (r.x < -r.r) r.x = W + r.r; if (r.x > W + r.r) r.x = -r.r;
      if (r.y > H + r.r * 2) { st.rocks.splice(j, 1); continue; }
      // hit by a shot
      var hit = false;
      for (var k = st.shots.length - 1; k >= 0; k--) {
        var s = st.shots[k], dx = s.x - r.x, dy = s.y - r.y;
        if (dx * dx + dy * dy < r.r * r.r) { st.shots.splice(k, 1); hit = true; break; }
      }
      if (hit) {
        st.score += [20, 50, 100][r.size];
        burst(r.x, r.y, P.rock, 8 + (2 - r.size) * 4);
        st.rocks.splice(j, 1);
        if (r.size < 2) for (var n = 0; n < 2; n++) addRock(r.size + 1, r.x, r.y, r.vx + (n ? 1 : -1) * W * 0.12, r.vy * 0.9);
        continue;
      }
      // hits the ship
      var sx = st.x - r.x, sy = shipY - r.y, rr = r.r + 4 * S;
      if (st.inv <= 0 && sx * sx + sy * sy < rr * rr) {
        st.lives--; st.inv = 2; burst(st.x, shipY, "#E00000", 24); st.rocks.splice(j, 1);
        if (navigator.vibrate) navigator.vibrate(120);
        if (st.lives <= 0) { endGame(); return; }
      }
    }
    for (var b = st.bits.length - 1; b >= 0; b--) {
      var p = st.bits[b]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) st.bits.splice(b, 1);
    }
  }

  // ---------- draw ----------
  function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

  function drawPlanet(P, t) {
    var R = Math.min(W, H) * 0.32, cx = W * 0.78, cy = -R * 0.35 + 8;
    var step = Math.max(4, S * 2);
    for (var y = -R; y < R; y += step) for (var x = -R; x < R; x += step) {
      if (x * x + y * y > R * R) continue;
      var band = Math.floor((y + R + t * 6) / (step * 3)) % 2;
      px(cx + x, cy + y, step, step, band ? P.c1 : P.c2);
    }
    if (P.name === "SATURN") { ctx.strokeStyle = "#E8D08F"; ctx.lineWidth = step; ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.6, R * 0.35, -0.25, 0, 6.28); ctx.stroke(); }
  }

  function drawShip(x, y) {
    var m = ["...R...", "..RWR..", "..RWR..", ".RRWRR.", "RRYRYRR", "R.R.R.R"];
    for (var r = 0; r < m.length; r++) for (var c = 0; c < m[r].length; c++) {
      var ch = m[r][c]; if (ch === ".") continue;
      px(x + (c - 3.5) * S, y + (r - 3) * S, S, S, ch === "R" ? "#E00000" : ch === "W" ? "#FFFFFF" : "#FFC400");
    }
    if (Math.floor(st.t * 20) % 2) px(x - S * 0.5, y + 3 * S, S, S * 1.5, "#FFC400");
  }

  function drawRock(r, color) {
    ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
    ctx.beginPath();
    for (var k = 0; k < r.pts.length; k++) {
      var a = (k / r.pts.length) * 6.283;
      ctx[k ? "lineTo" : "moveTo"](Math.cos(a) * r.pts[k], Math.sin(a) * r.pts[k]);
    }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = Math.max(2, S * 0.6); ctx.strokeStyle = "#0A0A12"; ctx.stroke();
    ctx.fillStyle = "rgba(10,10,18,.35)"; ctx.fillRect(-r.r * 0.3, -r.r * 0.2, r.r * 0.35, r.r * 0.35);
    ctx.restore();
  }

  function draw() {
    var P = PLANETS[st.level];
    px(0, 0, W, H, "#0A0A12");
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i]; s.y += 0.0009 * s.z * (1 + st.level * 0.2); if (s.y > 1) { s.y = 0; s.x = Math.random(); }
      px(s.x * W, s.y * H, s.z > 0.7 ? 2 : 1, s.z > 0.7 ? 2 : 1, s.z > 0.7 ? "#FFC400" : "#5A5A70");
    }
    drawPlanet(P, st.t);
    for (var k = 0; k < st.shots.length; k++) px(st.shots[k].x - S * 0.5, st.shots[k].y, S, S * 2.5, "#FFC400");
    for (var j = 0; j < st.rocks.length; j++) drawRock(st.rocks[j], P.rock);
    for (var b = 0; b < st.bits.length; b++) px(st.bits[b].x, st.bits[b].y, S * 0.8, S * 0.8, st.bits[b].c);
    if (!(st.inv > 0 && Math.floor(st.inv * 10) % 2)) drawShip(st.x, H - 14 * S);

    // HUD
    $("hs").textContent = st.score;
    $("hl").textContent = (LANG === "fr" ? P.fr : P.name) + " " + (st.level + 1) + "/8";
    $("hv").textContent = "♥".repeat(Math.max(0, st.lives));
    if (st.banner > 0) {
      ctx.fillStyle = "rgba(10,10,18,.75)"; ctx.fillRect(0, H * 0.4 - 30, W, 60);
      ctx.fillStyle = "#FFC400"; ctx.font = Math.max(12, S * 3.5) + "px 'Press Start 2P', monospace"; ctx.textAlign = "center";
      ctx.fillText(T.arrive + " " + (LANG === "fr" ? P.fr : P.name), W / 2, H * 0.4 + 6);
    }
    if (st.paused) {
      ctx.fillStyle = "rgba(10,10,18,.7)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#FFFFFF"; ctx.font = Math.max(10, S * 3) + "px 'Press Start 2P', monospace"; ctx.textAlign = "center";
      ctx.fillText(T.paused, W / 2, H / 2);
    }
  }

  function loop(ts) {
    // The first frame can be stamped slightly before start(), so never let time run backwards.
    var dt = Math.max(0, Math.min(0.05, (ts - last) / 1000 || 0)); last = ts;
    update(dt);
    if (st) draw();
    if (st && !st.over) raf = requestAnimationFrame(loop);
  }

  // ---------- start / end ----------
  function start() {
    var nick = nickIn.value.trim();
    if (!/^[\p{L}\p{N} _.-]{2,16}$/u.test(nick)) { msg.textContent = T.needNick; nickIn.focus(); return; }
    store.set("c54-nick", nick);
    msg.textContent = "";
    flush(); // sends any waiting scores under this name (e.g. after a "name taken")
    menu.hidden = true; hud.hidden = false; document.body.classList.add("playing");
    resize(); st = newGame(); last = performance.now();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }

  function endGame() {
    st.over = true;
    var result = {
      id: playerId, nick: store.get("c54-nick", ""),
      score: st.score, duration: Math.round(st.t * 10) / 10, level: st.level + 1, at: Date.now()
    };
    var best = Math.max(store.get("c54-best", 0), st.score);
    store.set("c54-best", best);
    var hist = store.get("c54-history", []); hist.unshift(result); store.set("c54-history", hist.slice(0, 20));
    var queue = store.get("c54-pending", []); queue.push(result); store.set("c54-pending", queue.slice(-30));
    $("bestv").textContent = best;
    $("lastv").textContent = st.score;
    $("last").hidden = false;
    $("playbtn").textContent = T.again;
    setTimeout(function () {
      menu.hidden = false; hud.hidden = true; document.body.classList.remove("playing");
      flush();
    }, 900);
  }

  // ---------- syncing scores ----------
  var flushing = false, justSent = false;
  function showPending() {
    var n = store.get("c54-pending", []).length;
    $("pending").textContent = n ? n + " " + T.pending : "";
  }
  function flush() {
    showPending();
    if (flushing) return;
    if (!navigator.onLine) { $("sync").textContent = T.offline; return; }
    var queue = store.get("c54-pending", []);
    if (!queue.length) { loadBoard(justSent); justSent = false; return; }
    flushing = true;
    // Always send under the player's current name, so a renamed player's waiting scores follow them.
    var item = Object.assign({}, queue[0], { id: playerId, nick: store.get("c54-nick", queue[0].nick) });
    fetch("/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (r) {
        flushing = false;
        if (r.status === 409) {
          // Name owned by someone else: keep the score, ask for a new name.
          $("sync").textContent = T.taken; msg.textContent = T.taken;
          if (menu.hidden === false) nickIn.focus();
          showPending();
          loadBoard();
          return;
        }
        if (r.ok || (r.status === 400)) {
          // Sent, or permanently refused: either way drop it from the queue.
          var q = store.get("c54-pending", []); q.shift(); store.set("c54-pending", q);
          if (r.ok) justSent = true;
          $("sync").textContent = r.ok ? (r.j.rank ? T.sent + r.j.rank : T.saved) : r.j.error;
          flush();
        } else {
          $("sync").textContent = (r.j && r.j.error) || T.unavailable;
          showPending();
          loadBoard();
        }
      })
      .catch(function () { flushing = false; $("sync").textContent = T.offline; showPending(); });
  }
  window.addEventListener("online", flush);

  // ---------- leaderboard ----------
  function row(rank, name, sub, score) {
    var li = document.createElement("li");
    var a = document.createElement("span"); a.className = "rk"; a.textContent = "#" + rank;
    var b = document.createElement("span"); b.className = "nm"; b.textContent = name;
    if (sub) { var s = document.createElement("small"); s.textContent = sub; b.appendChild(s); }
    var c = document.createElement("span"); c.className = "sc"; c.textContent = score.toLocaleString();
    li.append(a, b, c); return li;
  }
  // Normal loads share a 30-second cached board (cheap for the server). Right after
  // this player's own score is sent, fetch a fresh one so they see themselves on it.
  function loadBoard(fresh) {
    if (!navigator.onLine) { $("sync").textContent = T.offline; return; }
    if (!$("pl").children.length) $("pl").textContent = T.loading;
    fetch(fresh ? "/api/leaderboard?fresh=" + Date.now() : "/api/leaderboard", { cache: fresh ? "no-store" : "no-cache" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
      store.set("c54-board", d); renderBoard(d);
    }).catch(function () {
      var cached = store.get("c54-board", null);
      if (cached) renderBoard(cached);
      else { $("pl").textContent = T.unavailable; }
    });
  }
  function renderBoard(d) {
    var pl = $("pl"); pl.textContent = "";
    if (!d.players || !d.players.length) { pl.textContent = T.empty; return; }
    var me = store.get("c54-nick", "").toLowerCase();
    d.players.slice(0, 50).forEach(function (p, i) {
      var li = row(i + 1, p.nick, "", p.score);
      if (p.nick.toLowerCase() === me) li.className = "me";
      pl.appendChild(li);
    });
  }

  // ---------- input ----------
  $("playbtn").addEventListener("click", start);
  $("startform").addEventListener("submit", function (e) { e.preventDefault(); start(); });
  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
    if ((e.key === "p" || e.key === "Escape") && st && !st.over) st.paused = !st.paused;
    if (st && !st.over && ["ArrowLeft", "ArrowRight", " "].indexOf(e.key) > -1) e.preventDefault();
  });
  window.addEventListener("keyup", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
  });
  function tx(e) { var r = cv.getBoundingClientRect(); return (e.touches ? e.touches[0].clientX : e.clientX) - r.left; }
  cv.addEventListener("touchstart", function (e) { if (st && st.paused) st.paused = false; touchX = tx(e); e.preventDefault(); }, { passive: false });
  cv.addEventListener("touchmove", function (e) { touchX = tx(e); e.preventDefault(); }, { passive: false });
  cv.addEventListener("touchend", function () { touchX = null; });
  cv.addEventListener("mousemove", function (e) { if (e.buttons) touchX = tx(e); });
  cv.addEventListener("mouseup", function () { touchX = null; });
  cv.addEventListener("click", function () { if (st && st.paused) st.paused = false; });
  // Pause when the tab is hidden so a game is never lost to a phone call.
  document.addEventListener("visibilitychange", function () { if (document.hidden && st && !st.over) st.paused = true; });

  // ---------- offline support ----------
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/play/sw.js", { scope: "/play/" }).catch(function () {});

  resize();
  flush();
})();
