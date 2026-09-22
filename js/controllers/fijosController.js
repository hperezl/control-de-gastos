window.CDG = window.CDG || {};
CDG.Controllers = CDG.Controllers || {};

(function () {
  const U = CDG.Utils;
  const M = CDG.Model;

  /* ---- ingreso fijo (versioned: edits/removals never touch closed periods) ---- */
  function openFijoModal(kind, persona, existing) {
    const isEdit = !!existing;
    const it = existing || { id: null, persona, descripcion: "", monto: "", moneda: "CRC", periodo: "" };
    const label = kind === "ingreso" ? "ingreso fijo" : "gasto fijo";
    const warn = (kind === "ingreso" && isEdit && existing.vigenteDesde < M.periodKeyForToday())
      ? `<p class="hint small">Este cambio aplicará desde el periodo actual en adelante. Los reportes de periodos ya cerrados conservarán el monto anterior.</p>` : "";
    U.openModal(`
      <h3>${isEdit ? "Editar" : "Nuevo"} ${label} — ${U.escapeHtml(persona)}</h3>
      <div class="field"><label>Descripción</label><input type="text" id="fDesc" value="${U.escapeHtml(it.descripcion)}" placeholder="Ej. Tel ${U.escapeHtml(persona)}"></div>
      <div class="field-row three">
        <div class="field"><label>Periodo / Día</label><input type="text" id="fPeriodo" value="${U.escapeHtml(it.periodo)}" placeholder="Ej. Día 13"></div>
        <div class="field"><label>Monto</label><input type="number" step="0.01" id="fMonto" value="${it.monto}"></div>
        <div class="field"><label>Moneda</label>${U.monedaSegHtml("fMonedaSeg", it.moneda)}</div>
      </div>
      ${warn}
      <div class="modal-actions">
        <button id="fCancel">Cancelar</button>
        <button class="primary" id="fSave">Guardar</button>
      </div>
    `, (root) => {
      const getMoneda = U.wireMonedaSeg(root, "fMonedaSeg");
      root.querySelector("#fCancel").onclick = U.closeModal;
      root.querySelector("#fSave").onclick = () => {
        const monto = parseFloat(root.querySelector("#fMonto").value);
        if (isNaN(monto)) { U.toast("Ingresa un monto válido"); return; }
        const datos = {
          persona,
          descripcion: root.querySelector("#fDesc").value.trim(),
          periodo: root.querySelector("#fPeriodo").value.trim(),
          monto,
          moneda: getMoneda()
        };
        if (kind === "ingreso") {
          M.guardarIngresoFijo(datos, it.id);
        } else {
          const rec = Object.assign({ id: it.id || U.uid() }, datos);
          if (isEdit) M.state.gastosFijos[M.state.gastosFijos.findIndex(x => x.id === it.id)] = rec;
          else M.state.gastosFijos.push(rec);
        }
        M.save(); U.closeModal(); U.toast("Guardado"); CDG.App.refreshAll();
      };
    });
  }

  function openRebajoModal(existing) {
    const isEdit = !!existing;
    const usuarios = M.state.config.usuarios;
    const it = existing || { id: null, persona: usuarios[0] || "", descripcion: "", monto: "" };
    U.openModal(`
      <h3>${isEdit ? "Editar" : "Nuevo"} rebajo ($)</h3>
      <div class="field"><label>Descripción</label><input type="text" id="rDesc" value="${U.escapeHtml(it.descripcion)}" placeholder="Ej. Carro"></div>
      <div class="field-row">
        <div class="field"><label>Aplica al ingreso de</label>
          <select id="rPersona">${usuarios.map(p => `<option ${p === it.persona ? "selected" : ""}>${U.escapeHtml(p)}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Monto ($)</label><input type="number" step="0.01" id="rMonto" value="${it.monto}"></div>
      </div>
      <div class="modal-actions">
        <button id="rCancel">Cancelar</button>
        <button class="primary" id="rSave">Guardar</button>
      </div>
    `, (root) => {
      root.querySelector("#rCancel").onclick = U.closeModal;
      root.querySelector("#rSave").onclick = () => {
        const monto = parseFloat(root.querySelector("#rMonto").value);
        if (isNaN(monto)) { U.toast("Ingresa un monto válido"); return; }
        const rec = { id: it.id || U.uid(), persona: root.querySelector("#rPersona").value, descripcion: root.querySelector("#rDesc").value.trim(), monto, moneda: "USD" };
        if (isEdit) M.state.rebajos[M.state.rebajos.findIndex(x => x.id === it.id)] = rec;
        else M.state.rebajos.push(rec);
        M.save(); U.closeModal(); U.toast("Guardado"); CDG.App.refreshAll();
      };
    });
  }

  /* ---- ingreso extra (one-off, scoped to the period being viewed) ---- */
  function openExtraModal(existing) {
    const isEdit = !!existing;
    const usuarios = M.state.config.usuarios;
    const period = M.periodForDate(CDG.App.getPeriodKey());
    const hoy = new Date();
    const fechaDefault = U.isoDate((hoy >= period.start && hoy <= period.end) ? hoy : period.start);
    const it = existing || { id: null, fecha: fechaDefault, persona: usuarios[0] || "", descripcion: "", monto: "", moneda: "CRC" };
    U.openModal(`
      <h3>${isEdit ? "Editar" : "Nuevo"} ingreso extra</h3>
      <p class="hint small">Solo aplica al periodo en el que se registra la fecha. No se repite en periodos futuros.</p>
      <div class="field-row">
        <div class="field"><label>Fecha</label><input type="date" id="eFecha" value="${it.fecha}"></div>
        <div class="field"><label>Persona</label>
          <select id="ePersona">${usuarios.map(p => `<option ${p === it.persona ? "selected" : ""}>${U.escapeHtml(p)}</option>`).join("")}</select>
        </div>
      </div>
      <div class="field"><label>Descripción</label><input type="text" id="eDesc" value="${U.escapeHtml(it.descripcion)}" placeholder="Ej. Bono, trabajo extra"></div>
      <div class="field-row">
        <div class="field"><label>Monto</label><input type="number" step="0.01" id="eMonto" value="${it.monto}"></div>
        <div class="field"><label>Moneda</label>${U.monedaSegHtml("eMonedaSeg", it.moneda)}</div>
      </div>
      <div class="modal-actions">
        <button id="eCancel">Cancelar</button>
        <button class="primary" id="eSave">Guardar</button>
      </div>
    `, (root) => {
      const getMoneda = U.wireMonedaSeg(root, "eMonedaSeg");
      root.querySelector("#eCancel").onclick = U.closeModal;
      root.querySelector("#eSave").onclick = () => {
        const monto = parseFloat(root.querySelector("#eMonto").value);
        const fecha = root.querySelector("#eFecha").value;
        if (!fecha || isNaN(monto)) { U.toast("Completa fecha y monto"); return; }
        const rec = {
          id: it.id || U.uid(), fecha,
          persona: root.querySelector("#ePersona").value,
          descripcion: root.querySelector("#eDesc").value.trim(),
          monto, moneda: getMoneda()
        };
        if (isEdit) M.state.ingresosExtra[M.state.ingresosExtra.findIndex(x => x.id === it.id)] = rec;
        else M.state.ingresosExtra.push(rec);
        M.save(); U.closeModal(); U.toast("Guardado"); CDG.App.refreshAll();
      };
    });
  }

  function renderExtra() {
    const period = M.periodForDate(CDG.App.getPeriodKey());
    const wrap = document.getElementById("extraTableWrap");
    const list = M.state.ingresosExtra.filter(x => M.inPeriod(x.fecha, period)).sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (list.length === 0) {
      wrap.innerHTML = `<div class="empty-hint">Sin ingresos extra en este periodo.</div>`;
      return;
    }
    let total = 0;
    const rows = list.map(it => {
      total += M.toColones(it.monto, it.moneda);
      return `<tr>
        <td data-label="Fecha">${U.fechaLegible(it.fecha)}</td>
        <td data-label="Persona">${U.escapeHtml(it.persona)}</td>
        <td data-label="Descripción">${U.escapeHtml(it.descripcion) || "—"}</td>
        <td class="num" data-label="Monto">${U.fmtMoneda(it.monto, it.moneda)}</td>
        <td class="row-actions">
          <button class="icon ghost" data-edit-extra="${it.id}">✏️</button>
          <button class="icon ghost danger" data-del-extra="${it.id}">🗑️</button>
        </td>
      </tr>`;
    }).join("");
    wrap.innerHTML = `<table class="stack-mobile">
      <thead><tr><th>Fecha</th><th>Persona</th><th>Descripción</th><th class="num">Monto</th><th></th></tr></thead>
      <tbody>${rows}<tr class="total-row"><td colspan="3">Total extra del periodo</td><td class="num">${U.fmtCRC(total)}</td><td></td></tr></tbody>
    </table>`;
    wrap.querySelectorAll("[data-edit-extra]").forEach(btn => {
      btn.onclick = () => openExtraModal(M.state.ingresosExtra.find(x => x.id === btn.dataset.editExtra));
    });
    wrap.querySelectorAll("[data-del-extra]").forEach(btn => {
      btn.onclick = () => U.confirmDelete("¿Eliminar este ingreso extra?", () => {
        M.state.ingresosExtra = M.state.ingresosExtra.filter(x => x.id !== btn.dataset.delExtra);
        M.save(); CDG.App.refreshAll();
      });
    });
  }

  function fijoTable(list, kind) {
    if (list.length === 0) return `<div class="empty-hint">Sin registros.</div>`;
    let total = 0;
    const rows = list.map(it => {
      total += M.toColones(it.monto, it.moneda);
      return `<tr>
        <td data-label="Descripción">${U.escapeHtml(it.descripcion) || "—"}</td>
        <td data-label="Periodo">${U.escapeHtml(it.periodo) || "—"}</td>
        <td class="num" data-label="Monto">${U.fmtMoneda(it.monto, it.moneda)}</td>
        <td class="row-actions">
          <button class="icon ghost" data-edit-fijo="${it.id}" data-kind="${kind}" title="Editar">✏️</button>
          <button class="icon ghost danger" data-del-fijo="${it.id}" data-kind="${kind}" title="Eliminar">🗑️</button>
        </td>
      </tr>`;
    }).join("");
    return `<table class="stack-mobile">
      <thead><tr><th>Descripción</th><th>Periodo</th><th class="num">Monto</th><th></th></tr></thead>
      <tbody>${rows}<tr class="total-row"><td colspan="2">Total</td><td class="num">${U.fmtCRC(total)}</td><td></td></tr></tbody>
    </table>`;
  }

  function renderPersonGrid(containerId, kind, sectionTitle) {
    const container = document.getElementById(containerId);
    const usuarios = M.state.config.usuarios;
    if (usuarios.length === 0) {
      container.innerHTML = `<div class="empty-hint">Agrega usuarios desde el engrane de Configuración.</div>`;
      return;
    }
    container.innerHTML = usuarios.map(persona => {
      const list = kind === "ingreso" ? M.ingresosFijosVigentesHoy(persona) : M.state.gastosFijos.filter(x => x.persona === persona);
      return `<section class="block">
        <div class="block-head">
          <h2>${sectionTitle} — ${U.escapeHtml(persona)}</h2>
          <button class="primary" data-add-fijo="${kind}" data-persona="${U.escapeHtml(persona)}">+ Agregar</button>
        </div>
        ${fijoTable(list, kind)}
      </section>`;
    }).join("");

    container.querySelectorAll("[data-add-fijo]").forEach(btn => {
      btn.onclick = () => openFijoModal(btn.dataset.addFijo, btn.dataset.persona, null);
    });
    container.querySelectorAll("[data-edit-fijo]").forEach(btn => {
      btn.onclick = () => {
        const arr = btn.dataset.kind === "ingreso" ? M.state.ingresosFijos : M.state.gastosFijos;
        const it = arr.find(x => x.id === btn.dataset.editFijo);
        openFijoModal(btn.dataset.kind, it.persona, it);
      };
    });
    container.querySelectorAll("[data-del-fijo]").forEach(btn => {
      btn.onclick = () => U.confirmDelete("¿Eliminar este registro fijo? Los periodos ya cerrados conservarán su valor histórico.", () => {
        if (btn.dataset.kind === "ingreso") {
          M.eliminarIngresoFijo(btn.dataset.delFijo);
        } else {
          M.state.gastosFijos = M.state.gastosFijos.filter(x => x.id !== btn.dataset.delFijo);
        }
        M.save(); CDG.App.refreshAll();
      });
    });
  }

  function renderRebajos() {
    const wrap = document.getElementById("rebajosTableWrap");
    if (M.state.rebajos.length === 0) {
      wrap.innerHTML = `<div class="empty-hint">Sin rebajos registrados.</div>`;
      return;
    }
    let total = 0;
    const rows = M.state.rebajos.map(it => {
      total += it.monto;
      return `<tr>
        <td data-label="Descripción">${U.escapeHtml(it.descripcion) || "—"}</td>
        <td data-label="Persona">${U.escapeHtml(it.persona)}</td>
        <td class="num" data-label="Monto">${U.fmtUSD(it.monto)}</td>
        <td class="row-actions">
          <button class="icon ghost" data-edit-rebajo="${it.id}">✏️</button>
          <button class="icon ghost danger" data-del-rebajo="${it.id}">🗑️</button>
        </td>
      </tr>`;
    }).join("");
    wrap.innerHTML = `<table class="stack-mobile">
      <thead><tr><th>Descripción</th><th>Persona</th><th class="num">Monto</th><th></th></tr></thead>
      <tbody>${rows}<tr class="total-row"><td colspan="2">Total rebajos</td><td class="num">${U.fmtUSD(total)}</td><td></td></tr></tbody>
    </table>`;
    wrap.querySelectorAll("[data-edit-rebajo]").forEach(btn => {
      btn.onclick = () => openRebajoModal(M.state.rebajos.find(x => x.id === btn.dataset.editRebajo));
    });
    wrap.querySelectorAll("[data-del-rebajo]").forEach(btn => {
      btn.onclick = () => U.confirmDelete("¿Eliminar este rebajo?", () => {
        M.state.rebajos = M.state.rebajos.filter(x => x.id !== btn.dataset.delRebajo);
        M.save(); CDG.App.refreshAll();
      });
    });
  }

  function render() {
    renderExtra();
    renderPersonGrid("fijosIngresoGrid", "ingreso", "Ingreso fijo");
    renderRebajos();
    renderPersonGrid("fijosGastoGrid", "gasto", "Gastos fijos");
  }

  function init() {
    document.getElementById("addRebajoBtn").addEventListener("click", () => openRebajoModal(null));
    document.getElementById("addExtraBtn").addEventListener("click", () => openExtraModal(null));
  }

  CDG.Controllers.Fijos = { init, render };
})();
