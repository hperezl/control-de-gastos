window.CDG = window.CDG || {};

/* Model: state, persistence, domain calculations (currency, billing-cycle periods,
   weeks, temporal versioning of ingresos fijos, and derived ahorro). */
CDG.Model = (function () {
  const U = CDG.Utils;
  const STORAGE_KEY = "cdg_data_v3";
  const V2_KEY = "cdg_data_v2";
  const V1_KEY = "cdg_data_v1";

  const CATEGORIAS_GASTO = [
    "Farmacia", "Veterinaria", "Cuota del préstamo", "Supermercado", "Estudio",
    "Familia materna", "Familia paterna", "Soda", "Salidas", "Gasolina", "Carro", "Otro"
  ];

  function defaultConfig() {
    return {
      registrado: false,
      nombreControl: "",
      usuarios: [],
      corteActivo: false,
      diaCorte: 5,
      tipoCambio: 502,
      tipoCambioAuto: true,
      tipoCambioFecha: null
    };
  }
  function defaultState() {
    return {
      config: defaultConfig(),
      movimientos: [],      // gastos variables: {id, fecha, persona, categoria, descripcion, monto, moneda}
      ingresosFijos: [],    // {id, persona, descripcion, periodo, monto, moneda, vigenteDesde, vigenteHasta}
      ingresosExtra: [],    // {id, fecha, persona, descripcion, monto, moneda}
      rebajos: [],
      gastosFijos: []
    };
  }

  /* ---- migration chain: v1 -> v2 -> v3 ---- */
  function v1ToV2Shape(old) {
    const v2 = { config: {}, movimientos: [], ingresosFijos: [], gastosFijos: [], rebajos: [] };
    v2.config.usuarios = ["Heiner", "Suy"];
    v2.config.registrado = true;
    v2.config.tipoCambio = (old.config && old.config.tipoCambio) || 502;
    v2.movimientos = old.movimientos || [];
    v2.ingresosFijos = old.ingresosFijos || [];
    v2.gastosFijos = old.gastosFijos || [];
    v2.rebajos = (old.rebajos || []).map(r => Object.assign({ persona: "Heiner" }, r));
    return v2;
  }
  function v2ToV3Shape(old) {
    const v3 = defaultState();
    v3.config = Object.assign(defaultConfig(), old.config || {});
    const ingresosExtra = [];
    const movimientosGasto = [];
    (old.movimientos || []).forEach(m => {
      if (m.tipo === "ingreso") {
        ingresosExtra.push({ id: m.id, fecha: m.fecha, persona: m.persona, descripcion: m.descripcion, monto: m.monto, moneda: m.moneda });
      } else {
        movimientosGasto.push({ id: m.id, fecha: m.fecha, persona: m.persona, categoria: "Otro", descripcion: m.descripcion, monto: m.monto, moneda: m.moneda });
      }
    });
    v3.movimientos = movimientosGasto;
    v3.ingresosExtra = ingresosExtra;
    v3.ingresosFijos = (old.ingresosFijos || []).map(x => Object.assign({ vigenteDesde: "2000-01-01", vigenteHasta: null }, x));
    v3.rebajos = old.rebajos || [];
    v3.gastosFijos = old.gastosFijos || [];
    return v3;
  }

  function load() {
    try {
      const rawV3 = localStorage.getItem(STORAGE_KEY);
      if (rawV3) {
        const parsed = JSON.parse(rawV3);
        return Object.assign(defaultState(), parsed, { config: Object.assign(defaultConfig(), parsed.config || {}) });
      }
      const rawV2 = localStorage.getItem(V2_KEY);
      if (rawV2) {
        const migrated = v2ToV3Shape(JSON.parse(rawV2));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      const rawV1 = localStorage.getItem(V1_KEY);
      if (rawV1) {
        const migrated = v2ToV3Shape(v1ToV2Shape(JSON.parse(rawV1)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      return defaultState();
    } catch (e) {
      console.error("Error cargando datos", e);
      return defaultState();
    }
  }

  let state = load();

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (window.CDG && CDG.Cloud && CDG.Cloud.isSignedIn()) CDG.Cloud.guardar(state);
  }
  function resetAll() { state = defaultState(); save(); }
  function replaceState(newState) {
    state = Object.assign(defaultState(), newState, {
      config: Object.assign(defaultConfig(), newState.config || {})
    });
    save();
  }
  /* Applies a state snapshot received from the cloud: updates the local cache
     only, never writes back to the cloud (that would loop the sync). */
  function applyRemoteState(data) {
    state = Object.assign(defaultState(), data, {
      config: Object.assign(defaultConfig(), data.config || {})
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function toColones(monto, moneda) {
    return moneda === "USD" ? monto * state.config.tipoCambio : monto;
  }
  function toDolares(monto, moneda) {
    return moneda === "CRC" ? monto / state.config.tipoCambio : monto;
  }
  function personasDisponibles() {
    const u = state.config.usuarios.slice();
    if (u.length > 1) u.push("Compartido");
    return u;
  }

  /* ---- billing-cycle aware periods ---- */
  function periodForDate(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    if (!state.config.corteActivo) {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { start, end, key: U.isoDate(start) };
    }
    const D = state.config.diaCorte;
    let start, end;
    if (d.getDate() > D) {
      start = new Date(d.getFullYear(), d.getMonth(), D + 1);
      end = new Date(d.getFullYear(), d.getMonth() + 1, D);
    } else {
      start = new Date(d.getFullYear(), d.getMonth() - 1, D + 1);
      end = new Date(d.getFullYear(), d.getMonth(), D);
    }
    return { start, end, key: U.isoDate(start) };
  }
  function periodFromKey(key) { return periodForDate(key); }
  function shiftPeriod(key, dir) {
    const cur = periodFromKey(key);
    const probe = new Date(dir > 0 ? cur.end : cur.start);
    probe.setDate(probe.getDate() + (dir > 0 ? 1 : -1));
    return periodForDate(U.isoDate(probe)).key;
  }
  function periodKeyForToday() { return periodForDate(U.isoDate(new Date())).key; }
  function periodLabel(period) {
    const f = (dt) => dt.toLocaleDateString("es-CR", { day: "2-digit", month: "short" });
    if (!state.config.corteActivo) {
      const label = period.start.toLocaleDateString("es-CR", { month: "long", year: "numeric" });
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
    return `${f(period.start)} – ${f(period.end)} ${period.end.getFullYear()}`;
  }
  function inPeriod(dateStr, period) {
    const d = new Date(dateStr + "T00:00:00");
    return d >= period.start && d <= period.end;
  }

  /* week grouping (Monday-start), independent of billing cycle */
  function weekKey(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const day = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - day);
    return U.isoDate(monday);
  }
  function weekLabel(mondayKey) {
    const start = new Date(mondayKey + "T00:00:00");
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const f = (dt) => dt.toLocaleDateString("es-CR", { day: "2-digit", month: "2-digit" });
    return f(start) + " – " + f(end);
  }

  /* ---- ingresos fijos: temporal versioning ----
     Editing/removing a fijo never rewrites history: a version that has already
     been used by a closed (past) period is "closed" (vigenteHasta set) and a new
     version takes over from the current period onward. A version created within
     the still-open current period (never seen by a closed period) is mutated in
     place. */
  function ingresoFijoActivoEnPeriodo(item, period) {
    const desde = item.vigenteDesde || "0000-00-00";
    const hasta = item.vigenteHasta;
    return desde <= U.isoDate(period.end) && (!hasta || hasta >= U.isoDate(period.start));
  }
  function ingresosFijosActivos(period, persona) {
    return state.ingresosFijos.filter(x => (!persona || x.persona === persona) && ingresoFijoActivoEnPeriodo(x, period));
  }
  function ingresosFijosVigentesHoy(persona) {
    return ingresosFijosActivos(periodForDate(U.isoDate(new Date())), persona);
  }
  function guardarIngresoFijo(datos, existingId) {
    const hoy = periodForDate(U.isoDate(new Date()));
    const hoyStart = U.isoDate(hoy.start);
    if (!existingId) {
      state.ingresosFijos.push(Object.assign({ id: U.uid(), vigenteDesde: hoyStart, vigenteHasta: null }, datos));
      return;
    }
    const idx = state.ingresosFijos.findIndex(x => x.id === existingId);
    if (idx === -1) return;
    const old = state.ingresosFijos[idx];
    if (old.vigenteDesde >= hoyStart) {
      state.ingresosFijos[idx] = Object.assign({}, old, datos);
    } else {
      const diaAnterior = new Date(hoy.start);
      diaAnterior.setDate(diaAnterior.getDate() - 1);
      old.vigenteHasta = U.isoDate(diaAnterior);
      state.ingresosFijos.push(Object.assign({ id: U.uid(), vigenteDesde: hoyStart, vigenteHasta: null }, datos));
    }
  }
  function eliminarIngresoFijo(id) {
    const hoy = periodForDate(U.isoDate(new Date()));
    const hoyStart = U.isoDate(hoy.start);
    const idx = state.ingresosFijos.findIndex(x => x.id === id);
    if (idx === -1) return;
    const old = state.ingresosFijos[idx];
    if (old.vigenteDesde >= hoyStart) {
      state.ingresosFijos.splice(idx, 1);
    } else {
      const diaAnterior = new Date(hoy.start);
      diaAnterior.setDate(diaAnterior.getDate() - 1);
      old.vigenteHasta = U.isoDate(diaAnterior);
    }
  }

  /* ---- libre / ahorro derived calculations ---- */
  function librePersona(persona, period) {
    const ingresoFijo = ingresosFijosActivos(period, persona).reduce((s, x) => s + toColones(x.monto, x.moneda), 0);
    const extra = state.ingresosExtra.filter(x => x.persona === persona && inPeriod(x.fecha, period)).reduce((s, x) => s + toColones(x.monto, x.moneda), 0);
    const gastoFijo = state.gastosFijos.filter(x => x.persona === persona).reduce((s, x) => s + toColones(x.monto, x.moneda), 0);
    return { ingresoFijo, extra, gastoFijo, libre: ingresoFijo + extra - gastoFijo };
  }
  function gastosVariablesPersona(persona, period) {
    return state.movimientos.filter(m => m.persona === persona && inPeriod(m.fecha, period)).reduce((s, m) => s + toColones(m.monto, m.moneda), 0);
  }
  /* Desglose por moneda (sin convertir) — para mostrar "$X ≈ ₡Y" cuando el
     ingreso de una persona está en dólares, en vez de solo el total en colones. */
  function sumaPorMoneda(items) {
    const sums = { USD: 0, CRC: 0 };
    items.forEach(x => { sums[x.moneda] = (sums[x.moneda] || 0) + x.monto; });
    return sums;
  }
  function ingresoFijoPorMoneda(persona, period) { return sumaPorMoneda(ingresosFijosActivos(period, persona)); }
  function ingresoExtraPorMoneda(persona, period) {
    return sumaPorMoneda(state.ingresosExtra.filter(x => x.persona === persona && inPeriod(x.fecha, period)));
  }
  function gastoFijoPorMoneda(persona) { return sumaPorMoneda(state.gastosFijos.filter(x => x.persona === persona)); }
  function gastoVariablePorMoneda(persona, period) {
    return sumaPorMoneda(state.movimientos.filter(m => m.persona === persona && inPeriod(m.fecha, period)));
  }
  /* Combina desgloses por moneda sin convertir (ej. Neto.USD = ingreso.USD −
     gastoFijo.USD), para poder mostrar "Neto"/"Libre" en su moneda de origen
     cuando ingreso y gasto de una persona están en la misma moneda. */
  function combinarPorMoneda(terminos) {
    return terminos.reduce((acc, [sums, signo]) => ({
      USD: acc.USD + sums.USD * signo,
      CRC: acc.CRC + sums.CRC * signo
    }), { USD: 0, CRC: 0 });
  }
  function ahorroPersona(persona, period) {
    return librePersona(persona, period).libre - gastosVariablesPersona(persona, period);
  }
  function ahorroTotalPeriodo(period) {
    const totalLibre = state.config.usuarios.reduce((s, p) => s + librePersona(p, period).libre, 0);
    const totalGastos = state.movimientos.filter(m => inPeriod(m.fecha, period)).reduce((s, m) => s + toColones(m.monto, m.moneda), 0);
    return totalLibre - totalGastos;
  }
  function primerPeriodoConDatos() {
    const keys = [];
    state.movimientos.forEach(m => keys.push(periodForDate(m.fecha).key));
    state.ingresosExtra.forEach(m => keys.push(periodForDate(m.fecha).key));
    state.ingresosFijos.forEach(x => keys.push(x.vigenteDesde));
    if (keys.length === 0) return null;
    return keys.sort()[0];
  }
  function periodosConDatos() {
    const first = primerPeriodoConDatos();
    const hoyKey = periodKeyForToday();
    if (!first) return [];
    const periodos = [];
    let key = first > hoyKey ? hoyKey : first;
    let guard = 0;
    while (key <= hoyKey && guard < 600) {
      periodos.push(periodFromKey(key));
      if (key === hoyKey) break;
      key = shiftPeriod(key, 1);
      guard++;
    }
    return periodos;
  }
  function historicoAhorro() {
    const periodos = periodosConDatos().map(period => ({ key: period.key, label: periodLabel(period), ahorro: ahorroTotalPeriodo(period) }));
    const total = periodos.reduce((s, p) => s + p.ahorro, 0);
    return { total, periodos };
  }
  function historicoReportes() {
    return periodosConDatos().map(period => {
      const gastoVariable = state.movimientos.filter(m => inPeriod(m.fecha, period)).reduce((s, m) => s + toColones(m.monto, m.moneda), 0);
      let ingresoTotal = 0;
      let gastoFijoTotal = 0;
      state.config.usuarios.forEach(p => {
        const L = librePersona(p, period);
        ingresoTotal += L.ingresoFijo + L.extra;
        gastoFijoTotal += L.gastoFijo;
      });
      const gastoTotal = gastoFijoTotal + gastoVariable;
      return { key: period.key, label: periodLabel(period), ingreso: ingresoTotal, gasto: gastoTotal, balance: ingresoTotal - gastoTotal, ahorro: ahorroTotalPeriodo(period) };
    });
  }

  /* ---- día del mes (para desglose por quincena) ----
     ingresosFijos/gastosFijos guardan un "día" numérico (1-31) desde esta
     versión; registros viejos solo tenían "periodo" como texto libre (ej.
     "Día 13") — se extrae el primer número como respaldo. */
  function resolveDia(item) {
    if (item.dia != null && item.dia !== "") return parseInt(item.dia, 10);
    const m = (item.periodo || "").match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }
  function quincenaDeDia(dia) { return dia != null && dia <= 15 ? 1 : 2; }

  function desgloseQuincenas(persona, period) {
    const q = {
      1: { ingreso: { USD: 0, CRC: 0 }, gasto: { USD: 0, CRC: 0 } },
      2: { ingreso: { USD: 0, CRC: 0 }, gasto: { USD: 0, CRC: 0 } }
    };
    ingresosFijosActivos(period, persona).forEach(x => {
      q[quincenaDeDia(resolveDia(x))].ingreso[x.moneda] += x.monto;
    });
    state.ingresosExtra.filter(x => x.persona === persona && inPeriod(x.fecha, period)).forEach(x => {
      const dia = new Date(x.fecha + "T00:00:00").getDate();
      q[quincenaDeDia(dia)].ingreso[x.moneda] += x.monto;
    });
    state.gastosFijos.filter(x => x.persona === persona).forEach(x => {
      q[quincenaDeDia(resolveDia(x))].gasto[x.moneda] += x.monto;
    });
    function armar(qx) {
      const ingresoCRC = toColones(qx.ingreso.USD, "USD") + qx.ingreso.CRC;
      const gastoCRC = toColones(qx.gasto.USD, "USD") + qx.gasto.CRC;
      return {
        ingresoSums: qx.ingreso,
        gastoSums: qx.gasto,
        aporteSums: { USD: qx.ingreso.USD - qx.gasto.USD, CRC: qx.ingreso.CRC - qx.gasto.CRC },
        ingreso: ingresoCRC,
        gasto: gastoCRC,
        aporte: ingresoCRC - gastoCRC
      };
    }
    return { q1: armar(q[1]), q2: armar(q[2]) };
  }

  return {
    get state() { return state; },
    CATEGORIAS_GASTO,
    save, resetAll, replaceState, applyRemoteState,
    toColones, toDolares, personasDisponibles,
    periodForDate, periodFromKey, shiftPeriod, periodKeyForToday, periodLabel, inPeriod,
    weekKey, weekLabel,
    ingresoFijoActivoEnPeriodo, ingresosFijosActivos, ingresosFijosVigentesHoy,
    guardarIngresoFijo, eliminarIngresoFijo,
    librePersona, gastosVariablesPersona, ahorroPersona, ahorroTotalPeriodo, historicoAhorro,
    ingresoFijoPorMoneda, ingresoExtraPorMoneda, gastoFijoPorMoneda, gastoVariablePorMoneda,
    combinarPorMoneda,
    historicoReportes, resolveDia, desgloseQuincenas
  };
})();
