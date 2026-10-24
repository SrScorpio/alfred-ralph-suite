# Modelo de amenazas: ralph-suite

**Fecha:** 19 de octubre de 2026 (migrado de `plans/seguridad.md`, 5 de junio de 2026)
**Autor:** security-officer
**Metodología:** STRIDE

> El contenido procedente de `plans/seguridad.md` se marca *(heredado)*. Convención vigente: `docs/` es la única documentación de proyecto. Principios heredados: menor privilegio en toda operación de FS o red; validar y sanitizar todo input del usuario o de la webview; separar backlog (`prd.json`), runtime (`.ralph/`) y memoria estable (`.agent/memories.md`).

Actualización acotada del 22 de octubre de 2026: mitigaciones de integridad y
límites observados en las fases 1–3. No constituye nueva aprobación de seguridad,
compliance ni validación de una instalación real.

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
- `prdManager.ts` normaliza campos descriptivos, prioridad y estado; rechaza IDs inválidos/duplicados y colisiones de nombres por mayúsculas/minúsculas. No transforma identidades ni dependencias al cargar. Las escrituras explícitas siguen centralizadas en `saveRaw`/`mutateRaw` (temporal + `rename`).
- `safeTaskId` valida literalmente `[A-Za-z0-9_.-]{1,80}` antes de crear runtime: no reemplaza caracteres, no recorta ni aplica trim. Los IDs numéricos legacy conservan su representación decimal existente. La carga incompatible se rechaza con diagnóstico; no hay migración automática.
- Sync individual y masivo comparten `ralph-suite.syncIssue`: labels locales explícitos, pertenencia al backlog y mapeo unívoco. Un número compartido o varios repositorios/números en una tarea se rechazan antes de escribir. Los cuerpos remotos no autorizan IDs; el chat no recibe instrucciones de escribir runtime directamente. El comando no certifica la identidad ni el estado remoto: la API legacy numérica requiere contexto de repositorio fiable.
- `getStatus` no reescribe señales; lee una instantánea tolerante (primera línea no vacía). Una consulta no sobrescribe una actualización concurrente ni genera por sí misma otro evento de escritura.
- `prd.json` solo se escribe desde workflows UI/import explícitos; los prompts de ejecución prohíben modificarlo *(heredado)*.
- Con `ralph-suite.gitCheckpoint` activo, el checkpoint crea un commit con mensaje estándar y sin secretos *(heredado)*.

### Repudiation (repudio)
- Historial por tarea en `.ralph/task-<ID>-log.json` y una línea de modo efectivo en el OutputChannel por acción (ADR-018).
- `NOTA:` queda como historial runtime; solo `DECISION:`, `MEMORIA:`, `BUG:` y `CONVENCION:` promocionan a memoria estable *(heredado)*.

### Information Disclosure (fuga de información)
- Logs en `.ralph/` sin PII ni tokens; lo sensible se enmascara antes de persistir *(heredado)*.
- No commitear `.env` ni credenciales; `.env.example` solo con claves de ejemplo; preferir `keytar` o variables de entorno *(heredado)*.
- Secret Guard analiza blobs staged, no el editor. La composición ejecuta primero
  el hook preservado en un proceso separado: ante fallo devuelve su código; tras
  éxito devuelve el del guard. No añade código tras un `exit` ajeno. Una copia
  previa ocupada o marcador no reconocido (incluido el formato antiguo) rechaza
  la instalación y exige integración manual; no debe anunciarse protección
  instalada si la operación falla. Antes de cualquier escritura, rechaza hooks
  dependientes de `$0`/`${0…}` o `BASH_SOURCE` (también `dirname`, aunque conserve
  directorio), dispatchers Husky por nombre e intérpretes fuera de sh/bash/dash.
  La reinstalación vuelve a comprobar el hook preservado: no repara automáticamente
  wrappers antiguos inseguros ni cambia sus rutas/bytes al rechazar. La composición
  no es una adaptación universal de hooks arbitrarios; los formatos incompatibles
  requieren integración y validación manual, preservando su identidad original.
  Los tests aíslan configuración global/system, variables Git y templates; fijan
  y verifican `core.hooksPath` local dentro de cada fixture antes de instalar.
  Requiere shell de Git y
  Node en PATH. Las firmas no detectan todos los secretos; no sustituye revisión
  ni gestión de credenciales. Solo se ha validado con repositorios fixture; no se
  alteraron hooks ni configuración de seguridad reales.

