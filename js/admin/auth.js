/* =========================================================
   ADMIN — Autenticación
   Usa Supabase Auth (correo + contraseña). El usuario admin
   se crea manualmente desde el panel de Supabase (ver README).
   ========================================================= */

const AdminAuth = {
  session: null,

  // Consulta si ya hay una sesión iniciada.
  async checkSession() {
    const { data } = await sb.auth.getSession();
    this.session = data.session;
    return this.session;
  },

  // Inicia sesión con correo y contraseña (lanza error si son incorrectos).
  async login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.session = data.session;
    return data;
  },

  // Cierra la sesión y recarga la página.
  async logout() {
    await sb.auth.signOut();
    this.session = null;
    window.location.reload();
  },
};

// "Puerta" del panel: con sesión muestra el panel, sin sesión muestra la pantalla de inicio de sesión.
async function initAuthGate() {
  await AdminAuth.checkSession();

  const loginScreen = document.getElementById("loginScreen");
  const adminShell = document.getElementById("adminShell");

  if (AdminAuth.session) {
    loginScreen.style.display = "none";
    adminShell.style.display = "flex";
    document.getElementById("adminUserChip").textContent = AdminAuth.session.user.email;
    return true;
  } else {
    loginScreen.style.display = "flex";
    adminShell.style.display = "none";
    return false;
  }
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");
  const btn = document.getElementById("loginBtn");

  errEl.classList.remove("show");
  errEl.textContent = "Correo o contraseña incorrectos.";
  btn.disabled = true;
  btn.textContent = "Ingresando...";

  try {
    await AdminAuth.login(email, password);
    if (await initAuthGate()) initAdminPanel();
  } catch (err) {
    errEl.classList.add("show");
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = "Ingresar";
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => AdminAuth.logout());
