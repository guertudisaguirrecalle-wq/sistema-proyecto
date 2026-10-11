/* =========================================================
   CLIENTE DE SUPABASE
   Se usa en toda la aplicación (tienda + panel admin).
   ========================================================= */

let supabaseClient = null;

// Crea la conexión a Supabase una sola vez y la reutiliza en toda la aplicación.
function getSupabaseClient() {
  if (!supabaseClient) {
    if (!window.supabase) {
      console.error("No se pudo cargar la librería de Supabase. Revisa tu conexión a internet.");
      return null;
    }
    supabaseClient = window.supabase.createClient(
      APP_CONFIG.SUPABASE_URL,
      APP_CONFIG.SUPABASE_ANON_KEY
    );
  }
  return supabaseClient;
}

// 'sb' es la conexión lista para usar desde los demás archivos (sb.from('tabla')...).
const sb = getSupabaseClient();
