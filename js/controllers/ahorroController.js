window.CDG = window.CDG || {};
CDG.Controllers = CDG.Controllers || {};

/* Ahorro is derived, not entered by hand: it's what's left of each salary's
   "libre" once variable gastos (Movimientos) for that period are subtracted. */
(function () {
  const U = CDG.Utils;
  const M = CDG.Model;

  function render() {
    const period = M.periodForDate(CDG.App.getPeriodKey());
    const usuarios = M.state.config.usuarios;
    const historico = M.historicoAhorro();
    const ahorroPeriodoActual = M.ahorroTotalPeriodo(period);

    document.getElementById("ahorroCards").innerHTML = `
      <div class="card"><div class="label">Ahorro del periodo mostrado</div><div class="value ${ahorroPeriodoActual >= 0 ? "pos" : "neg"}">${U.fmtCRC(ahorroPeriodoActual)}</div><div class="sub">${U.escapeHtml(M.periodLabel(period))}</div></div>
      <div class="card"><div class="label">Ahorro acumulado</div><div class="value pos">${U.fmtCRC(historico.total)}</div><div class="sub">Suma de todos los periodos con datos</div></div>
    ` + usuarios.map(persona => {
      const v = M.ahorroPersona(persona, period);
      return `<div class="card"><div class="label">Ahorro ${U.escapeHtml(persona)} (periodo mostrado)</div><div class="value ${v >= 0 ? "pos" : "neg"}">${U.fmtCRC(v)}</div></div>`;
    }).join("");

    const detalleWrap = document.getElementById("ahorroDetalleWrap");
    if (usuarios.length === 0) {
      detalleWrap.innerHTML = `<div class="empty-hint">Agrega usuarios desde el engrane de Configuración.</div>`;
    } else {
      const rows = usuarios.map(persona => {
        const L = M.librePersona(persona, period);
        const gastoVar = M.gastosVariablesPersona(persona, period);
        const ahorro = L.libre - gastoVar;
        return `<tr>
          <td data-label="Persona">${U.escapeHtml(persona)}</td>
          <td class="num" data-label="Ingreso (fijo+extra)">${U.fmtCRC(L.ingresoFijo + L.extra)}</td>
          <td class="num" data-label="Rebajos+Gastos fijos">${U.fmtCRC(L.rebajos + L.gastoFijo)}</td>
          <td class="num" data-label="Libre">${U.fmtCRC(L.libre)}</td>
          <td class="num" data-label="Gastos variables">${U.fmtCRC(gastoVar)}</td>
          <td class="num" data-label="Ahorro">${U.fmtCRC(ahorro)}</td>
        </tr>`;
      }).join("");
      detalleWrap.innerHTML = `<table class="stack-mobile">
        <thead><tr><th>Persona</th><th class="num">Ingreso (fijo+extra)</th><th class="num">Rebajos+Gastos fijos</th><th class="num">Libre</th><th class="num">Gastos variables</th><th class="num">Ahorro</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    }

    const histWrap = document.getElementById("ahorroHistoricoWrap");
    if (historico.periodos.length === 0) {
      histWrap.innerHTML = `<div class="empty-hint">Aún no hay datos suficientes para calcular un histórico.</div>`;
    } else {
      const rows = historico.periodos.slice().reverse().map(p => `<tr>
        <td data-label="Periodo">${U.escapeHtml(p.label)}</td>
        <td class="num" data-label="Ahorro">${U.fmtCRC(p.ahorro)}</td>
      </tr>`).join("");
      histWrap.innerHTML = `<table class="stack-mobile">
        <thead><tr><th>Periodo</th><th class="num">Ahorro</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    }
  }

  CDG.Controllers.Ahorro = { render };
})();
