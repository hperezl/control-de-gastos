window.CDG = window.CDG || {};
CDG.Controllers = CDG.Controllers || {};

(function () {
  const U = CDG.Utils;

  /* Generic wiring for the registro form (usuarios add/remove, corte toggle, save).
     Shared by the onboarding screen and the Configuración tab. */
  function wireRegistroForm(root, prefix, initialConfig, onSave) {
    let usuarios = initialConfig.usuarios.slice();
    const $ = (id) => root.querySelector("#" + prefix + id);

    function renderUsuarios() {
      $("UsuariosList").innerHTML = CDG.Views.Registro.usuariosListHtml(usuarios);
      $("UsuariosList").querySelectorAll("[data-remove-usuario]").forEach(btn => {
        btn.onclick = () => { usuarios.splice(+btn.dataset.removeUsuario, 1); renderUsuarios(); };
      });
    }
    renderUsuarios();

    function addUsuario() {
      const input = $("NuevoUsuario");
      const val = input.value.trim();
      if (!val) return;
      if (usuarios.includes(val)) { U.toast("Ese usuario ya existe"); return; }
      usuarios.push(val);
      input.value = "";
      renderUsuarios();
      input.focus();
    }
    $("AddUsuario").onclick = addUsuario;
    $("NuevoUsuario").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addUsuario(); }
    });

    $("CorteActivo").addEventListener("change", (e) => {
      $("DiaCorteWrap").style.display = e.target.checked ? "" : "none";
    });

    $("Guardar").onclick = () => {
      if (usuarios.length === 0) { U.toast("Agrega al menos un usuario"); return; }
      const corteActivo = $("CorteActivo").checked;
      let diaCorte = initialConfig.diaCorte;
      if (corteActivo) {
        diaCorte = parseInt($("DiaCorte").value, 10);
        if (isNaN(diaCorte) || diaCorte < 1 || diaCorte > 28) {
          U.toast("Día de corte inválido (usa un valor entre 1 y 28)");
          return;
        }
      }
      onSave({
        nombreControl: $("Nombre").value.trim(),
        usuarios,
        corteActivo,
        diaCorte
      });
    };
  }

  function init(onComplete) {
    const screen = document.getElementById("registroScreen");
    const config = CDG.Model.state.config;
    screen.innerHTML = `
      <div class="registro-card">
        <h1>Configura tu control de gastos</h1>
        <p class="hint">Registra quiénes van a compartir este control y, si aplica, la fecha de corte de la tarjeta de crédito que se usará para dividir los reportes mensuales.</p>
        ${CDG.Views.Registro.render(config, "reg", "Guardar y continuar")}
      </div>
    `;
    wireRegistroForm(screen, "reg", config, (data) => {
      const st = CDG.Model.state;
      st.config.nombreControl = data.nombreControl;
      st.config.usuarios = data.usuarios;
      st.config.corteActivo = data.corteActivo;
      st.config.diaCorte = data.diaCorte;
      st.config.registrado = true;
      CDG.Model.save();
      U.toast("¡Listo! Control configurado");
      onComplete();
    });
  }

  CDG.Controllers.wireRegistroForm = wireRegistroForm;
  CDG.Controllers.Registro = { init };
})();
