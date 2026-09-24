window.CDG = window.CDG || {};
CDG.Controllers = CDG.Controllers || {};

/* Movimientos: variable expenses only (ingresos live in Ingresos Fijos / Ingreso extra). */
(function () {
  const U = CDG.Utils;
  const M = CDG.Model;

  function personaOptions(selected) {
    return M.personasDisponibles().map(p => `<option ${p === selected ? "selected" : ""}>${U.escapeHtml(p)}</option>`).join("");
  }
  function categoriaOptions(selected) {
    return M.CATEGORIAS_GASTO.map(c => `<option ${c === selected ? "selected" : ""}>${U.escapeHtml(c)}</option>`).join("");
  }

  function openMovModal(existing) {
    const isEdit = !!existing;
    const usuarios = M.personasDisponibles();
    const it = existing || {
      id: null,
      fecha: new Date().toISOString().slice(0, 10),
      persona: usuarios[0] || "",
      categoria: M.CATEGORIAS_GASTO[0],
      descripcion: "",
      monto: "",
      moneda: "CRC"
    };
    U.openModal(`
      <h3>${isEdit ? "Editar" : "Nuevo"} gasto</h3>
      <div class="field-row">
        <div class="field"><label>Fecha</label><input type="date" id="mFecha" value="${it.fecha}"></div>
        <div class="field"><label>Categoría</label><select id="mCategoria">${categoriaOptions(it.categoria)}</select></div>
      </div>
      <div class="field"><label>Descripción breve (opcional)</label><input type="text" id="mDesc" value="${U.escapeHtml(it.descripcion)}" placeholder="Ej. Antojito"></div>
      <div class="field-row three">
        <div class="field"><label>Persona</label><select id="mPersona">${personaOptions(it.persona)}</select></div>
        <div class="field"><label>Monto</label><input type="number" step="0.01" id="mMonto" value="${it.monto}"></div>
        <div class="field"><label>Moneda</label>${U.monedaSegHtml("mMonedaSeg", it.moneda)}</div>
      </div>
      <p class="hint small">"Compartido" reparte el monto entre las personas registradas (redondeado hacia arriba, sin decimales) en vez de guardarlo como un solo gasto sin dueño.</p>
      <div class="modal-actions">
        <button id="mCancel">Cancelar</button>
        <button class="primary" id="mSave">Guardar</button>
      </div>
    `, (root) => {
      const getMoneda = U.wireMonedaSeg(root, "mMonedaSeg");
      root.querySelector("#mCancel").onclick = U.closeModal;
      root.querySelector("#mSave").onclick = () => {
        const monto = parseFloat(root.querySelector("#mMonto").value);
        const fecha = root.querySelector("#mFecha").value;
        if (!fecha || isNaN(monto)) { U.toast("Completa fecha y monto"); return; }
        const persona = root.querySelector("#mPersona").value;
        const categoria = root.querySelector("#mCategoria").value;
        const descripcion = root.querySelector("#mDesc").value.trim();
        const moneda = getMoneda();
        const st = M.state;
        if (isEdit) {
          st.movimientos = st.movimientos.filter(x => x.id !== it.id);
        }
        if (persona === "Compartido") {
          const personasReales = M.state.config.usuarios;
          const montoPersona = Math.ceil(monto / personasReales.length);
          personasReales.forEach(p => {
            st.movimientos.push({
              id: U.uid(),
              fecha,
              persona: p,
              categoria,
              descripcion,
              monto: montoPersona,
              moneda,
              compartido: true
            });
          });
        } else {
          st.movimientos.push({
            id: it.id || U.uid(),
            fecha,
            persona,
            categoria,
            descripcion,
            monto,
            moneda
          });
        }
        M.save(); U.closeModal(); U.toast("Gasto guardado"); CDG.App.refreshAll();
      };
    });
  }

  function render() {
    const period = M.periodForDate(CDG.App.getPeriodKey());
    const personaF = document.getElementById("movPersonaFilter");
    const categoriaF = document.getElementById("movCategoriaFilter");

    const keepPersona = personaF.value;
    personaF.innerHTML = `<option value="todos">Todas las personas</option>` +
      M.personasDisponibles().map(p => `<option value="${U.escapeHtml(p)}">${U.escapeHtml(p)}</option>`).join("");
    if ([...personaF.options].some(o => o.value === keepPersona)) personaF.value = keepPersona;

    if (categoriaF.options.length <= 1) {
      categoriaF.innerHTML = `<option value="todos">Todas las categorías</option>` +
        M.CATEGORIAS_GASTO.map(c => `<option value="${U.escapeHtml(c)}">${U.escapeHtml(c)}</option>`).join("");
    }

    let list = M.state.movimientos.filter(m => M.inPeriod(m.fecha, period));
    if (personaF.value === "Compartido") {
      // "Compartido" ya no se guarda como persona (se reparte al instante entre las
      // personas reales) — el filtro busca la marca `compartido` en cada mitad.
      list = list.filter(m => m.compartido);
    } else if (personaF.value !== "todos") {
      list = list.filter(m => m.persona === personaF.value);
    }
    if (categoriaF.value !== "todos") list = list.filter(m => m.categoria === categoriaF.value);
    list.sort((a, b) => a.fecha.localeCompare(b.fecha));

    const wrap = document.getElementById("movimientosTableWrap");
    if (list.length === 0) {
      wrap.innerHTML = `<div class="empty-hint">No hay gastos para este periodo con los filtros seleccionados.</div>`;
      return;
    }

    const groups = new Map();
    list.forEach(m => {
      const wk = M.weekKey(m.fecha);
      if (!groups.has(wk)) groups.set(wk, []);
      groups.get(wk).push(m);
    });
    const weeks = Array.from(groups.keys()).sort();

    let rows = "";
    let totalCRC = 0;
    weeks.forEach(wk => {
      const items = groups.get(wk);
      let weekTotal = 0;
      items.forEach(m => { weekTotal += M.toColones(m.monto, m.moneda); });
      items.forEach(m => {
        rows += `<tr data-id="${m.id}">
          <td data-label="Fecha">${U.fechaLegible(m.fecha)}</td>
          <td data-label="Categoría"><span class="tag gasto">${U.escapeHtml(m.categoria)}</span></td>
          <td data-label="Persona">${U.escapeHtml(m.persona)}${m.compartido ? ` <span class="tag compartido" title="Parte de un gasto compartido">Compartido</span>` : ""}</td>
          <td data-label="Descripción">${U.escapeHtml(m.descripcion) || "—"}</td>
          <td class="num" data-label="Monto">${U.fmtMoneda(m.monto, m.moneda)}</td>
          <td class="row-actions">
            <button class="icon ghost" data-edit-mov="${m.id}" title="Editar">✏️</button>
            <button class="icon ghost danger" data-del-mov="${m.id}" title="Eliminar">🗑️</button>
          </td>
        </tr>`;
      });
      rows += `<tr class="week-row">
        <td colspan="4">Semana ${M.weekLabel(wk)}</td>
        <td class="num">${U.fmtCRC(weekTotal)}</td>
        <td></td>
      </tr>`;
      totalCRC += weekTotal;
    });

    wrap.innerHTML = `<table class="stack-mobile">
      <thead><tr><th>Fecha</th><th>Categoría</th><th>Persona</th><th>Descripción</th><th class="num">Monto</th><th></th></tr></thead>
      <tbody>${rows}
        <tr class="total-row"><td colspan="4">Total gastado en el periodo</td><td class="num">${U.fmtCRC(totalCRC)}</td><td></td></tr>
      </tbody>
    </table>`;

    wrap.querySelectorAll("[data-edit-mov]").forEach(btn => {
      btn.onclick = () => openMovModal(M.state.movimientos.find(m => m.id === btn.dataset.editMov));
    });
    wrap.querySelectorAll("[data-del-mov]").forEach(btn => {
      btn.onclick = () => U.confirmDelete("¿Eliminar este gasto?", () => {
        M.state.movimientos = M.state.movimientos.filter(m => m.id !== btn.dataset.delMov);
        M.save(); CDG.App.refreshAll();
      });
    });
  }

  function init() {
    document.getElementById("movPersonaFilter").addEventListener("change", render);
    document.getElementById("movCategoriaFilter").addEventListener("change", render);
    document.getElementById("addMovBtn").addEventListener("click", () => openMovModal(null));
  }

  CDG.Controllers.Movimientos = { init, render };
})();
