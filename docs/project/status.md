# Estado del flujo — alfred-ralph-suite

> Snapshot local duplicado desde GitHub Issues y PRs. La fuente de verdad
> colaborativa son las issues (labels) y los PRs; este fichero es el respaldo
> offline. Lo escribe `tech-writer`. Plantilla de referencia de
> alfred-dev-vscode. Actualizado: 2026-10-20

## Flujo activo

- **Flujo:** feature — blindaje de memoria y UX
- **Feature / descripción:** blindaje de la memoria del proyecto (ADR-020) y de la UX: guardrails con backup antes de escrituras destructivas, verificación de estado y reconciliación por Alfred, estructura completa al analizar, skill suggest y sección Alfred en la Activity Bar.
- **Fase actual:** entrega — completada (v1.12.5 publicada)
- **Gate pendiente:** validación del usuario de #9 (4 flujos de agentes) y decisión de #10.
- **Siguiente acción:** el usuario valida #9 con la extensión instalada; la sincronización de este snapshot ya la ejecuta `tech-writer`.
- **Releases:** v1.12.3, v1.12.4 y v1.12.5 (2026-10-20). `main`: 2c0d348.

## Issues

| Issue | Historia | Estado | PR |
|-------|----------|--------|----|
| #9 | validar la extensión instalada sola (ISSUE-001) | in-progress | — |
| #10 | decidir qué sobra de las dos extensiones (ISSUE-002) | backlog | — |
| #12 | feat: paralelismo real de Auto Run con maxParallelTasks | blocked | — |
| #13 | feat: política de sesión por acción | blocked | — |
| #14 | feat: modo de lanzamiento por defecto (Autopilot) con override por tarea | blocked | — |
| #15 | feat: permisos autorizar todo solo en workspaces de confianza | blocked | — |
| #8 | feat: publicar Actualizar estado y la recuperación del Auto Run | done | #25 |
| #11 | docs: ADR de sesión, paralelismo y permisos | done | #29 |
| #16 | feat: estructura completa del proyecto al analizar/configurar | done | #32 |
| #17 | feat: Alfred verifica y reconcilia el estado del proyecto | done | #32 |
| #18 | docs: ADR del modelo de memoria del proyecto | done | #29 |
| #19 | feat: convención de nomenclatura de tareas y documentos | done | #27 |
| #20 | feat: guía de tests del proyecto y skill de testing | done | #28 |
| #21 | spike: evaluar Organic-Driven Development (gentle-ai) como forma de trabajar | done | #29 |
| #22 | feat: guardrails - patrones peligrosos y backup antes de escrituras destructivas | done | #31 |
| #23 | feat: endurecer la memoria - anti-inyección, lessons, gaps y unificación memories | done | #30 |
| #24 | feat: skill suggest y carga progresiva de skills | done | #32 |

Cerradas hoy (2026-10-20) por los merges #25-#33. #1-#7 cerradas el 2026-10-18: transferencia inicial de la paleta de Alfred y decisiones de alcance. PR #26 (migración a docs/ y retiro de plans/) y PR #33 (Activity Bar) se fusionaron sin cerrar issues por referencia.

Board local (`docs/ralph/prd.json`, gitignored): 12/18 completadas; ISSUE-006..009 blocked alineadas con #12-#15; ISSUE-001/002 enlazadas a #9/#10.

## PRs abiertos

Ninguno (2026-10-20). Fusionados: #25-#29 (cadena 1.12.3: refresh de estado, docs/project, stories, tests, ADRs), #30 (memoria única, ADR-020), #31 (guardrails + backup), #32 (verificación de Alfred, estructura al analizar, skill suggest), #33 (sección Alfred en Activity Bar + verifyStatus + TDD condicionado en prompts).

## Historial de gates

| Fecha | Fase | Veredicto | Evidencia |
|-------|------|-----------|-----------|
| 2026-10-20 | QA cadena #25-#29 (refresh de estado, docs/project, stories, tests, ADRs) | APTA (con correcciones aplicadas) | PRs #25, #26, #27, #28 y #29 |
| 2026-10-20 | QA #30/#31/#32 | APTA con correcciones resueltas | #30: summary + idempotencia; #31: APTA directa; #32: fila de plantilla |
| 2026-10-20 | QA #33 | Sin revisión formal | desarrollo directo del orquestador; suite local 301 passing |
| 2026-10-20 | Release 1.12.4/1.12.5 | Publicadas | pipeline local: 301 passing + vsce OK |

## Bloqueos

- #12, #13, #14 y #15 (blocked): bloqueadas por ADR-019 hasta que el host de chat exponga APIs públicas para sesión aislada por tarea/acción, fijar el modo de lanzamiento (Autopilot) y autorizar permisos solo en workspaces de confianza.

## Lessons aprendidas

Ninguna registrada todavía.

## Gaps (lo que sé que me falta)

- #12-#15 esperan la API del host (ADR-019): sin ella no hay paralelismo real, política de sesión por acción, Autopilot por defecto ni permisos por confianza.
- Falta QA formal de #33: única evidencia, la suite local (301 passing).
- #9 sin validar por el usuario (4 flujos de agentes con la extensión instalada).
- #10 sin decidir: qué sobra de las dos extensiones.