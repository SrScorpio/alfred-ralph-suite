# Validar lo heredado de Alfred Dev y Ralph Suite

Estado: cerrada el 20 de octubre de 2026; validación funcional aislada hecha.

El repo ya tiene remoto (`origin`, SrScorpio/alfred-ralph-suite) y la release
[v1.12.1](https://github.com/SrScorpio/alfred-ralph-suite/releases/tag/v1.12.1)
está publicada (18 de octubre de 2026). El paquete actual del árbol de trabajo
es 1.12.2. La presencia del remoto y de la release no sustituye la comprobación
con esta extensión instalada sola.

## Qué hay que comprobar

Los dos repos de origen tienen arreglos en el árbol local, sin commit y sin
publicar. Esta extensión nace de ese árbol. Antes de dar nada por cerrado hay
que repetirlo aquí, con esta extensión instalada sola.

- El VSIX copia los 12 agentes a `~/.copilot/agents` al activarse y el selector
  del chat los muestra tras recargar la ventana.
- Ejecutar una tarea del tablero abre el chat nombrando al subagente
  (`@junior-dev` en implementación, `@alfred` en init, `@product-owner` en
  análisis, `@tech-writer` en memoria). Sin identidad válida cae en el chat
  activo.
- La mención elige agente. No concede permisos de herramienta ni activa
  autopilot: eso sigue siendo del usuario.
- ISSUE-003 e ISSUE-005 del backlog de Alfred figuran `completed` y coinciden
  con el código (carpeta multi-root y vista de la Activity Bar).
- `docs/project/status.md` de Alfred describe 0.9.0, no 0.8.1.
- ADR-004: el trabajo que cruza de repo se anota una sola vez, en Alfred, con
  el repo de destino escrito en la tarea.
- Una historia publicada en GitHub, con Ralph presente, queda en el tablero con
  el label explícito `github:#N`. Nadie deduce `ISSUE-00N` de `#N` y nadie
  edita `prd.json` sin autorización.

## Qué sigue pendiente en los repos de origen

- El runner es en serie. El scheduler paralelo no existe y no se simula.
- `announceIdentity` no está en la paleta a propósito. Si esta extensión
  convive con Alfred Dev, manda la identidad que anuncia Alfred Dev.
- El `.vsix` suelto de la raíz de Alfred está ignorado por git. No se borra
  sin confirmación.
- Sigue habiendo un `prd.json` legado en la raíz y documentación histórica en
  `plans/`. El layout vigente es `docs/`.
- Las issues `SrScorpio/alfred-dev-vscode` #52 a #57 están reabiertas: se
  cerraron antes de publicar el código.

## Resultado de validación (20 de octubre de 2026)

- **Instalada sola, sin Alfred Dev al lado.** El perfil tiene únicamente esta
  extensión: `code.cmd --list-extensions --show-versions` informa
  `srscorpio.alfred-ralph-suite@1.12.5` y nada de `alfred-dev-vscode`. Una
  instalación aislada (`--user-data-dir` y `--extensions-dir` propios, con el
  VSIX 1.12.5) arranca el extension host con `===== ACTIVATING v1.12.5 =====`.
  La discrepancia del 19 de octubre queda explicada: `extensions.json` ya
  registra solo 1.12.5; las carpetas 1.12.0, 1.12.2 y 1.12.3 siguen en disco
  pero sin registrar, y por eso el CLI las ignoraba.
- **Criterio 1 — los 12 agentes en el selector: verificado.** La activación
  deja 12 `.agent.md` en `~/.copilot/agents` con marcador
  `{"version":"1.12.5"}` e idénticos byte a byte a `catalog/agents/` del repo.
  El registro que consume el selector del chat (`chat.customModes.local` y
  `chat.customModes.agent-host-copilotcli` en el estado del workspace) contiene
  exactamente esos 12 nombres —alfred, architect, devops-engineer, junior-dev,
  lucius, product-owner, qa-engineer, security-officer, selina, senior-dev,
  seo-specialist y tech-writer— más los integrados del host (Ask, Plan).
  Confirmado además por tu comprobación visual tras recargar la ventana.
- **Criterio 2 — mención del subagente: contrato y traza verificados.**
  `builtinIdentity` mapea acción a agente (tarea → `junior-dev`, init →
  `alfred`, análisis → `product-owner`, memoria → `tech-writer`) y `sendToChat`
  antepone `@<agente>` y envía `agent` en la llamada a
  `workbench.action.chat.open`. El Output de la extensión registra
  `[Ralph][Alfred] identidad integrada — subagente @junior-dev` y
  `[Board] Context refresh prompt sent for ISSUE-001`. La suite local
  (`npm.cmd test`, 301 passing) cubre el direccionamiento y el payload.
- **Criterio 3 — sin identidad válida cae en el chat activo: verificado.** Con
  la identidad nula el llamador pasa `agent: undefined`, y `sendToChat` solo
  añade mención y participante cuando el nombre pasa la allowlist; si no, deja
  el prompt tal cual para el chat que esté activo. Cubierto por los tests de
  `chatLauncher` (agente fuera de la allowlist, ausencia de `newChat` y caída al
  portapapeles sin abortar).
- **Límite de la evidencia.** Los criterios 2 y 3 se acreditan por código,
  traza de la extensión y tests, no por observación del hilo del Chat en la UI.
  No hay captura ni transcripción de los cuatro flujos dentro de una
  conversación. Queda anotado como límite aceptado al cerrar.
- **Puntos heredados de la lista original** (ISSUE-003/005, estado de Alfred
  Dev, ADR-004, historia GitHub con Ralph presente y límites de permisos): fuera
  del alcance de esta historia; su comprobación vive en los repos de destino.

Cierre: confirmaste que la extensión está instalada y pediste cerrar la tarea el
20 de octubre de 2026. El criterio 1 queda verificado con evidencia y los
criterios 2 y 3 con contrato, traza y tests; el límite de arriba se acepta como
riesgo residual y la historia pasa a cerrada.

## Hecho cuando

Cada punto de la primera lista tiene una comprobación en esta extensión, con
el resultado escrito aquí.
