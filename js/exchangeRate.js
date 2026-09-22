window.CDG = window.CDG || {};

/* Auto-updates the USD -> CRC exchange rate from BCCR (Banco Central de Costa
   Rica), via a free CORS-friendly mirror (no backend needed, no API key).
   Never blocks or throws: on any failure it just keeps the last known value.
   Attribution required by the mirror's free-use terms — see settingsController. */
CDG.ExchangeRate = (function () {
  const U = CDG.Utils;
  const M = CDG.Model;
  const ENDPOINT = "https://allratestoday.com/api/open/central-bank/bccr";
  const MIN_REFRESH_MS = 60 * 60 * 1000; // be a good citizen: at most once an hour

  let lastAttempt = 0;
  let inFlight = null;

  function refresh(force) {
    const cfg = M.state.config;
    if (!cfg.tipoCambioAuto && !force) return Promise.resolve(null);

    const now = Date.now();
    if (!force && now - lastAttempt < MIN_REFRESH_MS) return Promise.resolve(null);
    if (inFlight) return inFlight;

    lastAttempt = now;
    inFlight = fetch(ENDPOINT, { cache: "no-store" })
      .then(res => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .then(data => {
        const rates = data.rates || [];
        const buy = rates.find(r => r.base === "USD" && r.quote === "CRC" && r.type === "buy");
        if (!buy) throw new Error("Formato de respuesta inesperado");
        const value = Math.round(buy.value * 100) / 100;
        M.state.config.tipoCambio = value;
        M.state.config.tipoCambioFecha = data.rate_date || U.isoDate(new Date());
        M.save();
        return value;
      })
      .catch(err => {
        console.warn("No se pudo actualizar el tipo de cambio desde BCCR", err);
        return null;
      })
      .finally(() => { inFlight = null; });

    return inFlight;
  }

  return { refresh };
})();
