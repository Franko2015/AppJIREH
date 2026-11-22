/* =====================================================================
   RADIO JIREH — SELECTOR DE COLORES (TEMAS)
   Botón de la paleta en la barra superior. Guarda la elección en este
   equipo y cambia también el color de la barra del celular.
   Archivo independiente: no modifica nada del funcionamiento de la radio.
   ===================================================================== */
(function () {
  'use strict';

  var TEMAS = { noche: '#070d1f', aurora: '#120a22', amanecer: '#fbf6ec' };
  var CLAVE = 'jireh_tema';
  var raiz = document.documentElement;

  function temaActual() {
    var t = raiz.getAttribute('data-tema');
    return TEMAS[t] ? t : 'noche';
  }

  function aplicar(tema, guardar) {
    if (!TEMAS[tema]) { tema = 'noche'; }
    if (tema === 'noche') { raiz.removeAttribute('data-tema'); } else { raiz.setAttribute('data-tema', tema); }
    var meta = document.getElementById('metaColorTema');
    if (meta) { meta.setAttribute('content', TEMAS[tema]); }
    Array.prototype.forEach.call(document.querySelectorAll('.tema-opcion'), function (op) {
      op.setAttribute('aria-checked', op.getAttribute('data-tema') === tema ? 'true' : 'false');
    });
    if (guardar) { try { window.localStorage.setItem(CLAVE, tema); } catch (e) {} }
  }

  function montar() {
    var btn = document.getElementById('btnTema');
    var menu = document.getElementById('menuTema');
    aplicar(temaActual(), false);
    if (!btn || !menu) { return; }

    function abrir() {
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      var marcada = menu.querySelector('[aria-checked="true"]');
      if (marcada) { marcada.focus(); }
    }
    function cerrar(devolverFoco) {
      if (menu.hidden) { return; }
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (devolverFoco) { btn.focus(); }
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (menu.hidden) { abrir(); } else { cerrar(false); }
    });
    // Cambio de colores con un círculo que se expande desde el botón de la paleta
    function cambiarConEfecto(tema) {
      var reducida = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (tema === temaActual() || !document.startViewTransition || reducida) { aplicar(tema, true); return; }
      var r = btn.getBoundingClientRect();
      var x = r.left + r.width / 2, y = r.top + r.height / 2;
      var radio = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      var transicion = document.startViewTransition(function () { aplicar(tema, true); });
      transicion.ready.then(function () {
        raiz.animate(
          { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radio + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 700, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(function () {});
    }

    menu.addEventListener('click', function (e) {
      var op = e.target.closest ? e.target.closest('.tema-opcion') : null;
      if (!op) { return; }
      cerrar(true);
      cambiarConEfecto(op.getAttribute('data-tema'));
    });
    menu.addEventListener('keydown', function (e) {
      var ops = Array.prototype.slice.call(menu.querySelectorAll('.tema-opcion'));
      var i = ops.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); ops[(i + 1) % ops.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); ops[(i - 1 + ops.length) % ops.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); cerrar(true); }
    });
    document.addEventListener('click', function (e) {
      if (!menu.hidden && !menu.contains(e.target) && e.target !== btn) { cerrar(false); }
    });
    window.addEventListener('scroll', function () { cerrar(false); }, { passive: true });
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', montar); } else { montar(); }
})();
