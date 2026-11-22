/* =====================================================================
   RADIO JIREH — EFECTOS VISUALES
   Solo decoración: un brillo suave que sigue al mouse sobre las tarjetas
   (en computadoras). No toca nada del funcionamiento de la radio.
   ===================================================================== */
(function () {
  'use strict';

  if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) { return; }

  var TARJETAS = '.vivo-panel, .versiculo-card, .news-form, .clima-card, .contacto-dato, .nombre-card';
  var pendiente = null;
  var ultimo = null;

  function pintar() {
    pendiente = null;
    if (!ultimo) { return; }
    var r = ultimo.tarjeta.getBoundingClientRect();
    ultimo.tarjeta.style.setProperty('--mx', (ultimo.x - r.left) + 'px');
    ultimo.tarjeta.style.setProperty('--my', (ultimo.y - r.top) + 'px');
  }

  document.addEventListener('pointermove', function (e) {
    var tarjeta = e.target && e.target.closest ? e.target.closest(TARJETAS) : null;
    if (!tarjeta) { return; }
    ultimo = { tarjeta: tarjeta, x: e.clientX, y: e.clientY };
    if (!pendiente) { pendiente = window.requestAnimationFrame(pintar); }
  }, { passive: true });
})();
