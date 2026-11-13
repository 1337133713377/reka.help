/* REKA — micro de studio XLR en 3D, qui tourne au défilement.
   Le modèle est construit ici, pièce par pièce (aucun fichier 3D à charger).
   Three.js n'est téléchargé que lorsque la section approche de l'écran.
   Sans WebGL, sans JavaScript ou avec les animations réduites, la page garde
   l'image fixe du micro et les quatre étapes en texte. */

const section = document.querySelector(".mic-scrolly");
const reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

function webglOk() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) {
    return false;
  }
}

if (section && !reduce && webglOk()) {
  const start = () => {
    import("../vendor/three.module.min.js")
      .then((THREE) => import("../vendor/RoomEnvironment.js").then((env) => build(THREE, env.RoomEnvironment)))
      .catch(() => { /* la version fixe reste affichée */ });
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      start();
    }, { rootMargin: "900px 0px" });
    io.observe(section);
  } else {
    start();
  }
}

function build(THREE, RoomEnvironment) {
  const stage = section.querySelector(".mic-stage");
  const canvas = section.querySelector(".mic-canvas");
  const steps = Array.from(section.querySelectorAll(".mic-step"));
  const dots = Array.from(section.querySelectorAll(".mic-rail i"));
  const root = document.documentElement;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;

  /* ---------- Moteur de rendu ---------- */

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.95;

  const camera = new THREE.PerspectiveCamera(26, 1, 0.5, 400);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  /* ---------- Matières ---------- */

  function meshTexture(size, wire, rotate) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    g.fillStyle = "#000";
    g.fillRect(0, 0, size, size);
    g.strokeStyle = "#fff";
    g.lineWidth = wire;
    g.lineCap = "square";
    g.beginPath();
    if (rotate) {
      /* Maille en losanges : deux familles de fils en diagonale. */
      for (let k = -1; k <= 1; k++) {
        g.moveTo(k * size, 0); g.lineTo(k * size + size, size);
        g.moveTo(k * size + size, 0); g.lineTo(k * size, size);
      }
    } else {
      g.moveTo(size / 2, 0); g.lineTo(size / 2, size);
      g.moveTo(0, size / 2); g.lineTo(size, size / 2);
    }
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    t.colorSpace = THREE.NoColorSpace;
    return t;
  }

  const outerMesh = meshTexture(128, 38, true);
  outerMesh.repeat.set(70, 23);
  const innerMesh = meshTexture(64, 16, false);
  innerMesh.repeat.set(150, 56);

  const M = {
    chrome: new THREE.MeshStandardMaterial({ color: 0xe9ecf2, metalness: 1, roughness: 0.12 }),
    satin: new THREE.MeshPhysicalMaterial({ color: 0x20232b, metalness: 0.6, roughness: 0.36, clearcoat: 0.6, clearcoatRoughness: 0.22 }),
    grille: new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 1, roughness: 0.26, alphaMap: outerMesh, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide }),
    gauze: new THREE.MeshStandardMaterial({ color: 0x7c8290, metalness: 1, roughness: 0.48, alphaMap: innerMesh, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide }),
    gold: new THREE.MeshPhysicalMaterial({ color: 0xf3c56a, metalness: 1, roughness: 0.14, iridescence: 0.85, iridescenceIOR: 1.45, iridescenceThicknessRange: [180, 760] }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc8963f, metalness: 1, roughness: 0.3 }),
    gun: new THREE.MeshStandardMaterial({ color: 0x8d939e, metalness: 1, roughness: 0.3 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0d0f13, metalness: 0.2, roughness: 0.55 }),
    rubber: new THREE.MeshPhysicalMaterial({ color: 0x0b0c0f, metalness: 0, roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
    accent: new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 2.4, metalness: 0.2, roughness: 0.3 }),
    wave: new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  };

  const lathe = (pts, seg, mat) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg || 128), mat);
  const torus = (r, tube, mat, y) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 20, 160), mat);
    m.rotation.x = Math.PI / 2;
    m.position.y = y;
    return m;
  };
  function arc(cx, cy, r, from, to, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = from + (to - from) * (i / n);
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return out;
  }

  /* ---------- Le micro ---------- */

  const tilt = new THREE.Group();        /* inclinaison d'ensemble et pointeur */
  const spin = new THREE.Group();        /* rotation au défilement */
  tilt.add(spin);
  scene.add(tilt);

  /* Tête : grille extérieure en losanges, toile fine dessous, anneaux chromés. */
  const R = 2.72, HC = 3.4;
  const head = new THREE.Group();
  const headProfile = (r) => [[r, 0.2], [r, HC]].concat(arc(0, HC, r, 0, Math.PI / 2, 24).slice(1)).map(([x, y]) => [Math.max(x, 0.001), y]);
  head.add(lathe(headProfile(R), 144, M.grille));
  head.add(lathe(headProfile(R - 0.16), 144, M.gauze));
  head.add(torus(R + 0.03, 0.17, M.chrome, 0.2));
  head.add(torus(R + 0.01, 0.045, M.chrome, HC));
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), M.chrome);
  finial.position.y = HC + R;
  head.add(finial);
  spin.add(head);

  /* Capsule à double membrane, dorée et irisée, sur son berceau. */
  const capsule = new THREE.Group();
  capsule.position.y = 3.15;
  for (const z of [-0.24, 0.24]) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.62, 0.05, 96), M.gold);
    disc.rotation.x = Math.PI / 2;
    disc.position.z = z;
    capsule.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.1, 20, 96), M.brass);
    ring.position.z = z;
    capsule.add(ring);
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 24), M.brass);
    dot.rotation.x = Math.PI / 2;
    dot.position.z = z * 1.15;
    capsule.add(dot);
  }
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.74, 1.74, 0.48, 96, 1, true), M.black);
  band.rotation.x = Math.PI / 2;
  capsule.add(band);
  const cradle = new THREE.Mesh(new THREE.TorusGeometry(1.98, 0.075, 16, 96, Math.PI), M.chrome);
  cradle.rotation.z = Math.PI;
  capsule.add(cradle);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 1.3, 24), M.chrome);
  post.position.y = -2.55;
  capsule.add(post);
  spin.add(capsule);

  /* Corps : col chromé, fût satiné, anneau lumineux, logo, sélecteur. */
  spin.add(lathe([[0.001, 0.12], [2.62, 0.12], [2.76, 0.02], [2.78, -0.3], [2.7, -0.52], [0.001, -0.52]], 128, M.chrome));
  const bodyProfile = [[2.66, -0.52], [2.55, -0.7], [2.5, -1.4], [2.44, -4], [2.33, -8], [2.2, -11.2], [2.16, -12], [2.08, -12.35], [1.98, -12.45], [0.001, -12.45]];
  spin.add(lathe(bodyProfile, 160, M.satin));
  const glow = torus(2.53, 0.06, M.accent, -1.05);
  spin.add(glow);

  const badgeTex = new THREE.TextureLoader().load("assets/img/reka-mark-324.webp");
  badgeTex.colorSpace = THREE.SRGBColorSpace;
  badgeTex.anisotropy = maxAniso;
  const badge = new THREE.Mesh(
    new THREE.CylinderGeometry(2.478, 2.452, 1.12, 48, 1, true, -0.5, 1.0),
    new THREE.MeshStandardMaterial({ map: badgeTex, transparent: true, metalness: 0.3, roughness: 0.35, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -2 })
  );
  badge.position.y = -3.4;
  spin.add(badge);

  const switchPlate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.15, 0.2), M.black);
  switchPlate.position.set(0, -6.4, 2.33);
  spin.add(switchPlate);
  const nub = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.22), M.chrome);
  nub.position.set(0, -6.15, 2.45);
  spin.add(nub);
  for (const y of [-6.75, -6.4, -6.05]) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.02), M.chrome);
    mark.position.set(0.48, y, 2.35);
    spin.add(mark);
  }

  /* Embase XLR mâle : manchon chromé, isolant, trois broches dorées. */
  spin.add(lathe([[1.97, -12.35], [1.98, -13.9], [1.86, -13.98], [1.84, -12.4]], 96, M.chrome));
  const insulator = new THREE.Mesh(new THREE.CylinderGeometry(1.84, 1.84, 0.2, 64), M.black);
  insulator.position.y = -12.75;
  spin.add(insulator);
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.95, 20), M.gold);
    pin.position.set(Math.cos(a) * 0.62, -13.3, Math.sin(a) * 0.62);
    spin.add(pin);
  }

  /* Fiche XLR femelle, manchon de câble et câble. */
  const plug = new THREE.Group();
  plug.add(lathe([[0.001, -14.05], [1.8, -14.05], [1.84, -14.2], [1.84, -15.4], [1.72, -15.7], [1.6, -17.1], [1.3, -17.6], [0.001, -17.6]], 128, M.gun));
  for (let i = 0; i < 6; i++) plug.add(torus(1.67 - i * 0.02, 0.05, M.chrome, -15.85 - i * 0.22));
  const latch = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.18), M.chrome);
  latch.position.set(0, -14.6, 1.86);
  plug.add(latch);
  plug.add(lathe([[1.18, -17.55], [1.05, -18.4], [0.82, -19.6], [0.62, -20.8], [0.5, -21.6], [0.001, -21.6]], 96, M.rubber));
  for (let i = 0; i < 5; i++) plug.add(torus(1.0 - i * 0.09, 0.05, M.rubber, -18.2 - i * 0.62));
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 60, 32, 1, true), M.rubber);
  cable.position.y = -51.4;
  plug.add(cable);
  spin.add(plug);

  /* Impulsions qui descendent le câble : le son part vers ses sorties. */
  const pulses = [];
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.13, 14, 48), M.accent.clone());
    p.rotation.x = Math.PI / 2;
    p.visible = false;
    plug.add(p);
    pulses.push(p);
  }

  /* Ondes autour de la tête : la voix entre. */
  const waves = [];
  for (let i = 0; i < 4; i++) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 8, 128), M.wave.clone());
    w.rotation.x = Math.PI / 2;
    w.position.y = 3.1;
    tilt.add(w);
    waves.push(w);
  }

  /* ---------- Lumières ---------- */

  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-7, 9, 11);
  const rimA = new THREE.DirectionalLight(0x3b82f6, 4.5);
  rimA.position.set(-11, 3, -9);
  const rimB = new THREE.DirectionalLight(0x22d3ee, 4.5);
  rimB.position.set(11, 1, -7);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(8, -6, 9);
  scene.add(key, rimA, rimB, fill);

  /* ---------- Couleurs du thème ---------- */

  const red = new THREE.Color(0xef4444);
  const accent = new THREE.Color(0x3b82f6);
  const glowColor = new THREE.Color();
  function readTheme() {
    const cs = getComputedStyle(root);
    const get = (name, fallback) => {
      const v = cs.getPropertyValue(name).trim();
      try { return new THREE.Color(v || fallback); } catch (e) { return new THREE.Color(fallback); }
    };
    accent.copy(get("--accent", "#3b82f6"));
    rimA.color.copy(get("--grad-a", "#3b82f6"));
    rimB.color.copy(get("--grad-b", "#22d3ee"));
    pulses.forEach((p) => { p.material.color.copy(accent); p.material.emissive.copy(accent); });
    waves.forEach((w) => w.material.color.copy(rimB.color));
    dirty = true;
  }
  new MutationObserver(readTheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  /* ---------- Cadrage ---------- */

  let width = 0, height = 0, wide = true;
  function resize() {
    const r = stage.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width));
    height = Math.max(1, Math.round(r.height));
    wide = width / height > 1.05;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, wide ? 2 : 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    dirty = true;
  }

  /* ---------- Défilement ---------- */

  let progress = 0, shown = -1, dirty = true;
  function readScroll() {
    const r = section.getBoundingClientRect();
    const run = r.height - innerHeight;
    progress = run > 0 ? clamp(-r.top / run, 0, 1) : 0;
    const step = Math.min(steps.length - 1, Math.floor(progress * steps.length * 0.999));
    if (step !== shown) {
      shown = step;
      steps.forEach((s, i) => s.classList.toggle("on", i === step));
      dots.forEach((d, i) => d.classList.toggle("on", i <= step));
    }
    section.style.setProperty("--mic-p", progress.toFixed(4));
    dirty = true;
  }

  /* Le pointeur fait légèrement pencher le micro. */
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  stage.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const r = stage.getBoundingClientRect();
    look.tx = ((e.clientX - r.left) / r.width - 0.5) * 0.35;
    look.ty = ((e.clientY - r.top) / r.height - 0.5) * 0.18;
  }, { passive: true });
  stage.addEventListener("pointerleave", () => { look.tx = look.ty = 0; });

  /* ---------- Animation ---------- */

  let eased = 0, last = 0, running = 0, visible = false;
  function frame(t) {
    running = 0;
    if (!visible || document.hidden) return;
    const dt = last ? Math.min((t - last) / 1000, 0.05) : 0.016;
    last = t;

    eased += (progress - eased) * (1 - Math.pow(0.0015, dt));
    look.x += (look.tx - look.x) * 0.06;
    look.y += (look.ty - look.y) * 0.06;
    const p = eased;

    /* Étapes : brancher, ouvrir la tête, couper, envoyer. */
    const plugged = smooth(0.02, 0.15, p);
    const open = smooth(0.27, 0.4, p) - smooth(0.5, 0.6, p);
    const mute = smooth(0.55, 0.62, p) - smooth(0.76, 0.8, p);
    const send = smooth(0.78, 0.86, p);
    const voice = smooth(0.12, 0.2, p) * (1 - mute) * (1 - open) * (1 - send);

    spin.rotation.y = -0.65 + p * Math.PI * 2 + Math.sin(t * 0.0004) * 0.04;
    tilt.rotation.z = (wide ? 0.13 : 0.08) - p * 0.05;
    tilt.rotation.x = 0.14 - Math.sin(p * Math.PI) * 0.22 + look.y;
    tilt.rotation.y = look.x;
    tilt.position.y = Math.sin(t * 0.0011) * 0.18;

    head.position.y = open * 5.6;
    head.rotation.y = open * 0.6;
    capsule.position.y = 3.15 + open * 1.4;
    capsule.rotation.y = open * Math.sin(t * 0.0009) * 0.25;
    plug.position.y = -(1 - plugged) * 3.6;

    glowColor.copy(accent).lerp(red, mute);
    M.accent.color.copy(glowColor);
    M.accent.emissive.copy(glowColor);
    M.accent.emissiveIntensity = 2.4 + Math.sin(t * 0.004) * 0.4 * (1 - mute);

    waves.forEach((w, i) => {
      const k = ((t * 0.00042 + i / waves.length) % 1);
      const s = mix(3.1, 9.5, k);
      w.scale.set(s, s, s);
      w.material.opacity = voice * (1 - k) * 0.55;
      w.visible = w.material.opacity > 0.003;
    });
    pulses.forEach((pl, i) => {
      const k = ((t * 0.00055 + i / pulses.length) % 1);
      pl.position.y = mix(-21.4, -34, k);
      pl.material.emissiveIntensity = 5 * send * Math.sin(k * Math.PI);
      pl.scale.setScalar(0.6 + 0.6 * Math.sin(k * Math.PI));
      pl.visible = send > 0.01;
    });

    /* Cadrage : le micro à gauche sur grand écran, en haut sur téléphone. */
    const dist = (wide ? 84 : 124) * (1 - open * 0.1 + send * 0.1);
    const visH = 2 * dist * Math.tan((camera.fov * Math.PI) / 360);
    const visW = visH * camera.aspect;
    tilt.position.x = wide ? -visW * 0.2 : 0;
    const aimY = mix(-6.5, 0, open) - send * 2.5 + (wide ? 0 : -visH * 0.07);
    camera.position.set(0, aimY + 9, dist);
    camera.lookAt(0, aimY, 0);

    renderer.render(scene, camera);
    dirty = false;
    running = requestAnimationFrame(frame);
  }
  function kick() {
    if (!running && visible && !document.hidden) { last = 0; running = requestAnimationFrame(frame); }
  }

  /* ---------- Démarrage ---------- */

  section.classList.add("is-3d");
  resize();
  readTheme();
  readScroll();
  eased = progress;

  addEventListener("resize", () => { resize(); readScroll(); kick(); });
  addEventListener("scroll", () => { readScroll(); kick(); }, { passive: true });
  document.addEventListener("visibilitychange", kick);
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    kick();
  }).observe(section);

  /* Pour régénérer l'image fixe (assets/img/mic.webp) : window.__reka_mic_snapshot(900, 1200) */
  window.__reka_mic_snapshot = (w, h) => {
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    tilt.position.x = 0;
    camera.position.set(0, -0.5, 80);
    camera.lookAt(0, -7.5, 0);
    waves.forEach((w) => { w.visible = false; });
    renderer.render(scene, camera);
    const url = canvas.toDataURL("image/png");
    resize();
    return url;
  };
}
