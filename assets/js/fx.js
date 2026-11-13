/* REKA — effets visuels : apparitions, relief 3D sous le pointeur, console du haut
   de page, champ d'égaliseur en perspective, carrousel de thèmes, vue éclatée d'une
   strip et mini-console interactive. Aucune dépendance.
   Tout est décoratif : sans ce script, les pages restent complètes. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function onTheme(fn) {
    new MutationObserver(fn).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  }
  function theme() { return root.getAttribute("data-theme") || "studio"; }

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
        }, 1100 + delay * 1000);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
    reveals.forEach(function (el) { seen.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.remove("reveal"); });
  }

  /* ---------- Cartes : inclinaison 3D et reflet sous le pointeur ---------- */

  var TILTABLE = ".card, .tile, .quick a, .final .box, .support";
  var tilted = null;
  function untilt(el) {
    el.style.removeProperty("--rx");
    el.style.removeProperty("--ry");
  }
  document.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    var el = e.target.closest ? e.target.closest(TILTABLE) : null;
    if (tilted && tilted !== el) untilt(tilted);
    tilted = el;
    if (!el) return;
    var r = el.getBoundingClientRect();
    var px = clamp((e.clientX - r.left) / r.width, 0, 1), py = clamp((e.clientY - r.top) / r.height, 0, 1);
    el.style.setProperty("--mx", (px * r.width).toFixed(0) + "px");
    el.style.setProperty("--my", (py * r.height).toFixed(0) + "px");
    if (reduce) return;
    var max = clamp(5200 / r.width, 3, 12);          /* les grands blocs penchent moins */
    el.style.setProperty("--ry", ((px - 0.5) * 2 * max).toFixed(2));
    el.style.setProperty("--rx", ((0.5 - py) * 2 * max).toFixed(2));
  }, { passive: true });
  document.addEventListener("pointerleave", function () { if (tilted) { untilt(tilted); tilted = null; } });
  root.addEventListener("mouseleave", function () { if (tilted) { untilt(tilted); tilted = null; } });

  /* ---------- Console du haut de page : suit le pointeur, se redresse au défilement ---------- */

  var hero = document.querySelector(".hero"), rig = document.querySelector(".rig");
  if (hero && rig && !reduce) {
    var want = { rx: 0, ry: 0 }, now = { rx: 0, ry: 0 }, easing = 0, queued = false;
    var ease = function () {
      easing = 0;
      now.rx += (want.rx - now.rx) * 0.09;
      now.ry += (want.ry - now.ry) * 0.09;
      rig.style.setProperty("--rx", now.rx.toFixed(2));
      rig.style.setProperty("--ry", now.ry.toFixed(2));
      if (Math.abs(want.rx - now.rx) + Math.abs(want.ry - now.ry) > 0.02) easing = requestAnimationFrame(ease);
    };
    var go = function () { if (!easing) easing = requestAnimationFrame(ease); };
    hero.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      var r = hero.getBoundingClientRect();
      want.ry = ((e.clientX - r.left) / r.width - 0.5) * 16;
      want.rx = (0.5 - (e.clientY - r.top) / r.height) * 9;
      go();
    }, { passive: true });
    hero.addEventListener("pointerleave", function () { want.rx = want.ry = 0; go(); });

    var lean = function () {
      queued = false;
      var top = rig.getBoundingClientRect().top;
      rig.style.setProperty("--tilt", (clamp((top - innerHeight * 0.1) / (innerHeight * 0.6), 0, 1) * 15).toFixed(2));
    };
    addEventListener("scroll", function () { if (!queued) { queued = true; requestAnimationFrame(lean); } }, { passive: true });
    addEventListener("resize", lean);
    lean();
  }

  /* Changement de thème : la console fait un demi-tour sur elle-même. */
  var flipper = document.querySelector(".flipper");
  if (flipper && !reduce) {
    onTheme(function () {
      flipper.classList.remove("flip");
      void flipper.offsetWidth;                       /* relance l'animation */
      flipper.classList.add("flip");
    });
    flipper.addEventListener("animationend", function () { flipper.classList.remove("flip"); });
  }

  /* ---------- Champ d'égaliseur 3D derrière la console ---------- */

  var canvas = document.querySelector(".spectrum");
  if (canvas && canvas.getContext && !reduce) {
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, focal = 600, horizon = 0, visible = true, frame = 0;
    var colA = [59, 130, 246], colB = [34, 211, 238], hideL = 0, hideR = 0;
    var COLS = 44, ROWS = 9, SX = 74, SZ = 112, BW = 40, BD = 46, MAXH = 270, CAM_Y = 310, CAM_Z = -430;
    var seeds = [], order = [];
    for (var c = 0; c < COLS; c++) { seeds.push(Math.random() * 6.28); order.push(c); }
    var centerX = function (col) { return (col - (COLS - 1) / 2) * SX; };
    order.sort(function (a, b) { return Math.abs(centerX(b)) - Math.abs(centerX(a)); });   /* de l'extérieur vers le centre */

    var hex = function (value, fallback) {
      var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
      if (!m) return fallback;
      var h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
      var n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    var readColors = function () {
      var cs = getComputedStyle(root);
      colA = hex(cs.getPropertyValue("--grad-a"), colA);
      colB = hex(cs.getPropertyValue("--grad-b"), colB);
    };
    var resize = function () {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      focal = H * 1.1; horizon = H * 0.28;
      /* Zone cachée par la capture : inutile d'y dessiner. */
      var shot = document.querySelector(".hero-shot"), box = canvas.getBoundingClientRect();
      if (shot) { var s = shot.getBoundingClientRect(); hideL = s.left - box.left + 90; hideR = s.right - box.left - 90; }
    };
    var px = function (x, z) { return W / 2 + x * focal / (z - CAM_Z); };
    var py = function (y, z) { return horizon + (CAM_Y - y) * focal / (z - CAM_Z); };
    var quad = function (x1, y1, x2, y2, x3, y3, x4, y4, r, g, b, a) {
      ctx.fillStyle = "rgba(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + "," + a.toFixed(3) + ")";
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();
    };

    var draw = function (t) {
      frame = 0;
      if (!visible || document.hidden || !W) return;
      ctx.clearRect(0, 0, W, H);

      /* Sol quadrillé qui fuit vers l'horizon. */
      var zFar = (ROWS - 1) * SZ + BD, half = COLS / 2 * SX;
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(" + colA[0] + "," + colA[1] + "," + colA[2] + ",0.16)";
      ctx.beginPath();
      for (var i = 0; i <= COLS; i += 2) {
        var gx = (i - COLS / 2) * SX;
        ctx.moveTo(px(gx, -SZ), py(0, -SZ)); ctx.lineTo(px(gx, zFar), py(0, zFar));
      }
      for (var j = -1; j <= ROWS; j++) {
        var gz = j * SZ - (SZ - BD) / 2;
        ctx.moveTo(px(-half, gz), py(0, gz)); ctx.lineTo(px(half, gz), py(0, gz));
      }
      ctx.stroke();

      for (var row = ROWS - 1; row >= 0; row--) {
        var z0 = row * SZ, z1 = z0 + BD, fog = 1 - row / ROWS * 0.78;
        for (var k = 0; k < COLS; k++) {
          var col = order[k], cx = centerX(col), x0 = cx - BW / 2, x1 = cx + BW / 2;
          var fl = px(x0, z0), fr = px(x1, z0);
          if (fr < -40 || fl > W + 40) continue;
          if (fl > hideL && fr < hideR) continue;

          var a = 0.5 + 0.5 * Math.sin(t * 0.0016 + row * 0.7 + col * 0.33);
          var b = 0.5 + 0.5 * Math.sin(t * 0.0027 - col * 0.52 + row * 0.2);
          var d = 0.5 + 0.5 * Math.sin(t * 0.0009 + col * 0.17 + seeds[col] + row);
          var lvl = 0.05 + 0.95 * a * b * (0.45 + 0.55 * d), h = lvl * MAXH;
          var r = colA[0] + (colB[0] - colA[0]) * lvl, g = colA[1] + (colB[1] - colA[1]) * lvl, bl = colA[2] + (colB[2] - colA[2]) * lvl;

          var bl0 = px(x0, z1), br0 = px(x1, z1);
          var gy0 = py(0, z0), ty0 = py(h, z0), ty1 = py(h, z1), gy1 = py(0, z1);
          /* Flanc tourné vers le centre, puis face avant, puis dessus. */
          if (x0 > 0) quad(fl, gy0, fl, ty0, bl0, ty1, bl0, gy1, r * 0.42, g * 0.42, bl * 0.42, fog * 0.85);
          else if (x1 < 0) quad(fr, gy0, fr, ty0, br0, ty1, br0, gy1, r * 0.42, g * 0.42, bl * 0.42, fog * 0.85);
          quad(fl, gy0, fr, gy0, fr, ty0, fl, ty0, r * 0.8, g * 0.8, bl * 0.8, fog * 0.72);
          quad(fl, ty0, fr, ty0, br0, ty1, bl0, ty1, Math.min(255, r * 1.25 + 30), Math.min(255, g * 1.25 + 30), Math.min(255, bl * 1.25 + 30), fog * 0.95);
        }
      }
      frame = requestAnimationFrame(draw);
    };
    var kick = function () { if (!frame) frame = requestAnimationFrame(draw); };

    readColors(); resize(); kick();
    addEventListener("resize", function () { resize(); kick(); });
    document.addEventListener("visibilitychange", kick);
    onTheme(readColors);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; kick(); }).observe(canvas);
    }
  }

  /* ---------- Vue éclatée d'une strip ---------- */

  var iso = document.querySelector(".iso");
  if (iso) {
    var plates = iso.querySelectorAll(".plate"), items = document.querySelectorAll(".layers li");
    var light = function (layer) {
      iso.classList.toggle("dim", layer !== null);
      plates.forEach(function (p) { p.classList.toggle("on", p.dataset.layer === layer); });
      items.forEach(function (li) { li.classList.toggle("on", li.dataset.layer === layer); });
    };
    items.forEach(function (li) {
      li.addEventListener("pointerenter", function () { light(li.dataset.layer); });
      li.addEventListener("pointerleave", function () { light(null); });
      li.addEventListener("focus", function () { light(li.dataset.layer); });
      li.addEventListener("blur", function () { light(null); });
    });
    if (!reduce) {
      /* Les étages s'écartent à mesure que le bloc entre dans l'écran. */
      var stageEl = iso.parentNode, waiting = false;
      var spread = function () {
        waiting = false;
        var r = stageEl.getBoundingClientRect();
        var p = clamp(1 - (r.top - innerHeight * 0.2) / (innerHeight * 0.65), 0, 1);
        iso.style.setProperty("--gap", (14 + p * 80).toFixed(1) + "px");
      };
      addEventListener("scroll", function () { if (!waiting) { waiting = true; requestAnimationFrame(spread); } }, { passive: true });
      addEventListener("resize", spread);
      spread();
    }
  }

  /* ---------- Thèmes : carrousel en anneau ---------- */

  function applyTheme(name) {
    var chip = document.querySelector('.theme-chip[data-theme="' + name + '"]');
    if (chip) chip.click();
  }
  var stage = document.querySelector(".theme-stage");
  var cards = stage ? Array.prototype.slice.call(stage.querySelectorAll(".theme-card")) : [];
  if (cards.length) {
    var wall = stage.querySelector(".theme-wall");
    var count = cards.length, turn = 360 / count, index = 0, angle = 0, touched = false, inView = false, auto = 0, pressedFront = null;
    stage.classList.add("ring");
    cards.forEach(function (card, i) { card.style.setProperty("--i", i); });

    var rotateTo = function (i) {
      i = ((i % count) + count) % count;
      var delta = ((i - index) % count + count) % count;
      if (delta > count / 2) delta -= count;        /* par le chemin le plus court */
      index = i; angle -= delta * turn;
      wall.style.setProperty("--angle", angle);
      cards.forEach(function (card, n) { card.classList.toggle("front", n === index); });
    };
    var sync = function () {
      cards.forEach(function (card) { card.setAttribute("aria-pressed", String(card.dataset.pick === theme())); });
    };

    cards.forEach(function (card, i) {
      card.addEventListener("pointerdown", function () { pressedFront = card.classList.contains("front"); });
      card.addEventListener("focus", function () { touched = true; rotateTo(i); });
      card.addEventListener("click", function () {
        var wasFront = pressedFront === null ? true : pressedFront;
        pressedFront = null; touched = true;
        rotateTo(i);
        applyTheme(wasFront && theme() === card.dataset.pick ? "studio" : card.dataset.pick);
      });
    });
    document.querySelectorAll("[data-ring]").forEach(function (btn) {
      btn.addEventListener("click", function () { touched = true; rotateTo(index + Number(btn.dataset.ring)); });
    });
    onTheme(sync);
    sync();

    var start = cards.findIndex(function (card) { return card.dataset.pick === theme(); });
    rotateTo(start < 0 ? 0 : start);

    /* Un tour de présentation, tant que personne n'y a touché. */
    if (!reduce && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; }, { threshold: 0.4 }).observe(stage);
      var timer = setInterval(function () {
        if (touched || auto >= count) { clearInterval(timer); return; }
        if (!inView || document.hidden || stage.matches(":hover")) return;
        auto++; rotateTo(index + 1);
      }, 3200);
    }
  }
  document.querySelectorAll('[data-pick="studio"]').forEach(function (btn) {
    btn.addEventListener("click", function () { applyTheme("studio"); });
  });

  /* ---------- Titre : les mots se lèvent un à un ---------- */

  document.querySelectorAll(".hero h1").forEach(function (h1) {
    if (!reduce) {
      var i = 0;
      Array.prototype.slice.call(h1.childNodes).forEach(function (node) {
        if (node.nodeType === 1) { node.classList.add("w"); node.style.setProperty("--i", i++); return; }
        if (node.nodeType !== 3) return;
        var frag = document.createDocumentFragment();
        node.textContent.split(/( +)/).forEach(function (part) {
          if (!part) return;
          if (part.charAt(0) === " ") { frag.appendChild(document.createTextNode(part)); return; }
          var span = document.createElement("span");
          span.className = "w"; span.style.setProperty("--i", i++); span.textContent = part;
          frag.appendChild(span);
        });
        h1.replaceChild(frag, node);
      });
    }
    h1.classList.add("words");
  });

  /* ---------- Lumière qui suit le pointeur ---------- */

  if (!reduce) {
    var glow = null, gx = 0, gy = 0, glowQueued = false;
    document.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      if (!glow) { glow = document.createElement("div"); glow.className = "cursor-light"; document.body.appendChild(glow); }
      gx = e.clientX; gy = e.clientY;
      if (glowQueued) return;
      glowQueued = true;
      requestAnimationFrame(function () {
        glowQueued = false;
        glow.style.transform = "translate3d(" + gx + "px," + gy + "px,0)";
        glow.classList.add("on");
      });
    }, { passive: true });
    root.addEventListener("mouseleave", function () { if (glow) glow.classList.remove("on"); });
  }

  /* ---------- En-tête : progression de lecture et rubrique en cours ---------- */

  var bar = document.querySelector(".site-header .wrap");
  var spyLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  var spyTargets = spyLinks.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
  if (bar) {
    var barQueued = false;
    var progress = function () {
      barQueued = false;
      var max = document.documentElement.scrollHeight - innerHeight;
      bar.style.setProperty("--scroll", max > 0 ? clamp(scrollY / max, 0, 1).toFixed(4) : 0);
      var current = -1;
      spyTargets.forEach(function (el, n) { if (el && el.getBoundingClientRect().top < innerHeight * 0.4) current = n; });
      spyLinks.forEach(function (a, n) { a.classList.toggle("active", n === current); });
    };
    addEventListener("scroll", function () { if (!barQueued) { barQueued = true; requestAnimationFrame(progress); } }, { passive: true });
    addEventListener("resize", progress);
    progress();
  }

  /* ---------- Grands chiffres : comptent jusqu'à leur valeur ---------- */

  var counters = document.querySelectorAll("[data-count]");
  if (counters.length && !reduce && "IntersectionObserver" in window) {
    var counted = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target, goal = Number(el.dataset.count), t0 = 0;
        counted.unobserve(el);
        var tick = function (t) {
          if (!t0) t0 = t;
          var k = clamp((t - t0) / 1100, 0, 1);
          el.textContent = Math.round(goal * (1 - Math.pow(1 - k, 3)));
          if (k < 1) requestAnimationFrame(tick);
        };
        el.textContent = "0";
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { counted.observe(el); });
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

  /* Glisser vertical, à la souris, au doigt ou au stylet. Pendant le geste, la
     console reste à plat (classe « busy ») pour que le pointeur tombe juste. */
  function dragY(el, onStart, onMove) {
    el.addEventListener("pointerdown", function (e) {
      if (e.button) return;
      e.preventDefault();
      el.focus({ preventScroll: true });
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* pointeur déjà relâché */ }
      el.classList.add("drag");
      host.classList.add("busy");
      var last = e.clientY;
      if (onStart) onStart(e);
      var move = function (ev) { var dy = ev.clientY - last; last = ev.clientY; onMove(dy, ev.shiftKey); };
      var up = function () {
        el.classList.remove("drag");
        host.classList.remove("busy");
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

  var running = 0, consoleInView = true;
  function loop(t) {
    running = 0;
    if (!consoleInView || document.hidden) return;
    step(t, false);
    running = requestAnimationFrame(loop);
  }
  function startLoop() { if (!reduce && !running) running = requestAnimationFrame(loop); }
  /* Animations réduites : pas de mouvement continu, un niveau fixe mis à jour à chaque geste. */
  function still() { if (reduce && master.bars) step(0, true); }

  strips.forEach(function (s) { s.setDb(s.db); });
  setMaster(0);
  if (reduce) step(0, true);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) { consoleInView = entries[0].isIntersecting; startLoop(); }).observe(host);
  }
  document.addEventListener("visibilitychange", startLoop);
  startLoop();
})();
