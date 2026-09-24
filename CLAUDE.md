# Claude Code — project context

## Qué es esto

Control de gastos compartido para un hogar (ej. Heiner/Suy), inspirado en una hoja de
cálculo de presupuesto. App **estática, sin backend ni build step**: HTML + CSS + JS
puro, pensada para abrir con doble clic (`file://`) o servida desde GitHub Pages.

**Entry point:** `index.html`. Este archivo actualiza este documento cuando se
toman decisiones de arquitectura nuevas — no hace falta releer todo el código para
retomar el contexto, basta este archivo.

## Arquitectura (MVC, sin frameworks)

```
index.html                        shell: solo HTML + <script> tags (sin lógica)
css/styles.css                    todos los estilos + variables de color (tema claro/oscuro)
js/model.js                       Model: estado, localStorage, Firestore sync, cálculos de dominio
js/utils.js                       helpers compartidos (formato, modal, toast, moneda-toggle)
js/chart.js                       gráficos SVG a mano (barras semanales, donut de categorías)
js/firebase.js                    CDG.Cloud: wrapper de Firebase Auth + Firestore
js/firebase-config.js             llaves del proyecto Firebase (públicas por diseño, ver comentario ahí)
js/views/registroView.js          formulario de usuarios/corte, reutilizado por onboarding y Configuración
js/controllers/*.js               un controlador por sección (login, registro, settings, resumen,
                                   movimientos, fijos, ahorro, backup) — cada uno wire + render
js/app.js                         Controller principal: routing (login→registro→dashboard),
                                   tabs, navegador de periodo, tema, orquestación de sync con la nube
```

`<script>` clásicos (no ES modules) a propósito, para que `file://` siga funcionando sin
bloqueos de CORS. Cache-busting: todos los `<link>`/`<script>` locales llevan
`?v=YYYYMMDDx` en `index.html` — súbele la letra cada vez que edites CSS/JS para forzar
recarga en el navegador del usuario (no confiar en que refresque solo).

## Conceptos de dominio clave

- **Periodos, no meses calendario**: si el usuario activa "fecha de corte de tarjeta"
  (día 1–28) en el registro/Configuración, todos los reportes usan periodos día(corte+1)
  → día(corte) del mes siguiente, en vez de mes calendario. Ver `M.periodForDate` /
  `M.periodForKey` / `M.shiftPeriod` en `model.js`. El navegador ◀ periodo ▶ del header
  controla qué periodo se está viendo en Resumen/Movimientos/Fijos/Ahorro.
- **Movimientos = solo gastos variables** (categoría fija + descripción corta opcional).
  Los ingresos NO viven aquí.
- **Persona "Compartido" en Movimientos**: cuando hay 2+ usuarios, `M.personasDisponibles()`
  agrega una opción extra `"Compartido"` al `<select>` de Persona (`model.js`, no es un
  usuario real de `config.usuarios`). **Ya existía la opción en el dropdown antes de
  2026-09-24**, pero antes se guardaba tal cual como un solo `movimiento` con
  `persona: "Compartido"` — como ninguna función de por-persona filtra por ese nombre
  (`gastosVariablesPersona`, `gastoVariablePorMoneda`, etc. hacen `m.persona === persona`),
  ese gasto contaba en los totales del periodo pero no se le atribuía a nadie en Resumen/
  Ahorro por persona. Desde 2026-09-24, elegir "Compartido" y guardar reparte el monto
  entre los usuarios reales (`M.state.config.usuarios`, no `personasDisponibles()` —
  excluye el pseudo-usuario "Compartido" en sí) creando un `movimiento` independiente por
  persona con `Math.ceil(monto / cantidadUsuarios)` — sin decimales, siempre redondeado
  hacia arriba (el total repartido puede quedar levemente por encima del original, nunca
  por debajo). Aplica tanto al crear como al editar (editar un gasto y cambiarlo a
  "Compartido" borra el registro único y lo reemplaza por los N repartidos). Son
  registros independientes sin id de grupo — editar o borrar uno de los repartidos después
  no afecta a los demás. Cada mitad repartida lleva `compartido: true` (campo nuevo,
  aditivo) — es lo que permite que el filtro "Compartido" de la tabla de Movimientos siga
  funcionando aunque ningún `movimiento` real tenga ya `persona: "Compartido"`: ese filtro
  compara `m.compartido` en vez de `m.persona` (ver `render()` en
  `movimientosController.js`). Si se edita una mitad repartida y se le pone una persona
  normal (no "Compartido") al guardar, pierde la marca `compartido` — deja de contarse
  como parte de un gasto compartido, a propósito (ya se desligó del reparto original).
