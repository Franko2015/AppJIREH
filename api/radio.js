/* =====================================================================
   RADIO JIREH — PUENTE HTTPS DE LA SEÑAL  (/api/radio)

   El servidor de la radio (MyRadioStream) solo entrega el audio por
   http://, y un sitio https:// no puede reproducir audio http:// (el
   navegador lo bloquea por "contenido mixto"). Esta función corre en
   Vercel, se conecta al servidor de la radio y le reenvía el audio al
   navegador por https://, desde el mismo dominio del sitio.

   Además, MyRadioStream exige un token que cambia. Cada vez que alguien
   aprieta "Escuchar", esta función lee el token vigente de la página
   oficial del reproductor, así que no hay que actualizarlo a mano.

   Vercel corta cada función a los 300 segundos: la función cierra la
   conexión un poco antes y el reproductor de la página se reconecta solo.
   ===================================================================== */

const { Readable } = require('stream');

// Página oficial del reproductor (de ahí se saca la dirección y el token).
const PAGINA_RADIO = process.env.PAGINA_RADIO || 'http://jireh11035.on-air.fm';
// Dirección directa por si no se puede leer la página oficial.
const STREAM_RESPALDO = process.env.STREAM_URL || 'http://5.135.154.66:40600/;';
// Cerrar antes del límite de 300 s de Vercel para que el corte sea limpio.
const DURACION_MAX_MS = 285 * 1000;
const AGENTE = 'Mozilla/5.0 (compatible; RadioJirehWeb/1.0)';

async function conTiempo(url, opciones, ms) {
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), ms);
  try {
    return await fetch(url, Object.assign({}, opciones, { signal: control.signal }));
  } finally {
    clearTimeout(t);
  }
}

// Lee la página oficial y devuelve { url, unlock } con el token vigente.
async function obtenerFuente() {
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
  return { url: STREAM_RESPALDO, unlock: '' };
}

module.exports = async function handler(req, res) {
  const fuente = await obtenerFuente();

  // El reproductor oficial "desbloquea" la señal antes de pedirla; hacemos lo mismo.
  if (fuente.unlock) {
    try { await conTiempo(fuente.unlock, { headers: { 'User-Agent': AGENTE, Referer: PAGINA_RADIO } }, 4000); } catch (e) {}
  }

  const control = new AbortController();
  let origen;
  try {
    origen = await fetch(fuente.url, {
      headers: { 'User-Agent': AGENTE, Referer: PAGINA_RADIO, 'Icy-MetaData': '0' },
      signal: control.signal
    });
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Cache-Control', 'no-store');
    res.end('No se pudo conectar con el servidor de la radio.');
    return;
  }

  if (!origen.ok || !origen.body) {
    // 404 = la radio no está transmitiendo; 403 = token rechazado.
    res.statusCode = 502;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Radio-Estado', String(origen.status));
    res.end('La radio no está transmitiendo en este momento (' + origen.status + ').');
    try { control.abort(); } catch (e) {}
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', origen.headers.get('content-type') || 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const cuerpo = Readable.fromWeb(origen.body);
  let terminado = false;
  function cerrar() {
    if (terminado) { return; }
    terminado = true;
    clearTimeout(limite);
    try { control.abort(); } catch (e) {}
    try { cuerpo.destroy(); } catch (e) {}
    try { res.end(); } catch (e) {}
  }
  const limite = setTimeout(cerrar, DURACION_MAX_MS);

  req.on('close', cerrar);
  cuerpo.on('error', cerrar);
  cuerpo.on('end', cerrar);
  cuerpo.pipe(res);

  // Mantener la función viva mientras dure la transmisión.
  await new Promise((resolver) => {
    res.on('close', resolver);
    res.on('finish', resolver);
  });
  cerrar();
};
