/* ════════════════════════════════════════════════════════════════════
   SGQ Tech — anim.js
   Camada de interação + animação. Carregado com defer, DEPOIS de GSAP/anime.
   Princípios:
   • Baseline (reveals, nav, FAQ, contadores, mockup NC) NÃO depende de CDN —
     funciona mesmo se GSAP/anime falharem.
   • GSAP/anime são realce, sempre sob `if (window.x)` e try/catch.
   • Tudo respeita prefers-reduced-motion. Anima só transform/opacity
     (+ stroke-dashoffset em 1 SVG pequeno — não causa reflow).
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // O anim.js está rodando → cancela o failsafe anti-FOUC do <head>.
  if (window.__af) { clearTimeout(window.__af); window.__af = null; }

  var prefersReduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Helper: dispara cb (uma vez) quando o elemento entra no viewport.
  function inView(el, cb, threshold) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { cb(); return; }
    var ob = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { ob.unobserve(en.target); cb(); }
      });
    }, { threshold: threshold || 0.3 });
    ob.observe(el);
  }

  /* ── Reveal ao rolar (base, sem dependências) ─────────────────────── */
  var reveals = document.querySelectorAll('.reveal, .reveal-img, .signal');
  if (!('IntersectionObserver' in window) || prefersReduced) {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ── Navegação ────────────────────────────────────────────────────── */
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('navToggle');
  if (nav && toggle) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    });
    nav.querySelectorAll('.nav__links a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ── Header com sombra ao rolar ───────────────────────────────────── */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ── Laudo: "trava e folheia" (scroll-jacking via sticky + transform, sem ScrollTrigger) ──
     A seção #laudos vira um trilho (100vh + D). O miolo .laudo-pin gruda (sticky) e,
     enquanto grudado, o strip do laudo desliza do topo ao fim conforme o scroll. Robusto:
     recalcula a posição a cada scroll real (não depende de ticker/refresh do GSAP). */
  (function initLaudoPin() {
    var sec = document.getElementById('laudos');
    var scroll = document.getElementById('laudoScroll');
    var strip = document.getElementById('laudoStrip');
    if (!sec || !scroll || !strip || !sec.querySelector('.laudo-pin')) return;
    var D = 0, enabled = false;
    function canPin() { return !prefersReduced && window.innerWidth >= 901 && window.innerHeight >= 560; }
    function apply() {
      if (!enabled) return;
      var p = (-sec.getBoundingClientRect().top) / D;
      p = p < 0 ? 0 : (p > 1 ? 1 : p);
      strip.style.transform = 'translate3d(0,' + (-(p * D)).toFixed(1) + 'px,0)';
    }
    function enable() {
      sec.classList.add('is-pinnable');        // aplica o CSS do pin antes de medir
      strip.style.transform = 'translate3d(0,0,0)';
      D = strip.offsetHeight - scroll.clientHeight;
      if (D < 40) { disable(); return; }
      sec.style.height = 'calc(100vh + ' + Math.round(D) + 'px)';
      enabled = true; apply();
    }
    function disable() { enabled = false; sec.classList.remove('is-pinnable'); sec.style.height = ''; strip.style.transform = ''; }
    function measure() { if (canPin()) enable(); else disable(); }
    var imgs = strip.querySelectorAll('img'), n = 0;
    function ready() { if (++n >= imgs.length) measure(); }
    if (imgs.length) { imgs.forEach(function (im) { if (im.complete) ready(); else im.addEventListener('load', ready); }); }
    else { measure(); }
    window.addEventListener('scroll', apply, { passive: true });
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(measure, 150); });
  })();

  /* ── FAQ: abrir um fecha os outros ────────────────────────────────── */
  var faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) faqItems.forEach(function (o) { if (o !== d) o.open = false; });
    });
  });

  /* ── Contadores animados ([data-count]) ───────────────────────────── */
  function animateCount(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(target)) return;
    if (prefersReduced) { el.textContent = String(target); return; }
    var dur = 1200, t0 = performance.now();
    el.textContent = '0';
    (function tick(t) {
      var p = Math.min(1, (t - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick); else el.textContent = String(target);
    })(t0);
  }
  document.querySelectorAll('[data-count]').forEach(function (el) {
    inView(el, function () { animateCount(el); }, 0.6);
  });

  /* ── Mockup NC: Aberta → Em ação → Resolvida (sem dependências) ───── */
  var ncMock = document.getElementById('ncMock');
  if (ncMock) {
    var ncSteps = ncMock.querySelectorAll('.nc-step');
    var ncStatus = document.getElementById('ncStatus');
    var ncSetActive = function (n) {
      ncSteps.forEach(function (s) {
        var i = parseInt(s.getAttribute('data-i'), 10);
        s.classList.toggle('is-done', i < n);
        s.classList.toggle('is-active', i === n);
      });
    };
    var ncFinal = function () {
      ncMock.classList.add('s2', 's3');
      ncSteps.forEach(function (s) { s.classList.add('is-done'); s.classList.remove('is-active'); });
      if (ncStatus) ncStatus.textContent = 'Resolvida';
    };
    if (prefersReduced) {
      ncFinal();
    } else {
      inView(ncMock, function () {
        setTimeout(function () {
          ncMock.classList.add('s2'); ncSetActive(2);
          if (ncStatus) ncStatus.textContent = 'Em ação';
        }, 650);
        setTimeout(ncFinal, 1850);
      }, 0.35);
    }
  }

  /* ── Carrossel de telas (vanilla: autoplay, setas, dots, swipe, loop) ── */
  (function () {
    var root = document.getElementById('systemCarousel');
    if (!root) return;
    var track = root.querySelector('.carousel__track');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.carousel__slide'));
    var caps = ['Painel da qualidade', 'Indicadores de qualidade', 'Indicadores de manutenção', 'Painel do SGI', 'Programação de produção', 'Suprimentos', 'Rastreabilidade de lote'];
    var capEl = document.getElementById('carouselCap');
    var dotsWrap = document.getElementById('carouselDots');
    var i = 0, timer = null, n = slides.length;
    slides.forEach(function (_, idx) {
      var d = document.createElement('button');
      d.type = 'button'; d.className = 'carousel__dot'; d.setAttribute('aria-label', 'Tela ' + (idx + 1));
      d.addEventListener('click', function () { go(idx); restart(); });
      dotsWrap.appendChild(d);
    });
    var dots = dotsWrap.querySelectorAll('.carousel__dot');
    function go(idx) {
      i = (idx + n) % n;
      track.style.transform = 'translateX(' + (-i * 100) + '%)';
      dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); });
      if (capEl && caps[i]) capEl.textContent = caps[i];
    }
    function next() { go(i + 1); }
    function prev() { go(i - 1); }
    root.querySelector('.carousel__arrow--next').addEventListener('click', function () { next(); restart(); });
    root.querySelector('.carousel__arrow--prev').addEventListener('click', function () { prev(); restart(); });
    function start() { if (prefersReduced) return; stop(); timer = setInterval(next, 4200); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function restart() { stop(); start(); }
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    var x0 = null;
    root.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
      x0 = null; start();
    }, { passive: true });
    go(0);
    if ('IntersectionObserver' in window) {
      var io2 = new IntersectionObserver(function (es) { es.forEach(function (en) { en.isIntersecting ? start() : stop(); }); }, { threshold: 0.25 });
      io2.observe(root);
    } else { start(); }
  })();

  /* ── Matriz de planos: abas no mobile ── */
  (function () {
    var m = document.getElementById('planMatrix');
    if (!m) return;
    var tabs = m.querySelectorAll('.matrix__tab');
    var panels = m.querySelectorAll('.matrix__panel');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        var p = t.getAttribute('data-plan');
        tabs.forEach(function (x) { x.classList.toggle('is-active', x === t); });
        panels.forEach(function (x) { x.classList.toggle('is-active', x.getAttribute('data-plan') === p); });
      });
    });
  })();

  if (prefersReduced) return; // ── nada de realce com libs além daqui ──

  /* ════════════════ Realce com GSAP ════════════════ */
  if (window.gsap) {
    try {
      if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
      var ST = window.ScrollTrigger;

      /* Hero — micro-flutuação contínua do card (após a entrada) */
      var heroShot = document.getElementById('heroShot');
      if (heroShot) {
        gsap.set(heroShot, { willChange: 'transform' });
        gsap.to(heroShot, { y: -6, duration: 4, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1.2 });
      }
      var rastShot = document.getElementById('rastShot');
      if (rastShot) {
        gsap.set(rastShot, { willChange: 'transform' });
        gsap.to(rastShot, { y: -7, duration: 4.5, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 0.6 });
      }

      /* Hero — parallax leve só no glow decorativo */
      var glow = document.querySelector('.hero__glow');
      if (ST && glow) {
        gsap.set(glow, { willChange: 'transform' });
        gsap.to(glow, { y: 90, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      }

      /* Hero — linhas do laudo em cascata */
      var laudoRows = gsap.utils.toArray('.laudo-row');
      if (laudoRows.length) {
        gsap.from(laudoRows, {
          opacity: 0, y: 14, duration: 0.5, stagger: 0.08, ease: 'power2.out',
          scrollTrigger: ST ? { trigger: '#laudoCard', start: 'top 85%' } : undefined,
          delay: ST ? 0 : 0.6
        });
      }

      /* Tabela hoje vs SGQ — linhas em stagger + realce teal na coluna SGQ */
      var compare = document.querySelector('.compare');
      if (compare) {
        var crows = compare.querySelectorAll('.compare__row');
        var ctl = gsap.timeline({ scrollTrigger: ST ? { trigger: compare, start: 'top 80%' } : undefined });
        ctl.from(crows, { opacity: 0, y: 14, duration: 0.45, stagger: 0.09, ease: 'power2.out' });
        ctl.add(function () { compare.classList.add('sgq-glow'); }, '>-0.1');
        if (!ST) compare.classList.add('sgq-glow');
      }

      /* Mockup rastreabilidade — linha desenha + nós acendem + dot + selo */
      var line = document.getElementById('traceLine');
      var diagram = document.querySelector('.trace__diagram');
      if (line && diagram) {
        var LEN = 860; // x2 - x1
        var tnodes = gsap.utils.toArray('.trace-node');
        var pulse = document.querySelector('.trace-pulse-wrap');
        var seal = document.querySelector('.trace-seal');
        gsap.set(line, { strokeDasharray: LEN, strokeDashoffset: LEN });
        gsap.set(tnodes, { opacity: 0, y: 10 });
        if (pulse) gsap.set(pulse, { opacity: 0, x: 0 });
        if (seal) gsap.set(seal, { opacity: 0 });
        var runTrace = function () {
          var tl = gsap.timeline();
          tl.to(line, { strokeDashoffset: 0, duration: 1.0, ease: 'power1.inOut' }, 0);
          if (pulse) {
            tl.to(pulse, { opacity: 1, duration: 0.2 }, 0)
              .to(pulse, { x: LEN, duration: 1.0, ease: 'power1.inOut' }, 0)
              .to(pulse, { opacity: 0, duration: 0.3 }, 0.92);
          }
          tl.to(tnodes, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: 0.22 }, 0.12);
          if (seal) tl.to(seal, { opacity: 1, duration: 0.45, ease: 'power2.out' }, '>-0.15');
        };
        if (ST) ScrollTrigger.create({ trigger: diagram, start: 'top 78%', once: true, onEnter: runTrace });
        else inView(diagram, runTrace, 0.3);
      }

      /* Hero — entrada do print do dashboard (fade + scale + subida) */
      if (heroShot) {
        gsap.from(heroShot, { opacity: 0, scale: 0.97, y: 16, duration: 0.7, ease: 'power2.out', delay: 0.15 });
      }

      /* 7 sinais: a entrada deslizante alternada é feita pelo IntersectionObserver
         de reveal (CSS `html.js .signal`) — mais robusto que o ScrollTrigger aqui,
         que dependia de refresh/timing de layout e podia disparar fora da tela. */

      /* Laudo "trava e folheia": movido p/ fora do GSAP (sticky + scroll) — ver initLaudoPin no escopo base */
    } catch (e) { /* realce é opcional — nunca quebra a página */ }

  } else if (window.anime) {
    /* Fallback sem GSAP: nós do diagrama em stagger via anime.js */
    var diagram2 = document.querySelector('.trace__diagram');
    var nodes2 = document.querySelectorAll('.trace-node');
    if (diagram2 && nodes2.length) {
      nodes2.forEach(function (n) { n.style.opacity = '0'; });
      inView(diagram2, function () {
        window.anime({ targets: '.trace-node', opacity: [0, 1], translateY: [10, 0], easing: 'easeOutQuad', duration: 500, delay: window.anime.stagger(130) });
      }, 0.3);
    }
  }
})();
