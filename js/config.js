/* =====================================================================
   RADIO JIREH 103.5 FM — CONFIGURACIÓN GENERAL

   Este es el ÚNICO archivo que hay que tocar para cambiar:
     * la URL del stream (la señal de la radio en internet)
     * la contraseña del panel del dueño
     * los datos de contacto y redes sociales
     * las coordenadas para el clima
   Guardá el archivo (Ctrl + S) y recargá la página con F5.
   ===================================================================== */

const CONFIG = {
  // Link directo de la señal de la radio (servidor y puerto).
  STREAM_URL: "http://uk25freenew.listen2myradio.com:14851/;stream.mp3",

  // Direcciones de respaldo (opcional): se prueban si la principal falla.
  STREAM_FALLBACKS: [],

  // Página oficial del reproductor de la radio (se muestra en Contacto).
  PAGINA_RADIO: "http://jireh11035.on-air.fm",

  RADIO_NOMBRE: "RADIO JIREH",
  FRECUENCIA: "103.5 FM",
  UBICACION: "Formosa · Argentina",

  // Contraseña del panel "Área de la radio" (pie de página).
  ADMIN_CLAVE: "HUGOORTIX2020",

  // Número de WhatsApp para pedidos de oración, con código de país y sin
  // espacios ni signos (ej: "5493704123456"). Si está vacío y tampoco hay
  // CORREO_ORACION, la sección "Pedidos de oración" queda oculta.
  WHATSAPP: "",

  // Correo alternativo para pedidos de oración (se usa si no hay WhatsApp).
  CORREO_ORACION: "",

  // Correo de la radio que recibe las suscripciones. Si está vacío,
  // la sección Newsletter queda oculta.
  NEWSLETTER_EMAIL: "",

  // Redes sociales: completá las direcciones completas (https://...).
  // Las que queden vacías no se muestran.
  REDES: {
    facebook: "",
    instagram: "",
    youtube: "",
    tiktok: ""
  },

  // Centro de la ciudad de Formosa; wttr.in usa estas coordenadas sin API key.
  CLIMA_LAT: -26.1775,
  CLIMA_LON: -58.1781,
  CLIMA_TZ: "America/Argentina/Cordoba"
};
