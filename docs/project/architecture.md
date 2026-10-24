# Arquitectura — ralph-suite

> Última actualización: 19 de octubre de 2026. Migrado de `plans/arquitectura.md` y `plans/decisiones.md`; los ADR vigentes viven en `docs/adr/`. Convención vigente: `docs/` es la única documentación de proyecto.

## Stack

- TypeScript
- Node.js
- VS Code Extension API
- Webview (HTML/CSS/vanilla JS, sin framework)
- Almacenamiento JSON local: `docs/ralph/prd.json` (backlog), `.ralph/` (runtime), `.agent/memories.md` (memoria estable)
- Tests: Mocha + ts-node con mock local de `vscode` (`src/test/vscodeMock.js`)

## Estructura

```
src/
  extension.ts          — activate/deactivate mínimo; la lógica vive en activate.ts
  activate.ts           — registro de comandos y watchers
  kanbanPanel.ts        — KanbanPanel: ciclo de vida del webview, runner y message handler
  prdManager.ts         — acceso centralizado al PRD: normalización defensiva, escritura atómica (temporal + rename)
  stateManager.ts       — estados locales, rutas seguras (.ralph/), promoción de memoria estable
  contextInjector.ts    — inyección de memoria por secciones (ADR-002)
  promptBuilders.ts     — buildPrompt, buildInitPrompt, inferTaskType, resolveAgentProfile
  agentsMdBuilders.ts   — builders de AGENTS.md y docs del proyecto
  alfredIdentity.ts     — detección y validación de la identidad Alfred (ADR-018)
  alfredPrompt.ts       — prompts en modo Alfred
  builtinIdentity.ts, boardSanitizers.ts, catalogInstaller.ts, chatLauncher.ts,
    healthScore.ts, i18n.ts, sidebarTree.ts, workspaceFolders.ts, workspaceRoot.ts, workspaceTrust.ts
  commands/             — alfredPalette, menu, project, syncIssue, task (runTaskWithRetry), memory
  kanban/               — analyzeProject, contextRefresh, dependencyGraph, gitHubSync, planImport
  security/             — secretHook
  webview/              — kanbanHtml: HTML/JS del tablero con escape explícito (esc/escAttr)
docs/
  adr/                  — log de decisiones (ADR-016…ADR-018)
  project/              — architecture, threat-model, compliance, status (esta convención)
  ralph/prd.json        — backlog (fuente de verdad del backlog)
.ralph/                 — runtime por tarea (logs y señales), gitignored
.agent/memories.md      — memoria estable (secciones Project, Conventions, Decisions, Known Issues)
```

## Decisiones clave

Vigentes:

