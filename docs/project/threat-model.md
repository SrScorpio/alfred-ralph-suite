# Modelo de amenazas: ralph-suite

**Fecha:** 19 de octubre de 2026 (migrado de `plans/seguridad.md`, 5 de junio de 2026)
**Autor:** security-officer
**Metodología:** STRIDE

> El contenido procedente de `plans/seguridad.md` se marca *(heredado)*. Convención vigente: `docs/` es la única documentación de proyecto. Principios heredados: menor privilegio en toda operación de FS o red; validar y sanitizar todo input del usuario o de la webview; separar backlog (`prd.json`), runtime (`.ralph/`) y memoria estable (`.agent/memories.md`).

## Superficie de ataque

- Webview del tablero (`src/webview/kanbanHtml.ts`): renderiza `prd.json`, logs, memoria, labels, dependencias y criterios *(heredado)*.
- Mensajes `postMessage` del webview al extension host (`kanbanPanel.ts`) *(heredado)*.
- Ficheros locales: `docs/ralph/prd.json` (backlog), `.ralph/task-<ID>-*` (runtime), `.agent/memories.md` (memoria estable) *(heredado)*.
- Comandos contribuidos (`ralph-suite.runTask`, `syncIssue`, `setupProject`,…) invocables desde la paleta y desde otras extensiones.
- Comando entrante de identidad `alfred-dev.ralph.announceIdentity` (modo Alfred, ADR-018).
- Import de planes y Add from Chat (`src/kanban/planImport.ts`): markdown/JSON externo que se convierte en backlog.

## Activos a proteger

| Activo | Clasificación | Impacto de compromiso |
|--------|--------------|----------------------|
| `docs/ralph/prd.json` (backlog) | Integridad | Corrupción o suplantación del trabajo planificado |
| `.ralph/` (señales y logs) | Integridad / confidencialidad | Ejecución errónea del runner; fuga de datos sensibles |
| `.agent/memories.md` | Confidencialidad / integridad | Inyección de instrucciones en prompts futuros |
| Tokens y credenciales del usuario | Confidencialidad | Acceso a GitHub y otros servicios |
| Extension host y FS del workspace | Integridad / disponibilidad | Ejecución de acciones no autorizadas |

## Análisis STRIDE

### Spoofing (suplantación de identidad)
- Un `prd.json` manipulado o texto importado puede suplantar la voz de Ralph: validar y sanitizar todo input del usuario o de la webview *(heredado)*.
- Identidad Alfred: contrato fail-closed, un solo fallo invalida el modo para esa acción (ADR-018). El DTO solo trae `agent`/`mention`/`preamble`; si trae `provider` o `model`, se rechaza entero.
- APIs remotas: OAuth2 o tokens con expiración y scopes mínimos; tokens nunca en la UI ni en logs sin enmascarar *(heredado)*.

### Tampering (manipulación)
- `prdManager.ts` normaliza defensivamente `prd.json` (strings, arrays, IDs, duplicados, prioridad, estado); escrituras solo vía `saveRaw`/`mutateRaw` con fichero temporal + `rename` *(heredado)*.
- Todo ID usado en rutas `.ralph/task-<ID>-*` pasa por `safeTaskId`; nunca construir rutas de escritura con input crudo de webview, PRD o agente *(heredado)*.
- `prd.json` solo se escribe desde workflows UI/import explícitos; los prompts de ejecución prohíben modificarlo *(heredado)*.
- Con `ralph-suite.gitCheckpoint` activo, el checkpoint crea un commit con mensaje estándar y sin secretos *(heredado)*.

### Repudiation (repudio)
- Historial por tarea en `.ralph/task-<ID>-log.json` y una línea de modo efectivo en el OutputChannel por acción (ADR-018).
- `NOTA:` queda como historial runtime; solo `DECISION:`, `MEMORIA:`, `BUG:` y `CONVENCION:` promocionan a memoria estable *(heredado)*.

### Information Disclosure (fuga de información)
- Logs en `.ralph/` sin PII ni tokens; lo sensible se enmascara antes de persistir *(heredado)*.
- No commitear `.env` ni credenciales; `.env.example` solo con claves de ejemplo; preferir `keytar` o variables de entorno *(heredado)*.

### Denial of Service (denegación de servicio)
- Runner serial: una tarea a la vez con abort compartido del panel; el dispatch paralelo queda fuera hasta un scheduler con leases (ADR-016).
- `ralph-suite.maxLoops`, `taskTimeoutMs` y `taskRetries` acotan el ciclo de ejecución *(heredado)*.

### Elevation of Privilege (elevación de privilegios)
- Mensajes del webview validados por allowlist (`id`, `status`, `priority`, arrays y campos editables) y longitud máxima *(heredado)*.
- CSP estricta con nonce en `getShellHtml(nonce)`; sin `eval`; event delegation (`data-action`/`data-close`) en vez de handlers inline *(heredado, resuelto 2026-08)*.
- `workspaceTrust.ts`: las operaciones protegidas exigen workspace de confianza; `workspaceFolders.ts`/`workspaceRoot.ts` resuelven la carpeta Ralph en multi-root.

## Matriz de riesgo

| Amenaza | Probabilidad | Impacto | Riesgo | Mitigación |
|---------|-------------|---------|--------|------------|
| XSS en webview vía contenido de PRD/memoria | Media | Alto | Alto | `esc`/`escAttr` + CSP con nonce + allowlist de mensajes *(heredado)*; deuda: eliminar `innerHTML` |
| Path traversal vía ID de tarea | Baja | Alto | Medio | `safeTaskId` + normalización de IDs del PRD *(heredado)* |
| Prompt injection desde backlog importado | Media | Medio | Medio | El import solo crea backlog; los prompts de ejecución prohíben modificar `prd.json` *(heredado)* |
| Corrupción de `prd.json` en escritura | Baja | Alto | Medio | Escritura atómica (temporal + `rename`) en `PrdManager` *(heredado)* |
| Fuga de tokens a logs o memoria | Baja | Alto | Medio | Sin secretos en logs/notas; enmascarar antes de persistir *(heredado)* |
| Identidad Alfred suplantada por otra extensión | Baja | Medio | Bajo | DTO fail-closed validado campo a campo (ADR-018) |

## Recomendaciones

- Deuda prioritaria *(heredada)*: eliminar `innerHTML` para datos no confiables migrando el render del board a APIs DOM; hoy se escapa con `esc`/`escAttr`, pero el board sigue inyectándose vía `innerHTML`.
- Validación de esquema formal para `prd.json` cuando se adopte un schema validator o se implemente un validador local completo *(heredado)*.
- Si algún día se abre un servidor local: HTTPS, validación de origen, puerto documentado y autorización explícita del usuario *(heredado)*.
- Incidentes de seguridad: documentar la decisión o corrección en `docs/adr/` si cambia una decisión, y siempre el hecho y las acciones en `.agent/memories.md` *(heredado, actualizado a la convención `docs/`)*.
