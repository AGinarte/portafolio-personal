/* ============================================================
   Álvaro García Ginarte — portafolio
   Un cable RJ45 sale de la terminal y serpentea por toda la
   página enchufándose en cada objeto: foto · nube · candado ·
   NAS · toma RJ45 final (que se ilumina). Se dibuja con el
   scroll y es reversible. Sin menú lateral.
   Filosofía: menos es más.
   ============================================================ */
(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  /* ---- NAV: menú móvil ---- */
  const nav = $('#nav');
  const hamburger = $('#hamburger');
  const navLinks = $('#navLinks');
  const closeMenu = () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  };
  hamburger.addEventListener('click', () => {
    const open = hamburger.classList.toggle('open');
    navLinks.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
  });
  navLinks.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));

  /* ---- TERMINAL: escritura ---- */
  const termBody = $('#termBody');
  const SCRIPT = [
    { p: 'C:\\> ', cmd: 'whoami' },
    { out: 'Álvaro García Ginarte' },
    { p: 'C:\\> ', cmd: 'cat rol.txt' },
    { out: 'Consultor IT Junior · Vicmartin, Madrid', dim: true },
    { p: 'C:\\> ', cmd: 'stack --top' },
    { out: 'VMware · Sophos · Zscaler · Proxmox · Veeam', dim: true },
    { p: 'C:\\> ', caret: true },
  ];
  function runTerminal() {
    if (!termBody) return;
    if (reduce) {
      termBody.innerHTML = SCRIPT.map((l) => l.out
        ? `<span class="${l.dim ? 'dim' : 'out'}">${l.out}</span>`
        : `<span class="prompt">${l.p}</span>${l.cmd || ''}${l.caret ? '<span class="caret"></span>' : ''}`
      ).join('\n');
      return;
    }
    let html = '', li = 0;
    const nextLine = () => {
      if (li >= SCRIPT.length) return;
      const line = SCRIPT[li];
      if (line.out !== undefined) {
        html += `<span class="${line.dim ? 'dim' : 'out'}">${line.out}</span>\n`;
        termBody.innerHTML = html; li++; setTimeout(nextLine, 380); return;
      }
      const base = html + `<span class="prompt">${line.p}</span>`;
      if (line.caret) { termBody.innerHTML = base + '<span class="caret"></span>'; return; }
      let ci = 0;
      const type = () => {
        termBody.innerHTML = base + line.cmd.slice(0, ci) + '<span class="caret"></span>';
        if (ci < line.cmd.length) { ci++; setTimeout(type, 55 + Math.random() * 50); }
        else { html = base + line.cmd + '\n'; li++; setTimeout(nextLine, 320); }
      };
      type();
    };
    setTimeout(nextLine, 500);
  }

  /* ---- CABLE: construcción y dibujo ---- */
  const Wire = (() => {
    const svg = $('#wire');
    const base = $('#wireBase');
    const core = $('#wireCore');
    const plugStart = $('#plugStart');
    const plugHead = $('#plugHead');
    const ports = $$('.port').sort((a, b) => (+a.dataset.order) - (+b.dataset.order));
    let len = 0, nodes = [], stations = [], yToL = [];

    function docPoint(el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 + window.scrollX, y: r.top + r.height / 2 + window.scrollY };
    }

    function tangentDeg(l) {
      const a = core.getPointAtLength(clamp(l, 0, len));
      const b = core.getPointAtLength(clamp(l + 1, 0, len));
      return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90;
    }

    function build() {
      const story = document.getElementById('story');
      const W = document.documentElement.clientWidth;
      const Hd = story.offsetHeight;   // alto del contenido (no del documento)
      svg.setAttribute('width', W);
      svg.setAttribute('height', Hd);
      svg.setAttribute('viewBox', `0 0 ${W} ${Hd}`);

      nodes = ports.map(docPoint);
      let d = `M ${nodes[0].x} ${nodes[0].y}`;
      for (let i = 1; i < nodes.length; i++) {
        const p = nodes[i - 1], c = nodes[i], my = (p.y + c.y) / 2;
        d += ` C ${p.x} ${my}, ${c.x} ${my}, ${c.x} ${c.y}`;
      }
      base.setAttribute('d', d);
      core.setAttribute('d', d);
      len = core.getTotalLength();
      base.style.strokeDasharray = len; core.style.strokeDasharray = len;

      // tabla altura-del-documento -> longitud de arco, para que la
      // punta del cable siga al viewport (se ve salir de la terminal)
      yToL = [];
      const SAMPLES = 240;
      for (let s = 0; s <= SAMPLES; s++) {
        const l = (s / SAMPLES) * len;
        yToL.push({ l, y: core.getPointAtLength(l).y });
      }

      // umbral de encendido por estación: cuando el conector cruza el
      // borde superior del dibujo (lo toca de verdad). La última (roseta)
      // se enciende solo al enchufarse del todo.
      stations = ports.map((port, i) => {
        const target = nodes[i];
        let best = 0, bestD = Infinity;
        const steps = 60;
        for (let s = 0; s <= steps; s++) {
          const l = (s / steps) * len;
          const pt = core.getPointAtLength(l);
          const dd = (pt.x - target.x) ** 2 + (pt.y - target.y) ** 2;
          if (dd < bestD) { bestD = dd; best = l; }
        }
        let threshold = best - 6;
        if (i > 0 && i < ports.length - 1) {
          const visual = port.closest('svg, .photo-card');
          if (visual) {
            const r = visual.getBoundingClientRect();
            threshold = Math.min(threshold, lengthAtY(r.top + window.scrollY + 10));
          }
        }
        return { threshold, step: port.closest('.step') };
      });

      // conector de salida fijo en la terminal
      plugStart.setAttribute('transform', `translate(${nodes[0].x} ${nodes[0].y}) rotate(${tangentDeg(0).toFixed(1)})`);
      plugStart.classList.add('show');
    }

    // mayor longitud de cable cuyo punto queda por encima de targetY
    function lengthAtY(targetY) {
      let best = 0;
      for (let i = 0; i < yToL.length; i++) {
        if (yToL[i].y <= targetY) best = yToL[i].l;
      }
      return best;
    }

    function update(targetY, atEnd) {
      if (!len) return;
      const reveal = atEnd ? len : clamp(lengthAtY(targetY), 0, len);
      base.style.strokeDashoffset = len - reveal;
      core.style.strokeDashoffset = len - reveal;

      const p = core.getPointAtLength(reveal);
      plugHead.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${tangentDeg(reveal).toFixed(1)})`);
      plugHead.classList.toggle('show', reveal > 8 && reveal < len - 2);

      // cada objeto se enciende JUSTO cuando el conector lo toca
      stations.forEach((st) => {
        if (st.step) st.step.classList.toggle('connected', reveal >= st.threshold);
      });
    }

    return { build, update };
  })();

  /* ---- SCROLL: dibuja el cable + revela contenido + nav ---- */
  const steps = $$('.step');
  const sectionLinks = {};
  navLinks.querySelectorAll('a[href^="#"]').forEach((a) => {
    sectionLinks[a.getAttribute('href').slice(1)] = a;
  });

  const story = document.getElementById('story');
  function onScroll() {
    const y = window.scrollY;
    const storyH = story.offsetHeight;
    // la punta del cable sigue al viewport (~60% de la pantalla):
    // se ve salir de la terminal y acompaña todo el recorrido
    const maxY = storyH - window.innerHeight;
    const atEnd = maxY > 0 && y >= maxY - 2;
    Wire.update(y + window.innerHeight * 0.6, atEnd);
    document.body.classList.toggle('dark', y < window.innerHeight * 0.5);
    nav.classList.toggle('scrolled', y > window.innerHeight * 0.6);

    const vc = window.innerHeight / 2;
    let active = null;
    steps.forEach((step) => {
      const r = step.getBoundingClientRect();
      const center = r.top + r.height / 2;
      const dist = Math.abs(center - vc) / window.innerHeight;
      const c = clamp(1 - dist * 1.2, 0, 1);
      const panel = step.querySelector('.panel');
      const obj = step.querySelector('.obj');
      if (panel) { panel.style.opacity = reduce ? 1 : (0.18 + c * 0.82); panel.style.transform = reduce ? 'none' : `translateY(${(1 - c) * 24}px)`; }
      if (obj) { obj.style.opacity = reduce ? 1 : (0.18 + c * 0.82); }
      if (r.top <= vc && r.bottom >= vc) active = step.id;
    });
    Object.entries(sectionLinks).forEach(([id, a]) => a.classList.toggle('active', id === active));
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });

  let rTick = false;
  window.addEventListener('resize', () => {
    if (rTick) return;
    rTick = true;
    requestAnimationFrame(() => { Wire.build(); onScroll(); rTick = false; });
  });

  /* ---- TILT en la tarjeta de proyecto ---- */
  if (!reduce && window.matchMedia('(pointer:fine)').matches) {
    $$('[data-tilt]').forEach((card) => {
      const MAX = 4; let raf = null;
      card.addEventListener('pointermove', (ev) => {
        const r = card.getBoundingClientRect();
        const px = (ev.clientX - r.left) / r.width - 0.5;
        const py = (ev.clientY - r.top) / r.height - 0.5;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          card.style.transform = `perspective(900px) rotateX(${(-py*MAX).toFixed(2)}deg) rotateY(${(px*MAX).toFixed(2)}deg)`;
        });
      });
      card.addEventListener('pointerleave', () => { if (raf) cancelAnimationFrame(raf); card.style.transform = ''; });
    });
  }

  /* ---- CARRUSEL de proyectos ---- */
  (function () {
    const root = document.getElementById('projCarousel');
    if (!root) return;
    const track = document.getElementById('projTrack');
    const cards = Array.from(track.children);
    const prev = document.getElementById('projPrev');
    const next = document.getElementById('projNext');
    const dotsBox = document.getElementById('projDots');
    const count = document.getElementById('projCount');
    if (cards.length < 2) { root.classList.add('single'); cards.forEach(c => c.classList.add('is-active')); return; }
    const pad = (n) => String(n).padStart(2, '0');
    const dots = cards.map((_, i) => {
      const b = document.createElement('button');
      b.setAttribute('aria-label', 'Ir al proyecto ' + (i + 1));
      b.addEventListener('click', () => go(i));
      dotsBox.appendChild(b); return b;
    });
    let cur = 0;
    function go(i) {
      i = Math.max(0, Math.min(cards.length - 1, i));
      track.scrollTo({ left: cards[i].offsetLeft - track.offsetLeft - 2, behavior: reduce ? 'auto' : 'smooth' });
    }
    function setActive(i) {
      cur = i;
      cards.forEach((c, k) => c.classList.toggle('is-active', k === i));
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
      prev.disabled = i === 0; next.disabled = i === cards.length - 1;
      count.textContent = pad(i + 1) + ' / ' + pad(cards.length);
    }
    let sTick = false;
    track.addEventListener('scroll', () => {
      if (sTick) return; sTick = true;
      requestAnimationFrame(() => {
        const i = Math.round(track.scrollLeft / (cards[0].offsetWidth + 20));
        if (i !== cur) setActive(Math.max(0, Math.min(cards.length - 1, i)));
        sTick = false;
      });
    }, { passive: true });
    prev.addEventListener('click', () => go(cur - 1));
    next.addEventListener('click', () => go(cur + 1));
    root.setAttribute('tabindex', '-1');
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
    });
    setActive(0);
  })();

  /* ---- ARRANQUE ---- */
  function start() { Wire.build(); onScroll(); }
  start();
  window.addEventListener('load', start, { once: true });
  runTerminal();
})();