- **Backlog vs runtime vs memoria (ADR-009):** `prd.json` es el backlog; `.ralph/` el estado de ejecución; `.agent/memories.md` la memoria estable. Solo `DECISION:`, `MEMORIA:`, `BUG:` y `CONVENCION:` promocionan contenido a memoria.
- **Inyección de memoria por secciones (ADR-002):** Core y Conventions siempre; Decisions solo si la tarea depende de ellas; Task History nunca automática.
- **Acceso centralizado al PRD (ADR-013):** `PrdManager.loadRaw/saveRaw/mutateRaw` con escritura atómica. `ralph-suite.prdPath` por defecto `docs/ralph/prd.json`; si falta, carga el `prd.json` legado de la raíz.
- **Sanitización webview (ADR-010) e IDs seguros (ADR-011):** escape HTML/atributos/JS y allowlist de mensajes entrantes. `safeTaskId` valida literalmente `[A-Za-z0-9_.-]{1,80}` en toda ruta `.ralph/task-<ID>-*`: rechaza, no transforma. La carga rechaza IDs inválidos y duplicados (incluidas colisiones de mayúsculas/minúsculas); no renombra ni migra. Las dependencias son literales y se evalúan después de aplicar todos los overrides runtime.
- **Tests Node con mock de VS Code (ADR-012):** los tests corren en Node sin `vscode-test`.
- **Ajustes coherentes (ADR-015):** eliminados `autoRun` y `memoryOptimizeAutoApply`; `memoriesPath` cableado con protección anti path traversal y fallback a `.agent/memories.md`.
- **Dispatch paralelo (ADR-016):** solo `ralph-suite.syncIssue` (mapeo explícito `github:#N` / `owner/repo#N`, escribe solo `.ralph`, nunca `prd.json`). Runner serial; el paralelismo futuro exige un scheduler propiedad de Ralph con lease por tarea, concurrencia limitada, abort por tarea y recuperación idempotente.
- **Reserva de ejecución Ralph (fase 1):** una reserva síncrona global por instancia de extensión cubre `runTask` manual y autorunner en todas las raíces del chat compartido; no coordina otras ventanas y no cancela el agente remoto. Un fallo inequívoco antes de `chat.open` libera la reserva; timeout, abort o parada tras iniciar el envío se considera estado desconocido, conserva la reserva y bloquea nuevos envíos/avance automático. Solo una recuperación explícita, tras pedir al usuario comprobar y detener el agente anterior, la libera; cancelar conserva el bloqueo. No hay reintentos automáticos de trabajo que pudo enviarse (`taskRetries` sigue siendo una opción compatible, pero no se usa para relanzar esos casos). Sin ID de intento en el protocolo runtime, una señal tardía tras recuperar sigue siendo indistinguible de la del intento nuevo.
- **`modelProfiles` simplificado (ADR-017, supersede parcialmente ADR-007):** Ralph recomienda `engine`/`model`/`mode` con vocabulario propio (defaults `model: ""`, modos `execute|review`), inyectado en el prompt; sin router de Chat ni paleta Alfred.
- **Continuidad Alfred ↔ Ralph (alineación ADR-018/019/020/021):** la identidad integrada enruta `runTask` a `alfred`; el DTO externo sigue decidiendo su propio rol y `alfredMode: off` conserva la ruta anterior. El prompt con contexto Ralph validado transmite un contrato inmutable (`kind`, `localTaskId`, `workspaceRoot`, `scope`, `gates`, `closureOwner`): cada ejecutor devuelve evidencia y solo el dueño de cierre del padre escribe ambas señales tras completar alcance y gates. La reconciliación previa consulta las fuentes actuales y el backlog configurado sin editarlo; un alta pendiente requiere UI y autorización del maintainer, no una API agéntica inexistente. El trabajo ad hoc independiente no inventa ID ni señales. Los doce perfiles del catálogo conservan sus roles y herramientas sin binding `model`; el host elige el modelo, sin preferencias automáticas por rol ni sustitución genérica silenciosa. Estas instrucciones guían al agente, no imponen enforcement determinista de su conducta ni de gates desde el host; `task_complete` no actualiza el tablero. No se añade bridge ni API de alta.
- **Modo Alfred (ADR-018):** `ralph-suite.alfredMode` (`auto|off`) se lee por acción, sin caché. Detección por id de extensión + comando anunciado `alfred-dev.ralph.announceIdentity`; DTO fail-closed que solo acepta `agent`/`mention`/`preamble` (si trae `provider` o `model` se rechaza entero). Se silencia lo que compite con la identidad (guardrails, boundaries, agentRole/Stack/Project, engine/modelProfiles, checkpoints) y se conserva el protocolo y runtime Ralph. `AGENTS.md` tiene un solo dueño: en modo Alfred, `setupProject` queda bloqueado y no se escribe el paquete. Overrides de usuario con `/plan/` o `plans/`: aviso único por sesión, cero escrituras en `settings.json`.
- **Modularización (ADR-014):** `extension.ts` solo activate/deactivate; la lógica vive en `activate.ts` y módulos por responsabilidad (`commands/`, `kanban/`, builders y managers). Base del layout actual.
- **Perfiles agénticos y salud:** `inferTaskType` clasifica la tarea y `resolveAgentProfile` resuelve la recomendación; `healthScore.ts` (ADR-005) y `kanban/dependencyGraph.ts` (ADR-006) están implementados y expuestos en el tablero.
- **Git checkpoint (ADR-004, opt-in):** `ralph-suite.gitCheckpoint` (default off) crea un commit con mensaje estándar y sin secretos antes de trabajos críticos; riesgo de commits automáticos auditado.

Superadas o no implementadas (heredadas de `plans/decisiones.md`; se conservan como historial, no se borran):

- **ADR-003** (task splitting con `splitSuggestAfterMs`): propuesta nunca implementada; no existe el setting en el código.
- **ADR-001** (stack TypeScript + VS Code Extension API + webview ligero): vigente y realizado; base del Stack de arriba.
- **ADR-007** (prompt templates por tipo de tarea): aceptado en su momento; supersede parcial por ADR-017 (se conserva la inferencia y la inyección; cambian defaults y vocabulario).
- **ADR-008** (resumen de sesión automático al parar el runner): propuesta, sin implementación registrada.
- Registro heredado marcaba ADR-005 y ADR-006 como «proposed»; el código actual ya los implementa.

## Ajustes y comandos

