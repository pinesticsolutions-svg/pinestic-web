/* PINESTIC v2: animaciones e interacción. Sin dependencias externas. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  /* ---------- Encabezado y menú móvil ---------- */
  var header = document.querySelector('[data-header]');
  var toggle = document.querySelector('[data-nav-toggle]');
  var nav = document.querySelector('[data-nav]');

  function onScroll() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 12);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function closeMenu() {
    if (!nav || !toggle) return;
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.querySelector('.sr-only').textContent = 'Abrir menú';
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.querySelector('.sr-only').textContent = open ? 'Cerrar menú' : 'Abrir menú';
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  /* ---------- Año del pie de página ---------- */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Pestañas de servicios ---------- */
  var tabs = document.querySelector('[data-tabs]');
  var tabButtons = tabs ? Array.prototype.slice.call(tabs.querySelectorAll('[data-tab-btn]')) : [];

  function selectTab(name, focus) {
    tabButtons.forEach(function (btn) {
      var active = btn.getAttribute('data-tab-btn') === name;
      btn.setAttribute('aria-selected', String(active));
      btn.tabIndex = active ? 0 : -1;
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (panel) panel.hidden = !active;
      if (active && focus) btn.focus();
    });
  }
  tabButtons.forEach(function (btn, i) {
    btn.addEventListener('click', function () { selectTab(btn.getAttribute('data-tab-btn')); });
    btn.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = tabButtons[(i + 1) % tabButtons.length];
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = tabButtons[(i - 1 + tabButtons.length) % tabButtons.length];
      if (e.key === 'Home') next = tabButtons[0];
      if (e.key === 'End') next = tabButtons[tabButtons.length - 1];
      if (next) { e.preventDefault(); selectTab(next.getAttribute('data-tab-btn'), true); }
    });
  });
  // Enlaces de otras secciones (situaciones y diagrama) que abren una pestaña concreta
  document.addEventListener('click', function (e) {
    var link = e.target.closest('[data-tab]');
    if (link && tabButtons.length) selectTab(link.getAttribute('data-tab'));
  });

  /* ---------- Aparición al desplazarse ---------- */
  var revealItems = document.querySelectorAll('[data-reveal], .card-grid > .glow-card, .report');
  var counters = document.querySelectorAll('[data-count]');
  var timeline = document.querySelector('[data-timeline]');

  function runCounter(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    var start = null, duration = 1400;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  if (reduceMotion || !hasIO) {
    revealItems.forEach(function (el) { el.classList.add('is-visible'); });
    if (timeline) { timeline.classList.add('is-visible'); timeline.style.setProperty('--progress', 1); }
  } else {
    counters.forEach(function (el) { el.textContent = '0'; });
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add('is-visible');
        el.querySelectorAll('[data-count]').forEach(runCounter);
        if (el === timeline) el.style.setProperty('--progress', 1);
        revealObserver.unobserve(el);
      });
    }, { threshold: 0.25, rootMargin: '0px 0px -40px 0px' });
    revealItems.forEach(function (el) { revealObserver.observe(el); });
    if (timeline) revealObserver.observe(timeline);
  }

  /* ---------- Logos de tecnologías: solo se cargan los que estén activados ---------- */
  document.querySelectorAll('[data-logos]').forEach(function (marquee) {
    var enabled = (marquee.getAttribute('data-logos') || '').split(/\s+/).filter(Boolean);
    marquee.querySelectorAll('[data-logo]').forEach(function (item) {
      var name = item.getAttribute('data-logo');
      if (enabled.indexOf(name) === -1) return;
      var img = new Image();
      img.alt = item.closest('[aria-hidden="true"]') ? '' : item.textContent.trim();
      img.decoding = 'async';
      img.onload = function () { item.classList.add('has-file'); };
      img.src = (window.LOGO_DATA && window.LOGO_DATA[name]) || '/logos/' + name + '.png';
      item.insertBefore(img, item.firstChild);
    });
  });

  /* ---------- Ampliar la imagen del panel de monitoreo ---------- */
  var zoomBtn = document.querySelector('[data-zoom]');
  var zoomDlg = document.querySelector('[data-zoom-dialog]');
  if (zoomBtn && zoomDlg && typeof zoomDlg.showModal === 'function') {
    zoomBtn.addEventListener('click', function () { zoomDlg.showModal(); });
    zoomDlg.querySelector('[data-zoom-close]').addEventListener('click', function () { zoomDlg.close(); });
    zoomDlg.addEventListener('click', function (e) { if (e.target === zoomDlg) zoomDlg.close(); });
  } else if (zoomBtn) {
    zoomBtn.addEventListener('click', function () { window.open('/img/panel-monitoreo.webp', '_blank'); });
  }

  /* ---------- Cinta de logos: avance automático y flechas ---------- */
  document.querySelectorAll('.logo-carousel').forEach(function (car) {
    var viewport = car.querySelector('.logo-marquee');
    var rail = car.querySelector('[data-rail]');
    var track = rail && rail.querySelector('.logo-track');
    if (!viewport || !track) return;
    var x = 0, speed = reduceMotion ? 0 : 38, paused = false, anim = null, last = 0, visible = true;
    function wrap() { var w = track.offsetWidth; if (w > 0) { while (x >= w) x -= w; while (x < 0) x += w; } }
    function render() { rail.style.transform = 'translate3d(' + (-x).toFixed(1) + 'px,0,0)'; }
    function frame(ts) {
      var dt = last ? Math.min((ts - last) / 1000, 0.05) : 0; last = ts;
      if (anim) {
        var p = Math.min(1, (ts - anim.t0) / anim.dur), e = 1 - Math.pow(1 - p, 3);
        x = anim.from + anim.delta * e;
        if (p >= 1) anim = null;
      } else if (!paused && visible) {
        x += speed * dt;
      }
      wrap(); render();
      requestAnimationFrame(frame);
    }
    car.querySelectorAll('.lc-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = +btn.getAttribute('data-dir');
        var delta = dir * Math.max(200, viewport.clientWidth * 0.5);
        anim = { from: x, delta: delta, t0: performance.now(), dur: reduceMotion ? 1 : 650 };
      });
    });
    viewport.addEventListener('mouseenter', function () { paused = true; });
    viewport.addEventListener('mouseleave', function () { paused = false; });
    if (hasIO) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(car);
    requestAnimationFrame(frame);
  });

  /* ---------- Brillo que sigue al cursor en las tarjetas ---------- */
  document.querySelectorAll('[data-glow]').forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ---------- Haces de luz del inicio (canvas) ---------- */
  (function streams() {
    var canvas = document.querySelector('[data-streams]');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var w = 0, h = 0, lines = [], running = false, raf = null, t0 = null, lastFrame = 0;
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function build() {
      lines = [];
      var small = window.innerWidth < 700;
      var n = small ? 12 : 20;
      for (var i = 0; i < n; i++) {
        lines.push({
          dir: i % 2 ? 1 : -1, y0: rnd(0.15, 0.85), slope: rnd(0.18, 0.55),
          amp: rnd(18, 80), freq: rnd(0.0012, 0.0035), phase: rnd(0, 6.28), speed: rnd(0.00012, 0.00032),
          width: rnd(0.6, 1.8), alpha: rnd(0.3, 0.8), coral: i === 5 || i === 14
        });
      }
      // Haces anchos y suaves para dar profundidad
      for (var j = 0; j < (small ? 3 : 5); j++) {
        lines.push({
          dir: j % 2 ? -1 : 1, y0: rnd(0.25, 0.75), slope: rnd(0.25, 0.5),
          amp: rnd(30, 70), freq: rnd(0.0008, 0.0016), phase: rnd(0, 6.28), speed: rnd(0.0001, 0.0002),
          width: rnd(26, 60), alpha: rnd(0.035, 0.06), beam: true
        });
      }
    }
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function color(l, a) { return l.coral ? 'rgba(255,96,106,' + a + ')' : 'rgba(17,197,233,' + a + ')'; }
    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      var cx = w / 2;
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i], base = l.y0 * h;
        // Punto brillante que recorre cada línea
        var p = 0.5 + 0.38 * Math.sin(t * l.speed * 0.8 + l.phase);
        var g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, color(l, 0));
        g.addColorStop(Math.max(0.01, p - 0.32), color(l, l.alpha * 0.15));
        g.addColorStop(p, color(l, l.alpha));
        g.addColorStop(Math.min(0.99, p + 0.32), color(l, l.alpha * 0.15));
        g.addColorStop(1, color(l, 0));
        ctx.beginPath();
        for (var x = -40; x <= w + 40; x += 18) {
          var y = base + l.dir * l.slope * (x - cx)
            + l.amp * Math.sin(x * l.freq + l.phase + t * l.speed)
            + l.amp * 0.35 * Math.sin(x * l.freq * 2.3 - t * l.speed * 1.6);
          x === -40 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = g;
        if (!l.beam) {
          ctx.lineWidth = l.width * 6; ctx.globalAlpha = 0.18; ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.lineWidth = l.width; ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    function frame(ts) {
      if (!running) return;
      if (t0 === null) t0 = ts;
      // Las luces son decorativas: 24 FPS en movil son suficientes.
      if (window.innerWidth < 760 && ts - lastFrame < 40) {
        raf = requestAnimationFrame(frame);
        return;
      }
      lastFrame = ts;
      draw(ts - t0 + 4000);
      raf = requestAnimationFrame(frame);
    }
    function start() { if (running || reduceMotion || document.hidden) return; running = true; raf = requestAnimationFrame(frame); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); }
    build(); resize(); draw(4000);
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { resize(); if (!running) draw(4000); }, 150);
    });
    if (hasIO) {
      new IntersectionObserver(function (en) { en[0].isIntersecting ? start() : stop(); }).observe(canvas);
    } else { start(); }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  })();

  /* ---------- Panel de monitoreo (datos simulados) ---------- */
  (function dashboard() {
    var dash = document.querySelector('[data-dash]');
    if (!dash) return;
    var gauges = Array.prototype.slice.call(dash.querySelectorAll('[data-gauge]'));
    var hexWrap = dash.querySelector('[data-hexes]');
    var portWrap = dash.querySelector('[data-ports]');
    var lineIn = dash.querySelector('[data-line="in"]');
    var lineOut = dash.querySelector('[data-line="out"]');
    var area = dash.querySelector('[data-area]');
    var hostVals = dash.querySelectorAll('[data-host-val]');
    var i, hexes = [], ports = [];

    for (i = 0; i < 36; i++) { var h = document.createElement('i'); hexWrap.appendChild(h); hexes.push(h); }
    for (i = 0; i < 24; i++) { var p = document.createElement('i'); portWrap.appendChild(p); ports.push(p); }
    var downPorts = [5, 13, 21, 22];
    ports.forEach(function (p, k) { if (downPorts.indexOf(k) === -1) p.classList.add('up'); });

    var N = 40, inData = [], outData = [];
    var vin = 48, vout = 26;
    function step(v, lo, hi, jump) { v += (Math.random() - 0.5) * jump; return Math.max(lo, Math.min(hi, v)); }
    for (i = 0; i < N; i++) { vin = step(vin, 18, 92, 16); vout = step(vout, 8, 60, 12); inData.push(vin); outData.push(vout); }

    function path(data) {
      return data.map(function (v, k) { return (k ? 'L' : 'M') + (k * 300 / (N - 1)).toFixed(1) + ' ' + (150 - v * 1.4).toFixed(1); }).join(' ');
    }
    function drawChart() {
      var d = path(inData);
      lineIn.setAttribute('d', d); lineOut.setAttribute('d', path(outData));
      area.setAttribute('d', d + ' L300 150 L0 150 Z');
    }
    function setGauge(g, v) {
      g.querySelector('.g-val').style.strokeDasharray = v.toFixed(1) + ' 100';
      g.querySelector('strong span').textContent = Math.round(v);
      g.classList.toggle('is-high', v >= 85);
    }
    function shuffleHexes() {
      hexes.forEach(function (h) {
        var r = Math.random();
        h.className = r < 0.55 ? '' : (r < 0.85 ? 'h2' : 'h3');
      });
      hexes[27].className = 'hw';
    }
    gauges.forEach(function (g) { setGauge(g, +g.getAttribute('data-gauge')); });
    shuffleHexes(); drawChart();
    if (reduceMotion) return;

    var timers = [], visible = false;
    function tick() {
      vin = step(inData[N - 1], 18, 92, 18); vout = step(outData[N - 1], 8, 60, 12);
      inData.push(vin); inData.shift(); outData.push(vout); outData.shift(); drawChart();
      gauges.forEach(function (g) {
        var base = +g.getAttribute('data-gauge'), w = +g.getAttribute('data-wobble');
        setGauge(g, Math.max(2, Math.min(97, base + (Math.random() - 0.5) * 2 * w)));
      });
      for (var k = 0; k < 4; k++) {
        var hx = hexes[Math.floor(Math.random() * hexes.length)];
        if (hx.className !== 'hw') { var r = Math.random(); hx.className = r < 0.55 ? '' : (r < 0.85 ? 'h2' : 'h3'); }
      }
      if (hostVals[0]) hostVals[0].textContent = (0.5 + Math.random() * 0.8).toFixed(1).replace('.', ',') + ' ms';
      if (hostVals[1]) hostVals[1].textContent = 'CPU ' + Math.round(22 + Math.random() * 25) + ' %';
    }
    function blink() {
      ports.forEach(function (p) { if (p.classList.contains('up')) p.classList.toggle('tx', Math.random() < 0.35); });
    }
    function start() {
      if (visible) return; visible = true;
      timers.push(setInterval(tick, 1100), setInterval(blink, 180));
    }
    function stop() { visible = false; timers.forEach(clearInterval); timers = []; }
    if (hasIO) {
      new IntersectionObserver(function (en) { en[0].isIntersecting && !document.hidden ? start() : stop(); }, { threshold: 0.15 }).observe(dash);
    } else { start(); }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
  })();

  /* ---------- Diagrama de red animado ---------- */
  var topo = document.querySelector('[data-topology]');
  if (!topo || reduceMotion) return;

  var SVGNS = 'http://www.w3.org/2000/svg';
  var packetLayer = topo.querySelector('[data-packets]');
  var log = topo.querySelector('[data-log]');
  var nodes = {};
  topo.querySelectorAll('[data-node]').forEach(function (n) { nodes[n.getAttribute('data-node')] = n; });

  // Cada enlace: id del trazo, nodo de origen y nodo de destino (en el sentido en que está dibujado)
  var LINKS = [
    ['lk-1', 'internet', 'firewall'], ['lk-2', 'vpn', 'firewall'], ['lk-3', 'firewall', 'switch'],
    ['lk-4', 'switch', 'srvwin'], ['lk-5', 'switch', 'hyper'], ['lk-6', 'switch', 'srvlnx'],
    ['lk-7', 'srvwin', 'backup'], ['lk-8', 'hyper', 'backup'], ['lk-9', 'hyper', 'monitor'],
    ['lk-10', 'srvlnx', 'monitor']
  ].map(function (l) {
    var path = document.getElementById(l[0]);
    return { path: path, len: path.getTotalLength(), from: l[1], to: l[2] };
  });

  // Eventos de ejemplo: una alerta que se detecta y luego se atiende
  var EVENTS = [
    { node: 'srvlnx', link: 'lk-10', alert: 'linux: disco al 91 %', ok: 'linux: espacio liberado' },
    { node: 'backup', link: 'lk-8', alert: 'backup: 1 trabajo con error', ok: 'backup: reintento verificado' },
    { node: 'firewall', link: 'lk-3', alert: 'firewall: accesos inusuales bloqueados', ok: 'firewall: regla revisada' },
    { node: 'srvwin', link: 'lk-4', alert: 'windows: actualizaciones pendientes', ok: 'windows: parches aplicados' }
  ];
  var ROUTINE = ['servicios críticos en línea', 'backup incremental completado', 'certificados vigentes', 'latencia normal en la red', 'agentes de monitoreo activos'];

  var packets = [];
  var clock = 8 * 60 + 5;
  var running = false, rafId = null, lastTs = 0;
  var nextSpawn = 0, nextEvent = 3500, nextRoutine = 1800, elapsed = 0;
  var eventIndex = 0, activeEvent = null, lastRoutine = 'servicios críticos en línea';

  function stamp() {
    clock += 1 + Math.floor(Math.random() * 3);
    var h = Math.floor(clock / 60) % 24, m = clock % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function addLog(kind, text) {
    var li = document.createElement('li');
    var t = document.createElement('time'); t.textContent = stamp();
    var b = document.createElement('b'); b.className = kind; b.textContent = kind === 'ok' ? 'ok' : 'alerta';
    li.appendChild(t); li.appendChild(b); li.appendChild(document.createTextNode(text));
    log.appendChild(li);
    while (log.children.length > 3) log.removeChild(log.firstElementChild);
  }
  function linkById(id) { for (var i = 0; i < LINKS.length; i++) if (LINKS[i].path.id === id) return LINKS[i]; }

  function spawn(link, reverse, alert) {
    var c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('r', alert ? 4.5 : 3.2);
    if (alert) c.setAttribute('class', 'alert');
    packetLayer.appendChild(c);
    packets.push({ el: c, link: link, dist: 0, reverse: reverse, speed: alert ? 120 : 70 + Math.random() * 50 });
  }
  function ping(name) {
    var n = nodes[name]; if (!n) return;
    n.classList.remove('is-ping'); void n.getBBox(); n.classList.add('is-ping');
    setTimeout(function () { n.classList.remove('is-ping'); }, 650);
  }

  function startEvent() {
    var ev = EVENTS[eventIndex++ % EVENTS.length];
    activeEvent = ev;
    var n = nodes[ev.node], link = linkById(ev.link);
    n.classList.add('is-alert');
    link.path.classList.add('is-hot');
    addLog('alert', ev.alert);
    // El aviso viaja hacia el monitoreo o hacia el núcleo de la red
    spawn(link, link.to !== ev.node ? false : true, true);
    setTimeout(function () {
      n.classList.remove('is-alert');
      link.path.classList.remove('is-hot');
      n.classList.add('is-ok');
      addLog('ok', ev.ok);
      setTimeout(function () { n.classList.remove('is-ok'); activeEvent = null; }, 1400);
    }, 2800);
  }

  function frame(ts) {
    if (!running) return;
    var dt = lastTs ? Math.min(ts - lastTs, 64) : 16;
    lastTs = ts; elapsed += dt;

    if (elapsed >= nextSpawn && packets.length < 8) {
      spawn(LINKS[Math.floor(Math.random() * LINKS.length)], Math.random() < 0.5, false);
      nextSpawn = elapsed + 380 + Math.random() * 420;
    }
    if (elapsed >= nextEvent && !activeEvent) { startEvent(); nextEvent = elapsed + 7000; }
    if (elapsed >= nextRoutine) {
      if (!activeEvent) {
        var msg; do { msg = ROUTINE[Math.floor(Math.random() * ROUTINE.length)]; } while (msg === lastRoutine);
        lastRoutine = msg; addLog('ok', msg);
      }
      nextRoutine = elapsed + 3200 + Math.random() * 1200;
    }

    for (var i = packets.length - 1; i >= 0; i--) {
      var p = packets[i];
      p.dist += p.speed * dt / 1000;
      if (p.dist >= p.link.len) {
        ping(p.reverse ? p.link.from : p.link.to);
        packetLayer.removeChild(p.el);
        packets.splice(i, 1);
        continue;
      }
      var pt = p.link.path.getPointAtLength(p.reverse ? p.link.len - p.dist : p.dist);
      p.el.setAttribute('cx', pt.x.toFixed(1));
      p.el.setAttribute('cy', pt.y.toFixed(1));
    }
    rafId = requestAnimationFrame(frame);
  }

  function start() { if (running || document.hidden) return; running = true; lastTs = 0; rafId = requestAnimationFrame(frame); }
  function stop() { running = false; if (rafId) cancelAnimationFrame(rafId); }

  // Solo se anima mientras el diagrama está en pantalla y la pestaña está activa
  if (hasIO) {
    new IntersectionObserver(function (entries) {
      entries[0].isIntersecting ? start() : stop();
    }, { threshold: 0.1 }).observe(topo);
  } else { start(); }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (!hasIO || topo.getBoundingClientRect().top < window.innerHeight) start();
  });
})();
