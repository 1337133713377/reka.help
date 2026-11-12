/* REKA — effets de la page d'accueil : apparitions, reflets, spectre animé,
   galerie de thèmes et mini-console interactive. Aucune dépendance.
   Tout est décoratif : sans ce script, la page reste complète. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- Apparition au défilement ---------- */

  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce) {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        seen.unobserve(el);
        el.classList.add("in");
        var delay = parseFloat(getComputedStyle(el).transitionDelay) || 0;
        setTimeout(function () {
          el.classList.remove("reveal", "in");
          el.style.removeProperty("--delay");
        }, 1000 + delay * 1000);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
    reveals.forEach(function (el) { seen.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.remove("reveal"); });
  }

  /* ---------- Reflet qui suit le pointeur sur les cartes ---------- */

  document.addEventListener("pointermove", function (e) {
    var card = e.target.closest && e.target.closest(".card");
    if (!card) return;
    var r = card.getBoundingClientRect();
    card.style.setProperty("--mx", (e.clientX - r.left) + "px");
    card.style.setProperty("--my", (e.clientY - r.top) + "px");
  }, { passive: true });

  /* ---------- Capture du haut de page : se redresse au défilement ---------- */

  var shot = document.querySelector(".hero-shot .shot");
  if (shot && !reduce) {
    var queued = false;
    var tilt = function () {
      queued = false;
      var top = shot.getBoundingClientRect().top;
      var p = clamp((top - innerHeight * 0.1) / (innerHeight * 0.6), 0, 1);
      shot.style.setProperty("--tilt", (p * 14).toFixed(2));
    };
    addEventListener("scroll", function () {
      if (!queued) { queued = true; requestAnimationFrame(tilt); }
    }, { passive: true });
    addEventListener("resize", tilt);
    tilt();
  }

  /* ---------- Spectre animé derrière la capture ---------- */

  var canvas = document.querySelector(".spectrum");
  if (canvas && canvas.getContext && !reduce) {
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, bars = [], colors = ["#3b82f6", "#22d3ee"], onScreen = true, raf = 0;
    var STEP = 16, BAR = 9;

    var readColors = function () {
      var cs = getComputedStyle(root);
      colors = [cs.getPropertyValue("--grad-a").trim() || colors[0], cs.getPropertyValue("--grad-b").trim() || colors[1]];
    };
    var resize = function () {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.ceil(W / STEP);
      bars = [];
      for (var i = 0; i < n; i++) bars.push({ v: 0, pk: 0, seed: Math.random() * 100 });
    };
    var draw = function (t) {
      raf = 0;
      if (!onScreen || document.hidden || !W) return;
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createLinearGradient(0, H, 0, 0);
      g.addColorStop(0, colors[0]); g.addColorStop(1, colors[1]);
      ctx.fillStyle = g;
      for (var i = 0; i < bars.length; i++) {
        var b = bars[i];
        var n1 = Math.sin(t * 0.0013 + b.seed) * 0.5 + 0.5;
        var n2 = Math.sin(t * 0.0034 + i * 0.47) * 0.5 + 0.5;
        var n3 = Math.sin(t * 0.0008 + i * 0.11 + 2) * 0.5 + 0.5;
        var target = (0.12 + 0.88 * n1 * n2) * (0.4 + 0.6 * n3);
        b.v += (target - b.v) * 0.14;
        b.pk = Math.max(b.pk - 0.0035, b.v);
        var h = b.v * H * 0.92, x = i * STEP;
        ctx.globalAlpha = 0.62;
        ctx.fillRect(x, H - h, BAR, h);
        ctx.globalAlpha = 0.95;
        ctx.fillRect(x, H - b.pk * H * 0.92 - 5, BAR, 2);
      }
      raf = requestAnimationFrame(draw);
    };
    var kick = function () { if (!raf) raf = requestAnimationFrame(draw); };

    readColors(); resize(); kick();
    addEventListener("resize", function () { resize(); kick(); });
    document.addEventListener("visibilitychange", kick);
    new MutationObserver(readColors).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        kick();
      }).observe(canvas);
    }
  }

  /* ---------- Galerie de thèmes ---------- */

  var picks = document.querySelectorAll("[data-pick]");
  if (picks.length) {
    var current = function () { return root.getAttribute("data-theme") || "studio"; };
    var sync = function () {
      picks.forEach(function (el) {
        if (el.hasAttribute("aria-pressed")) el.setAttribute("aria-pressed", String(el.dataset.pick === current()));
      });
    };
    picks.forEach(function (el) {
      el.addEventListener("click", function () {
        var want = el.dataset.pick === current() ? "studio" : el.dataset.pick;
        var chip = document.querySelector('.theme-chip[data-theme="' + want + '"]');
        if (chip) chip.click();
      });
    });
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    sync();
  }

  /* ---------- Mini-console interactive ---------- */

  var host = document.querySelector("[data-mini-console]");
  if (!host) return;

  /* Même échelle que la vraie console : +12 dB en haut, 0 dB vers 15 %, −60 dB en bas. */
  var SCALE = [[12, 0], [6, 0.075], [0, 0.15], [-6, 0.28], [-12, 0.385], [-24, 0.555], [-48, 0.765], [-60, 1]];
  function dbToPos(db) {
    db = clamp(db, -60, 12);
    for (var i = 0; i < SCALE.length - 1; i++) {
      var a = SCALE[i], b = SCALE[i + 1];
      if (db <= a[0] && db >= b[0]) return a[1] + (a[0] - db) / (a[0] - b[0]) * (b[1] - a[1]);
    }
    return 1;
  }
  function posToDb(p) {
    p = clamp(p, 0, 1);
    for (var i = 0; i < SCALE.length - 1; i++) {
      var a = SCALE[i], b = SCALE[i + 1];
      if (p >= a[1] && p <= b[1]) return a[0] - (p - a[1]) / (b[1] - a[1]) * (a[0] - b[0]);
    }
    return -60;
  }
  function fmt(db) { return (Math.round(db * 10) / 10).toFixed(1); }

  var ARC = 94.25;   /* 270° d'un cercle de rayon 20 */
  function knobSvg(size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 48 48" aria-hidden="true">' +
      '<circle cx="24" cy="24" r="20" fill="none" stroke="#ffffff1a" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + ARC + ' 200" transform="rotate(135 24 24)"/>' +
      '<circle class="arc" cx="24" cy="24" r="20" fill="none" stroke-width="4" stroke-linecap="round" stroke-dasharray="0 200" transform="rotate(135 24 24)"/>' +
      '<circle cx="24" cy="24" r="13.5" fill="#262c38" stroke="#3a4150" stroke-width="1"/>' +
      '<line class="ptr" x1="30" y1="24" x2="35" y2="24" stroke="#f8fafc" stroke-width="2.6" stroke-linecap="round"/></svg>';
  }
  function setKnob(el, v) {
    el.querySelector(".arc").setAttribute("stroke-dasharray", (v * ARC).toFixed(2) + " 200");
    el.querySelector(".ptr").setAttribute("transform", "rotate(" + (135 + v * 270).toFixed(1) + " 24 24)");
  }
  function vuHtml() {
    return '<div class="mc-vu"><div class="bar"><i class="lvl"></i><i class="pk"></i></div><div class="bar"><i class="lvl"></i><i class="pk"></i></div></div>';
  }

  /* Glisser vertical, à la souris, au doigt ou au stylet. */
  function dragY(el, onStart, onMove) {
    el.addEventListener("pointerdown", function (e) {
      if (e.button) return;
      e.preventDefault();
      el.focus({ preventScroll: true });
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* pointeur déjà relâché */ }
      el.classList.add("drag");
      var last = e.clientY;
      if (onStart) onStart(e);
      var move = function (ev) { var dy = ev.clientY - last; last = ev.clientY; onMove(dy, ev.shiftKey); };
      var up = function () {
        el.classList.remove("drag");
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    });
  }
  function keys(el, get, set) {
    el.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 0.1 : 0.5, v = get();
      if (e.key === "ArrowUp" || e.key === "ArrowRight") v += step;
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") v -= step;
      else if (e.key === "PageUp") v += 3;
      else if (e.key === "PageDown") v -= 3;
      else if (e.key === "Home") v = 12;
      else if (e.key === "End") v = -60;
      else if (e.key === "Enter" || e.key === "0") v = 0;
      else return;
      e.preventDefault();
      set(v);
    });
  }

  var strips = [
    { name: "Microphone", db: 2, send: true, kind: "voice" },
    { name: "Musique", db: -9, send: true, kind: "music" },
    { name: "Appels", db: -3, send: true, kind: "call" },
    { name: "Bureau", db: -6, send: false, kind: "desk" }
  ];
  var master = { db: 0, lv: [-60, -60], pk: [-60, -60] };

  strips.forEach(function (s) {
    s.muted = false; s.lv = [-60, -60]; s.pk = [-60, -60]; s.on = false; s.next = 0; s.ph = Math.random() * 6;

    var el = document.createElement("div");
    el.className = "mc-strip";
    var ticks = [12, 0, -12, -24, -48].map(function (d) {
      return '<span style="top:' + (dbToPos(d) * 100).toFixed(1) + '%">' + (d > 0 ? "+" : "") + d + "</span>";
    }).join("");
    el.innerHTML =
      '<button class="mc-send" type="button" aria-pressed="' + s.send + '" aria-label="Monitor, ' + s.name + '">' + knobSvg(38) + "<span>Monitor</span></button>" +
      '<button class="mc-mute" type="button" aria-pressed="false" aria-label="Muet, ' + s.name + '">Muet</button>' +
      '<div class="mc-box mc-meter"><div class="mc-db"></div><div class="mc-lane">' +
        '<div class="mc-scale" aria-hidden="true">' + ticks + "</div>" +
        '<div class="mc-fader" role="slider" tabindex="0" aria-orientation="vertical" aria-valuemin="-60" aria-valuemax="12" aria-label="Fader ' + s.name + '"><i class="fill"></i><i class="thumb"></i></div>' +
        vuHtml() +
      "</div></div>" +
      '<div class="mc-name">' + s.name + "</div>";
    host.appendChild(el);

    var send = el.querySelector(".mc-send"), mute = el.querySelector(".mc-mute");
    var fader = el.querySelector(".mc-fader"), read = el.querySelector(".mc-db");
    s.bars = el.querySelectorAll(".mc-vu .bar");

    var setDb = function (db) {
      s.db = clamp(Math.round(db * 10) / 10, -60, 12);
      fader.style.setProperty("--p", dbToPos(s.db).toFixed(4));
      fader.setAttribute("aria-valuenow", s.db);
      fader.setAttribute("aria-valuetext", fmt(s.db) + " dB");
      read.innerHTML = fmt(s.db) + "<small>dB</small>";
      still();
    };
    setKnob(send, 0.75);
    send.addEventListener("click", function () {
      s.send = !s.send;
      send.setAttribute("aria-pressed", String(s.send));
      still();
    });
    mute.addEventListener("click", function () {
      s.muted = !s.muted;
      mute.setAttribute("aria-pressed", String(s.muted));
      still();
    });
    dragY(fader, function (e) {
      var r = fader.getBoundingClientRect();
      if (!e.target.classList.contains("thumb")) setDb(posToDb((e.clientY - r.top) / r.height));
    }, function (dy, fine) {
      var r = fader.getBoundingClientRect();
      setDb(posToDb(dbToPos(s.db) + dy / r.height * (fine ? 0.2 : 1)));
    });
    fader.addEventListener("dblclick", function () { setDb(0); });
    keys(fader, function () { return s.db; }, setDb);
    s.setDb = setDb;
  });

  var m = document.createElement("div");
  m.className = "mc-strip mc-master";
  m.innerHTML =
    '<div class="mc-title">Master</div>' +
    '<div class="mc-status"><i></i>REKA</div>' +
    '<div class="mc-box mc-knob" role="slider" tabindex="0" aria-valuemin="-60" aria-valuemax="12" aria-label="Casque">' + knobSvg(76) + "<b></b><span>Casque</span></div>" +
    '<div class="mc-box">' + vuHtml() + "</div>";
  host.appendChild(m);
  var knob = m.querySelector(".mc-knob"), knobRead = knob.querySelector("b");
  master.bars = m.querySelectorAll(".mc-vu .bar");
  function setMaster(db) {
    master.db = clamp(Math.round(db * 10) / 10, -60, 12);
    setKnob(knob, 1 - dbToPos(master.db));
    knob.setAttribute("aria-valuenow", master.db);
    knob.setAttribute("aria-valuetext", fmt(master.db) + " dB");
    knobRead.textContent = fmt(master.db) + " dB";
    still();
  }
  dragY(knob, null, function (dy, fine) { setMaster(master.db - dy * (fine ? 0.06 : 0.3)); });
  knob.addEventListener("dblclick", function () { setMaster(0); });
  keys(knob, function () { return master.db; }, setMaster);

  /* Signal simulé de chaque strip, entre 0 et 1 : aucun son n'est joué. */
  function signal(s, t) {
    if (s.kind === "music") return 0.42 + 0.38 * Math.pow(1 - (t % 520) / 520, 3) + 0.08 * Math.sin(t * 0.002);
    if (s.kind === "desk") return 0.22 + 0.18 * Math.abs(Math.sin(t * 0.0016)) + (Math.random() < 0.012 ? 0.3 : 0);
    var voice = s.kind === "voice";
    if (t > s.next) {
      s.on = !s.on;
      s.next = t + (s.on ? (voice ? 900 : 1500) + Math.random() * 2400 : (voice ? 350 : 1200) + Math.random() * (voice ? 900 : 2800));
    }
    if (!s.on) return 0.015;
    return 0.32 + 0.56 * Math.abs(Math.sin(t * (voice ? 0.012 : 0.009) + s.ph)) * (0.65 + 0.35 * Math.random());
  }
  function paint(bars, lv, pk) {
    for (var c = 0; c < 2; c++) {
      bars[c].style.setProperty("--v", dbToPos(lv[c]).toFixed(3));
      bars[c].style.setProperty("--pk", dbToPos(pk[c]).toFixed(3));
    }
  }
  function follow(obj, c, target) {
    obj.lv[c] = target > obj.lv[c] ? obj.lv[c] + (target - obj.lv[c]) * 0.55 : Math.max(target, obj.lv[c] - 1.3);
    obj.pk[c] = Math.max(obj.pk[c] - 0.22, obj.lv[c]);
  }
  function step(t, fixed) {
    var power = [0, 0];
    strips.forEach(function (s) {
      var amp = fixed ? 0.5 : signal(s, t);
      for (var c = 0; c < 2; c++) {
        var a = amp * (fixed ? 1 : 0.9 + 0.1 * Math.random());
        var target = s.muted ? -60 : clamp(20 * Math.log10(Math.max(a, 0.001)) + s.db, -60, 12);
        if (fixed) { s.lv[c] = s.pk[c] = target; } else follow(s, c, target);
        if (s.send && !s.muted) power[c] += Math.pow(10, s.lv[c] / 10);
      }
      paint(s.bars, s.lv, s.pk);
    });
    for (var c = 0; c < 2; c++) {
      var target = power[c] > 0 ? clamp(10 * Math.log10(power[c]) + master.db, -60, 12) : -60;
      if (fixed) { master.lv[c] = master.pk[c] = target; } else follow(master, c, target);
    }
    paint(master.bars, master.lv, master.pk);
  }

  var running = 0, inView = true;
  function loop(t) {
    running = 0;
    if (!inView || document.hidden) return;
    step(t, false);
    running = requestAnimationFrame(loop);
  }
  function start() { if (!reduce && !running) running = requestAnimationFrame(loop); }
  /* Animations réduites : pas de mouvement continu, un niveau fixe mis à jour à chaque geste. */
  function still() { if (reduce && master.bars) step(0, true); }

  strips.forEach(function (s) { s.setDb(s.db); });
  setMaster(0);
  if (reduce) step(0, true);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; start(); }).observe(host);
  }
  document.addEventListener("visibilitychange", start);
  start();
})();