- **Ingresos fijos con versionado temporal**: editar/eliminar un ingreso fijo que ya fue
  usado por un periodo cerrado no lo sobrescribe — cierra esa versión (`vigenteHasta`) y
  crea una nueva vigente desde el periodo actual en adelante (`M.guardarIngresoFijo` /
  `M.eliminarIngresoFijo`). Así los reportes de meses cerrados no cambian.
  **Gastos fijos NO están versionados** (limitación conocida y aceptada: editarlos afecta
  retroactivamente todo el histórico de ahorro).
- **Ingreso extra**: ingreso puntual atado a una fecha/periodo específico, no se repite
  solo automáticamente el siguiente periodo (`state.ingresosExtra`).
- **Rebajos: eliminado por completo** (2026-09-22, a pedido explícito). Ya no hay tarjeta,
  modal, ni resta en el cálculo de Neto/Libre. `state.rebajos` sigue existiendo en el
  esquema de datos por si algún usuario tenía registros ahí (no se borran, regla de
  "aditivo no destructivo" de abajo), pero nada los lee ni los muestra — si vuelve a
  pedirse esta función, hay que reconstruirla desde cero, no reactivar el código viejo.
- **"Neto" vs "Libre" en Resumen** (renombrado 2026-09-22, antes ambos se llamaban
  "Libre" y confundía): `Neto = ingreso fijo+extra − gastos fijos` (punto de partida,
  antes de gastar); `Libre = Neto − gastos variables del periodo` (lo que realmente queda
  ahora). `M.librePersona()` sigue devolviendo el `Neto` en su campo `.libre` por
  compatibilidad — quien lo consuma debe restar `gastosVariablesPersona()` aparte si
  quiere el "Libre" real (ver `personaResumenHtml` en `resumenController.js`).
- **Ahorro es calculado, no manual**: mismo cálculo que "Libre" de arriba pero a nivel
  periodo/total. No hay CRUD de "aportes de ahorro"; la pestaña Ahorro solo muestra el
  cálculo por persona y un histórico periodo a periodo (`M.historicoAhorro`, recorre
  desde el primer dato hasta hoy).
- **Desglose por quincena**: `ingresosFijos`/`gastosFijos` tienen un campo numérico
  `dia` (1–31, opcional) — quincena 1 = día 1–15, quincena 2 = día 16–31, sin relación
  con la fecha de corte de tarjeta (son dos conceptos independientes). Registros viejos
  solo tenían `periodo` como texto libre ("Día 13"); `M.resolveDia()` extrae el número de
  ahí como respaldo si `dia` no está seteado. `M.desgloseQuincenas(persona, period)`
  calcula ingreso/gasto/aporte por quincena, mostrado debajo de cada persona en Resumen
  (también consciente de moneda, ver bullet siguiente).
