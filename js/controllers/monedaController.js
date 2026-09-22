window.CDG = window.CDG || {};
CDG.Controllers = CDG.Controllers || {};

/* Moneda: live 4-way converter (CRC / USD / EUR / CHF). Typing in any card
   recomputes the other three, using USD as the pivot currency. */
CDG.Controllers.Moneda = (function () {
  const U = CDG.Utils;
  const M = CDG.Model;

  const CURRENCIES = [
    { code: "CRC", label: "Colón costarricense", symbol: "₡" },
    { code: "USD", label: "Dólar estadounidense", symbol: "$" },
    { code: "EUR", label: "Euro", symbol: "€" },
    { code: "CHF", label: "Franco suizo", symbol: "CHF" }
  ];

  function fmt(n) {
    if (n == null || isNaN(n)) return "—";
    return n.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function renderRatesStrip() {
    const el = document.getElementById("fxRatesStrip");
    if (!el) return;
    const usdToCrc = M.state.config.tipoCambio;
    const pills = [`<span class="fx-rate-pill">$1 = ₡${fmt(usdToCrc)}</span>`];
    if (CDG.Currency.isReady()) {
      pills.push(`<span class="fx-rate-pill">$1 = €${fmt(CDG.Currency.ratePerUSD("EUR"))}</span>`);
      pills.push(`<span class="fx-rate-pill">$1 = CHF ${fmt(CDG.Currency.ratePerUSD("CHF"))}</span>`);
    } else {
      pills.push(`<span class="hint small">Cargando € y CHF…</span>`);
    }
    el.innerHTML = pills.join("");
  }

  function recompute(sourceCode) {
    const sourceInput = document.getElementById("fxAmt-" + sourceCode);
    const raw = parseFloat(sourceInput.value);
    CURRENCIES.forEach(c => {
      if (c.code === sourceCode) return;
      const input = document.getElementById("fxAmt-" + c.code);
      if (isNaN(raw)) { input.value = ""; return; }
      const converted = CDG.Currency.convert(raw, sourceCode, c.code);
      input.value = converted == null ? "" : converted.toFixed(2);
    });
  }

  function render() {
    const wrap = document.getElementById("fxCardsWrap");
    wrap.innerHTML = CURRENCIES.map(c => `
      <div class="fx-card">
        <div class="fx-card-label">${c.symbol} ${U.escapeHtml(c.label)}</div>
        <input type="number" class="fx-card-input" id="fxAmt-${c.code}" inputmode="decimal" step="0.01" placeholder="0.00">
        <div class="fx-card-code">${c.code}</div>
      </div>
    `).join("");

    CURRENCIES.forEach(c => {
      document.getElementById("fxAmt-" + c.code).addEventListener("input", () => recompute(c.code));
    });

    document.getElementById("fxAmt-USD").value = "1";
    recompute("USD");
    renderRatesStrip();
  }

  function refreshValues() {
    if (document.getElementById("fxAmt-USD")) recompute("USD");
  }

  function init() {
    render();
    document.getElementById("fxRefreshBtn").addEventListener("click", () => {
      const btn = document.getElementById("fxRefreshBtn");
      btn.disabled = true;
      Promise.all([CDG.ExchangeRate.refresh(true), CDG.Currency.refresh()]).then(() => {
        btn.disabled = false;
        renderRatesStrip();
        recompute("USD");
        U.toast("Tipos de cambio actualizados");
      });
    });
  }

  return { init, renderRatesStrip, refreshValues };
})();
