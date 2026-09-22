window.CDG = window.CDG || {};
CDG.Controllers = CDG.Controllers || {};

/* Login screen: one shared email/password account for the whole household,
   plus a "forgot password" flow confirmed by email (Firebase-hosted). */
CDG.Controllers.Login = (function () {
  function renderLogin() {
    const screen = document.getElementById("loginScreen");
    screen.innerHTML = `
      <div class="registro-card">
        <h1>Control de Gastos</h1>
        <p class="hint">Ingresa con la cuenta del hogar para acceder al control compartido.</p>
        <div class="field"><label>Correo</label><input type="email" id="loginEmail" autocomplete="username"></div>
        <div class="field"><label>Contraseña</label><input type="password" id="loginPass" autocomplete="current-password"></div>
        <div id="loginError" style="color:var(--critical); font-size:13px; min-height:18px; margin-bottom:4px"></div>
        <div class="modal-actions" style="justify-content:space-between; align-items:center">
          <button type="button" id="forgotLink" class="ghost" style="padding:4px 0; font-size:13px; color:var(--text-secondary)">¿Olvidaste tu contraseña?</button>
          <button class="primary" id="loginBtn">Entrar</button>
        </div>
        <p class="hint small" style="margin-top:16px">🔒 Los datos viajan y se guardan cifrados (Firebase cifra en tránsito y en reposo automáticamente).</p>
      </div>
    `;
    document.getElementById("loginBtn").onclick = submitLogin;
    document.getElementById("forgotLink").onclick = renderForgot;
    document.getElementById("loginPass").addEventListener("keydown", (e) => { if (e.key === "Enter") submitLogin(); });
    document.getElementById("loginEmail").focus();
  }

  function submitLogin() {
    const email = document.getElementById("loginEmail").value.trim();
    const pass = document.getElementById("loginPass").value;
    if (!email || !pass) { showError("Completa correo y contraseña"); return; }
    const btn = document.getElementById("loginBtn");
    btn.disabled = true; btn.textContent = "Entrando...";
    CDG.Cloud.signIn(email, pass).catch((err) => {
      showError(traducirErrorLogin(err));
      btn.disabled = false; btn.textContent = "Entrar";
    });
  }

  function renderForgot() {
    const emailPrevio = (document.getElementById("loginEmail") || {}).value || "";
    const screen = document.getElementById("loginScreen");
    screen.innerHTML = `
      <div class="registro-card">
        <h1>Recuperar contraseña</h1>
        <p class="hint">Te enviaremos un enlace por correo para elegir una nueva contraseña.</p>
        <div class="field"><label>Correo</label><input type="email" id="forgotEmail" value="${emailPrevio.replace(/"/g, "&quot;")}" autocomplete="username"></div>
        <div id="forgotMsg" style="font-size:13px; min-height:18px; margin-bottom:4px"></div>
        <div class="modal-actions" style="justify-content:space-between; align-items:center">
          <button type="button" id="backToLogin" class="ghost" style="padding:4px 0; font-size:13px; color:var(--text-secondary)">← Volver a iniciar sesión</button>
          <button class="primary" id="forgotBtn">Enviar enlace</button>
        </div>
      </div>
    `;
    document.getElementById("backToLogin").onclick = renderLogin;
    document.getElementById("forgotBtn").onclick = submitForgot;
    document.getElementById("forgotEmail").addEventListener("keydown", (e) => { if (e.key === "Enter") submitForgot(); });
    document.getElementById("forgotEmail").focus();
  }

  function submitForgot() {
    const email = document.getElementById("forgotEmail").value.trim();
    const msg = document.getElementById("forgotMsg");
    if (!email) { msg.style.color = "var(--critical)"; msg.textContent = "Escribe el correo de la cuenta."; return; }
    const btn = document.getElementById("forgotBtn");
    btn.disabled = true; btn.textContent = "Enviando...";
    CDG.Cloud.resetPassword(email).then(() => {
      msg.style.color = "var(--success)";
      msg.textContent = "Listo. Revisa " + email + " y sigue el enlace para elegir una nueva contraseña.";
      btn.textContent = "Enviado";
    }).catch((err) => {
      msg.style.color = "var(--critical)";
      msg.textContent = traducirErrorForgot(err);
      btn.disabled = false; btn.textContent = "Enviar enlace";
    });
  }

  function traducirErrorLogin(err) {
    const code = err && err.code;
    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      return "Correo o contraseña incorrectos.";
    }
    if (code === "auth/too-many-requests") return "Demasiados intentos. Intenta más tarde.";
    if (code === "auth/network-request-failed") return "Sin conexión. Revisa tu internet.";
    return "No se pudo iniciar sesión.";
  }
  function traducirErrorForgot(err) {
    const code = err && err.code;
    if (code === "auth/user-not-found") return "No existe ninguna cuenta con ese correo.";
    if (code === "auth/invalid-email") return "Ese correo no es válido.";
    if (code === "auth/network-request-failed") return "Sin conexión. Revisa tu internet.";
    return "No se pudo enviar el enlace. Intenta de nuevo.";
  }

  function showError(msg) {
    const el = document.getElementById("loginError");
    if (el) el.textContent = msg;
  }

  function showLoading(msg) {
    document.getElementById("loginScreen").innerHTML = `
      <div class="registro-card" style="text-align:center">
        <h1>Control de Gastos</h1>
        <p class="hint" style="margin:0">${msg}</p>
      </div>
    `;
  }

  function init() { renderLogin(); }

  return { init, render: renderLogin, showError, showLoading };
})();
