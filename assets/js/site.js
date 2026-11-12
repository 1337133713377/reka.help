/* REKA — langue, thème, menu, visionneuse, recherche de l'aide.
   Aucune dépendance. Tout reste lisible sans JavaScript (français par défaut). */
(function () {
  "use strict";

  var root = document.documentElement;
  var REPO = "1337133713377/reka";

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* stockage indisponible : on continue sans mémoriser */ }
    return null;
  }

  /* ---------- Langue ---------- */

  function currentLang() { return root.getAttribute("data-lang") === "en" ? "en" : "fr"; }

  function setLang(lang, remember) {
    lang = lang === "en" ? "en" : "fr";
    root.setAttribute("data-lang", lang);
    root.setAttribute("lang", lang);
    if (remember) store("reka-lang", lang);

    var title = document.querySelector("title");
    if (title && title.dataset[lang]) document.title = title.dataset[lang];
    var desc = document.querySelector('meta[name="description"]');
    if (desc && desc.dataset[lang]) desc.setAttribute("content", desc.dataset[lang]);

    document.querySelectorAll(".lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.setLang === lang));
    });
    document.querySelectorAll("[data-ph-fr]").forEach(function (el) {
      el.setAttribute("placeholder", el.getAttribute("data-ph-" + lang));
    });
    document.querySelectorAll("[data-label-fr]").forEach(function (el) {
      el.setAttribute("aria-label", el.getAttribute("data-label-" + lang));
    });
    document.querySelectorAll("[data-alt-fr]").forEach(function (el) {
      el.setAttribute("alt", el.getAttribute("data-alt-" + lang));
    });
    document.dispatchEvent(new CustomEvent("reka:lang", { detail: lang }));
  }

  document.querySelectorAll(".lang button").forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.dataset.setLang, true); });
  });
  setLang(currentLang(), false);

  /* ---------- Menu mobile ---------- */

  var toggle = document.querySelector(".menu-toggle");
  var nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- Thèmes ---------- */

  var chips = document.querySelectorAll(".theme-chip");
  var stack = document.querySelector(".hero-shot .stack");
  var shownTheme = "studio";

  function setTheme(theme, remember) {
    if (theme === "studio") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    if (remember) store("reka-theme", theme);

    chips.forEach(function (c) {
      var on = c.dataset.theme === theme;
      c.setAttribute("aria-checked", String(on));
      c.tabIndex = on ? 0 : -1;
    });

    if (!stack || shownTheme === theme) return;
    shownTheme = theme;
    var src = theme === "studio" ? stack.dataset.base : "assets/img/theme-" + theme + ".webp";
    var loader = new Image();
    loader.onload = function () {
      if (shownTheme !== theme) return;           // un autre thème a été choisi entre-temps
      var current = stack.querySelector("img.top");
      var img = document.createElement("img");
      img.className = "top out";
      img.width = 1034; img.height = 860;
      img.alt = current ? current.alt : "";
      if (current && current.dataset.altFr) {
        img.dataset.altFr = current.dataset.altFr;
        img.dataset.altEn = current.dataset.altEn;
      }
      img.src = src;
      stack.appendChild(img);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { img.classList.remove("out"); });
      });
      setTimeout(function () {
        while (img.previousElementSibling) img.previousElementSibling.remove();
      }, 380);
    };
    loader.src = src;
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () { setTheme(chip.dataset.theme, true); });
    chip.addEventListener("keydown", function (e) {
      var group = Array.prototype.slice.call(chip.parentNode.querySelectorAll(".theme-chip"));
      var i = group.indexOf(chip);
      var step = (e.key === "ArrowRight" || e.key === "ArrowDown") ? 1
        : (e.key === "ArrowLeft" || e.key === "ArrowUp") ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      var target = group[(i + step + group.length) % group.length];
      target.focus();
      setTheme(target.dataset.theme, true);
    });
  });
  if (chips.length) setTheme(root.getAttribute("data-theme") || "studio", false);

  /* ---------- Dernière version publiée ---------- */

  var tags = document.querySelectorAll("[data-latest-version]");
  if (tags.length && window.fetch) {
    fetch("https://api.github.com/repos/" + REPO + "/releases/latest", {
      headers: { Accept: "application/vnd.github+json" }
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.tag_name) return;
        tags.forEach(function (t) { t.textContent = data.tag_name; });
      })
      .catch(function () { /* hors ligne ou limite atteinte : l'étiquette reste masquée */ });
  }

  /* ---------- Copier une commande ---------- */

  document.querySelectorAll(".cmd button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.parentNode.querySelector("span").textContent;
      var done = function () {
        btn.classList.add("copied");
        var before = btn.innerHTML;
        btn.textContent = currentLang() === "en" ? "Copied" : "Copié";
        setTimeout(function () { btn.innerHTML = before; btn.classList.remove("copied"); }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {});
      }
    });
  });

  /* ---------- Visionneuse d'images ---------- */

  var lightbox = document.querySelector(".lightbox");
  if (lightbox && lightbox.showModal) {
    var big = lightbox.querySelector("img");
    document.addEventListener("click", function (e) {
      var zoom = e.target.closest("button.zoom");
      if (!zoom) return;
      var imgs = zoom.querySelectorAll("img");
      var img = imgs[imgs.length - 1];
      var themed = zoom.querySelector(".stack") && shownTheme !== "studio";
      big.src = (!themed && zoom.dataset.full) || img.currentSrc || img.src;
      big.alt = img.alt;
      lightbox.showModal();
    });
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox || e.target === big) lightbox.close();
    });
  }

  /* ---------- Page d'aide : sommaire et recherche ---------- */

  var doc = document.querySelector(".doc");
  if (!doc) return;

  var sections = Array.prototype.slice.call(doc.querySelectorAll(".doc-section"));
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc a"));
  var select = document.querySelector(".toc-mobile select");

  function fillSelect() {
    if (!select) return;
    var lang = currentLang();
    select.innerHTML = "";
    var first = document.createElement("option");
    first.value = "";
    first.textContent = lang === "en" ? "Jump to a section…" : "Aller à une rubrique…";
    select.appendChild(first);
    tocLinks.forEach(function (a) {
      var label = a.querySelector('[lang="' + lang + '"]');
      var o = document.createElement("option");
      o.value = a.getAttribute("href");
      o.textContent = (label || a).textContent.trim();
      select.appendChild(o);
    });
  }
  if (select) {
    select.addEventListener("change", function () {
      if (select.value) { location.hash = select.value; select.value = ""; }
    });
  }
  fillSelect();

  if ("IntersectionObserver" in window) {
    var visible = {};
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      var current = null;
      sections.some(function (s) { if (visible[s.id]) { current = s.id; return true; } return false; });
      if (!current) return;
      tocLinks.forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("href") === "#" + current);
      });
    }, { rootMargin: "-80px 0px -60% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  }

  var input = document.querySelector("#help-search");
  var status = document.querySelector(".search-status");
  var empty = document.querySelector(".empty");
  var quick = document.querySelector(".quick");

  function norm(s) {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  var textCache = { fr: new WeakMap(), en: new WeakMap() };
  function langText(el, lang) {
    var cached = textCache[lang].get(el);
    if (cached !== undefined) return cached;
    var copy = el.cloneNode(true);
    var other = lang === "en" ? "fr" : "en";
    copy.querySelectorAll('[lang="' + other + '"]').forEach(function (n) { n.remove(); });
    var text = norm(copy.textContent + " " + (el.getAttribute("data-keywords") || ""));
    textCache[lang].set(el, text);
    return text;
  }

  function search() {
    var lang = currentLang();
    var words = norm(input.value).split(/\s+/).filter(Boolean);
    var shown = 0;

    sections.forEach(function (s) {
      var faqs = s.querySelectorAll("details.faq");
      if (!words.length) {
        s.hidden = false;
        faqs.forEach(function (d) { d.hidden = false; });
        return;
      }
      var hit;
      if (faqs.length) {
        var any = false;
        faqs.forEach(function (d) {
          var text = langText(d, lang);
          var ok = words.every(function (w) { return text.indexOf(w) !== -1; });
          d.hidden = !ok;
          d.open = ok;
          if (ok) any = true;
        });
        hit = any;
      } else {
        var body = langText(s, lang);
        hit = words.every(function (w) { return body.indexOf(w) !== -1; });
      }
      s.hidden = !hit;
      if (hit) shown++;
    });

    if (quick) quick.hidden = words.length > 0;
    tocLinks.forEach(function (a) {
      var target = document.getElementById(a.getAttribute("href").slice(1));
      a.parentNode.hidden = !!(target && target.hidden);
    });
    document.querySelectorAll(".toc ol").forEach(function (list) {
      var none = !list.querySelector("li:not([hidden])");
      list.hidden = none;
      if (list.previousElementSibling) list.previousElementSibling.hidden = none;
    });
    if (empty) empty.classList.toggle("show", words.length > 0 && shown === 0);
    if (status) {
      if (!words.length) status.textContent = "";
      else if (lang === "en") status.textContent = shown + (shown === 1 ? " section matches" : " sections match");
      else status.textContent = shown + (shown > 1 ? " rubriques correspondent" : " rubrique correspond");
    }
  }

  if (input) {
    input.addEventListener("input", search);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { input.value = ""; search(); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && document.activeElement !== input &&
          !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
        e.preventDefault();
        input.focus();
      }
    });
    var q = new URLSearchParams(location.search).get("q");
    if (q) { input.value = q; search(); }
  }

  document.addEventListener("reka:lang", function () {
    fillSelect();
    if (input && input.value) search();
  });

  /* Un lien direct vers une question l'ouvre. */
  function openFromHash() {
    if (!location.hash) return;
    var target;
    try { target = document.querySelector(location.hash); } catch (e) { return; }
    if (target && target.tagName === "DETAILS") target.open = true;
  }
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();
