# Validar lo heredado de Alfred Dev y Ralph Suite

Estado: abierta; validación funcional aislada pendiente.

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

## Resultado de validación (19 de octubre de 2026)

- **Remoto y publicación:** comprobados. `origin` apunta a
  `https://github.com/SrScorpio/alfred-ralph-suite.git`; GitHub devuelve la
  release publicada `v1.12.1` con el VSIX adjunto.
- **Pruebas automatizadas:** `npm.cmd test` en este repo: 229 passing.
  Incluyen pruebas del direccionamiento del chat y la integración del prompt
  de tarea/tablero con identidad válida e inválida.
- **Rutas esperadas en el código:** la implementación envía `@junior-dev` para
  ejecución de tarea, y las acciones init, análisis y memoria resuelven agente
  desde la identidad activa; sin agente, `sendToChat` no añade participante y
  usa el prompt dirigido al chat. Esto acredita el contrato a nivel de código,
  no la conducta visual real del Chat.
- **Instalación v1.12.2:** tras informar que instalaste v1.12.2, el marcador
  del catálogo local cambió a `1.12.2` el 19 de octubre de 2026 a las 16:04 UTC;
  siguen presentes 12 archivos `.agent.md`. Esto confirma que la extensión
  v1.12.2 activó la copia del catálogo. Confirmaste que, tras recargar, el
  selector muestra los 12 agentes. Sin embargo, `code.cmd --list-extensions
  --show-versions` aún informa `srscorpio.alfred-ralph-suite` 1.12.0, así que
  ese CLI parece consultar otro perfil/instalación de VS Code; la versión y la
  instalación aislada no quedan reconciliadas por esa salida.
- **Chat real (incluida caída de identidad inválida):** no verificado en la UI.
  No se afirma éxito a partir de las pruebas unitarias; hace falta ejecutar los
  cuatro flujos en una ventana con la extensión instalada sola y observar el
  chat abierto.
- **Otros puntos heredados de la lista original** (ISSUE-003/005, estado de
  Alfred Dev, ADR-004, historia GitHub con Ralph presente y límites de permisos)
  siguen pendientes de comprobación en los repos/ventana de destino.

El criterio 1 queda confirmado por tu comprobación visual tras instalar y
recargar, aunque la salida del CLI no coincide con esa instalación. Los criterios
2–3 siguen pendientes: no se ejecutaron los flujos de Chat ni la caída con
identidad inválida. La issue permanece abierta y no se escriben señales de
completado hasta completar esos pasos y aclarar el perfil de la instalación.

## Hecho cuando

Cada punto de la primera lista tiene una comprobación en esta extensión, con
el resultado escrito aquí.
