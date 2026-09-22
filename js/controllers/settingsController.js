window.CDG = window.CDG || {};
CDG.Controllers = CDG.Controllers || {};

/* Settings modal, opened from the gear icon: appearance (dark mode), exchange
   rate, and the usuarios / fecha de corte form (editable after onboarding). */
CDG.Controllers.Settings = (function () {
  const U = CDG.Utils;
  const M = CDG.Model;
  let cloudEnabled = false;

  const THEME_OPTS = [
    { value: "light", label: "Claro" },
    { value: "dark", label: "Oscuro" },
    { value: "system", label: "Sistema" }
  ];

  function themeSegHtml(current) {
    return `<div class="seg-group" id="cfgThemeSeg">` + THEME_OPTS.map(o => `
      <button type="button" class="seg-btn ${o.value === current ? "active" : ""}" data-theme-opt="${o.value}">${o.label}</button>
    `).join("") + `</div>`;
  }

  function open() {
    const config = M.state.config;
    U.openModal(`
      <h3>Configuración</h3>

      <div class="field">
        <label>Apariencia</label>
        ${themeSegHtml(U.getThemeChoice())}
      </div>

      <div class="field">
        <label>Tipo de cambio (₡ por $)</label>
        <input type="number" id="cfgFx" step="0.01" value="${config.tipoCambio}">
        <label class="checkbox-label" style="margin-top:4px">
          <input type="checkbox" id="cfgFxAuto" ${config.tipoCambioAuto ? "checked" : ""}>
          Actualizar automáticamente desde el BCCR
        </label>
        <div style="display:flex; align-items:center; gap:8px; margin-top:6px">
          <button type="button" id="cfgFxRefresh" style="font-size:12px; padding:5px 10px">Actualizar ahora</button>
          <span class="hint small" id="cfgFxMeta" style="margin:0">${config.tipoCambioFecha ? `BCCR · ${U.escapeHtml(config.tipoCambioFecha)}` : ""}</span>
        </div>
        <p class="hint small">Tipo de cambio de compra del BCCR (el más bajo), vía <a href="https://allratestoday.com/central-bank-rates-api/bccr/" target="_blank" rel="noopener">AllRatesToday</a>.</p>
      </div>

      <hr style="border:none;border-top:1px solid var(--gridline);margin:16px 0">

      <div style="font-size:13px;font-weight:600;margin-bottom:10px">Usuarios y fecha de corte</div>
      ${CDG.Views.Registro.render(config, "cfg", "Guardar cambios")}

      <hr style="border:none;border-top:1px solid var(--gridline);margin:16px 0">

      <div style="font-size:13px;font-weight:600;margin-bottom:10px">Respaldo de datos</div>
      <p class="hint small" style="margin-top:0">Los datos se guardan en este navegador y, si configuraste la nube, también en Firebase. Usa estas opciones para exportar un respaldo manual o restaurarlo.</p>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:4px">
        <button type="button" id="exportBtn">Exportar JSON</button>
        <button type="button" id="importBtn">Importar JSON</button>
        <input type="file" id="importFile" accept="application/json" style="display:none">
        <button type="button" class="danger" id="resetBtn">Borrar todos los datos</button>
      </div>

      ${cloudEnabled ? `
        <hr style="border:none;border-top:1px solid var(--gridline);margin:16px 0">
        <button type="button" id="cfgLogout" style="width:100%">Cerrar sesión</button>
      ` : ""}
    `, (root) => {
      CDG.Controllers.Backup.wire(root);
      if (cloudEnabled) {
        root.querySelector("#cfgLogout").onclick = () => {
          U.closeModal();
          CDG.Cloud.signOut();
        };
      }
      root.querySelectorAll("[data-theme-opt]").forEach(btn => {
        btn.onclick = () => {
          U.applyTheme(btn.dataset.themeOpt);
          root.querySelectorAll("[data-theme-opt]").forEach(b => b.classList.toggle("active", b === btn));
        };
      });

      root.querySelector("#cfgFx").addEventListener("change", (e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v) && v > 0) { M.state.config.tipoCambio = v; M.save(); CDG.App.refreshAll(); }
      });
      root.querySelector("#cfgFxAuto").addEventListener("change", (e) => {
        M.state.config.tipoCambioAuto = e.target.checked;
        M.save();
      });
      root.querySelector("#cfgFxRefresh").addEventListener("click", (e) => {
        const btn = e.target;
        btn.disabled = true; btn.textContent = "Actualizando…";
        CDG.ExchangeRate.refresh(true).then((val) => {
          btn.disabled = false; btn.textContent = "Actualizar ahora";
          if (val) {
            root.querySelector("#cfgFx").value = val;
            root.querySelector("#cfgFxMeta").textContent = M.state.config.tipoCambioFecha ? `BCCR · ${M.state.config.tipoCambioFecha}` : "";
            U.toast("Tipo de cambio actualizado");
            CDG.App.refreshAll();
          } else {
            U.toast("No se pudo actualizar (revisa tu conexión)");
          }
        });
      });

      CDG.Controllers.wireRegistroForm(root, "cfg", config, (data) => {
        const st = M.state;
        const usuariosEliminados = st.config.usuarios.filter(u => !data.usuarios.includes(u));
        st.config.nombreControl = data.nombreControl;
        st.config.usuarios = data.usuarios;
        st.config.corteActivo = data.corteActivo;
        st.config.diaCorte = data.diaCorte;
        M.save();
        U.closeModal();
        if (usuariosEliminados.length) {
          U.toast("Configuración actualizada. Los movimientos y ahorros de " + usuariosEliminados.join(", ") + " se conservan, pero sus ingresos/gastos fijos ya no se muestran.");
        } else {
          U.toast("Configuración actualizada");
        }
        CDG.App.refreshAll();
      });
    });
  }

  function init(isCloudEnabled) {
    cloudEnabled = !!isCloudEnabled;
    document.getElementById("settingsBtn").addEventListener("click", open);
  }

  return { init, open };
})();
