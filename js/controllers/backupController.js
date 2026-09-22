window.CDG = window.CDG || {};
CDG.Controllers = CDG.Controllers || {};

/* Backup lives inside the Settings modal (gear icon), not its own tab.
   wire(root) re-binds every time the modal is opened, since its HTML is
   rebuilt from scratch on each open. */
CDG.Controllers.Backup = (function () {
  const U = CDG.Utils;
  const M = CDG.Model;

  function exportJson() {
    const blob = new Blob([JSON.stringify(M.state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `control-de-gastos-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    U.toast("Respaldo exportado");
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        M.replaceState(parsed);
        U.closeModal();
        CDG.App.onDataReplaced();
        U.toast("Datos importados");
      } catch (e) {
        U.toast("Archivo inválido");
      }
    };
    reader.readAsText(file);
  }

  function wire(root) {
    root.querySelector("#exportBtn").addEventListener("click", exportJson);
    root.querySelector("#importBtn").addEventListener("click", () => root.querySelector("#importFile").click());
    root.querySelector("#importFile").addEventListener("change", (e) => {
      if (e.target.files[0]) importJson(e.target.files[0]);
      e.target.value = "";
    });
    root.querySelector("#resetBtn").addEventListener("click", () => {
      U.confirmDelete("Esto borrará todos los usuarios, movimientos, ingresos/gastos fijos y ahorros guardados. Esta acción no se puede deshacer.", () => {
        M.resetAll();
        CDG.App.onDataReplaced();
        U.toast("Datos borrados");
      });
    });
  }

  return { wire };
})();
