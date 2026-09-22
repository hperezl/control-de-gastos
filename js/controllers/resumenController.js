window.CDG = window.CDG || {};
CDG.Controllers = CDG.Controllers || {};

(function () {
  const U = CDG.Utils;
  const M = CDG.Model;

  function personaResumenHtml(persona, period) {
    const L = M.librePersona(persona, period);
    const gastoVar = M.gastosVariablesPersona(persona, period);
    const ahorro = L.libre - gastoVar;
    return `
      <div class="cards" style="margin-bottom:0">
        <div class="card"><div class="label">Ingreso fijo</div><div class="value">${U.fmtCRC(L.ingresoFijo)}</div></div>
        ${L.extra > 0 ? `<div class="card"><div class="label">Ingreso extra</div><div class="value">${U.fmtCRC(L.extra)}</div></div>` : ""}
        ${L.rebajos > 0 ? `<div class="card"><div class="label">Rebajos</div><div class="value neg">${U.fmtCRC(L.rebajos)}</div></div>` : ""}
        <div class="card"><div class="label">Gastos fijos</div><div class="value">${U.fmtCRC(L.gastoFijo)}</div></div>
        <div class="card"><div class="label">Libre</div><div class="value ${L.libre >= 0 ? "pos" : "neg"}">${U.fmtCRC(L.libre)}</div></div>
        <div class="card"><div class="label">Gastos variables</div><div class="value">${U.fmtCRC(gastoVar)}</div></div>
        <div class="card"><div class="label">Ahorro del periodo</div><div class="value ${ahorro >= 0 ? "pos" : "neg"}">${U.fmtCRC(ahorro)}</div></div>
      </div>
    `;
  }

  function render() {
    const period = M.periodForDate(CDG.App.getPeriodKey());
    const gastosPeriodo = M.state.movimientos.filter(m => M.inPeriod(m.fecha, period));
    const gastoTotal = gastosPeriodo.reduce((s, m) => s + M.toColones(m.monto, m.moneda), 0);

    const usuarios = M.state.config.usuarios;
    const ingresoTotal = usuarios.reduce((s, p) => {
      const L = M.librePersona(p, period);
      return s + L.ingresoFijo + L.extra;
    }, 0);
    const balance = ingresoTotal - gastoTotal;
    const ahorroAcumulado = M.historicoAhorro().total;

    document.getElementById("resumenCards").innerHTML = `
      <div class="card"><div class="label">Ingresos del periodo</div><div class="value pos">${U.fmtCRC(ingresoTotal)}</div><div class="sub">Ingreso fijo + extra</div></div>
      <div class="card"><div class="label">Gastos del periodo</div><div class="value neg">${U.fmtCRC(gastoTotal)}</div></div>
      <div class="card"><div class="label">Balance del periodo</div><div class="value ${balance >= 0 ? "pos" : "neg"}">${U.fmtCRC(balance)}</div><div class="sub">Ingresos − Gastos</div></div>
      <div class="card"><div class="label">Ahorro acumulado</div><div class="value">${U.fmtCRC(ahorroAcumulado)}</div></div>
    `;

    const personasWrap = document.getElementById("resumenPersonasWrap");
    if (usuarios.length === 0) {
      personasWrap.innerHTML = `<div class="empty-hint">Agrega usuarios desde el engrane de Configuración para ver su resumen aquí.</div>`;
    } else {
      personasWrap.innerHTML = usuarios.map(persona => `
        <section class="block">
          <div class="block-head"><h2>${U.escapeHtml(persona)}</h2></div>
          ${personaResumenHtml(persona, period)}
        </section>
      `).join("");
    }

    CDG.Chart.renderWeekChart(document.getElementById("weekChart"), gastosPeriodo);
    CDG.Chart.renderCategoryDonut(document.getElementById("categoryDonut"), document.getElementById("categoryLegend"), gastosPeriodo);
  }

  CDG.Controllers.Resumen = { render };
})();
