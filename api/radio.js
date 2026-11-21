/* =====================================================================
   RADIO JIREH — PUENTE HTTPS DE LA SEÑAL  (/api/radio)

   Los servidores de la radio (listen2myradio / MyRadioStream) solo
   entregan el audio por http://, y un sitio https:// no puede reproducir
   audio http:// (el navegador lo bloquea por "contenido mixto"). Esta
   función corre en Vercel, se conecta al servidor de la radio y le
   reenvía el audio al navegador por https://, desde el mismo dominio.

   Uso:
     /api/radio?u=<dirección http del stream>   → reenvía esa señal
       (solo servidores de listen2myradio.com / myradiostream.com)
     /api/radio                                  → lee la página oficial
       de MyRadioStream, saca el token vigente y reenvía esa señal

   Los servidores SHOUTcast responden "ICY 200 OK" en vez de "HTTP/1.1
   200 OK", y el fetch() de Node rechaza esa respuesta. Por eso la
   conexión se hace con un socket TCP y se acepta cualquiera de las dos.

   Vercel corta cada función a los 300 segundos: la función cierra la
   conexión un poco antes y el reproductor de la página se reconecta solo.
   ===================================================================== */

const net = require('net');

// Página oficial del reproductor de MyRadioStream (de ahí se saca el token).
const PAGINA_RADIO = process.env.PAGINA_RADIO || 'http://jireh11035.on-air.fm';
// Señal principal si no llega ?u= (la misma que STREAM_URL en js/config.js).
const STREAM_PRINCIPAL = process.env.STREAM_URL || 'http://uk25freenew.listen2myradio.com:14851/;stream.mp3';
// Servidores permitidos en ?u= (para que el puente no sirva de proxy abierto).
const DOMINIOS_PERMITIDOS = ['listen2myradio.com', 'myradiostream.com']
  .concat((process.env.RADIO_DOMINIOS || '').split(',').map((d) => d.trim()).filter(Boolean));
// Cerrar antes del límite de 300 s de Vercel para que el corte sea limpio.
const DURACION_MAX_MS = 285 * 1000;
const AGENTE = 'Mozilla/5.0 (compatible; RadioJirehWeb/1.0)';

function permitida(texto) {
  let u;
  try { u = new URL(texto); } catch (e) { return false; }
  if (u.protocol !== 'http:') { return false; }
  const host = u.hostname.toLowerCase();
  return DOMINIOS_PERMITIDOS.some((d) => host === d || host.endsWith('.' + d));
}

async function conTiempo(url, opciones, ms) {
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), ms);
  try {
    return await fetch(url, Object.assign({}, opciones, { signal: control.signal }));
  } finally {
    clearTimeout(t);
  }
}

// Lee la página oficial de MyRadioStream y devuelve { url, unlock } con el token vigente.
async function fuenteMyRadioStream() {
  try {
    const r = await conTiempo(PAGINA_RADIO, { headers: { 'User-Agent': AGENTE } }, 8000);
    const html = await r.text();
    const token = (html.match(/const\s+token\s*=\s*'([^']*)'/) || [])[1] || '';
    const json = (html.match(/var\s+data\s*=\s*(\{[^\n]*?\});/) || [])[1];
    if (json) {
      const data = JSON.parse(json);
      if (data && data.url) {
        const unlock = data.h && data.p && data.s
          ? 'http://' + data.h + '.myradiostream.com/unlock.php?p=' + encodeURIComponent(data.p) + '&id=' + encodeURIComponent(data.s)
          : '';
        return { url: data.url + token, unlock: unlock };
      }
    }
  } catch (e) {
    console.error('No se pudo leer la página oficial:', e && e.message);
  }
  return null;
}

