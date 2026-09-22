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
- **Ingresos fijos con versionado temporal**: editar/eliminar un ingreso fijo que ya fue
  usado por un periodo cerrado no lo sobrescribe — cierra esa versión (`vigenteHasta`) y
  crea una nueva vigente desde el periodo actual en adelante (`M.guardarIngresoFijo` /
  `M.eliminarIngresoFijo`). Así los reportes de meses cerrados no cambian.
  **Gastos fijos y rebajos NO están versionados** (limitación conocida y aceptada:
  editarlos afecta retroactivamente todo el histórico de ahorro).
- **Ingreso extra**: ingreso puntual atado a una fecha/periodo específico, no se repite
  solo automáticamente el siguiente periodo (`state.ingresosExtra`).
- **Ahorro es calculado, no manual**: `Ahorro = Libre (ingreso fijo+extra − rebajos −
  gastos fijos) − gastos variables del periodo`. No hay CRUD de "aportes de ahorro"; la
  pestaña Ahorro solo muestra el cálculo por persona y un histórico periodo a periodo
  (`M.historicoAhorro`, recorre desde el primer dato hasta hoy).

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
(`--series-cat-1/2/3`, azul/aqua/amarillo) porque el rojo/verde ya son semánticos
(gasto/ingreso) — capado a 3 categorías + "Otros" por seguridad de daltonismo en gráficos
tipo pie (ver comentario en `chart.js`).

## Responsive

Breakpoint 860px: nav de pestañas → menú hamburguesa (☰, `#menuToggle`). Breakpoint
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

<!-- cloude-code-toolbox:mcp-skills-awareness-begin -->

### MCP & Skills awareness (Cloude Code ToolBox)

_Last synced: 2026-09-21T20:48:31.505Z._

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
