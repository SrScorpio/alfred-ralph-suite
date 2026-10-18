# Validar lo heredado de Alfred Dev y Ralph Suite

Estado: abierta. Vive en este repo porque todavía no tiene remoto.

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

## Hecho cuando

Cada punto de la primera lista tiene una comprobación en esta extensión, con
el resultado escrito en un comentario de esta issue.
