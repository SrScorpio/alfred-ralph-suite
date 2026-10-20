# Estado del flujo — alfred-ralph-suite

> Snapshot local duplicado desde GitHub Issues y PRs. La fuente de verdad
> colaborativa son las issues (labels) y los PRs; este fichero es el respaldo
> offline. Lo escribe `tech-writer`. Plantilla de referencia de
> alfred-dev-vscode. Actualizado: 2026-10-19

## Flujo activo

- **Flujo:** feature — blindaje de memoria
- **Feature / descripción:** blindaje del estado del runner y la memoria: señales `.ralph/` coherentes ante abort/timeout (WIP sin commitear en `stateManager.ts`, `commands/task.ts`, `kanbanPanel.ts`, `activate.ts` y tests).
- **Fase actual:** desarrollo
- **Gate pendiente:** validación del usuario de #9 (extensión instalada sola); para #8, autorización explícita de commit/PR.
- **Siguiente acción:** cerrar #9 con la validación del usuario; después decidir el orden de #8 y #10.

## Issues

| Issue | Historia | Estado | PR |
|-------|----------|--------|----|
| #8 | feat: publicar Actualizar estado y la recuperación del Auto Run | backlog | — |
| #9 | validar la extensión instalada sola (ISSUE-001) | in-progress | — |
| #10 | decidir qué sobra de las dos extensiones (ISSUE-002) | backlog | — |
| #11 | docs: ADR de sesión, paralelismo y permisos | backlog | — |
| #12 | feat: paralelismo real de Auto Run con maxParallelTasks | blocked | — |
| #13 | feat: política de sesión por acción | blocked | — |
| #14 | feat: modo de lanzamiento por defecto (Autopilot) con override por tarea | blocked | — |
| #15 | feat: permisos autorizar todo solo en workspaces de confianza | blocked | — |
| #16 | feat: estructura completa del proyecto al analizar/configurar | backlog | — |
| #17 | feat: Alfred verifica y reconcilia el estado del proyecto | backlog | — |
| #18 | docs: ADR del modelo de memoria del proyecto | backlog | — |

Sin PRs abiertos (2026-10-19). #1–#7 cerradas el 2026-10-18: transferencia inicial de la paleta de Alfred y decisiones de alcance.

## Historial de gates

| Fecha | Fase | Veredicto | Evidencia |
|-------|------|-----------|-----------|

Sin gates formales registradas todavía.

## Bloqueos

- #12, #13 y #14 (blocked): dependen de APIs públicas del host que hoy no garantizan sesión aislada por tarea ni fijar el modo de lanzamiento; cada issue describe su gate de desbloqueo de plataforma.
- #15 (blocked): exige opción oficial del host para autorizar permisos, limitada a workspaces de confianza.
- Migración de documentación: `plans/{arquitectura,decisiones,seguridad}.md` traspasados a `docs/project/` y eliminados (autorizado en #16, 2026-10-19).
