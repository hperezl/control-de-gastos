window.CDG = window.CDG || {};

/* App controller: routing (login -> registro -> dashboard), tabs, top bar,
   period navigator, theme, and cloud sync orchestration. */
CDG.App = (function () {
  const U = CDG.Utils;
  const M = CDG.Model;

  let periodKey = null;
  let controllersInitialized = false;
  let cloudEnabled = false;

  function getPeriodKey() { return periodKey; }

  function showOnly(id) {
    ["loginScreen", "registroScreen", "appScreen"].forEach(x => {
      const el = document.getElementById(x);
      if (el) el.style.display = (x === id) ? "" : "none";
    });
  }

  function syncPeriodUI() {
    const period = M.periodForDate(periodKey);
    document.getElementById("periodLabel").textContent = M.periodLabel(period);
  }

  function renderFxTicker() {
    const cfg = M.state.config;
    document.querySelectorAll(".fx-ticker").forEach(el => {
      if (!cfg.tipoCambio) { el.textContent = ""; return; }
      el.textContent = `₡${cfg.tipoCambio.toLocaleString("es-CR")} / $1`;
      el.title = cfg.tipoCambioFecha
        ? `Tipo de cambio de compra BCCR (${cfg.tipoCambioFecha}), vía AllRatesToday`
        : "Tipo de cambio";
    });
  }

  function switchTab(name) {
    document.querySelectorAll("nav.tabs button[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
    document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === "panel-" + name));
    closeMobileMenu();
  }

  function closeMobileMenu() {
    const nav = document.querySelector("nav.tabs");
    nav.classList.remove("open");
    document.getElementById("menuToggle").setAttribute("aria-expanded", "false");
  }
  function wireMobileMenu() {
    const nav = document.querySelector("nav.tabs");
    const btn = document.getElementById("menuToggle");
    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.getElementById("menuCloseBtn").addEventListener("click", closeMobileMenu);
    document.addEventListener("click", (e) => {
      if (nav.classList.contains("open") && !nav.contains(e.target) && e.target !== btn) closeMobileMenu();
    });
    document.getElementById("menuSettingsBtn").addEventListener("click", () => {
      closeMobileMenu();
      CDG.Controllers.Settings.open();
    });
    document.getElementById("menuLogoutBtn").addEventListener("click", () => {
      closeMobileMenu();
      CDG.Cloud.signOut();
    });
  }

  function refreshAll() {
    syncPeriodUI();
    renderFxTicker();
    CDG.Controllers.Resumen.render();
    CDG.Controllers.Movimientos.render();
    CDG.Controllers.Fijos.render();
    CDG.Controllers.Ahorro.render();
    if (CDG.Controllers.Moneda) CDG.Controllers.Moneda.renderRatesStrip();
    if (CDG.Controllers.Reportes) CDG.Controllers.Reportes.render();
  }

  function wireTopBar() {
    document.getElementById("periodPrev").addEventListener("click", () => {
      periodKey = M.shiftPeriod(periodKey, -1);
      refreshAll();
    });
    document.getElementById("periodNext").addEventListener("click", () => {
      periodKey = M.shiftPeriod(periodKey, 1);
      refreshAll();
    });
    document.querySelectorAll("nav.tabs button[data-tab]").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
    wireMobileMenu();
    CDG.Controllers.Settings.init(cloudEnabled);
    if (cloudEnabled) {
      const logoutBtn = document.getElementById("logoutBtn");
      logoutBtn.style.display = "";
      logoutBtn.addEventListener("click", () => CDG.Cloud.signOut());
      document.getElementById("menuLogoutBtn").style.display = "";
    }
  }

  function bootDashboard() {
    showOnly("appScreen");
    periodKey = M.periodKeyForToday();

    if (!controllersInitialized) {
      wireTopBar();
      CDG.Controllers.Movimientos.init();
      CDG.Controllers.Fijos.init();
      CDG.Controllers.Moneda.init();
      CDG.Controllers.Reportes.init();
      controllersInitialized = true;
    }
    refreshAll();
    if (CDG.ExchangeRate) CDG.ExchangeRate.refresh().then(() => refreshAll());
    if (CDG.Currency) CDG.Currency.refresh().then(() => { refreshAll(); CDG.Controllers.Moneda.refreshValues(); });
  }

  function routeToCurrentScreen() {
    if (M.state.config.registrado) {
      bootDashboard();
    } else {
      showOnly("registroScreen");
      CDG.Controllers.Registro.init(bootDashboard);
    }
  }

  function onDataReplaced() { routeToCurrentScreen(); }

  /* ---- cloud-backed boot ---- */
  function onSignedIn() {
    CDG.Controllers.Login.showLoading("Cargando tu control de gastos…");
    CDG.Cloud.cargarUnaVez().then((remote) => {
      if (remote) {
        M.applyRemoteState(remote);
      } else if (M.state.config.registrado) {
        // Local data exists but nothing in the cloud yet: use it to bootstrap.
        M.save();
      }
      CDG.Cloud.escuchar((data) => {
        if (JSON.stringify(data) !== JSON.stringify(M.state)) {
          M.applyRemoteState(data);
          routeToCurrentScreen();
        }
      });
      routeToCurrentScreen();
    }).catch(() => {
      CDG.Controllers.Login.render();
      CDG.Controllers.Login.showError("No se pudo cargar la información. Revisa tu conexión e intenta de nuevo.");
    });
  }

  function startCloudMode() {
    cloudEnabled = true;
    showOnly("loginScreen");
    CDG.Controllers.Login.init();
    CDG.Cloud.onAuthChange((user) => {
      if (user) onSignedIn();
      else { showOnly("loginScreen"); CDG.Controllers.Login.render(); }
    });
  }

  function startLocalOnly() {
    cloudEnabled = false;
    routeToCurrentScreen();
  }

  function init() {
    U.applyTheme(U.getThemeChoice());
    const ok = CDG.Cloud && CDG.Cloud.init();
    if (ok) startCloudMode(); else startLocalOnly();
  }

  return { init, getPeriodKey, refreshAll, onDataReplaced };
})();

document.addEventListener("DOMContentLoaded", CDG.App.init);
