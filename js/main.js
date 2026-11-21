/* =====================================================================
   RADIO JIREH — 103.5 FM · FORMOSA · ARGENTINA
   main.js — reloj, clima, reproductor, versículo del día y formularios
   ===================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var REDUCIDA = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CFG = (typeof CONFIG !== 'undefined') ? CONFIG : {};
  var NOMBRE = CFG.RADIO_NOMBRE || 'RADIO JIREH';
  var FRECUENCIA = CFG.FRECUENCIA || '103.5 FM';
  var LOCALE = 'es-AR';
  function esDispositivoMovil() {
    return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '') ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  var temporizadorToast = null;
  function toast(texto) {
    var t = $('toast');
    if (!t) { return; }
    $('toastTexto').textContent = texto;
    t.hidden = false;
    window.requestAnimationFrame(function () { t.classList.add('visible'); });
    window.clearTimeout(temporizadorToast);
    temporizadorToast = window.setTimeout(function () {
      t.classList.remove('visible');
      window.setTimeout(function () { t.hidden = true; }, 350);
    }, 5200);
  }
  function dosDig(n) { return (n < 10 ? '0' : '') + n; }
  function actualizarReloj() {
    var ahora = new Date();
    var reloj = $('reloj');
    if (reloj) { reloj.textContent = dosDig(ahora.getHours()) + ':' + dosDig(ahora.getMinutes()) + ':' + dosDig(ahora.getSeconds()); }
    var fecha = $('fechaLarga');
    if (fecha) {
      var txt;
      try { txt = ahora.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
      catch (e) { txt = ahora.getDate() + '/' + (ahora.getMonth() + 1) + '/' + ahora.getFullYear(); }
      txt = txt.charAt(0).toUpperCase() + txt.slice(1);
      fecha.textContent = txt;
    }
  }
  function pintarOdometro(contenedor, numero) {
    if (!contenedor) { return; }
    var texto = String(Math.max(0, Math.floor(numero)));
    while (texto.length < 6) { texto = '0' + texto; }
    if (contenedor.children.length !== texto.length) {
      contenedor.innerHTML = '';
      for (var i = 0; i < texto.length; i++) {
        var dig = document.createElement('span'); dig.className = 'odo-digito';
        var col = document.createElement('span'); col.className = 'odo-columna';
        for (var d = 0; d <= 9; d++) { var s = document.createElement('span'); s.textContent = String(d); col.appendChild(s); }
        dig.appendChild(col); contenedor.appendChild(dig);
      }
    }
    for (var j = 0; j < texto.length; j++) {
      var columna = contenedor.children[j].firstChild;
      var valor = parseInt(texto.charAt(j), 10);
      columna.style.transform = 'translateY(-' + (valor * 1.25) + 'em)';
    }
    contenedor.setAttribute('aria-label', 'Visitas de este equipo: ' + parseInt(numero, 10));
  }
  function iniciarVisitas() {
    var total = (typeof JIREH !== 'undefined') ? JIREH.registrarVisita() : 1;
    pintarOdometro($('odometroBarra'), total);
    pintarOdometro($('odometroPie'), total);
    var a = $('adminVisitas'); if (a) { a.textContent = String(total); }
    var a2 = $('adminVisitas2'); if (a2) { a2.textContent = String(total); }
  }

  /* ===== CLIMA DE FORMOSA (wttr.in, sin API key) ===== */
  var CODIGOS = {
    0: ['Despejado', 'sol'], 1: ['Principalmente despejado', 'sol'], 2: ['Parcialmente nublado', 'nube'], 3: ['Cubierto', 'nubes'],
    45: ['Neblina', 'niebla'], 48: ['Neblina con escarcha', 'niebla'],
    51: ['Llovizna ligera', 'lluvia'], 53: ['Llovizna', 'lluvia'], 55: ['Llovizna intensa', 'lluvia'], 56: ['Llovizna helada', 'lluvia'], 57: ['Llovizna helada intensa', 'lluvia'],
    61: ['Lluvia ligera', 'lluvia'], 63: ['Lluvia', 'lluvia'], 65: ['Lluvia intensa', 'tormenta'], 66: ['Lluvia helada', 'lluvia'], 67: ['Lluvia helada intensa', 'lluvia'],
    71: ['Nieve ligera', 'nieve'], 73: ['Nieve', 'nieve'], 75: ['Nieve intensa', 'nieve'], 77: ['Granos de nieve', 'nieve'],
    80: ['Chaparrones', 'lluvia'], 81: ['Chaparrones', 'lluvia'], 82: ['Chaparrones fuertes', 'tormenta'], 85: ['Chaparrones de nieve', 'nieve'], 86: ['Chaparrones de nieve', 'nieve'],
    95: ['Tormenta eléctrica', 'tormenta'], 96: ['Tormenta con granizo', 'tormenta'], 99: ['Tormenta fuerte con granizo', 'tormenta']
  };
  var CODIGOS_WTTR = {
    113: 0, 116: 2, 119: 3, 122: 3, 143: 45, 176: 61, 179: 71, 182: 66, 185: 56,
    200: 95, 227: 73, 230: 75, 248: 45, 260: 48, 263: 51, 266: 51, 281: 56, 284: 57,
    293: 61, 296: 61, 299: 63, 302: 63, 305: 65, 308: 65, 311: 66, 314: 67, 317: 66,
    320: 67, 323: 71, 326: 73, 329: 73, 332: 73, 335: 75, 338: 75, 350: 77, 353: 80,
    356: 81, 359: 82, 362: 80, 365: 81, 368: 85, 371: 86, 374: 77, 377: 77, 386: 95,
    389: 95, 392: 95, 395: 95
  };
  var CLIMA_LAT = (typeof CFG.CLIMA_LAT === 'number') ? CFG.CLIMA_LAT : -26.1775;
  var CLIMA_LON = (typeof CFG.CLIMA_LON === 'number') ? CFG.CLIMA_LON : -58.1781;
  var CLIMA_TZ = CFG.CLIMA_TZ || 'America/Argentina/Cordoba';
  function codigoWttr(codigo) {
    var codigoWmo = CODIGOS_WTTR[parseInt(codigo, 10)];
    return typeof codigoWmo === 'number' ? codigoWmo : 3;
  }
  function horaLocalClima(tz) {
    try { return new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date()); }
    catch (e) { return new Date().toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }); }
  }
  function convertirClimaWttr(datos, tz) {
    var actual = datos && datos.current_condition && datos.current_condition[0];
    if (!actual) { throw new Error('La respuesta del servicio no incluye condiciones actuales.'); }
    var temperatura = parseFloat(actual.temp_C);
    var sensacion = parseFloat(actual.FeelsLikeC);
    var humedad = parseFloat(actual.humidity);
    var viento = parseFloat(actual.windspeedKmph);
    if (![temperatura, sensacion, humedad, viento].every(function (valor) { return isFinite(valor); })) {
      throw new Error('La respuesta del servicio contiene datos meteorológicos inválidos.');
    }

    var pronostico = Array.isArray(datos.weather) ? datos.weather.slice(0, 3) : [];
    var dias = pronostico.map(function (dia) {
      var horas = Array.isArray(dia.hourly) ? dia.hourly : [];
      var mediodia = horas.filter(function (hora) { return String(hora.time) === '1200'; })[0] || horas[0] || {};
      return {
        fecha: dia.date,
        maxima: parseFloat(dia.maxtempC),
        minima: parseFloat(dia.mintempC),
        codigo: codigoWttr(mediodia.weatherCode)
      };
    }).filter(function (dia) {
      return dia.fecha && isFinite(dia.maxima) && isFinite(dia.minima);
    });

    return {
      current: {
        temperature_2m: temperatura,
        apparent_temperature: sensacion,
        relative_humidity_2m: humedad,
        wind_speed_10m: viento,
        weather_code: codigoWttr(actual.weatherCode),
        local_time: horaLocalClima(tz)
      },
      daily: {
        time: dias.map(function (dia) { return dia.fecha; }),
        weather_code: dias.map(function (dia) { return dia.codigo; }),
        temperature_2m_max: dias.map(function (dia) { return dia.maxima; }),
        temperature_2m_min: dias.map(function (dia) { return dia.minima; })
      }
    };
  }
  function iconoClima(tipo) {
    var sol = '<circle cx="32" cy="32" r="13" fill="#f3cf7a"/>' + '<g stroke="#f3cf7a" stroke-width="4" stroke-linecap="round">' + '<path d="M32 6v8"/><path d="M32 50v8"/><path d="M6 32h8"/><path d="M50 32h8"/>' + '<path d="M13 13l6 6"/><path d="M45 45l6 6"/><path d="M51 13l-6 6"/><path d="M19 45l-6 6"/></g>';
    var nube = '<path d="M20 46h26a10 10 0 0 0 1-20 15 15 0 0 0-29-4 9 9 0 0 0 2 24z" fill="#d6e0f2"/>';
    var cuerpo = '';
    if (tipo === 'sol') { cuerpo = sol; }
    else if (tipo === 'nube') { cuerpo = sol.replace('r="13"', 'r="10"').replace(/stroke-width="4"/g, 'stroke-width="3"') + nube; }
    else if (tipo === 'nubes') { cuerpo = nube + '<path d="M14 52h26a8 8 0 0 0 1-16 12 12 0 0 0-23-3 7 7 0 0 0-4 19z" fill="#8fa3bd" transform="translate(6,-8)"/>'; }
    else if (tipo === 'lluvia') { cuerpo = nube + '<g stroke="#7fb0ff" stroke-width="4" stroke-linecap="round"><path d="M24 52l-4 9"/><path d="M36 52l-4 9"/><path d="M48 52l-4 9"/></g>'; }
    else if (tipo === 'tormenta') { cuerpo = nube + '<path d="M34 46l-10 14h9l-5 12 16-18h-9l6-8z" fill="#f3cf7a"/>'; }
    else if (tipo === 'nieve') { cuerpo = nube + '<g stroke="#e6edf7" stroke-width="3" stroke-linecap="round"><path d="M24 54v8"/><path d="M21 57l6 3"/><path d="M27 57l-6 3"/><path d="M44 54v8"/><path d="M41 57l6 3"/><path d="M47 57l-6 3"/></g>'; }
    else if (tipo === 'niebla') { cuerpo = '<g stroke="#8fa3bd" stroke-width="5" stroke-linecap="round"><path d="M10 24h44"/><path d="M16 34h40"/><path d="M10 44h44"/><path d="M20 54h34"/></g>'; }
    else { cuerpo = sol; }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Ícono de clima">' + cuerpo + '</svg>';
  }
  function simboloMini(tipo) { return { sol: '☀', nube: '⛅', nubes: '☁', lluvia: '☂', tormenta: '⚡', nieve: '❄', niebla: '≋' }[tipo] || '◐'; }
  function fechaLocal(dia) {
    try { return new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'short', timeZone: CLIMA_TZ }).format(dia); }
    catch (e) { return 'Día ' + dia; }
  }
  function climaNoDisponible() {
    var est = $('climaEstado');
    if (est) { est.hidden = false; est.textContent = 'No se pudo obtener el clima actual. Revisá la conexión e intentá de nuevo.'; }
    var p = $('climaPrincipal'); if (p) { p.hidden = true; }
    var actualizado = $('climaActualizado'); if (actualizado) { actualizado.hidden = true; }
    var d = $('climaDias'); if (d) { d.hidden = true; }
    var btn = $('btnClimaReintentar'); if (btn) { btn.hidden = false; }
    var mini = $('climaMiniTemp'); if (mini) { mini.textContent = '--°'; }
    var miniIco = $('climaMiniIco'); if (miniIco) { miniIco.textContent = '◌'; }
  }
  function pedirClima() {
    var url = 'https://wttr.in/' + CLIMA_LAT + ',' + CLIMA_LON + '?format=j1&lang=es';
    var est = $('climaEstado');
    if (est) { est.hidden = false; est.textContent = 'Cargando el clima…'; }
    var btn = $('btnClimaReintentar'); if (btn) { btn.hidden = true; }
    var controlador = null; var cancelado = false; var temporizador = null;
    if (typeof AbortController !== 'undefined') {
      controlador = new AbortController();
      temporizador = window.setTimeout(function () { if (!cancelado) { controlador.abort(); } }, 12000);
    }
    var opciones = { cache: 'no-store' };
    if (controlador) { opciones.signal = controlador.signal; }
    fetch(url, opciones)
      .then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); })
      .then(function (datos) { cancelado = true; pintarClima(convertirClimaWttr(datos, CLIMA_TZ)); })
      .catch(function (error) {
        cancelado = true;
        console.warn('No se pudo consultar el clima actual de Formosa.', error);
        climaNoDisponible();
      })
      .then(function () { window.clearTimeout(temporizador); });
  }
  function pintarClima(datos) {
    if (!datos || !datos.current) { climaNoDisponible(); return; }
    var act = datos.current;
    var valoresActuales = [act.temperature_2m, act.apparent_temperature, act.relative_humidity_2m, act.wind_speed_10m];
    if (valoresActuales.some(function (valor) { return typeof valor !== 'number' || !isFinite(valor); })) { climaNoDisponible(); return; }
    var info = CODIGOS[act.weather_code] || ['Clima variable', 'nube'];
    var est = $('climaEstado'); if (est) { est.hidden = true; }
    var prin = $('climaPrincipal'); if (prin) { prin.hidden = false; }
    var dias = $('climaDias'); if (dias) { dias.hidden = false; }
    $('climaIco').innerHTML = iconoClima(info[1]);
    $('climaTemp').textContent = Math.round(act.temperature_2m) + ' °C';
    $('climaSens').textContent = 'Sensación ' + Math.round(act.apparent_temperature) + ' °C';
    $('climaDesc').textContent = info[0];
    $('climaHumedad').textContent = Math.round(act.relative_humidity_2m) + '%';
    $('climaViento').textContent = Math.round(act.wind_speed_10m) + ' km/h';
    $('climaMiniTemp').textContent = Math.round(act.temperature_2m) + '°';
    $('climaMiniIco').textContent = simboloMini(info[1]);
    $('climaMini').setAttribute('title', 'Clima en Formosa: ' + info[0] + ', ' + Math.round(act.temperature_2m) + ' grados');
    var actualizado = $('climaActualizado');
    if (actualizado) {
      actualizado.textContent = act.local_time ? 'Observación consultada a las ' + act.local_time + ' · hora de Formosa' : 'Dato meteorológico actual de Formosa';
      actualizado.hidden = false;
    }
    var cont = $('climaDias'); cont.innerHTML = '';
    if (datos.daily && datos.daily.time) {
      for (var i = 0; i < Math.min(3, datos.daily.time.length); i++) {
        var cod = datos.daily.weather_code[i];
        var dInfo = CODIGOS[cod] || ['Clima variable', 'nube'];
        var max = Math.round(datos.daily.temperature_2m_max[i]);
        var min = Math.round(datos.daily.temperature_2m_min[i]);
        var caja = document.createElement('div'); caja.className = 'clima-dia';
        caja.innerHTML = '<span class="clima-dia-nombre">' + fechaLocal(new Date(datos.daily.time[i] + 'T12:00:00Z')) + '</span>' + iconoClima(dInfo[1]) + '<span class="clima-dia-rango"><b>' + max + '°</b> / <i>' + min + '°</i></span>' + '<span class="clima-dia-nombre">' + dInfo[0] + '</span>';
        cont.appendChild(caja);
      }
    }
  }

  /* ===== PARTÍCULAS DE LUZ DEL HERO ===== */
  function fondoLuz() {
    var canvas = $('particulas');
    if (!canvas || !canvas.getContext) { return; }
    var ctx = canvas.getContext('2d');
    if (!ctx) { return; }
    var ancho = 0, alto = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var motas = []; var pedido = null;
    var visible = !('IntersectionObserver' in window); var ultimoFrame = 0;
    function medir() {
      var caja = canvas.parentElement;
      ancho = caja.clientWidth; alto = caja.clientHeight;
      canvas.width = Math.floor(ancho * dpr); canvas.height = Math.floor(alto * dpr);
      canvas.style.width = ancho + 'px'; canvas.style.height = alto + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var cantidad = Math.round(Math.min(90, Math.max(30, (ancho * alto) / 14000)));
      motas = [];
      for (var i = 0; i < cantidad; i++) { motas.push({ x: Math.random() * ancho, y: Math.random() * alto, r: Math.random() * 1.8 + 0.5, v: Math.random() * 0.25 + 0.05, a: Math.random() * 0.6 + 0.25, f: Math.random() * Math.PI * 2, c: Math.random() < 0.6 ? '#fff3c9' : '#f3cf7a' }); }
    }
    function pintar(mover, paso) {
      ctx.clearRect(0, 0, ancho, alto);
      for (var i = 0; i < motas.length; i++) {
        var m = motas[i];
        var brillo = m.a * (0.65 + 0.35 * Math.sin(m.f));
        ctx.globalAlpha = brillo; ctx.fillStyle = m.c; ctx.shadowColor = m.c; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
        if (mover) { m.y -= m.v * paso; m.x += Math.sin((m.y + i * 40) / 110) * 0.12 * paso; m.f += 0.03 * paso; if (m.y + m.r < 0) { m.y = alto + 4; m.x = Math.random() * ancho; } }
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }
    function iniciarBucle() {
      if (!REDUCIDA && visible && !document.hidden && !pedido) { pedido = window.requestAnimationFrame(bucle); }
    }
    function pausarBucle() {
      if (pedido) { window.cancelAnimationFrame(pedido); pedido = null; }
      ultimoFrame = 0;
    }
    function bucle(tiempo) {
      pedido = null;
      if (document.hidden || !visible) { return; }
      if (!ultimoFrame || tiempo - ultimoFrame >= 1000 / 30) {
        var paso = ultimoFrame ? Math.min((tiempo - ultimoFrame) / (1000 / 60), 2) : 1;
        pintar(true, paso);
        ultimoFrame = tiempo;
      }
      pedido = window.requestAnimationFrame(bucle);
    }
    medir(); pintar(false);
    if (!REDUCIDA) {
      if ('IntersectionObserver' in window) {
        var observadorVisible = new IntersectionObserver(function (entradas) {
          visible = entradas.some(function (entrada) { return entrada.isIntersecting; });
          if (visible) { iniciarBucle(); } else { pausarBucle(); }
        });
        observadorVisible.observe(canvas.parentElement);
      } else { iniciarBucle(); }
    }
    var reajuste = null;
    window.addEventListener('resize', function () { window.clearTimeout(reajuste); reajuste = window.setTimeout(function () { medir(); if (REDUCIDA) { pintar(false); } }, 180); });
    document.addEventListener('visibilitychange', function () {
      if (REDUCIDA) { return; }
      if (document.hidden) { pausarBucle(); }
      else { iniciarBucle(); }
    });
  }

  /* ===== REPRODUCTOR ===== */
  var Reproductor = (function () {
    var audio, estado = 'detenido';
    var tiempoTimer = null, esperaTimer = null, vigiaTimer = null;
    var segundos = 0; var alAire = false; var ultimoOk = 0; var intentoUrl = 0;
    var CLAVE_VOLUMEN = 'jireh_volumen'; var VOLUMEN_POR_DEFECTO = 80;
    function listaUrls() {
      var principal = CFG.STREAM_URL || '';
      var extras = Array.isArray(CFG.STREAM_FALLBACKS) ? CFG.STREAM_FALLBACKS : [];
      var lista = [];
      var protocolo = window.location.protocol;
      function agregarUrl(url) {
        if (!url) { return; }
        // En un sitio https el navegador bloquea el audio http:// (contenido mixto): se usa el puente /api/radio.
        if (protocolo === 'https:' && /^http:\/\//i.test(url)) { return; }
        // Abierta como archivo local no existe el puente /api/radio.
        if (protocolo === 'file:' && url.charAt(0) === '/') { return; }
        if (lista.indexOf(url) === -1) { lista.push(url); }
      }
      agregarUrl(principal);
      for (var k = 0; k < extras.length; k++) {
        agregarUrl(extras[k]);
      }
      return lista;
    }
    function setEstado(texto, modo) {
      var el = $('estadoRepro');
      if (el) { el.textContent = texto; if (modo) { el.setAttribute('data-estado', modo); } else { el.removeAttribute('data-estado'); } }
      var reproductor = $('reproductor');
      if (reproductor) { reproductor.setAttribute('data-estado', modo || (texto === 'EN VIVO' ? 'vivo' : 'detenido')); }
    }
    function pintarBotonPlay(sonando) {
      var btn = $('btnPlay');
      if (!btn) { return; }
      btn.classList.toggle('on', sonando);
      btn.setAttribute('aria-label', sonando ? 'Pausar la radio' : 'Reproducir la radio');
      var icono = $('iconoPlay');
      var texto = $('textoPlay');
      if (icono) { icono.textContent = sonando ? 'Ⅱ' : '▶'; }
      if (texto) { texto.textContent = sonando ? 'PAUSAR' : 'ESCUCHAR'; }
    }
    function pintarTiempo() {
      var el = $('tiempoRepro');
      if (el) { var m = Math.floor(segundos / 60), s = segundos % 60; el.textContent = dosDig(m) + ':' + dosDig(s); }
    }
    function pararTemporizadores() { window.clearTimeout(esperaTimer); esperaTimer = null; window.clearInterval(tiempoTimer); tiempoTimer = null; window.clearInterval(vigiaTimer); vigiaTimer = null; }
    function iniciarTiempo() { window.clearInterval(tiempoTimer); tiempoTimer = window.setInterval(function () { segundos++; pintarTiempo(); }, 1000); }
    function mostrarReintentar(ver) { var b = $('btnReintentar'); if (b) { b.hidden = !ver; } }
    function errorFinal() {
      pararTemporizadores(); estado = 'error'; alAire = false;
      setEstado('SEÑAL NO DISPONIBLE', 'error');
      mostrarReintentar(listaUrls().length > 0); pintarBotonPlay(false);
    }
    var reintentosFallidos = 0;
    function reintentoAutomatico() {
      var urls = listaUrls();
      if (!urls.length || reintentosFallidos >= 5) { errorFinal(); return; }
      reintentosFallidos++;
      intentoUrl = (intentoUrl + 1) % urls.length;
      pararTemporizadores(); estado = 'reintentando'; alAire = true;
      setEstado('REINTENTANDO…', 'conectando'); mostrarReintentar(false); pintarBotonPlay(false);
      esperaTimer = window.setTimeout(function () { reproducir(); }, Math.min(1000 * reintentosFallidos, 10000));
    }
    function fallo() {
      if (estado === 'detenido' || estado === 'pausa' || estado === 'error' || estado === 'reintentando') { return; }
      reintentoAutomatico();
    }
    function ok() { pararTemporizadores(); estado = 'reproduciendo'; alAire = true; intentoUrl = 0; reintentosFallidos = 0; ultimoOk = Date.now(); setEstado('EN VIVO'); pintarBotonPlay(true); mostrarReintentar(false); iniciarTiempo(); vigilar(); }
    function vigilar() {
      window.clearInterval(vigiaTimer);
      vigiaTimer = window.setInterval(function () {
        if (estado === 'reproduciendo') { ultimoOk = Date.now(); return; }
        if (estado === 'conectando' && alAire && Date.now() - ultimoOk > 8000) { window.clearInterval(vigiaTimer); vigiaTimer = null; reintentoAutomatico(); }
      }, 1000);
    }
    function reproducir() {
      var urls = listaUrls(); var u = urls[intentoUrl] || urls[0];
      if (!u) { errorFinal(); return; }
      pararTemporizadores(); estado = 'conectando'; setEstado('CONECTANDO…', 'conectando'); mostrarReintentar(false); pintarBotonPlay(false);
      audio.src = u; try { audio.load(); } catch (e) {}
      var promesa = audio.play(); if (promesa && promesa.catch) { promesa.catch(function () {}); }
      window.clearTimeout(esperaTimer);
      esperaTimer = window.setTimeout(function () { if (estado !== 'reproduciendo') { fallo(); } }, 15000);
      if (alAire) { vigilar(); }
    }
    function detener() {
      pararTemporizadores(); try { audio.pause(); } catch (e) {}
      estado = 'detenido'; alAire = false; intentoUrl = 0; reintentosFallidos = 0; segundos = 0; pintarTiempo(); setEstado('DETENIDO'); mostrarReintentar(false); pintarBotonPlay(false);
    }
    function leerVolumen() { try { var v = parseInt(window.localStorage.getItem(CLAVE_VOLUMEN), 10); if (!isNaN(v) && v >= 0 && v <= 100) { return v; } } catch (e) {} return VOLUMEN_POR_DEFECTO; }
    function guardarVolumen(v) { try { window.localStorage.setItem(CLAVE_VOLUMEN, String(v)); } catch (e) {} }
    function aplicarVolumen(v) { if (audio) { audio.volume = v / 100; } var salida = $('volValor'); if (salida) { salida.textContent = String(v); } var barra = $('volumen'); if (barra) { barra.value = String(v); } }
    function montar() {
      audio = $('radioAudio');
      if (!audio) {
        console.error('No se encontró el elemento de audio #radioAudio.');
        setEstado('REPRODUCTOR NO DISPONIBLE', 'error');
        return;
      }
      aplicarVolumen(leerVolumen());
      audio.addEventListener('playing', ok);
      audio.addEventListener('canplay', function () { if (estado === 'conectando' && !audio.paused) { ok(); } });
      audio.addEventListener('timeupdate', function () { if (estado === 'conectando' && !audio.paused) { ok(); } });
      audio.addEventListener('error', fallo);
      // El puente /api/radio corta cada ~5 minutos (límite de Vercel): si estaba sonando, reconectar enseguida.
      audio.addEventListener('ended', function () { if (estado === 'reproduciendo') { reproducir(); return; } fallo(); });
      audio.addEventListener('stalled', function () { if (estado === 'reproduciendo' || (estado === 'conectando' && alAire)) { estado = 'conectando'; setEstado('CONECTANDO…', 'conectando'); pintarBotonPlay(false); vigilar(); } });
      audio.addEventListener('waiting', function () { if (estado === 'reproduciendo') { estado = 'conectando'; setEstado('CONECTANDO…', 'conectando'); pintarBotonPlay(false); vigilar(); } });
      $('btnPlay').addEventListener('click', function () {
        if (estado === 'reproduciendo') { try { audio.pause(); } catch (e) {} estado = 'pausa'; alAire = false; pararTemporizadores(); setEstado('PAUSA', 'conectando'); pintarBotonPlay(false); return; }
        intentoUrl = 0; reintentosFallidos = 0; reproducir();
      });
      var btnStop = $('btnStop'); if (btnStop) { btnStop.addEventListener('click', detener); }
      $('btnReintentar').addEventListener('click', function () { intentoUrl = 0; reintentosFallidos = 0; alAire = false; estado = 'detenido'; pararTemporizadores(); reproducir(); });
      var vol = $('volumen');
      if (vol) { vol.addEventListener('input', function () { var v = parseInt(vol.value, 10); if (isNaN(v)) { return; } aplicarVolumen(v); guardarVolumen(v); }); }
      if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: NOMBRE + ' · ' + FRECUENCIA, artist: CFG.UBICACION || 'Formosa · Argentina',
            artwork: [{ src: 'assets/img/app-icon-512.png', sizes: '512x512', type: 'image/png' }]
          });
        } catch (e) {}
      }
      pintarTiempo();
    }
    return { montar: montar };
  })();

  function reveal() {
    var elementos = document.querySelectorAll('.reveal');
    if (REDUCIDA || !('IntersectionObserver' in window)) { Array.prototype.forEach.call(elementos, function (el) { el.classList.add('visible'); }); return; }
    var obs = new IntersectionObserver(function (entradas) { entradas.forEach(function (entrada) { if (entrada.isIntersecting) { entrada.target.classList.add('visible'); obs.unobserve(entrada.target); } }); }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    Array.prototype.forEach.call(elementos, function (el) { obs.observe(el); });
  }
  var ultimoFoco = null; var modalAbierto = null;
  function abrirModal(modal) { if (!modal) { return; } ultimoFoco = document.activeElement; modalAbierto = modal; modal.hidden = false; document.body.style.overflow = 'hidden'; var cerrar = modal.querySelector('.modal-cerrar'); if (cerrar) { cerrar.focus(); } }
  function cerrarModal(modal) { if (!modal) { return; } modal.hidden = true; document.body.style.overflow = ''; modalAbierto = null; if (ultimoFoco && ultimoFoco.focus) { ultimoFoco.focus(); } if (modal.id === 'modalAdmin') { window.dispatchEvent(new CustomEvent('jireh:modal-admin-cerrado')); } }
  window.JIREHCerrarModal = cerrarModal;
  function montarModales() {
    Array.prototype.forEach.call(document.querySelectorAll('.modal'), function (modal) { Array.prototype.forEach.call(modal.querySelectorAll('[data-cerrar]'), function (el) { el.addEventListener('click', function () { cerrarModal(modal); }); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalAbierto) { cerrarModal(modalAbierto); }
      if (e.key === 'Tab' && modalAbierto) {
        var foco = modalAbierto.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])');
        var visibles = Array.prototype.filter.call(foco, function (el) { return el.offsetParent !== null; });
        if (!visibles.length) { return; }
        var primero = visibles[0], ultimo = visibles[visibles.length - 1];
        if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); } else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
      }
    });
  }

  /* ===== VERSÍCULO DEL DÍA ===== */
  var versiculoActual = null;
  function pintarVersiculo() {
    versiculoActual = (typeof JIREH !== 'undefined') ? JIREH.versiculoDelDia(new Date()) : null;
    var seccion = $('versiculo');
    if (!versiculoActual) { if (seccion) { seccion.hidden = true; } return; }
    $('versiculoTexto').textContent = '«' + versiculoActual.texto + '»';
    $('versiculoCita').textContent = versiculoActual.cita + ' · RVR1960';
  }
  function compartirVersiculo() {
    if (!versiculoActual) { return; }
    var texto = '«' + versiculoActual.texto + '» — ' + versiculoActual.cita + '\n\nVersículo del día · ' + NOMBRE + ' ' + FRECUENCIA;
    var url = window.location.href.split('#')[0];
    if (navigator.share) {
      navigator.share({ title: 'Versículo del día', text: texto, url: url }).catch(function () {});
      return;
    }
    var completo = texto + '\n' + url;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(completo).then(function () { toast('Versículo copiado. ¡Pegalo donde quieras compartirlo!'); }, function () { toast('No se pudo copiar el versículo.'); });
    } else {
      toast('Tu navegador no permite compartir automáticamente.');
    }
  }

  /* ===== PEDIDOS DE ORACIÓN (WhatsApp o correo) ===== */
  function destinoOracion() {
    var wa = String(CFG.WHATSAPP || '').replace(/\D/g, '');
    if (wa) { return { tipo: 'whatsapp', valor: wa }; }
    var correo = String(CFG.CORREO_ORACION || '').trim();
    if (correo) { return { tipo: 'correo', valor: correo }; }
    return null;
  }
  function oracion() {
    var seccion = $('oracion'); var form = $('formOracion');
    var destino = destinoOracion();
    if (!destino) { if (seccion) { seccion.hidden = true; } return; }
    if (!form) { return; }
    var boton = $('btnOracion');
    if (boton) { boton.textContent = destino.tipo === 'whatsapp' ? 'ENVIAR POR WHATSAPP' : 'ENVIAR POR CORREO'; }
    var nota = $('oracionNota');
    if (nota) {
      nota.textContent = destino.tipo === 'whatsapp'
        ? 'Al enviar se abre WhatsApp con tu pedido listo para mandar a la radio. Nada se guarda en esta página.'
        : 'Al enviar se abre tu programa de correo con el pedido listo para mandar a la radio. Nada se guarda en esta página.';
    }
    var input = $('oracionPedido'); var error = $('oracionError');
    function mostrarError(txt) { error.textContent = txt; error.hidden = false; input.classList.add('invalido'); input.setAttribute('aria-invalid', 'true'); input.focus(); }
    function limpiarError() { error.hidden = true; error.textContent = ''; input.classList.remove('invalido'); input.removeAttribute('aria-invalid'); }
    input.addEventListener('input', limpiarError);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var pedido = input.value.trim(); var nombre = $('oracionNombre').value.trim();
      if (pedido.length < 5) { mostrarError('Contanos brevemente por qué querés que oremos.'); return; }
      var mensajeTxt = 'Pedido de oración para ' + NOMBRE + '\n' + (nombre ? 'Nombre: ' + nombre + '\n' : '') + '\n' + pedido;
      var enlace = destino.tipo === 'whatsapp'
        ? 'https://wa.me/' + destino.valor + '?text=' + encodeURIComponent(mensajeTxt)
        : 'mailto:' + destino.valor + '?subject=' + encodeURIComponent('Pedido de oración') + '&body=' + encodeURIComponent(mensajeTxt);
      limpiarError(); form.reset();
      if (destino.tipo === 'whatsapp') { window.open(enlace, '_blank', 'noopener'); } else { window.location.href = enlace; }
      toast('Gracias por confiarnos tu pedido. Estaremos orando por vos.');
    });
  }

  /* ===== REDES SOCIALES ===== */
  function redes() {
    var cont = $('listaRedes'); if (!cont) { return; }
    var nombres = { facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok' };
    var lista = CFG.REDES || {};
    cont.innerHTML = '';
    Object.keys(nombres).forEach(function (clave) {
      var url = String(lista[clave] || '').trim();
      if (!/^https?:\/\//i.test(url)) { return; }
      var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = nombres[clave];
      cont.appendChild(a);
    });
    var wa = String(CFG.WHATSAPP || '').replace(/\D/g, '');
    if (wa) { var w = document.createElement('a'); w.href = 'https://wa.me/' + wa; w.target = '_blank'; w.rel = 'noopener'; w.textContent = 'WhatsApp'; cont.appendChild(w); }
    if (CFG.PAGINA_RADIO) { var p = document.createElement('a'); p.href = CFG.PAGINA_RADIO; p.target = '_blank'; p.rel = 'noopener'; p.textContent = 'Reproductor oficial'; cont.appendChild(p); }
  }

  function sincronizarBarra() {
    var barra = $('barraSuperior'); var raiz = document.documentElement; if (!barra || !raiz.style) { return; }
    if (raiz.style.getPropertyValue('--topbar-h')) { raiz.style.removeProperty('--topbar-h'); }
    var alto = Math.ceil(barra.getBoundingClientRect().height) + 1; // Margen para evitar solapamiento por redondeo.
    if (alto > 0) { raiz.style.setProperty('--topbar-h', alto + 'px'); }
  }
  function vigilarBarra() {
    sincronizarBarra(); var reajuste = null;
    window.addEventListener('resize', function () { window.clearTimeout(reajuste); reajuste = window.setTimeout(sincronizarBarra, 150); });
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) { document.fonts.ready.then(function () { sincronizarBarra(); }).catch(function () {}); }
    window.setTimeout(sincronizarBarra, 1200);
  }
  function newsletterConfigurado() { return CFG.NEWSLETTER_EMAIL ? String(CFG.NEWSLETTER_EMAIL).trim() : ''; }
  function ocultarNewsletter() {
    if (newsletterConfigurado()) { return; }
    var seccion = $('newsletter'); if (seccion) { seccion.hidden = true; }
    var enlacePie = document.querySelector('.pie-links a[href="#newsletter"]'); if (enlacePie && enlacePie.parentNode) { enlacePie.parentNode.removeChild(enlacePie); }
  }
  function ocultarEnlacesSinSeccion() {
    Array.prototype.forEach.call(document.querySelectorAll('.pie-links a[href^="#"]'), function (a) {
      var id = a.getAttribute('href').slice(1); if (!id) { return; }
      var destino = document.getElementById(id);
      if (destino && destino.hidden && a.parentNode) { a.parentNode.removeChild(a); }
    });
  }
  function newsletter() {
    var form = $('formNews'); if (!form) { return; }
    var correoRadio = newsletterConfigurado(); if (!correoRadio) { return; }
    var input = $('newsEmail'); var error = $('newsError');
    function mostrarError(txt) { error.textContent = txt; error.hidden = false; input.classList.add('invalido'); input.setAttribute('aria-invalid', 'true'); input.focus(); }
    function limpiarError() { error.hidden = true; error.textContent = ''; input.classList.remove('invalido'); input.removeAttribute('aria-invalid'); }
    input.addEventListener('input', limpiarError);
    form.addEventListener('submit', function (e) {
      e.preventDefault(); var correo = input.value.trim(); var nombre = $('newsNombre').value.trim();
      if (!correo) { mostrarError('Escribí tu correo electrónico.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(correo)) { mostrarError('Ese correo no parece válido. Revisá el formato (ej: nombre@dominio.com).'); return; }
      var lista = (typeof JIREH !== 'undefined') ? JIREH.suscriptores() : [];
      var repetido = lista.some(function (s) { return String(s.email).toLowerCase() === correo.toLowerCase(); });
      if (repetido) { mostrarError('Ese correo ya estaba en la lista. ¡Gracias igual!'); return; }
      var fecha = ''; try { fecha = new Date().toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' }); } catch (err) { fecha = new Date().toISOString(); }
      lista.unshift({ nombre: nombre, email: correo, fecha: fecha }); if (typeof JIREH !== 'undefined') { JIREH.guardarSuscriptores(lista); }
      limpiarError(); form.reset();
      try {
        var asunto = 'Nueva suscripción - Radio JIREH';
        var cuerpo = 'Nombre: ' + (nombre || '(sin nombre)') + '\n' + 'Correo: ' + correo + '\n' + 'Fecha: ' + fecha + '\n' + 'Suscripción enviada desde la página de la radio.';
        window.location.href = 'mailto:' + correoRadio + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(cuerpo);
        toast('Se abrió tu correo para completar la suscripción. ¡Bendiciones!');
      } catch (err) { toast('No pudimos abrir tu correo. Escribinos por las redes para sumarte.'); }
      if (typeof AdminPanel !== 'undefined') { AdminPanel.pintarResumen(); }
    });
  }
  function panelDelDueno() {
    var enlace = $('linkAdmin');
    if (enlace) { enlace.addEventListener('click', function (e) { e.preventDefault(); abrirModal($('modalAdmin')); window.dispatchEvent(new CustomEvent('jireh:modal-admin-abierto')); }); }
  }
  function iniciar() {
    asegurarLogos(); reveal();
    ocultarNewsletter(); vigilarBarra();
    if (typeof AdminPanel !== 'undefined') { AdminPanel.montar(); }
    actualizarReloj(); window.setInterval(actualizarReloj, 1000);
    iniciarVisitas(); fondoLuz(); montarModales(); pintarVersiculo(); oracion(); redes(); newsletter(); panelDelDueno();
    ocultarEnlacesSinSeccion();
    var btnCompartir = $('btnCompartirVersiculo'); if (btnCompartir) { btnCompartir.addEventListener('click', compartirVersiculo); }
    Reproductor.montar();
    pedirClima();
    var btnClima = $('btnClimaReintentar'); if (btnClima) { btnClima.addEventListener('click', pedirClima); }
    window.setInterval(pedirClima, 15 * 60 * 1000);
    instalarApp();
  }
  function asegurarLogos() {
    Array.prototype.forEach.call(document.querySelectorAll('img[src="logo-radio.jpg"]'), function (img) {
      function usarAlternativa() {
        if (img.getAttribute('data-alternativa')) { return; }
        img.setAttribute('data-alternativa', 'true');
        img.src = 'radio.jpg';
      }
      img.addEventListener('error', usarAlternativa);
      if (img.complete && !img.naturalWidth) { usarAlternativa(); }
    });
  }
  function instalarApp() {
    var esLocalSeguro = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    var esContextoSeguro = window.isSecureContext || esLocalSeguro;
    if ('serviceWorker' in navigator && esLocalSeguro) {
      // En la computadora (Live Server) no se usa el modo sin conexión: la caché
      // escondía los cambios y los errores del servidor. Se borra lo que haya quedado.
      navigator.serviceWorker.getRegistrations().then(function (registros) {
        registros.forEach(function (r) { r.unregister(); });
      }).catch(function () {});
      if (window.caches) { caches.keys().then(function (claves) { claves.forEach(function (c) { caches.delete(c); }); }).catch(function () {}); }
    } else if ('serviceWorker' in navigator && esContextoSeguro) {
      navigator.serviceWorker.register('./sw.js').catch(function (error) {
        console.error('No se pudo habilitar el modo sin conexión de la radio.', error);
      });
    }

    var btn = $('btnInstalarApp');
    var esIos = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
    var esMovil = esDispositivoMovil();
    if (!btn || !esMovil || !esContextoSeguro) { return; }

    var eventoInstalacion = null;
    var yaInstalada = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    if (yaInstalada) {
      btn.hidden = true;
      return;
    }

    btn.hidden = false;

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      eventoInstalacion = e;
      btn.hidden = false;
    });

    window.addEventListener('appinstalled', function () {
      eventoInstalacion = null;
      btn.hidden = true;
      toast('¡Aplicación instalada en tu dispositivo!');
    });

    btn.addEventListener('click', function () {
      if (eventoInstalacion) {
        eventoInstalacion.prompt();
        eventoInstalacion.userChoice.then(function (res) {
          if (res && res.outcome === 'accepted') {
            btn.hidden = true;
          }
          eventoInstalacion = null;
        });
        return;
      }

      var cont = $('instalarInstrucciones');
      if (cont) {
        if (esIos) {
          cont.innerHTML =
            '<p>En <strong>iPhone o iPad (Safari)</strong>:</p>' +
            '<p>1. Tocá el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba en la barra inferior).</p>' +
            '<p>2. Deslizá hacia abajo y elegí <strong>"Agregar a inicio"</strong>.</p>' +
            '<p>3. Confirmá tocando <strong>"Agregar"</strong> arriba a la derecha.</p>';
        } else {
          cont.innerHTML =
            '<p>Para instalar la radio como app en tu teléfono:</p>' +
            '<p>1. Abrí el menú de tu navegador (los <strong>tres puntos ⋮</strong> arriba a la derecha).</p>' +
            '<p>2. Seleccioná <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.</p>';
        }
        abrirModal($('modalInstalar'));
      }
    });
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', iniciar); } else { iniciar(); }
})();
