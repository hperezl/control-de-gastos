window.CDG = window.CDG || {};
CDG.Views = CDG.Views || {};

/* View: the "registro" form (usuarios + corte de tarjeta). Reused by the
   onboarding screen and by the Configuración tab — each with its own id prefix. */
CDG.Views.Registro = (function () {
  const U = CDG.Utils;

  function usuariosListHtml(usuarios) {
    if (!usuarios.length) return `<div class="empty-hint">Agrega al menos un usuario para continuar.</div>`;
    return `<ul class="user-chip-list">` + usuarios.map((u, i) => `
      <li class="user-chip">
        <span>${U.escapeHtml(u)}</span>
        <button type="button" class="icon ghost danger" data-remove-usuario="${i}" title="Quitar">✕</button>
      </li>`).join("") + `</ul>`;
  }

  function render(config, prefix, buttonLabel) {
    return `
      <div class="field">
        <label>Nombre del control (opcional)</label>
        <input type="text" id="${prefix}Nombre" placeholder="Ej. Gastos familia" value="${U.escapeHtml(config.nombreControl)}">
      </div>

      <div class="field">
        <label>Usuarios que comparten este control</label>
        <div id="${prefix}UsuariosList">${usuariosListHtml(config.usuarios)}</div>
        <div class="add-row">
          <input type="text" id="${prefix}NuevoUsuario" placeholder="Nombre del usuario">
          <button type="button" id="${prefix}AddUsuario">Agregar</button>
        </div>
      </div>

      <div class="field checkbox-row">
        <label class="checkbox-label">
          <input type="checkbox" id="${prefix}CorteActivo" ${config.corteActivo ? "checked" : ""}>
          Usar la fecha de corte de una tarjeta de crédito para definir el periodo mensual
        </label>
      </div>

      <div class="field" id="${prefix}DiaCorteWrap" style="${config.corteActivo ? "" : "display:none"}">
        <label>Día de corte (1–28)</label>
        <input type="number" id="${prefix}DiaCorte" min="1" max="28" value="${config.diaCorte}">
        <div class="hint small">Ej: si el corte es el día 5, cada reporte mensual del control irá del 6 al 5 del mes siguiente.</div>
      </div>

      <div class="modal-actions" style="justify-content:flex-end">
        <button class="primary" id="${prefix}Guardar">${buttonLabel}</button>
      </div>
    `;
  }

  return { render, usuariosListHtml };
})();
