/* =========================================================
   CONFIGURACIÓN GENERAL — Couture Byte Market
   ---------------------------------------------------------
   Aquí es DONDE DEBES colocar tus claves de Supabase y los
   datos de contacto. Este es el único archivo que necesitas
   editar para poner en marcha la tienda.
   ========================================================= */

const APP_CONFIG = {
  // 1) Pega aquí la URL de tu proyecto de Supabase
  //    (Supabase → Project Settings → API → Project URL)
  SUPABASE_URL: "https://gecepecadrfdipfpzxsm.supabase.co",

  // 2) Pega aquí tu clave pública "anon" de Supabase
  //    (Supabase → Project Settings → API → anon public key)
  SUPABASE_ANON_KEY: "sb_publishable_XG7yyx9hzQmh0Wui51Eqwg_VaeWtIK-",

  // 3) Nombre de la carpeta de almacenamiento (bucket) de Supabase Storage donde se guardan
  //    las fotos de los productos (ya creado por el SQL/README)
  STORAGE_BUCKET: "productos-imagenes",

  // 4) Número de WhatsApp de la tienda (formato internacional, sin "+")
  //    Bolivia = 591 + número. Ejemplo: 78411020 -> 59178411020
  WHATSAPP_NUMBER: "59178411020",

  // 5) Redes sociales (edita libremente)
  INSTAGRAM_URL: "https://instagram.com/couturebite",
  FACEBOOK_URL: "https://facebook.com/couturebite",

  // 6) Ubicación de la tienda (para el texto informativo)
  DIRECCION: "Calle Beni, UV-4, Satélite Norte, Warnes, Santa Cruz, Bolivia",

  // 7) Tallas disponibles en la tienda (orden de visualización)
  TALLAS_DISPONIBLES: ["XS", "S", "M", "L", "XL"],

  // 8) Cuántos productos destacados mostrar en la página de inicio
  MAX_DESTACADOS: 4,

  // 9) Información de envío/entrega que se muestra al finalizar el pedido.
  //    Edítala libremente según cómo entregues tus pedidos.
  ENVIO_INFO: "Coordinamos la entrega por delivery dentro de Santa Cruz de la Sierra. El costo y tiempo de entrega se confirman por WhatsApp según tu zona.",

  // 10) Métodos de pago que se muestran en la pantalla de compra.
  //     Activa/desactiva cada uno con "activo: true" o "activo: false".
  METODOS_PAGO: {
    // QR de pago (Simple QR de tu banco, Tigo Money, etc.)
    // Para activarlo: 1) toma una foto/captura de tu QR real,
    // 2) súbela a Supabase Storage o cualquier servicio donde alojes imágenes,
    // 3) pega el enlace en "imagen_url" y cambia "activo" a true.
    qr: {
      activo: false,
      imagen_url: "",
      banco: "Banco Nacional de Bolivia",
      titular: "Nombre Apellido",
    },
    // Transferencia bancaria (número de cuenta)
    transferencia: {
      activo: false,
      banco: "",
      numero_cuenta: "",
      titular: "",
    },
    // Pago en efectivo al momento de recibir el pedido
    efectivo: {
      activo: true,
    },
  },
};
