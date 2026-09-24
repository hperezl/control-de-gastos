window.CDG = window.CDG || {};
CDG.Controllers = CDG.Controllers || {};

(function () {
  const U = CDG.Utils;
  const M = CDG.Model;

  /* Muestra el monto en la(s) moneda(s) en que realmente se registró, no solo
     el total convertido a colones. Si hay de las dos monedas, devuelve dos
     tarjetas (una por moneda); si es una sola, una tarjeta (con conversión
     a colones abajo, en letra pequeña, cuando es en dólares). */
  function montoCardsPorMoneda(label, sums, totalCRC) {
    const hasUSD = sums.USD > 0;
    const hasCRC = sums.CRC > 0;
    if (hasUSD && hasCRC) {
      const usdEnCRC = M.toColones(sums.USD, "USD");
      return `
        <div class="card"><div class="label">${label} ($)</div><div class="value">${U.fmtUSD(sums.USD)}</div><div class="sub">≈ ${U.fmtCRC(usdEnCRC)}</div></div>
        <div class="card"><div class="label">${label} (₡)</div><div class="value">${U.fmtCRC(sums.CRC)}</div></div>
      `;
    }
    if (hasUSD) {
      return `<div class="card"><div class="label">${label}</div><div class="value">${U.fmtUSD(sums.USD)}</div><div class="sub">≈ ${U.fmtCRC(totalCRC)}</div></div>`;
    }
    return `<div class="card"><div class="label">${label}</div><div class="value">${U.fmtCRC(totalCRC)}</div></div>`;
  }

  /* Igual que arriba, pero para valores que pueden ser negativos (Neto/Libre):
     colorea cada tarjeta según su propio signo y, cuando no hay mezcla de
     monedas, muestra la fórmula como sub-texto en vez de la conversión. */
  function netoCardsPorMoneda(label, sums, totalCRC, formula) {
    const hasUSD = Math.abs(sums.USD) > 0.005;
    const hasCRC = Math.abs(sums.CRC) > 0.005;
    const signo = (v) => (v >= 0 ? "pos" : "neg");
    if (hasUSD && hasCRC) {
      const usdEnCRC = M.toColones(sums.USD, "USD");
      return `
        <div class="card"><div class="label">${label} ($)</div><div class="value ${signo(sums.USD)}">${U.fmtUSD(sums.USD)}</div><div class="sub">≈ ${U.fmtCRC(usdEnCRC)}</div></div>
        <div class="card"><div class="label">${label} (₡)</div><div class="value ${signo(sums.CRC)}">${U.fmtCRC(sums.CRC)}</div><div class="sub">${formula}</div></div>
      `;
    }
    if (hasUSD) {
      return `<div class="card"><div class="label">${label}</div><div class="value ${signo(sums.USD)}">${U.fmtUSD(sums.USD)}</div><div class="sub">≈ ${U.fmtCRC(totalCRC)}</div></div>`;
    }
    return `<div class="card"><div class="label">${label}</div><div class="value ${signo(totalCRC)}">${U.fmtCRC(totalCRC)}</div><div class="sub">${formula}</div></div>`;
  }

  /* "Libre" (Neto − gastos variables): si el ingreso fijo de la persona está
     100% en una sola moneda, esa es la moneda "de casa" — cualquier gasto
     variable en la otra moneda se convierte a la de casa y se resta ahí, en
     vez de dejar una tarjeta suelta en la otra moneda (que podía terminar en
     negativo sin contexto, ej. "-₡5 000" cuando el ingreso es en dólares).
     Si el propio Neto ya está mezclado entre las dos monedas (o es cero en
     ambas), no hay una moneda de casa clara y se mantiene el desglose por
     moneda de siempre. */
  function libreCardHtml(netoSums, gastoVarSums, libreReal) {
    const netoHasUSD = Math.abs(netoSums.USD) > 0.005;
    const netoHasCRC = Math.abs(netoSums.CRC) > 0.005;
    const signo = (v) => (v >= 0 ? "pos" : "neg");
    if (netoHasUSD && !netoHasCRC) {
      const valorUSD = M.toDolares(libreReal, "CRC");
      return `<div class="card"><div class="label">Libre</div><div class="value ${signo(valorUSD)}">${U.fmtUSD(valorUSD)}</div><div class="sub">≈ ${U.fmtCRC(libreReal)}</div></div>`;
    }
    if (netoHasCRC && !netoHasUSD) {
      return `<div class="card"><div class="label">Libre</div><div class="value ${signo(libreReal)}">${U.fmtCRC(libreReal)}</div><div class="sub">Neto − gastos variables</div></div>`;
    }
    const libreSums = M.combinarPorMoneda([[netoSums, 1], [gastoVarSums, -1]]);
    return netoCardsPorMoneda("Libre", libreSums, libreReal, "Neto − gastos variables");
  }

  function personaResumenHtml(persona, period) {
    const L = M.librePersona(persona, period);
    const gastoVar = M.gastosVariablesPersona(persona, period);
    const libreReal = L.libre - gastoVar;
    const Q = M.desgloseQuincenas(persona, period);
    const ingresoFijoSums = M.ingresoFijoPorMoneda(persona, period);
    const extraSums = M.ingresoExtraPorMoneda(persona, period);
    const gastoFijoSums = M.gastoFijoPorMoneda(persona);
    const gastoVarSums = M.gastoVariablePorMoneda(persona, period);
    const netoSums = M.combinarPorMoneda([[ingresoFijoSums, 1], [extraSums, 1], [gastoFijoSums, -1]]);
    const mostrarGastoVarDolar = ingresoFijoSums.USD > 0 && gastoVarSums.USD > 0;
    return `
      <div class="cards" style="margin-bottom:0">
        ${montoCardsPorMoneda("Ingreso fijo", ingresoFijoSums, L.ingresoFijo)}
        ${L.extra > 0 ? montoCardsPorMoneda("Ingreso extra", extraSums, L.extra) : ""}
        ${montoCardsPorMoneda("Gastos fijos", gastoFijoSums, L.gastoFijo)}
        ${netoCardsPorMoneda("Neto", netoSums, L.libre, "Ingreso − gastos fijos")}
        <div class="card"><div class="label">Gastos variables</div><div class="value">${U.fmtCRC(gastoVarSums.CRC)}</div></div>
        ${mostrarGastoVarDolar ? `<div class="card"><div class="label">Gastos variables ($)</div><div class="value">${U.fmtUSD(gastoVarSums.USD)}</div><div class="sub">≈ ${U.fmtCRC(M.toColones(gastoVarSums.USD, "USD"))}</div></div>` : ""}
        ${libreCardHtml(netoSums, gastoVarSums, libreReal)}
      </div>
      <div class="quincena-row">
        ${quincenaCardHtml("Quincena 1", "día 1–15", Q.q1)}
        ${quincenaCardHtml("Quincena 2", "día 16–31", Q.q2)}
      </div>
    `;
  }

  /* Línea de la tarjeta de quincena, consciente de moneda: si el monto está
     100% en una moneda, una línea (con conversión a ₡ debajo en chico si es
     en $); si hay de las dos, dos líneas — una por moneda. */
  function quincenaLineaPorMoneda(label, sums, totalCRC, opts) {
    opts = opts || {};
    const rowClass = opts.total ? "quincena-line total" : "quincena-line";
    const color = (v) => (opts.signed ? (v >= 0 ? "pos" : "neg") : "");
    const hasUSD = Math.abs(sums.USD) > 0.005;
    const hasCRC = Math.abs(sums.CRC) > 0.005;
    const valueSpan = (texto, sub, colorClass) =>
      `<span class="${colorClass}">${texto}${sub ? `<div class="hint small" style="margin:0; text-align:right">${sub}</div>` : ""}</span>`;

    if (hasUSD && hasCRC) {
      const usdEnCRC = M.toColones(sums.USD, "USD");
      return `
        <div class="${rowClass}"><span>${label} ($)</span>${valueSpan(U.fmtUSD(sums.USD), `≈ ${U.fmtCRC(usdEnCRC)}`, color(sums.USD))}</div>
        <div class="${rowClass}"><span>${label} (₡)</span>${valueSpan(U.fmtCRC(sums.CRC), null, color(sums.CRC))}</div>
      `;
    }
    if (hasUSD) {
      return `<div class="${rowClass}"><span>${label}</span>${valueSpan(U.fmtUSD(sums.USD), `≈ ${U.fmtCRC(totalCRC)}`, color(sums.USD))}</div>`;
    }
    return `<div class="${rowClass}"><span>${label}</span>${valueSpan(U.fmtCRC(totalCRC), null, color(totalCRC))}</div>`;
  }

  function quincenaCardHtml(titulo, sub, q) {
    return `
      <div class="quincena-card">
        <div class="quincena-title">${titulo} <span class="hint small" style="margin:0">(${sub})</span></div>
        ${quincenaLineaPorMoneda("Ingreso", q.ingresoSums, q.ingreso)}
        ${quincenaLineaPorMoneda("Gastos fijos", q.gastoSums, q.gasto)}
        ${quincenaLineaPorMoneda("Aporte", q.aporteSums, q.aporte, { total: true, signed: true })}
      </div>
    `;
  }

  function render() {
    const period = M.periodForDate(CDG.App.getPeriodKey());
    const gastosPeriodo = M.state.movimientos.filter(m => M.inPeriod(m.fecha, period));
    const gastoTotal = gastosPeriodo.reduce((s, m) => s + M.toColones(m.monto, m.moneda), 0);

    const usuarios = M.state.config.usuarios;
    const ingresoNetoTotal = usuarios.reduce((s, p) => s + M.librePersona(p, period).libre, 0);
    const balance = ingresoNetoTotal - gastoTotal;
    const ahorroAcumulado = M.historicoAhorro().total;

    document.getElementById("resumenCards").innerHTML = `
      <div class="card"><div class="label">Ingreso neto del periodo</div><div class="value pos">${U.fmtCRC(ingresoNetoTotal)}</div><div class="sub">Ingreso fijo + extra − gastos fijos</div></div>
      <div class="card"><div class="label">Gastos variables del periodo</div><div class="value neg">${U.fmtCRC(gastoTotal)}</div></div>
      <div class="card"><div class="label">Balance / Libre del periodo</div><div class="value ${balance >= 0 ? "pos" : "neg"}">${U.fmtCRC(balance)}</div><div class="sub">Ingreso neto − gastos variables</div></div>
      <div class="card"><div class="label">Ahorro acumulado</div><div class="value">${U.fmtCRC(ahorroAcumulado)}</div><div class="sub">Suma del ahorro de todos los periodos registrados</div></div>
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