### Denial of Service (denegación de servicio)
- Reserva síncrona única por instancia del extension host para ejecución manual y autorunner, también entre raíces. Timeout, parada o envío ambiguo conservan la reserva y bloquean avance/reintentos automáticos; recuperarla exige consentimiento explícito tras verificar y detener el agente anterior. Cancelar conserva el bloqueo. No coordina ventanas ni cancela remotamente.
- `maxLoops` y `taskTimeoutMs` acotan el ciclo. `taskRetries` permanece compatible pero no relanza trabajo que pudo haberse enviado. Una señal tardía conserva riesgo de atribución errónea tras recuperación: el runtime no identifica intentos.
- El dispatch paralelo queda fuera hasta un scheduler con leases (ADR-016).

### Elevation of Privilege (elevación de privilegios)
- Mensajes del webview validados por allowlist (`id`, `status`, `priority`, arrays y campos editables) y longitud máxima *(heredado)*.
- CSP estricta con nonce en `getShellHtml(nonce)`; sin `eval`; event delegation (`data-action`/`data-close`) en vez de handlers inline *(heredado, resuelto 2026-08)*.
- `workspaceTrust.ts`: las operaciones protegidas exigen workspace de confianza; `workspaceFolders.ts`/`workspaceRoot.ts` resuelven la carpeta Ralph en multi-root.

## Matriz de riesgo

| Amenaza | Probabilidad | Impacto | Riesgo | Mitigación |
|---------|-------------|---------|--------|------------|
| XSS en webview vía contenido de PRD/memoria | Media | Alto | Alto | `esc`/`escAttr` + CSP con nonce + allowlist de mensajes *(heredado)*; deuda: eliminar `innerHTML` |
| Path traversal o alias de identidad vía ID | Baja | Alto | Medio | Validación literal y rechazo de colisiones, sin normalización de identidad |
| Estado asignado a otra tarea/repositorio durante sync | Media | Alto | Alto | Labels explícitos, unicidad en el comando compartido, rechazo de ambigüedad; identidad remota sigue requiriendo contexto fiable |
| Hook previo omite controles por cambio de identidad o su fallo se convierte en éxito | Media | Alto | Alto | Procesos separados y códigos preservados solo para hooks compatibles; rechazo sin escritura de `$0`/dispatchers y formatos antiguos, integración manual; instalación real pendiente de autorización |
| Señal tardía atribuida a otro intento tras recuperación | Media | Alto | Alto | Consentimiento y reserva bloqueante; sigue pendiente un protocolo por intento |
| Prompt injection desde backlog importado | Media | Medio | Medio | El import solo crea backlog; los prompts de ejecución prohíben modificar `prd.json` *(heredado)* |
| Corrupción de `prd.json` en escritura | Baja | Alto | Medio | Escritura atómica (temporal + `rename`) en `PrdManager` *(heredado)* |
| Fuga de tokens a logs o memoria | Baja | Alto | Medio | Sin secretos en logs/notas; enmascarar antes de persistir *(heredado)* |
| Identidad Alfred suplantada por otra extensión | Baja | Medio | Bajo | DTO fail-closed validado campo a campo (ADR-018) |

## Recomendaciones

- Deuda prioritaria *(heredada)*: eliminar `innerHTML` para datos no confiables migrando el render del board a APIs DOM; hoy se escapa con `esc`/`escAttr`, pero el board sigue inyectándose vía `innerHTML`.
- Validación de esquema formal para `prd.json` cuando se adopte un schema validator o se implemente un validador local completo *(heredado)*.
- Si algún día se abre un servidor local: HTTPS, validación de origen, puerto documentado y autorización explícita del usuario *(heredado)*.
- Incidentes de seguridad: documentar la decisión o corrección en `docs/adr/` si cambia una decisión, y siempre el hecho y las acciones en `.agent/memories.md` *(heredado, actualizado a la convención `docs/`)*.
