/* =====================================================================
   RADIO JIREH 103.5 FM — ÁREA DE LA RADIO (panel del dueño)
   ---------------------------------------------------------------------
   Guarda todo en localStorage:
     jireh_suscriptores · jireh_visitas · jireh_clave
   Este archivo se carga ANTES de main.js (sin módulos, sin fetch).
   ===================================================================== */

var JIREH = (function () {
  'use strict';

  var K = {
    SUSC: 'jireh_suscriptores',
    VISITAS: 'jireh_visitas',
    CLAVE: 'jireh_clave'
  };

  /* ---------- utilidades de almacenamiento (a prueba de errores) ---- */
  function leer(clave) {
    try {
      var bruto = window.localStorage.getItem(clave);
      return bruto ? JSON.parse(bruto) : null;
    } catch (e) { return null; }
  }
  function guardar(clave, valor) {
    try {
      window.localStorage.setItem(clave, JSON.stringify(valor));
      return true;
    } catch (e) { return false; }
  }

  /* ---------- versículo del día según la fecha --------------------- */
  function versiculoDelDia(fecha) {
    var lista = (typeof DATA_DEFECTO !== 'undefined' && DATA_DEFECTO.versiculos) ? DATA_DEFECTO.versiculos : [];
    if (!lista.length) { return null; }
    var dia = (fecha || new Date()).getDate();
    return lista[(dia - 1) % lista.length];
  }

  function suscriptores() {
    var guardado = leer(K.SUSC);
    return (guardado && guardado.length !== undefined) ? guardado : [];
  }

  function guardarSuscriptores(lista) { return guardar(K.SUSC, lista); }

  /* ---------- contador de visitas (local, 30 min de sesión) -------- */
  function visitas() {
    var v = leer(K.VISITAS);
    if (!v || typeof v.total !== 'number') { v = { total: 0, ultima: 0 }; }
    return v;
  }

  function registrarVisita() {
    var v = visitas();
    var ahora = Date.now();
    var sesion = 30 * 60 * 1000; /* 30 minutos */
    var esPrimera = !v.ultima;
    if (esPrimera || (ahora - v.ultima) > sesion) {
      v.total = (v.total || 0) + 1;
      v.ultima = ahora;
      guardar(K.VISITAS, v);
    }
    return v.total;
  }

  /* ---------- contraseña (config.js o la que cambie el dueño) ------ */
  function clave() {
    var propia = leer(K.CLAVE);
    if (typeof propia === 'string' && propia.length) { return propia; }
    return (typeof CONFIG !== 'undefined' && CONFIG.ADMIN_CLAVE) ? CONFIG.ADMIN_CLAVE : '';
  }

  function cambiarClave(nueva) { return guardar(K.CLAVE, nueva); }

  return {
    K: K,
    leer: leer, guardar: guardar,
    versiculoDelDia: versiculoDelDia,
    suscriptores: suscriptores, guardarSuscriptores: guardarSuscriptores,
    visitas: visitas, registrarVisita: registrarVisita,
    clave: clave, cambiarClave: cambiarClave
  };
})();


/* =====================================================================
   Interfaz del panel
   ===================================================================== */
