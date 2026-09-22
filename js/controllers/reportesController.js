window.CDG = window.CDG || {};
CDG.Controllers = CDG.Controllers || {};

/* Reportes: histórico de todos los periodos con datos, filtrable por mes/periodo.
   No depende del navegador de periodo del header — siempre muestra todo el historial. */
CDG.Controllers.Reportes = (function () {
  const U = CDG.Utils;
  const M = CDG.Model;

  function render() {
    const filtro = document.getElementById("reportesFiltro");
    const historico = M.historicoReportes();
    const ordenDesc = historico.slice().reverse();

    const keepVal = filtro.value || "todos";
    filtro.innerHTML = `<option value="todos">Todos los periodos</option>` +
      ordenDesc.map(p => `<option value="${p.key}">${U.escapeHtml(p.label)}</option>`).join("");
    if ([...filtro.options].some(o => o.value === keepVal)) filtro.value = keepVal;

    const filas = filtro.value === "todos" ? ordenDesc : ordenDesc.filter(p => p.key === filtro.value);

    const totalIngreso = filas.reduce((s, p) => s + p.ingreso, 0);
    const totalGasto = filas.reduce((s, p) => s + p.gasto, 0);
    const totalBalance = totalIngreso - totalGasto;
    const totalAhorro = filas.reduce((s, p) => s + p.ahorro, 0);

    document.getElementById("reportesCards").innerHTML = `
      <div class="card"><div class="label">Ingresos</div><div class="value pos">${U.fmtCRC(totalIngreso)}</div></div>
      <div class="card"><div class="label">Gastos</div><div class="value neg">${U.fmtCRC(totalGasto)}</div></div>
      <div class="card"><div class="label">Balance</div><div class="value ${totalBalance >= 0 ? "pos" : "neg"}">${U.fmtCRC(totalBalance)}</div></div>
      <div class="card"><div class="label">Ahorro</div><div class="value">${U.fmtCRC(totalAhorro)}</div></div>
    `;

    const wrap = document.getElementById("reportesTableWrap");
    if (filas.length === 0) {
      wrap.innerHTML = `<div class="empty-hint">Aún no hay reportes guardados.</div>`;
      return;
    }
    const rows = filas.map(p => `<tr>
      <td data-label="Periodo">${U.escapeHtml(p.label)}</td>
      <td class="num" data-label="Ingresos">${U.fmtCRC(p.ingreso)}</td>
      <td class="num" data-label="Gastos">${U.fmtCRC(p.gasto)}</td>
      <td class="num" data-label="Balance">${U.fmtCRC(p.balance)}</td>
      <td class="num" data-label="Ahorro">${U.fmtCRC(p.ahorro)}</td>
    </tr>`).join("");
    wrap.innerHTML = `<table class="stack-mobile">
      <thead><tr><th>Periodo</th><th class="num">Ingresos</th><th class="num">Gastos</th><th class="num">Balance</th><th class="num">Ahorro</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function init() {
    document.getElementById("reportesFiltro").addEventListener("change", render);
  }

  return { init, render };
})();
