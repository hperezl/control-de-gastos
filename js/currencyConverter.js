window.CDG = window.CDG || {};

/* Cross rates for the Moneda converter: EUR and CHF vs USD, from a free,
   CORS-open, no-key CDN feed (updates daily; cached for the session). CRC
   reuses the BCCR "compra" rate already tracked in M.state.config.tipoCambio,
   so the converter and the rest of the app always agree on that number. */
CDG.Currency = (function () {
  const M = CDG.Model;
  const PRIMARY = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";
  const FALLBACK = "https://latest.currency-api.pages.dev/v1/currencies/usd.json";

  const rates = { EUR: null, CHF: null, fecha: null };
  let inFlight = null;

  function fetchFrom(url) {
    return fetch(url, { cache: "no-store" }).then(res => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  function refresh() {
    if (inFlight) return inFlight;
    inFlight = fetchFrom(PRIMARY)
      .catch(() => fetchFrom(FALLBACK))
      .then(data => {
        const usd = data.usd || {};
        rates.EUR = usd.eur || null;
        rates.CHF = usd.chf || null;
        rates.fecha = data.date || null;
        return rates;
      })
      .catch(err => {
        console.warn("No se pudieron obtener tipos de cambio EUR/CHF", err);
        return rates;
      })
      .finally(() => { inFlight = null; });
    return inFlight;
  }

  function ratePerUSD(code) {
    if (code === "USD") return 1;
    if (code === "CRC") return M.state.config.tipoCambio || null;
    if (code === "EUR") return rates.EUR;
    if (code === "CHF") return rates.CHF;
    return null;
  }

  function convert(amount, fromCode, toCode) {
    const rFrom = ratePerUSD(fromCode);
    const rTo = ratePerUSD(toCode);
    if (!rFrom || !rTo || isNaN(amount)) return null;
    return (amount / rFrom) * rTo;
  }

  function isReady() { return rates.EUR != null && rates.CHF != null; }

  return { refresh, ratePerUSD, convert, isReady, get fecha() { return rates.fecha; } };
})();