var AdminPanel = (function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var sesion = false;

  function mensaje(id, texto, error) {
    var el = $(id);
    if (!el) { return; }
    el.textContent = texto || '';
    el.style.color = error ? '#ff9d87' : '#f3cf7a';
    if (texto) {
      window.setTimeout(function () {
        if (el.textContent === texto) { el.textContent = ''; }
      }, 5000);
    }
  }

  /* ------------------------- pestañas internas ---------------------- */
  function pintarPestanas() {
    var botones = document.querySelectorAll('#adminTabs .admin-tab');
    Array.prototype.forEach.call(botones, function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(botones, function (o) { o.classList.remove('activo'); });
        b.classList.add('activo');
        var pesta = b.getAttribute('data-atab');
        ['suscriptores', 'ajustes'].forEach(function (p) {
          var pane = $('pane' + p.charAt(0).toUpperCase() + p.slice(1));
          if (pane) { pane.hidden = (p !== pesta); }
        });
      });
    });
  }

  /* --------------------------- suscriptores ------------------------- */
  function tablaSuscriptores() {
    var tabla = $('tablaSuscriptores');
    if (!tabla) { return; }
    var cuerpo = tabla.querySelector('tbody');
    var lista = JIREH.suscriptores();
    cuerpo.innerHTML = '';

    if (!lista.length) {
      cuerpo.innerHTML = '<tr><td colspan="4">Todavía no hay suscriptores.</td></tr>';
    } else {
      lista.forEach(function (s, i) {
        var tr = document.createElement('tr');
        [String(i + 1), s.nombre || '—', s.email || '', s.fecha || ''].forEach(function (dato) {
          var td = document.createElement('td');
          td.textContent = dato;
          tr.appendChild(td);
        });
        cuerpo.appendChild(tr);
      });
    }

    var est = $('adminSuscriptores');
    if (est) { est.textContent = String(lista.length); }
  }

  function exportarCSV() {
    var lista = JIREH.suscriptores();
    if (!lista.length) {
      mensaje('msgSuscriptores', 'No hay suscriptores para exportar.', true);
      return;
    }
    var filas = [['nombre', 'correo', 'fecha']];
    lista.forEach(function (s) { filas.push([s.nombre || '', s.email || '', s.fecha || '']); });
    var csv = filas.map(function (f) {
      return f.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\r\n');

    try {
      var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'suscriptores-radio-jireh.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      mensaje('msgSuscriptores', 'CSV descargado: ' + lista.length + ' filas.');
    } catch (e) {
      mensaje('msgSuscriptores', 'No se pudo generar el archivo en este navegador.', true);
    }
  }

  function vaciarLista() {
    if (!window.confirm('¿Vaciar TODA la lista de suscriptores? Esta acción no se puede deshacer.')) { return; }
    JIREH.guardarSuscriptores([]);
    tablaSuscriptores();
    pintarResumen();
    mensaje('msgSuscriptores', 'Lista vaciada.');
  }

  /* ------------------------- estadísticas --------------------------- */
  function pintarResumen() {
    var v = JIREH.visitas();
    var s = JIREH.suscriptores().length;
    var a = $('adminVisitas'); if (a) { a.textContent = String(v.total || 0); }
    var a2 = $('adminVisitas2'); if (a2) { a2.textContent = String(v.total || 0); }
    var b = $('adminSuscriptores'); if (b) { b.textContent = String(s); }
  }

  /* --------------------------- ajustes ------------------------------ */
  function cambiarClave() {
    var nueva = $('claveNueva').value;
    var repetir = $('claveRepetir').value;
    if (!nueva || nueva.length < 4) {
      mensaje('msgClave', 'Usá una contraseña de al menos 4 caracteres.', true);
      return;
    }
    if (nueva !== repetir) {
      mensaje('msgClave', 'Las dos contraseñas no coinciden.', true);
      return;
    }
    JIREH.cambiarClave(nueva);
    $('claveNueva').value = '';
    $('claveRepetir').value = '';
    mensaje('msgClave', 'Contraseña guardada. Se usa la próxima vez que entres al panel.');
  }

  /* --------------------------- sesión ------------------------------- */
  function mostrarPanel() {
    $('adminLogin').hidden = true;
    $('adminPanel').hidden = false;
    pintarResumen();
    tablaSuscriptores();
  }

  function mostrarLogin(error) {
    $('adminLogin').hidden = false;
    $('adminPanel').hidden = true;
    var e = $('adminError');
    if (e) { e.hidden = !error; }
  }

  function intentarLogin(e) {
    if (e) { e.preventDefault(); }
    var valor = $('adminClave').value;
    if (valor && valor === JIREH.clave()) {
      sesion = true;
      $('adminClave').value = '';
      mostrarLogin(false);
      mostrarPanel();
    } else {
      mostrarLogin(true);
      $('adminClave').value = '';
      $('adminClave').focus();
    }
  }

  function salir() {
    sesion = false;
    mostrarLogin(false);
    var modal = $('modalAdmin');
    if (modal && window.JIREHCerrarModal) { window.JIREHCerrarModal(modal); }
  }

  /* --------------------------- montaje ------------------------------ */
  function montar() {
    if (window.__jirehAdminMontado) { return; }
    window.__jirehAdminMontado = true;

    pintarPestanas();

    var formLogin = $('formLogin');
    if (formLogin) { formLogin.addEventListener('submit', intentarLogin); }

    var btnCsv = $('btnCsv');
    if (btnCsv) { btnCsv.addEventListener('click', exportarCSV); }

    var btnVaciar = $('btnVaciar');
    if (btnVaciar) { btnVaciar.addEventListener('click', vaciarLista); }

    var btnClave = $('btnClave');
    if (btnClave) { btnClave.addEventListener('click', cambiarClave); }

    var btnSalir = $('btnSalirAdmin');
    if (btnSalir) { btnSalir.addEventListener('click', salir); }

    /* Si el dueño ya inició sesión en esta pestaña, va directo al panel */
    try {
      if (window.sessionStorage.getItem('jireh_admin') === '1') { sesion = true; }
    } catch (e) {}

    window.addEventListener('jireh:modal-admin-abierto', function () {
      if (sesion) { mostrarPanel(); } else { mostrarLogin(false); }
    });
    window.addEventListener('jireh:modal-admin-cerrado', function () {
      try { window.sessionStorage.setItem('jireh_admin', sesion ? '1' : '0'); } catch (e) {}
    });
  }

  return { montar: montar, pintarResumen: pintarResumen, esSesion: function () { return sesion; } };
})();
