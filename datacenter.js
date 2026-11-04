/* PINESTIC: recorrido 3D por un datacenter, controlado por el scroll.
   Requiere three.js (UMD) cargado antes. Toda la escena se construye con geometría y texturas propias. */
(function () {
  'use strict';

  var tour = document.querySelector('[data-tour]');
  if (!tour) return;

  var stations = Array.prototype.slice.call(tour.querySelectorAll('[data-station]'));
  var N = stations.length;
  var counter = tour.querySelector('[data-tour-count]');
  var bar = tour.querySelector('[data-tour-bar]');
  var intro = tour.querySelector('[data-tour-intro]');
  var outro = tour.querySelector('[data-tour-outro]');
  var hint = tour.querySelector('[data-tour-hint]');

  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nav = navigator, conn = nav.connection || {};
  var smallScreen = window.innerWidth < 760;
  // Equipos modestos o ahorro de datos: imagen fija en lugar de 3D
  var lowEnd = (nav.deviceMemory && nav.deviceMemory <= 2) || conn.saveData ||
    (smallScreen && nav.hardwareConcurrency && nav.hardwareConcurrency <= 4);
  if (reduce || lowEnd || !hasWebGL()) { tour.classList.add('tour-static'); return; }

  // three.js se descarga solo cuando se va a usar
  function loadThree(cb) {
    if (window.THREE) return cb();
    var sc = document.createElement('script');
    sc.src = tour.getAttribute('data-three') || '/vendor/three.min.js';
    sc.onload = cb;
    sc.onerror = function () { tour.classList.add('tour-static'); };
    document.head.appendChild(sc);
  }
  // Diferir la construccion de la escena hasta que el navegador haya pintado
  // la pagina y exista un momento ocioso. Evita competir con la carga inicial.
  var initialized = false;
  function initialize() {
    if (initialized) return;
    initialized = true;
    loadThree(run);
  }
  function scheduleScene() {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(initialize, { timeout: 4500 });
    } else {
      setTimeout(initialize, 2800);
    }
  }
  if (document.readyState === 'complete') scheduleScene();
  else window.addEventListener('load', scheduleScene, { once: true });
  // Si el visitante empieza a recorrer la pagina, activar antes la escena.
  tour.addEventListener('pointerdown', initialize, { once: true, passive: true });

  function run() {
  tour.classList.add('tour-3d');
  var THREE = window.THREE;
  var mobile = window.innerWidth < 760;
  var canvas = tour.querySelector('canvas');
  var C = { cyan: 0x11c5e9, coral: 0xff606a, green: 0x5be3a0 };

  /* ---------- Renderizador ---------- */
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  var maxAniso = renderer.capabilities.getMaxAnisotropy();

  var scene = new THREE.Scene();
  var FOG = 0x05080f;
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.FogExp2(FOG, mobile ? 0.06 : 0.05);
  var camera = new THREE.PerspectiveCamera(mobile ? 72 : 58, 1, 0.05, 140);

  /* ---------- Medidas reales (metros) ---------- */
  var SPACING = 13;
  var Z_START = 9;
  var LENGTH = (N + 2) * SPACING + 24;
  var Z_END = Z_START - LENGTH;
  var MID = Z_START - LENGTH / 2;
  var AISLE = 2.0;                 // pasillo frío entre frentes de racks
  var RACK_W = 0.6, RACK_D = 1.1, RACK_H = 2.1;
  var FRONT_X = AISLE / 2;         // el frente de cada rack mira al pasillo
  var RACK_X = FRONT_X + RACK_D / 2;
  var ROOF_Y = RACK_H + 0.02;      // techo de vidrio del pasillo confinado
  function gateZ(i) { return -(i + 1) * SPACING; }

  /* ---------- Utilidades de texturas ---------- */
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function tex(c, repeatX, repeatY) {
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
    if (repeatX) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatX, repeatY); }
    return t;
  }
  function glowTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    var r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.4)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    return tex(c);
  }
  var GLOW = glowTexture();

  /* ---------- Frente de rack de 42U con equipos variados ---------- */
  // Cada variante dibuja una textura de color y otra de luces (LEDs que brillan sin iluminación)
  var UPX = 20, TOP = 28, TEXW = 256, TEXH = TOP * 2 + 42 * UPX;
  function rackFace(variant, seed) {
    var r = rng(seed);
    var c = document.createElement('canvas'); c.width = TEXW; c.height = TEXH;
    var e = document.createElement('canvas'); e.width = TEXW; e.height = TEXH;
    var g = c.getContext('2d'), ge = e.getContext('2d');
    ge.fillStyle = '#000'; ge.fillRect(0, 0, TEXW, TEXH);
    g.fillStyle = '#0b0c0f'; g.fillRect(0, 0, TEXW, TEXH);
    // Rieles con perforaciones cuadradas
    [[4, 14], [TEXW - 18, 14]].forEach(function (rl) {
      g.fillStyle = '#1d2026'; g.fillRect(rl[0], 0, rl[1], TEXH);
      g.fillStyle = '#07080a';
      for (var y = TOP + 3; y < TEXH - TOP; y += UPX / 3) g.fillRect(rl[0] + 4, y, 6, 3);
    });
    // Marco superior e inferior
    g.fillStyle = '#16181d'; g.fillRect(0, 0, TEXW, TOP); g.fillRect(0, TEXH - TOP, TEXW, TOP);
    g.fillStyle = '#25282f'; g.fillRect(0, TOP - 2, TEXW, 2); g.fillRect(0, TEXH - TOP, TEXW, 2);

    var X0 = 20, W = TEXW - 40;
    function led(x, y, col, sz) { ge.fillStyle = col; ge.fillRect(x, y, sz || 2, sz || 2); g.fillStyle = col; g.fillRect(x, y, sz || 2, sz || 2); }
    function bezel(y, u, base) {
      var h = u * UPX - 1;
      var gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, base[0]); gr.addColorStop(1, base[1]);
      g.fillStyle = gr; g.fillRect(X0, y, W, h);
      g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(X0, y, W, 1);
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(X0, y + h - 1, W, 1);
      // Asas laterales
      g.fillStyle = '#4a4e57'; g.fillRect(X0 + 1, y + 3, 4, h - 6); g.fillRect(X0 + W - 5, y + 3, 4, h - 6);
      return h;
    }
    var GREEN = '#3dff8a', BLUE = '#3aa8ff', AMBER = '#ffb23a', WHITE = '#e8f4ff';
    var devices = {
      blank: function (y) {
        bezel(y, 1, ['#15171b', '#101114']);
        if (r() < 0.5) { g.fillStyle = '#0a0b0d'; for (var x = X0 + 12; x < X0 + W - 12; x += 5) g.fillRect(x, y + 6, 2, UPX - 13); }
        return 1;
      },
      server1u: function (y) {
        var silver = r() < 0.4;
        bezel(y, 1, silver ? ['#5d636d', '#3c4048'] : ['#2b2f36', '#1c1f24']);
        for (var b = 0; b < 8; b++) {
          var bx = X0 + 10 + b * 21;
          g.fillStyle = silver ? '#2a2d33' : '#14161a'; g.fillRect(bx, y + 3, 18, UPX - 7);
          g.fillStyle = '#0a0b0d'; g.fillRect(bx + 2, y + 5, 10, UPX - 11);
          led(bx + 14, y + 5, r() < 0.92 ? GREEN : AMBER);
          if (r() < 0.6) led(bx + 14, y + 10, BLUE);
        }
        g.fillStyle = '#0a0b0d'; g.fillRect(X0 + W - 30, y + 4, 22, UPX - 9);
        led(X0 + W - 26, y + 7, BLUE, 3); led(X0 + W - 19, y + 7, GREEN, 2);
        return 1;
      },
      server2u: function (y) {
        bezel(y, 2, ['#2a2e35', '#191b20']);
        for (var row = 0; row < 3; row++) for (var col = 0; col < 4; col++) {
          var bx = X0 + 10 + col * 44, by = y + 3 + row * 12;
          g.fillStyle = '#16181c'; g.fillRect(bx, by, 41, 10);
          g.fillStyle = '#3b3f47'; g.fillRect(bx + 2, by + 3, 22, 4);
          led(bx + 34, by + 4, r() < 0.93 ? GREEN : AMBER);
        }
        g.fillStyle = '#101114'; g.fillRect(X0 + W - 34, y + 4, 26, 2 * UPX - 9);
        for (var v = 0; v < 6; v++) { g.fillStyle = '#1e2026'; g.fillRect(X0 + W - 32, y + 7 + v * 5, 22, 2); }
        led(X0 + W - 30, y + 2 * UPX - 9, BLUE, 3);
        return 2;
      },
      switch1u: function (y) {
        bezel(y, 1, ['#1f2329', '#15171b']);
        for (var p = 0; p < 24; p++) {
          var px = X0 + 14 + p * 6.4 + Math.floor(p / 6) * 3;
          for (var rr = 0; rr < 2; rr++) {
            g.fillStyle = '#050506'; g.fillRect(px, y + 5 + rr * 6, 5, 5);
            if (r() < 0.75) led(px + 1, y + 4 + rr * 6, r() < 0.85 ? GREEN : AMBER, 1);
          }
        }
        for (var s = 0; s < 4; s++) { g.fillStyle = '#0a0a0b'; g.fillRect(X0 + W - 38 + s * 8, y + 6, 6, 8); led(X0 + W - 37 + s * 8, y + 4, GREEN, 1); }
        // Cables de red de colores saliendo de los puertos
        if (r() < 0.7) {
          var col = r() < 0.5 ? '#2f6fd6' : (r() < 0.5 ? '#d6c22f' : '#9aa0aa');
          g.strokeStyle = col; g.lineWidth = 2;
          for (var k = 0; k < 18; k++) { var cx = X0 + 16 + k * 8.5; g.beginPath(); g.moveTo(cx, y + 10); g.lineTo(cx + (k - 9) * 0.6, y + UPX + 3); g.stroke(); }
        }
        return 1;
      },
      patch1u: function (y) {
        bezel(y, 1, ['#141518', '#0e0f11']);
        g.fillStyle = '#d9dde3'; g.fillRect(X0 + 12, y + 2, W - 24, 3);
        for (var p = 0; p < 24; p++) { g.fillStyle = '#050506'; g.fillRect(X0 + 14 + p * 9, y + 8, 6, 6); }
        return 1;
      },
      cableman: function (y) {
        bezel(y, 1, ['#0f1012', '#0b0c0d']);
        g.fillStyle = '#1a1b1e'; for (var d = 0; d < 5; d++) g.fillRect(X0 + 16 + d * 44, y + 4, 22, UPX - 8);
        return 1;
      },
      storage4u: function (y) {
        bezel(y, 4, ['#30343c', '#1b1d22']);
        for (var row = 0; row < 3; row++) for (var col = 0; col < 4; col++) {
          var bx = X0 + 10 + col * 50, by = y + 6 + row * 24;
          g.fillStyle = '#121418'; g.fillRect(bx, by, 46, 21);
          g.fillStyle = '#41454e'; g.fillRect(bx + 3, by + 15, 28, 3);
          for (var v = 0; v < 5; v++) { g.fillStyle = '#1d2026'; g.fillRect(bx + 3, by + 3 + v * 2.4, 34, 1); }
          led(bx + 40, by + 4, r() < 0.95 ? GREEN : AMBER, 2); led(bx + 40, by + 9, BLUE, 2);
        }
        g.fillStyle = '#d9dde3'; g.fillRect(X0 + W / 2 - 18, y + 4 * UPX - 7, 36, 3);
        return 4;
      },
      ups2u: function (y) {
        bezel(y, 2, ['#202328', '#141619']);
        g.fillStyle = '#0a1a24'; g.fillRect(X0 + 20, y + 8, 40, 20);
        ge.fillStyle = '#1d6f8a'; ge.fillRect(X0 + 20, y + 8, 40, 20);
        g.fillStyle = '#1d6f8a'; g.fillRect(X0 + 20, y + 8, 40, 20);
        led(X0 + 70, y + 12, GREEN, 3);
        for (var v = 0; v < 12; v++) { g.fillStyle = '#0c0d10'; g.fillRect(X0 + 90 + v * 10, y + 6, 6, 2 * UPX - 12); }
        return 2;
      }
    };
    var plans = {
      compute: ['cableman', 'switch1u', 'blank', 'server1u', 'server1u', 'server1u', 'server1u', 'server2u', 'server2u', 'server1u', 'server1u', 'blank', 'server2u', 'server2u', 'server1u', 'server1u', 'server1u', 'blank', 'server2u', 'server2u', 'ups2u'],
      network: ['patch1u', 'cableman', 'switch1u', 'switch1u', 'cableman', 'patch1u', 'switch1u', 'switch1u', 'cableman', 'blank', 'blank', 'server1u', 'server1u', 'blank', 'patch1u', 'switch1u', 'cableman', 'blank', 'blank', 'blank', 'ups2u'],
      storage: ['switch1u', 'cableman', 'storage4u', 'storage4u', 'blank', 'storage4u', 'server2u', 'server2u', 'blank', 'storage4u', 'server1u', 'server1u', 'blank', 'ups2u'],
      mixed: ['patch1u', 'switch1u', 'blank', 'server2u', 'server1u', 'blank', 'blank', 'server1u', 'server2u', 'storage4u', 'blank', 'blank', 'server1u', 'server1u', 'blank', 'blank', 'ups2u']
    };
    var plan = plans[variant], u = 0, i = 0;
    while (u < 42) {
      var name = plan[i % plan.length]; i++;
      var need = name === 'storage4u' ? 4 : (name === 'server2u' || name === 'ups2u') ? 2 : 1;
      if (u + need > 42) name = 'blank', need = 1;
      devices[name](TOP + u * UPX);
      u += need;
    }
    return { map: tex(c), emissive: tex(e) };
  }

  /* ---------- Piso técnico de baldosas (normales y perforadas) ---------- */
  function floorTexture(perforated) {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = perforated ? '#6b7280' : '#7a818c'; g.fillRect(0, 0, 256, 256);
    var n = g.createLinearGradient(0, 0, 256, 256); n.addColorStop(0, 'rgba(255,255,255,.05)'); n.addColorStop(1, 'rgba(0,0,0,.08)');
    g.fillStyle = n; g.fillRect(0, 0, 256, 256);
    if (perforated) {
      g.fillStyle = '#2b2f36';
      for (var y = 14; y < 242; y += 8) for (var x = 14; x < 242; x += 8) { g.beginPath(); g.arc(x, y, 2.2, 0, 6.29); g.fill(); }
    }
    g.strokeStyle = '#3a3f47'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 253, 253);
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.strokeRect(4.5, 4.5, 247, 247);
    return c;
  }

  /* ---------- Mapa de entorno: da reflejos realistas a metal y piso ---------- */
  (function environment() {
    var envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x0b0f17);
    var room = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 20), new THREE.MeshBasicMaterial({ color: 0x141a24, side: THREE.BackSide }));
    envScene.add(room);
    var lamp = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (var k = -4; k <= 4; k++) { var l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.25), lamp); l.position.set(0, 1.9, k * 2.2); envScene.add(l); }
    var accent = new THREE.MeshBasicMaterial({ color: 0x0f6f86 });
    [-3.9, 3.9].forEach(function (x) { var s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.6, 18), accent); s.position.set(x, 0.2, 0); envScene.add(s); });
    var pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(envScene, 0.04).texture;
    pm.dispose();
  })();

  /* ---------- Piso, techo e iluminación del techo ---------- */
  var floorMatAisle = new THREE.MeshStandardMaterial({ map: tex(floorTexture(true), AISLE / 0.6, LENGTH / 0.6), roughness: 0.42, metalness: 0.35, envMapIntensity: 0.9 });
  var aisleFloor = new THREE.Mesh(new THREE.PlaneGeometry(AISLE, LENGTH), floorMatAisle);
  aisleFloor.rotation.x = -Math.PI / 2; aisleFloor.position.set(0, 0, MID); scene.add(aisleFloor);
  var floorMat = new THREE.MeshStandardMaterial({ map: tex(floorTexture(false), 6 / 0.6, LENGTH / 0.6), roughness: 0.5, metalness: 0.25, envMapIntensity: 0.7 });
  [-1, 1].forEach(function (s) {
    var f = new THREE.Mesh(new THREE.PlaneGeometry(6, LENGTH), floorMat);
    f.rotation.x = -Math.PI / 2; f.position.set(s * (AISLE / 2 + 3), -0.001, MID); scene.add(f);
  });
  var ceiling = new THREE.Mesh(new THREE.PlaneGeometry(14, LENGTH), new THREE.MeshStandardMaterial({ color: 0x0c0f15, roughness: 0.95 }));
  ceiling.rotation.x = Math.PI / 2; ceiling.position.set(0, 3.7, MID); scene.add(ceiling);

  // Luminarias lineales sobre el pasillo (se ven a través del techo de vidrio)
  var lampCount = Math.floor(LENGTH / 2.4);
  var lampMat = new THREE.MeshBasicMaterial({ color: 0xf2f8ff });
  var lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.04, 1.4), lampMat, lampCount);
  var lampHousing = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.06, 1.5), new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: 0.7, roughness: 0.4 }), lampCount);
  var m4 = new THREE.Matrix4();
  for (var l = 0; l < lampCount; l++) {
    m4.makeTranslation(0, 3.05, Z_START - 1 - l * 2.4); lamps.setMatrixAt(l, m4);
    m4.makeTranslation(0, 3.09, Z_START - 1 - l * 2.4); lampHousing.setMatrixAt(l, m4);
  }
  scene.add(lampHousing); scene.add(lamps);
  // Halo de cada luminaria sobre el vidrio
  var haloMat = new THREE.MeshBasicMaterial({ map: GLOW, color: 0xbfe6ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  var halos = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.4, 2.6), haloMat, lampCount);
  var dummy = new THREE.Object3D();
  for (var h = 0; h < lampCount; h++) {
    dummy.position.set(0, ROOF_Y + 0.01, Z_START - 1 - h * 2.4); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.updateMatrix();
    halos.setMatrixAt(h, dummy.matrix);
  }
  scene.add(halos);

  /* ---------- Pasillo frío confinado: techo de vidrio con perfilería ---------- */
  var roof = new THREE.Mesh(new THREE.PlaneGeometry(AISLE, LENGTH),
    new THREE.MeshStandardMaterial({ color: 0xa8d4e6, transparent: true, opacity: 0.07, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }));
  roof.rotation.x = -Math.PI / 2; roof.position.set(0, ROOF_Y, MID); scene.add(roof);
  var beamCount = Math.floor(LENGTH / 1.2);
  var profileMat = new THREE.MeshStandardMaterial({ color: 0x3a404a, metalness: 0.8, roughness: 0.35 });
  var beams = new THREE.InstancedMesh(new THREE.BoxGeometry(AISLE, 0.03, 0.035), profileMat, beamCount);
  for (var bm = 0; bm < beamCount; bm++) { m4.makeTranslation(0, ROOF_Y, Z_START - bm * 1.2); beams.setMatrixAt(bm, m4); }
  scene.add(beams);
  [-FRONT_X, FRONT_X].forEach(function (x) {
    var rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, LENGTH), profileMat); rail.position.set(x, ROOF_Y, MID); scene.add(rail);
  });

  /* ---------- Filas continuas de racks ---------- */
  var step = RACK_W + 0.004;
  var perSide = Math.floor((LENGTH - 4) / step);
  var variants = ['compute', 'network', 'storage', 'mixed'];
  var weights = [0.42, 0.16, 0.16, 0.26];
  var faceMats = variants.map(function (v, i) {
    var t = rackFace(v, 1234 + i * 777);
    return new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissive, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.55, metalness: 0.45, envMapIntensity: 0.6 });
  });
  var assign = [], counts = [0, 0, 0, 0], pick = rng(42);
  for (var s = 0; s < perSide * 2; s++) {
    var x = pick(), acc = 0, v = 0;
    for (v = 0; v < 4; v++) { acc += weights[v]; if (x <= acc) break; }
    v = Math.min(v, 3); assign.push(v); counts[v]++;
  }
  var faceGeo = new THREE.PlaneGeometry(RACK_W * 0.985, RACK_H * 0.985);
  var faceMeshes = faceMats.map(function (mat, i) { return new THREE.InstancedMesh(faceGeo, mat, Math.max(1, counts[i])); });
  var faceIdx = [0, 0, 0, 0];
  var bodyMat = new THREE.MeshStandardMaterial({ color: 0x0e1014, metalness: 0.65, roughness: 0.42, envMapIntensity: 0.8 });
  var bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(RACK_D, RACK_H, RACK_W - 0.006), bodyMat, perSide * 2);
  var postMat = new THREE.MeshStandardMaterial({ color: 0x1a1d23, metalness: 0.75, roughness: 0.35 });
  var posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, RACK_H, 0.03), postMat, perSide * 4);
  var rackPos = [], k = 0, pk = 0;
  [-1, 1].forEach(function (side) {
    for (var r = 0; r < perSide; r++) {
      var z = Z_START - 2 - r * step;
      var x = side * RACK_X;
      dummy.position.set(x, RACK_H / 2, z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      bodies.setMatrixAt(k, dummy.matrix);
      var v = assign[k];
      dummy.position.set(side * (FRONT_X - 0.003), RACK_H / 2, z);
      dummy.rotation.set(0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0); dummy.updateMatrix();
      faceMeshes[v].setMatrixAt(faceIdx[v]++, dummy.matrix);
      [-1, 1].forEach(function (e) {
        dummy.position.set(side * (FRONT_X - 0.012), RACK_H / 2, z + e * (RACK_W / 2 - 0.016)); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
        posts.setMatrixAt(pk++, dummy.matrix);
      });
      rackPos.push({ x: side * (FRONT_X - 0.005), z: z, side: side });
      k++;
    }
  });
  scene.add(bodies); scene.add(posts); faceMeshes.forEach(function (m) { scene.add(m); });

  /* ---------- Bandejas de cableado sobre los racks ---------- */
  var yellow = new THREE.MeshStandardMaterial({ color: 0xe0b21a, roughness: 0.55, metalness: 0.1 });
  var trayMetal = new THREE.MeshStandardMaterial({ color: 0x5a616c, metalness: 0.85, roughness: 0.35 });
  [-1, 1].forEach(function (side) {
    var x = side * RACK_X;
    // Canaleta amarilla de fibra óptica
    var fx = x + side * 0.1;
    var base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.015, LENGTH), yellow); base.position.set(fx, 2.55, MID); scene.add(base);
    [-0.15, 0.15].forEach(function (o) { var w = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.12, LENGTH), yellow); w.position.set(fx + o, 2.61, MID); scene.add(w); });
    // Bandeja tipo escalera con cables
    var lx = x - side * 0.2;
    [-0.22, 0.22].forEach(function (o) { var rl = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, LENGTH), trayMetal); rl.position.set(lx + o, 2.88, MID); scene.add(rl); });
    var rungs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.44, 0.015, 0.025), trayMetal, Math.floor(LENGTH / 0.3));
    for (var q = 0; q < Math.floor(LENGTH / 0.3); q++) { m4.makeTranslation(lx, 2.85, Z_START - q * 0.3); rungs.setMatrixAt(q, m4); }
    scene.add(rungs);
    var cableCols = [0x2f6fd6, 0x2f6fd6, 0x9aa0aa, 0xd6c22f, 0x1d1f24, 0x2f6fd6];
    cableCols.forEach(function (col, ci) {
      var cab = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, LENGTH, 8),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, metalness: 0.05 }));
      cab.rotation.x = Math.PI / 2; cab.position.set(lx - 0.15 + ci * 0.06, 2.9 + (ci % 2) * 0.03, MID); scene.add(cab);
    });
  });

  /* ---------- LEDs que parpadean ---------- */
  var ledsPerRack = mobile ? 4 : 7;
  var ledTotal = rackPos.length * ledsPerRack;
  var leds = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.009, 0.009), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), ledTotal);
  var ledBase = [], ri = rng(7);
  var pal = [new THREE.Color(0x3dff8a), new THREE.Color(0x3dff8a), new THREE.Color(0x3aa8ff), new THREE.Color(C.cyan)];
  var amber = new THREE.Color(0xffb23a), offC = new THREE.Color(0x101318);
  var li = 0;
  rackPos.forEach(function (p) {
    for (var q = 0; q < ledsPerRack; q++) {
      dummy.position.set(p.x - p.side * 0.004, 0.2 + ri() * 1.7, p.z + (ri() - 0.5) * 0.42);
      dummy.rotation.set(0, p.side > 0 ? -Math.PI / 2 : Math.PI / 2, 0); dummy.updateMatrix();
      leds.setMatrixAt(li, dummy.matrix);
      var col = ri() < 0.05 ? amber : pal[Math.floor(ri() * pal.length)];
      ledBase.push(col); leds.setColorAt(li, col); li++;
    }
  });
  scene.add(leds);

  /* ---------- Portales holográficos (uno por servicio) ---------- */
  var gates = [];
  stations.forEach(function (st, i) {
    var col = st.getAttribute('data-color') === 'coral' ? C.coral : C.cyan;
    var g = new THREE.Group(); g.position.z = gateZ(i);
    var mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, toneMapped: false });
    var W = AISLE - 0.18, H = ROOF_Y - 0.12, T = 0.035;
    [[0, H, W + T, T], [-W / 2, H / 2, T, H], [W / 2, H / 2, T, H]].forEach(function (b) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(b[2], b[3], T), mat); m.position.set(b[0], b[1], 0); g.add(m);
    });
    // Línea de luz en el piso que cruza el pasillo
    var line = new THREE.Mesh(new THREE.BoxGeometry(W, 0.004, 0.035), mat); line.position.y = 0.003; g.add(line);
    // Panel holográfico translúcido dentro del marco
    var veil = new THREE.Mesh(new THREE.PlaneGeometry(W, H),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    veil.position.y = H / 2; g.add(veil);
    var sMat = new THREE.SpriteMaterial({ map: GLOW, color: col, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    [[-W / 2, H], [W / 2, H], [-W / 2, 0.05], [W / 2, 0.05]].forEach(function (p) {
      var s = new THREE.Sprite(sMat); s.position.set(p[0], p[1], 0); s.scale.set(0.9, 0.9, 1); g.add(s);
    });
    var pool = new THREE.Mesh(new THREE.PlaneGeometry(AISLE, 3.2),
      new THREE.MeshBasicMaterial({ map: GLOW, color: col, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.006; g.add(pool);
    var light = new THREE.PointLight(col, 0, 6, 1.8); light.position.set(0, 1.4, 0.4); g.add(light);
    scene.add(g);
    gates.push({ mats: [mat], veil: veil, sMat: sMat, pool: pool, light: light });
  });

  /* ---------- Partículas de polvo en suspensión ---------- */
  var pCount = mobile ? 250 : 600;
  var pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(pCount * 3);
  for (var pp = 0; pp < pCount; pp++) {
    pPos[pp * 3] = (Math.random() - 0.5) * AISLE * 0.9;
    pPos[pp * 3 + 1] = Math.random() * ROOF_Y;
    pPos[pp * 3 + 2] = Z_START - Math.random() * LENGTH;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xcfeaff, size: 0.018, map: GLOW, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })));

  /* ---------- Luces ---------- */
  scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x1a1d24, 0.75));
  scene.add(new THREE.AmbientLight(0x8fa3c4, 0.25));
  var camLight = new THREE.PointLight(0xe6f2ff, 5, 7, 1.6); scene.add(camLight);
  var aheadLight = new THREE.PointLight(0xe6f2ff, 7, 10, 1.6); scene.add(aheadLight);

  /* ---------- Recorrido: el scroll mueve la cámara de parada en parada ---------- */
  var stops = [Z_START];
  for (var st = 0; st < N; st++) stops.push(gateZ(st) + (mobile ? 5 : 3.6));
  stops.push(gateZ(N - 1) - 9);

  function smooth(x) { return x * x * (3 - 2 * x); }
  function progress() {
    var r = tour.getBoundingClientRect();
    var total = tour.offsetHeight - window.innerHeight;
    return Math.min(1, Math.max(0, -r.top / total));
  }
  function stopCoord(prog) {
    var u = prog * (N + 1);
    var i = Math.min(N, Math.floor(u));
    var f = u - i;
    var e = smooth(Math.min(1, Math.max(0, (f - 0.22) / 0.56)));
    return { u: u, z: stops[i] + (stops[Math.min(N + 1, i + 1)] - stops[i]) * e };
  }

  /* ---------- Un giro de la rueda = un servicio ---------- */
  var STEPS = N + 1, tweening = false, cooldownUntil = 0;
  function tourTop() { return tour.getBoundingClientRect().top + window.scrollY; }
  function tourTotal() { return tour.offsetHeight - window.innerHeight; }
  function currentStep() { return Math.round(progress() * STEPS); }
  function goToStep(k) {
    var from = window.scrollY, to = tourTop() + tourTotal() * (k / STEPS);
    var t0 = performance.now(), dur = mobile ? 1050 : 700;
    tweening = true;
    (function anim() {
      var p = Math.max(0, Math.min(1, (performance.now() - t0) / dur));
      var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      window.scrollTo({ top: from + (to - from) * e, behavior: 'instant' });
      if (p < 1) requestAnimationFrame(anim);
      else { tweening = false; cooldownUntil = performance.now() + 350; }
    })();
  }
  window.addEventListener('wheel', function (e) {
    if (e.ctrlKey) return;
    var r = tour.getBoundingClientRect();
    var pinned = r.top <= 1 && r.bottom >= window.innerHeight - 1;
    if (!pinned) return;
    var dir = e.deltaY > 0 ? 1 : (e.deltaY < 0 ? -1 : 0);
    if (!dir) return;
    var cur = currentStep();
    // En los extremos se deja el scroll normal para entrar o salir del recorrido
    if ((dir > 0 && cur >= STEPS) || (dir < 0 && cur <= 0)) return;
    e.preventDefault();
    if (tweening || performance.now() < cooldownUntil) return;
    goToStep(Math.max(0, Math.min(STEPS, cur + dir)));
  }, { passive: false });

  /* Movil: un gesto vertical avanza solo una estacion.
     Evita que el impulso nativo del scroll salte varios cuadros.
     En los extremos se conserva el desplazamiento normal de la pagina. */
  if (mobile) {
    var touchStartY = null, touchStep = 0, touchLocked = false;
    function pinnedTour() {
      var r = tour.getBoundingClientRect();
      return r.top <= 2 && r.bottom >= window.innerHeight - 2;
    }
    tour.addEventListener('touchstart', function (e) {
      touchStartY = null; touchLocked = false;
      if (e.touches.length !== 1 || !pinnedTour()) return;
      touchStartY = e.touches[0].clientY;
      touchStep = currentStep();
    }, { passive: true });
    tour.addEventListener('touchmove', function (e) {
      if (touchStartY === null || e.touches.length !== 1) return;
      var delta = touchStartY - e.touches[0].clientY;
      var dir = delta > 0 ? 1 : -1;
      if (Math.abs(delta) < 8) return;
      if ((dir > 0 && touchStep >= STEPS) || (dir < 0 && touchStep <= 0)) return;
      if (e.cancelable) e.preventDefault();
      touchLocked = true;
    }, { passive: false });
    tour.addEventListener('touchend', function (e) {
      if (touchStartY === null) return;
      var endY = e.changedTouches.length ? e.changedTouches[0].clientY : touchStartY;
      var delta = touchStartY - endY;
      if (touchLocked && Math.abs(delta) >= 28 && !tweening && performance.now() >= cooldownUntil) {
        goToStep(Math.max(0, Math.min(STEPS, touchStep + (delta > 0 ? 1 : -1))));
      }
      touchStartY = null; touchLocked = false;
    }, { passive: true });
    tour.addEventListener('touchcancel', function () { touchStartY = null; touchLocked = false; }, { passive: true });
  }

  var camZ = Z_START, mouseX = 0, mouseY = 0, active = -1;
  window.addEventListener('pointermove', function (e) {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  function setActive(n) {
    if (n === active) return;
    active = n;
    stations.forEach(function (s, i) { s.classList.toggle('is-active', i === n); });
    if (counter) counter.textContent = (n >= 0 ? String(n + 1).padStart(2, '0') : '00') + ' / ' + String(N).padStart(2, '0');
  }

  function resize() {
    var w = canvas.clientWidth, hh = canvas.clientHeight;
    renderer.setSize(w, hh, false);
    camera.aspect = w / hh;
    camera.fov = w / hh < 0.8 ? 76 : (mobile ? 70 : 58);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  var running = false, raf = null, clock = new THREE.Clock(), blinkTimer = 0;
  var lastMobileFrame = 0;
  function frame(timestamp) {
    // Limitar el render movil a ~30 FPS; conservar 60 FPS en escritorio.
    if (mobile && timestamp - lastMobileFrame < 32) {
      raf = requestAnimationFrame(frame);
      return;
    }
    if (mobile) lastMobileFrame = timestamp;
    if (!running) return;
    var dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    var prog = progress();
    var sc = stopCoord(prog);
    camZ += (sc.z - camZ) * Math.min(1, dt * 7);

    camera.position.set(Math.sin(t * 0.3) * 0.05 + mouseX * 0.12, 1.62 + Math.sin(t * 0.55) * 0.015 - mouseY * 0.05, camZ);
    camera.lookAt(mouseX * 0.35, 1.45 - mouseY * 0.12, camZ - 8);
    camLight.position.set(0, 1.9, camZ - 0.5);
    aheadLight.position.set(0, 2.0, camZ - 4.5);

    var nearest = Math.round(sc.u) - 1;
    var settled = Math.abs(sc.u - Math.round(sc.u)) < 0.3;
    setActive(settled && nearest >= 0 && nearest < N ? nearest : -1);

    gates.forEach(function (g, i) {
      var on = i === active, pulse = 0.85 + Math.sin(t * 3 + i) * 0.15;
      g.mats[0].opacity += ((on ? 0.95 : 0.4) - g.mats[0].opacity) * 0.08;
      g.veil.material.opacity += ((on ? 0.09 * pulse : 0.025) - g.veil.material.opacity) * 0.08;
      g.sMat.opacity += ((on ? 0.85 : 0.3) - g.sMat.opacity) * 0.08;
      g.pool.material.opacity += ((on ? 0.45 : 0.12) - g.pool.material.opacity) * 0.08;
      g.light.intensity += ((on ? 9 : 1) - g.light.intensity) * 0.08;
    });

    blinkTimer += dt;
    if (blinkTimer > (mobile ? 0.16 : 0.07)) {
      blinkTimer = 0;
      for (var b = 0; b < (mobile ? 12 : 80); b++) {
        var q = Math.floor(Math.random() * ledTotal);
        leds.setColorAt(q, Math.random() < 0.35 ? offC : ledBase[q]);
      }
      leds.instanceColor.needsUpdate = true;
    }
    var arr = pGeo.attributes.position.array;
    for (var y = 1; y < arr.length; y += 3) { arr[y] += dt * 0.03; if (arr[y] > ROOF_Y) arr[y] = 0; }
    pGeo.attributes.position.needsUpdate = true;

    if (intro && intro.classList.contains('is-hidden') !== (prog > 0.06)) intro.classList.toggle('is-hidden', prog > 0.06);
    if (hint && hint.classList.contains('is-hidden') !== (prog > 0.03)) hint.classList.toggle('is-hidden', prog > 0.03);
    if (outro && outro.classList.contains('is-visible') !== (prog > 0.95)) outro.classList.toggle('is-visible', prog > 0.95);
    if (bar) bar.style.transform = 'scaleX(' + prog.toFixed(4) + ')';

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running || document.hidden) return; running = true; clock.getDelta(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { en[0].isIntersecting ? start() : stop(); }).observe(tour);
  } else { start(); }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  setActive(-1);
  }
})();