// Abre la señal con un socket TCP. Resuelve { tipo, socket, resto } si el
// servidor contesta 200 con audio; si no, rechaza con el motivo.
function abrirSenal(direccion, ms) {
  return new Promise((resolver, rechazar) => {
    const u = new URL(direccion);
    const socket = net.connect({ host: u.hostname, port: Number(u.port) || 80 });
    let cabecera = Buffer.alloc(0);
    let listo = false;
    const t = setTimeout(() => fallar('tiempo agotado'), ms);

    function fallar(motivo) {
      if (listo) { return; }
      listo = true;
      clearTimeout(t);
      socket.destroy();
      rechazar(new Error(motivo));
    }

    socket.on('connect', () => {
      socket.write(
        'GET ' + (u.pathname + u.search || '/') + ' HTTP/1.0\r\n' +
        'Host: ' + u.host + '\r\n' +
        'User-Agent: ' + AGENTE + '\r\n' +
        'Referer: ' + PAGINA_RADIO + '\r\n' +
        'Icy-MetaData: 0\r\n' +
        'Accept: */*\r\n' +
        'Connection: close\r\n\r\n'
      );
    });
    socket.on('error', (e) => fallar(e.message));
    socket.on('end', () => fallar('el servidor cerró la conexión'));
    socket.on('data', function alLlegar(trozo) {
      if (listo) { return; }
      cabecera = Buffer.concat([cabecera, trozo]);
      const fin = cabecera.indexOf('\r\n\r\n');
      if (fin === -1) {
        if (cabecera.length > 16384) { fallar('cabecera inválida'); }
        return;
      }
      const texto = cabecera.slice(0, fin).toString('latin1');
      const lineas = texto.split('\r\n');
      const estado = (lineas[0].match(/^(?:ICY|HTTP\/[\d.]+)\s+(\d{3})/) || [])[1];
      const tipo = ((texto.match(/^content-type:\s*([^\r\n]+)/im) || [])[1] || 'audio/mpeg').trim();
      if (estado !== '200') { fallar('respuesta ' + (estado || lineas[0])); return; }
      // La página de estado de SHOUTcast también da 200, pero en HTML.
      if (/text\/html/i.test(tipo)) { fallar('el servidor no está transmitiendo'); return; }
      listo = true;
      clearTimeout(t);
      socket.removeListener('data', alLlegar);
      socket.removeAllListeners('end');
      socket.pause();
      resolver({ tipo: tipo, socket: socket, resto: cabecera.slice(fin + 4) });
    });
  });
}

module.exports = async function handler(req, res) {
  const pedida = new URL(req.url, 'http://localhost').searchParams.get('u');
  const candidatas = [];
  if (pedida && permitida(pedida)) { candidatas.push({ url: pedida }); }
  if (STREAM_PRINCIPAL && candidatas.every((c) => c.url !== STREAM_PRINCIPAL)) { candidatas.push({ url: STREAM_PRINCIPAL }); }
  candidatas.push({ myradiostream: true });

  let senal = null;
  const errores = [];
  for (const c of candidatas) {
    let fuente = c;
    if (c.myradiostream) {
      fuente = await fuenteMyRadioStream();
      if (!fuente) { errores.push('MyRadioStream: no se pudo leer la página oficial'); continue; }
      // El reproductor oficial "desbloquea" la señal antes de pedirla; hacemos lo mismo.
      if (fuente.unlock) {
        try { await conTiempo(fuente.unlock, { headers: { 'User-Agent': AGENTE, Referer: PAGINA_RADIO } }, 4000); } catch (e) {}
      }
    }
    try {
      senal = await abrirSenal(fuente.url, 8000);
      break;
    } catch (e) {
      errores.push(fuente.url + ': ' + e.message);
    }
  }

  if (!senal) {
    console.error('Sin señal:', errores.join(' | '));
    res.statusCode = 502;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('La radio no está transmitiendo en este momento.\n' + errores.join('\n'));
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', senal.tipo);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const socket = senal.socket;
  let terminado = false;
  function cerrar() {
    if (terminado) { return; }
    terminado = true;
    clearTimeout(limite);
    try { socket.destroy(); } catch (e) {}
    try { res.end(); } catch (e) {}
  }
  const limite = setTimeout(cerrar, DURACION_MAX_MS);

  req.on('close', cerrar);
  socket.on('error', cerrar);
  socket.on('end', cerrar);
  if (senal.resto.length) { res.write(senal.resto); }
  socket.pipe(res);
  socket.resume();

  // Mantener la función viva mientras dure la transmisión.
  await new Promise((resolver) => {
    res.on('close', resolver);
    res.on('finish', resolver);
  });
  cerrar();
};
