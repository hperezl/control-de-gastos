window.CDG = window.CDG || {};

CDG.Utils = (function () {
  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }
  function escapeHtml(s) {
    return (s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function fmtCRC(v) { return "₡ " + Math.round(v).toLocaleString("es-CR"); }
  function fmtUSD(v) { return "$ " + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtMoneda(v, moneda) { return moneda === "USD" ? fmtUSD(v) : fmtCRC(v); }
  function fechaLegible(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("es-CR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
  function clampDay(day, year, month) { return Math.min(day, daysInMonth(year, month)); }
  function isoDate(d) {
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 10);
  }

  /* Two-way currency toggle used instead of a native <select> in forms: native
     dropdown popups position unreliably on some mobile browsers (Android
     Chrome in particular) when the trigger sits inside a scrollable modal. */
  function monedaSegHtml(id, selected) {
    return `<div class="seg-group compact" id="${id}">
      <button type="button" class="seg-btn ${selected === "USD" ? "" : "active"}" data-moneda="CRC" title="Colones">₡ CRC</button>
      <button type="button" class="seg-btn ${selected === "USD" ? "active" : ""}" data-moneda="USD" title="Dólares">$ USD</button>
    </div>`;
  }
  function wireMonedaSeg(root, id) {
    const group = root.querySelector("#" + id);
    group.querySelectorAll("[data-moneda]").forEach(btn => {
      btn.onclick = () => group.querySelectorAll("[data-moneda]").forEach(b => b.classList.toggle("active", b === btn));
    });
    return () => group.querySelector(".active").dataset.moneda;
  }

  function getThemeChoice() { return localStorage.getItem("cdg_theme") || "system"; }
  function applyTheme(choice) {
    if (choice === "dark" || choice === "light") {
      document.documentElement.setAttribute("data-theme", choice);
      localStorage.setItem("cdg_theme", choice);
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("cdg_theme");
    }
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function closeModal() {
    const overlay = document.getElementById("overlay");
    const modalBody = document.getElementById("modalBody");
    if (!overlay) return;
    overlay.classList.remove("open");
    modalBody.innerHTML = "";
  }
  function openModal(html, onMount) {
    const overlay = document.getElementById("overlay");
    const modalBody = document.getElementById("modalBody");
    modalBody.innerHTML = html;
    overlay.classList.add("open");
    if (onMount) onMount(modalBody);
  }
  function confirmDelete(msg, cb) {
    openModal(`
      <h3>Confirmar</h3>
      <p style="font-size:13px;color:var(--text-secondary)">${msg}</p>
      <div class="modal-actions">
        <button id="cdCancel">Cancelar</button>
        <button class="primary" id="cdOk" style="background:var(--critical);color:var(--accent-ink)">Eliminar</button>
      </div>
    `, (root) => {
      root.querySelector("#cdCancel").onclick = closeModal;
      root.querySelector("#cdOk").onclick = () => { cb(); closeModal(); };
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const overlay = document.getElementById("overlay");
    if (overlay) overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  });

  return {
    uid, escapeHtml, fmtCRC, fmtUSD, fmtMoneda, fechaLegible,
    daysInMonth, clampDay, isoDate,
    monedaSegHtml, wireMonedaSeg,
    getThemeChoice, applyTheme,
    toast, openModal, closeModal, confirmDelete
  };
})();