- **Montos "conscientes de moneda" en Resumen** (2026-09-22): las tarjetas de Ingreso
  fijo/extra, Gastos fijos, Gastos variables, Neto, Libre y las de quincena YA NO
  convierten ciegamente a ₡ — si el monto está 100% en $, se muestra en $ con "≈ ₡..."
  abajo en chico; si hay mezcla de $ y ₡ (ej. algunos gastos fijos en cada moneda), se
  parte en dos tarjetas/líneas, una por moneda, cada una con su propio color según signo.
  Funciones clave en `model.js`: `sumaPorMoneda`, `ingresoFijoPorMoneda`,
  `ingresoExtraPorMoneda`, `gastoFijoPorMoneda`, `gastoVariablePorMoneda`,
  `combinarPorMoneda` (combina varios desgloses con signo, ej. Neto = ingreso − gastoFijo
  sin pasar por conversión). **Importante: esto es solo presentación** — las tarjetas
  agregadas de arriba de Resumen ("Ingreso neto del periodo", "Balance", "Ahorro
  acumulado") y Reportes siguen sumando todo convertido a ₡ vía `librePersona()`
  (que internamente usa `toColones()` sin cambios); nunca tocar esa función al extender
  el desglose por moneda a una vista nueva — crear un helper `xPorMoneda` aparte, como
  los de arriba.
- **Excepción a "nunca mezclar monedas" — la tarjeta "Libre" sí convierte** (2026-09-24,
  a pedido explícito): con la regla de arriba, si el ingreso fijo de una persona era
  100% en $ y sus gastos variables del periodo estaban en ₡, "Libre" se partía en dos
  tarjetas — "Libre ($)" con el Neto normal, y una "Libre (₡)" suelta y negativa (ej.
  "-₡5 000 · Neto − gastos variables") sin ningún ingreso en ₡ que la compense, lo cual
  se veía como un error. Se pidió que en vez de eso, el gasto variable en la moneda
  distinta se convierta a la moneda del ingreso fijo ("moneda de casa") y se reste ahí,
  dejando una sola tarjeta "Libre" en esa moneda con la conversión "≈" abajo — igual que
  cualquier tarjeta de una sola moneda. Implementado en `libreCardHtml()`
  (`resumenController.js`) + `M.toDolares()` (nuevo, inverso de `toColones`, en
  `model.js`). Esto **solo aplica cuando el ingreso fijo de la persona es 100% de una
  moneda** (no mezclado entre $ y ₡ él mismo) — si el propio Neto ya está mezclado, no
  hay una "moneda de casa" clara y se mantiene el desglose de dos tarjetas de siempre.
  Las tarjetas agregadas de arriba de Resumen y Reportes no cambian (siguen sin tocar
  `librePersona()`/`toColones()`, ver bullet anterior).
- **Categorías de gasto**: "Familia" se reemplazó por "Familia materna" y "Familia
  paterna" (2026-09-22, en `CATEGORIAS_GASTO` de `model.js`). Gastos viejos guardados con
  categoria="Familia" conservan ese texto tal cual (se siguen viendo bien en la tabla),
  pero ya no aparece como opción en el `<select>` — si alguien edita uno de esos gastos
  viejos, tiene que elegir una categoría nueva al guardar.
- **Pestaña Reportes**: histórico de TODOS los periodos con datos (no solo el que se está
  viendo), filtrable por uno específico o "Todos". Usa `M.historicoReportes()` /
  `M.periodosConDatos()` (el mismo generador de periodos que ya usaba `historicoAhorro`,
  refactorizado para reusarse). No depende del navegador ◀ periodo ▶ del header. La
  columna "Gastos" incluye gastos fijos + variables (corregido 2026-09-22; antes solo
  sumaba variables, lo que hacía que "Balance" no coincidiera con "Ahorro" del mismo
  periodo — ahora sí coinciden, son la misma cifra vista desde dos ángulos).
- **Regla no escrita pero seguida hasta ahora: los cambios de esquema son aditivos, nunca
  destructivos.** Ningún cambio de código borra o sobrescribe datos existentes del
  usuario — campos nuevos (ej. `dia` en fijos) se agregan junto a los viejos (`periodo`),
  nunca los reemplazan, y `resolveDia()` es el patrón a seguir: leer el campo nuevo, si no
  existe usar el viejo como respaldo. `M.resetAll()` solo se dispara con una confirmación
  explícita del usuario en la UI (botón "Borrar todos los datos" en Configuración) — nunca
  como parte de una migración o actualización de código. Mantener esto así en cambios
  futuros: los usuarios ya tienen datos reales en producción (ver conversación del
  2026-09-22, "no le elimina datos" / "que otro usuario se pueda registrar...").

## Nube (Firebase) — opcional, con fallback local

Registro **abierto** (cualquiera con el link puede crear cuenta, decisión explícita del
usuario pese a la advertencia). Por eso cada cuenta tiene su **propio documento aislado**
en Firestore: `controles/{uid}`, no uno compartido — ver `docRef()` en `firebase.js`. La
regla de seguridad (`request.auth.uid == userId`) es lo que realmente aplica ese
aislamiento; el código solo no basta. Si dos personas SÍ quieren compartir un control, lo
hacen a propósito usando el mismo correo/contraseña — la app no lo asume por defecto.
(Versión anterior: un solo documento `controles/principal` compartido por todos los que
iniciaran sesión — se abandonó por el registro abierto, ver conversación del
2026-09-22.) `localStorage` sigue siendo la caché rápida/offline; `M.save()` escribe a
ambos si hay sesión. Si `js/firebase-config.js` sigue con llaves de ejemplo (`"TU_..."`),
`CDG.Cloud.init()` devuelve `false` y la app cae automáticamente a modo 100% local (sin
pantalla de login) — esto es intencional, no un bug. Incluye "olvidé mi contraseña"
(Firebase envía el correo y aloja la página de reset) y "crear cuenta" en la misma
pantalla de login. No se agregó cifrado propio de la app (decisión explícita del
usuario): se confía en el cifrado en tránsito/reposo que Firebase ya da por defecto.

## Diseño

Paleta de marca personalizada (no la del skill de dataviz por defecto): rojo `#DF1C1C`
(acento/CTA/gastos), gris `#F1F3F5` (fondo), blanco (tarjetas), gris asfalto `#121826`
(texto), verde `#10B981`/`#047857` (ingresos, dos pasos por contraste). Variables CSS en
`:root` / `@media (prefers-color-scheme: dark)` / `:root[data-theme="dark"]` en
`styles.css`. El donut de categorías usa una sub-paleta categórica validada aparte
(`--series-cat-1..8`, las 8 tonalidades fijas del skill de dataviz en su orden
validado: azul/naranja/aqua/amarillo/magenta/verde/violeta/rojo) porque el rojo/verde
del branding ya son semánticos (gasto/ingreso) — capado a 8 categorías + "Otros" antes de
caer a gris (ver comentario en `chart.js`). Se usa el check de "pares adyacentes" del
skill (no "todos los pares") porque en un donut ordenado por valor cada gajo solo
toca a su vecino inmediato, no a los demás — antes estaba capado a solo 3 categorías
(criterio más estricto, pensado para scatter/choropleth) y por eso categorías como
"Familia materna"/"Familia paterna" cabían casi siempre en "Otros" (corregido
2026-09-24).

## Responsive

Breakpoint 860px: nav de pestañas → menú hamburguesa (☰, `#menuToggle`, 2026-09-24
rediseñado como drawer de ancho completo + negro sólido): en vez de empujar el
contenido hacia abajo, `nav.tabs` se posiciona `absolute` (ancla
`.app{position:relative}`) con `top:0; left:0; right:0` — tapa toda la pantalla de
lado a lado y desde arriba cuando está abierto, con `background:#000` fijo (no usa las
variables de tema, es negro sólido siempre, claro u oscuro), `box-shadow` marcado y una
animación `transform: translateX(...)` de 0.5s. Al ser `position:absolute` con
`z-index`, el drawer tapa el header (`position:static`) que queda debajo simplemente
por las reglas normales de stacking — no hace falta elevar ni recolorear el header por
separado.

El título ("Control de Gastos" + el tipo de cambio) y el botón de cerrar **viven de
verdad dentro de `nav.tabs`**, como primer hijo (`.nav-drawer-head`, oculto salvo con
`nav.tabs.open`) — **no** es el header original reposicionado con trucos de z-index (esa
primera versión dejaba una costura/salto visible entre el título y "Resumen", y el
tipo de cambio se ocultaba de golpe en vez de tener su propio lugar). El botón
`#menuToggle` (☰, en el header, siempre visible) abre el menú; el botón `#menuCloseBtn`
(✕, dentro de `.nav-drawer-head`) lo cierra — son dos botones distintos a propósito,
porque el que abre tiene que seguir accesible con el drawer cerrado (fuera de
`nav.tabs`, que en ese estado está fuera de pantalla) y el que cierra tiene que
verse "dentro" del panel negro. El tipo de cambio aparece **duplicado** (un
`<span class="fx-ticker">` en el header de siempre y otro dentro de
`.nav-drawer-head`, ninguno con display condicionado) — `M.renderFxTicker()` en
`app.js` ya no apunta a un solo id, itera `document.querySelectorAll(".fx-ticker")`
para mantener ambos sincronizados. Al no ocultar/mostrar nada dinámicamente, abrir el
menú no reacomoda ni "brinca" el header original — el drawer simplemente lo tapa
encima, quieto. Los botones de Configuración y Cerrar sesión del header
(`#settingsBtn`/`#logoutBtn`) se ocultan en
mobile (`display:none !important` dentro del media query) y se duplican dentro del
propio `nav.tabs` como `#menuSettingsBtn`/`#menuLogoutBtn` (sección `.nav-menu-extra`,
oculta en desktop) — así solo se ven cuando el menú está desplegado. Como estos botones
nuevos viven dentro de `nav.tabs` pero no son pestañas, los selectores de `app.js` que
antes eran `"nav.tabs button"` se acotaron a `"nav.tabs button[data-tab]"` (si no, el
listener de cambio de pestaña los agarraba también y rompía el panel activo). Breakpoint
640px: las tablas (`class="stack-mobile"` + `data-label` en cada `<td>`) se apilan en
tarjetas "Etiqueta: valor" en vez de scroll horizontal. Afinado extra a 420px para
soportar hasta 360px de ancho. Selects de Moneda (solo 2 opciones) son un toggle
propio (`U.monedaSegHtml`/`wireMonedaSeg`), no un `<select>` nativo — los pickers
nativos de 2 opciones se posicionan mal en algunos navegadores móviles. Persona/
Categoría sí siguen siendo `<select>` nativo (muchas opciones, funciona bien).

## Cómo correr en desarrollo

```
python3 -m http.server 8765   # desde la raíz del proyecto
open http://localhost:8765/index.html
```
(`file://` también funciona para todo excepto Firebase, que requiere http(s).)

## Despliegue (producción)

- **Repo:** `https://github.com/hperezl/control-de-gastos.git`, rama `main`. Servido gratis
  por **GitHub Pages** desde la raíz (`/ `) del repo →
  `https://hperezl.github.io/control-de-gastos/`.
- **`git push` no funciona desde este entorno**: no hay credenciales de GitHub
  configuradas aquí (falló con "could not read Username"), y la cuenta del usuario no
  tiene `gh` ni Homebrew instalados. La forma que sí funciona, probada varias veces: subir
  archivos a mano por la web de GitHub — **"Add file" → "Upload files"**, arrastrando
  `index.html` y las carpetas `css`/`js` completas (arrastrar las carpetas, no su
  contenido suelto, para que GitHub conserve la estructura de subcarpetas) → "Commit
  changes". Repetir esto cada vez que haya cambios de código para reflejarlos en
  producción.
- **Antes de cada subida**: subir el sufijo de cache-busting (`?v=YYYYMMDDx`) en
  `index.html` — si no, el navegador del usuario puede seguir sirviendo JS/CSS viejo desde
  caché aunque el archivo en GitHub ya esté actualizado. Si después de subir y recargar el
  usuario sigue viendo comportamiento viejo, **probar primero en una ventana de
  incógnito** antes de asumir que hay un bug real — varias veces el código ya estaba
  correcto en el servidor y el problema era solo caché del navegador (verificable con
  `curl` contra la URL en vivo para confirmar qué hay realmente publicado).
- **El git local** (`.git` en esta carpeta) tiene un commit inicial hecho por Claude, con
  identidad local propia (`git config user.name/email`, solo para este repo — no toca la
  config global de trabajo del usuario, que es distinta). Ese commit **nunca se pudo
  pushear** (por la falta de credenciales) — todo lo que está en producción llegó por el
  método de subida manual de arriba, así que el historial de GitHub y el git local de esta
  carpeta están desincronizados. No asumir que `git log`/`git status` local refleja lo que
  hay en producción — para eso, verificar con `curl` contra la URL de GitHub Pages.
- **Proyecto Firebase:** `control-gastos-b947a` (plan Spark/gratis). Reglas de Firestore
  ya publicadas: cada cuenta solo puede leer/escribir `controles/{su-propio-uid}` (ver
  regla exacta en la sección "Nube" arriba). Dominio `hperezl.github.io` ya autorizado en
  Authentication → Settings → Authorized domains.




<!-- cloude-code-toolbox:mcp-skills-awareness-begin -->

### MCP & Skills awareness (Cloude Code ToolBox)

_Last synced: 2026-09-24T21:20:06.089Z._

- **Full report:** `.claude/cloude-code-toolbox-mcp-skills-awareness.md` in this workspace (auto-overwritten on each scan). Use it as ground truth for configured servers and skill folders.
- **MCP:** For **live tools** in Claude Code, enable the matching server via `/mcp`. Servers are configured in `~/.claude.json` (user) and `.mcp.json` (project).
- **When the user’s task matches a server** (e.g. Confluence work and a **Confluence** / **Atlassian** MCP is listed), **prefer that server id** and plan on tool use—not only file search.
- **Skills:** Folders below contain `SKILL.md`; attach or cite paths in chat when relevant.

#### Workspace MCP

- `/Users/jeiperez/Documents/control_de_gastos/.mcp.json` _(workspace: control_de_gastos)_ — _file missing_

_No active workspace servers in mcp.json._

#### User MCP

- `/Users/jeiperez/.claude.json` — _no servers defined_

_No active user-scoped servers in mcp.json._

#### Project skills

_None found (or no workspace open)._

#### User skills

_None found._

<!-- cloude-code-toolbox:mcp-skills-awareness-end -->
