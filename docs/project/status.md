# Estado del flujo — alfred-ralph-suite

> Snapshot local duplicado desde GitHub Issues y PRs. La fuente de verdad
> colaborativa son las issues (labels) y los PRs; este fichero es el respaldo
> offline. Lo escribe `tech-writer`. Plantilla de referencia de
> alfred-dev-vscode. Actualizado: 2026-10-24

## Flujo activo

- **Flujo:** feature — continuidad de workflow y distribución segura del catálogo (PR #40 / v1.12.7)
- **Feature / descripción:** runner integrado que entra por Alfred y transmite el contrato Ralph (ID local, raíz, alcance, gates, dueño de cierre); instalador de catálogo seguro (hashes por recurso, escritura atómica, lock interproceso, preserva personalizaciones); instrucciones globales neutrales; test de versión por activación real.
- **Fase actual:** entrega — completada (v1.12.7 publicada, latest)
- **Gate pendiente:** validación interactiva del runner 1.12.7 por el usuario y reconciliación de #9/#10.
- **Siguiente acción:** validación interactiva en ventana nueva (entrada por Alfred con contrato Ralph) y reconciliación del tablero.
- **Releases:** latest v1.12.7 (2026-10-24); previas v1.12.6 (2026-10-24), v1.12.5, v1.12.4 y v1.12.3 (2026-10-20). `main`: 90074e1.
- **Estado de la suite:** 412 passing en el árbol fuente (rama de preservación local `preserve/local-closure-20261024`); 406 passing en la rama publicada 1.12.7.
- **Instalación local verificada:** srscorpio.alfred-ralph-suite@1.12.7 instalada sola (sin la extensión antigua); SHA-256 del VSIX cotejado con el publicado.
- **Limitaciones declaradas en 1.12.7:** validación interactiva de la extensión instalada y del runner pendiente; sin coordinación entre ventanas ni cancelación remota; #34 separado y abierto.

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
| #35 | fix: auditoría de integridad — propiedad y recuperación del runner | closed (bug) | #38 |
| #36 | fix: auditoría de integridad — identidad literal y sincronización | closed (bug) | #38 |
| #37 | fix: auditoría de integridad — hooks, estado todo y lecturas puras | closed (bug) | #38 |

#1-#7 cerradas el 2026-10-18 (transferencia inicial de la paleta de Alfred y decisiones de alcance). #8, #11 y #16-#24 cerradas el 2026-10-20 por los merges #25-#33 (PR #26 y PR #33 se fusionaron sin cerrar issues por referencia). #35-#37 (auditoría de integridad, 22-24/10) cerradas el 2026-10-24T12:08Z por el merge de #38: entraron y cerraron por PR directo sin tarjeta en el board local — trabajo fuera del tablero.

Board local (`docs/ralph/prd.json`, gitignored): ISSUE-001/002 enlazadas a #9/#10 con señales `.ralph` 'completed' (20 y 21/10) y stories locales cerradas (`docs/stories/01-validar-lo-heredado.md` validada con 1.12.5 instalada sola; `docs/stories/02-limpieza-de-lo-redundante.md` con decisiones queda/quita/aplaza por candidato), pero las tarjetas siguen en 'todo' y las issues de GitHub siguen abiertas (#9 in-progress, #10 backlog). Divergencia viva y sin reconciliar: ISSUE-001 board 'todo' vs `.ralph` completed vs #9 in-progress; ISSUE-002 board 'todo' vs `.ralph` completed vs #10 backlog. La reconciliación corresponde al maintainer en la UI del tablero; el agente no edita `prd.json`.

## PRs abiertos

- **#34** — feat: guía de defaults globales del chat (head `feat/guia-defaults-chat`, abierto el 2026-10-21). Gates de host real pendientes según `docs/test/README.md` (matriz funcional PR34); sus tests de host NO se han ejecutado.

Fusionados desde el último snapshot (2026-10-20): #38 (Fix runner ownership and audit data integrity, 2026-10-24 12:08Z; cerró #35-#37), #39 (release v1.12.6, 12:11Z) y #40 (fix: align agent workflow continuity and safe catalog distribution, 20:44Z, merge commit 90074e1 → v1.12.7 publicada 20:47Z). Cadena previa del 2026-10-20: #25-#33.

## Historial de gates

| Fecha | Fase | Veredicto | Evidencia |
|-------|------|-----------|-----------|
| 2026-10-20 | QA cadena #25-#29 (refresh de estado, docs/project, stories, tests, ADRs) | APTA (con correcciones aplicadas) | PRs #25, #26, #27, #28 y #29 |
| 2026-10-20 | QA #30/#31/#32 | APTA con correcciones resueltas | #30: summary + idempotencia; #31: APTA directa; #32: fila de plantilla |
| 2026-10-20 | QA #33 | Sin revisión formal | desarrollo directo del orquestador; suite local 301 passing |
| 2026-10-20 | Release 1.12.4/1.12.5 | Publicadas | pipeline local: 301 passing + vsce OK |
| 2026-10-24 | Bugs integridad #35-#37 | Cerradas por merge #38 | Sin revisión formal qa-engineer acreditada; suite verde del árbol |
| 2026-10-24 | Release 1.12.6 | Publicada | PR #39; CI verde |
| 2026-10-24 | Release 1.12.7 | Publicada | PR #40 (90074e1); CI verde en PR y main; 406 passing en la rama publicada; VSIX con SHA-256 cotejado |

## Bloqueos

- #12, #13, #14 y #15 (blocked): bloqueadas por ADR-019 hasta que el host de chat exponga APIs públicas para sesión aislada por tarea/acción, fijar el modo de lanzamiento (Autopilot) y autorizar permisos solo en workspaces de confianza.
- Reconciliación del board local (ISSUE-001/002): las señales `.ralph` dicen 'completed' pero las tarjetas siguen en 'todo' y #9/#10 siguen abiertas. Pendiente del maintainer en la UI del tablero; el agente no edita `prd.json`.

## Lessons aprendidas

Ninguna registrada todavía.

## Gaps (lo que sé que me falta)

- #9: validación interactiva de 1.12.7 pendiente; la validación de 1.12.5 (instalada sola, 20/10) no cubre la entrada por Alfred del runner de 1.12.7.
- #10: decisión formal pendiente de cierre en GitHub pese a la story local cerrada.
- #34: gates de host real sin ejecutar (matriz funcional en `docs/test/README.md`).
- #12-#15: esperan las APIs del host (ADR-019).
- Sin QA formal acreditada de #38 y #40.
- Divergencias board local / `.ralph` / #9 / #10 sin reconciliar.