- Ajustes: `ralph-suite.prdPath`, `memoriesPath`, `engine`, `modelProfiles`, `gitCheckpoint`, `alfredMode`, y runtime del runner (`maxLoops`, `taskTimeoutMs`, `taskRetries`, `minWaitMs`, `pollIntervalMs`).
- Integraciones: `ralph-suite.syncIssue` valida labels locales explícitos, pertenencia, unicidad y estados permitidos. Rechaza números compartidos entre tareas o varios números/repositorios en una tarea; conserva la API numérica existente. El botón Sync masivo genera un prompt para listar issues e invocar ese mismo comando con raíz explícita; no admite IDs de cuerpos ni escrituras del chat al filesystem. Sin invocación de comandos no hay sincronización. El repositorio remoto debe identificarse y contrastarse con el label cualificado; `github:#N` sigue siendo no cualificado.
- Estado: mover a «todo» y `syncIssue(todo)` escriben un override `todo`; reset restaura la base del backlog retirando el override. Las dependencias siguen aplicándose. `getStatus` lee una única instantánea (primera línea no vacía) sin reescrituras; valores desconocidos devuelven `todo` sin reparar archivos.
- Secret Guard: instalación solo mediante acción explícita. Wrapper de shell con hook previo en proceso separado, copia exclusiva `pre-commit.alfred-previous` y preservación de códigos de salida; marcador legacy no reconocido exige integración explícita. La corrección local solo se ha ejecutado en fixtures, no se han instalado hooks reales.
- Comandos: `npm run compile` (TypeScript) y `npm test` (Mocha + ts-node con mock de `vscode`).

## Convenciones

- Naming: ficheros fuente `camelCase.ts`; documentación y ADR en `kebab-case`.
- Errores: `extension.ts` con try/catch alrededor de la activación; nunca tumbar el extension host; trazas al OutputChannel de Ralph.
- Config/secrets: todo ajuste vive en `ralph-suite.*`; secretos nunca en el repo ni en logs; tokens enmascarados.
- Documentación: `docs/` es la única convención; en proyectos legacy con `plans/`, su contenido se migra a `docs/` con confirmación del maintainer y no se crea nada nuevo en `plans/`.
- IDs: el ID local (`ISSUE-NNN`) se conserva literal; el mapeo GitHub↔Ralph solo con labels explícitos `github:#N` u `owner/repo#N`.
- Idioma: castellano, conciso, sin relleno.

## Decisiones bloqueadas (no cambiar sin discusión)

- Nunca modificar `prd.json` desde la ejecución agéntica; solo workflows UI/import explícitos.
- Los IDs locales no se renumeran ni migran; nunca inferir `ISSUE-00N` desde GitHub `#N`.
- Runner serial hasta que exista contrato de scheduler con aislamiento y leases (ADR-016).
- Ralph es independiente: no exige Alfred ni lee/escribe ajustes de otras extensiones (ADR-017, ADR-018).
- Un solo dueño de `AGENTS.md` por workspace según el modo (ADR-018).
- `docs/` es la única convención de documentación del proyecto.

## Reconciliación conservadora del catálogo instalado

`src/catalogInstaller.ts` mantiene el mecanismo existente de instalación al
perfil, sin modificar ajustes, permisos ni autenticación del host. El marcador
`.copilot/agents/.alfred-dev-catalog.json` registra `owner`, `version`,
`catalogHash` (SHA-256 del inventario ordenado con hashes de bytes) y `resources`
por ruta relativa del catálogo (`hash` y `version` del último recurso instalado
correctamente). No contiene copias del contenido. La versión y el hash global
solo avanzan si todo el catálogo se reconcilia; los éxitos individuales se
registran también cuando otros recursos fallan. Se conserva el historial de
recursos retirados, sin borrar sus ficheros ni extras locales.

Cada activación relee los bytes reales: instala ausentes, adopta coincidencias
exactas sin reescribir y actualiza únicamente si el destino coincide con su
último hash gestionado. `force` reevalúa, no da permiso para sobrescribir.
Divergencias se preservan y devuelven como conflictos con ruta; los errores
producen avisos de ruta/código, nunca contenido. Versiones superiores detectadas
no se degradan; versiones no comparables se tratan conservadoramente. Se
rechazan enlaces simbólicos/junctions en las rutas y ancestros, nombres con
traversal y destinos con enlaces duros múltiples. El marcador se publica mediante
un fichero exclusivo adyacente y `rename`, sin `unlink` ni reintento destructivo;
un fallo deja la instalación parcial explícita y puede dejar un `.pending`
para inspección manual, sin declararlo marcador válido.

**Migración legacy:** un marcador con solo versión (incluido `1.12.6`) no prueba
la autoría de los bytes instalados. Solo se adopta un destino idéntico al nuevo
catálogo; cualquier otro se preserva como conflicto, sin inferir el original,
archivarlo ni convertirlo en gestionado. Una reconciliación local posterior con
baseline verificado y respaldo es una operación explícita del operador, no una
migración oculta del instalador. Conflictos y avisos se muestran en Output:
Ralph Suite, incluso sin cambios. `changed` incluye instrucciones, plantillas y
skills; el contador de skills cuenta directorios con ficheros escritos.

Las instrucciones del producto aplican al flujo Alfred/Ralph, subordinadas al
repositorio; ADR-021 adopta prácticas, no un framework, persona de terceros,
memoria Engram ni automatización de commits. Los perfiles personales no forman
parte del catálogo. Esta implementación no acredita gates de UI ni de host real.
