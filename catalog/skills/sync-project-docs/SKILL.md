---
name: sync-project-docs
description: "Usar para sincronizar la documentación viva después de una fase. También: actualizar docs/project, status.md, architecture, compliance, threat-model."
---

# Sincronizar documentación viva

Esta skill la usa `tech-writer`. Alfred no la ejecuta: no tiene `edit`.

Tras una fase, actualiza **solo lo que ha cambiado**. La convención es `docs/`;
si el proyecto trae `plans/`, su contenido se migra a `docs/` con confirmación
del maintainer y no se crea nada nuevo en `plans/`.

El mapa completo del modelo (capas, dueños, alta de trabajo) está en la skill
`project-docs`.

## Proceso

1. **Lee el mapa actual.** `docs/project/status.md`, `docs/prd/`, `docs/adr/`.
   No inventes ficheros que el proyecto no usa.

2. **Actualiza lo de esta fase:**

   | Si en esta fase... | Actualiza |
   |--------------------|-----------|
   | Hubo decisión de arquitectura | ADR + fila en architecture |
   | Cambió la superficie de ataque | `threat-model.md` |
   | Se evaluó una dependencia | `dependencies.md` |
   | Se tocó compliance | `compliance.md` |
   | Se cerró una gate | `docs/project/status.md` (fase, gate, siguiente acción, historial) |

3. **No toques** guías de API, changelogs o arquitectura si no hubo cambio real.

4. **status.md** es el snapshot offline, duplicado desde GitHub. Solo
   `tech-writer` lo escribe. Tras cada gate superada, commitea `chore: update
   flow status` si el usuario quiere persistirlo. No copies el chat al snapshot:
   replica Issues, PRs y veredictos.

## Criterios de éxito

- El estado en `status.md` (o issues) coincide con la realidad.
- No hay prosa inventada sobre código que no se ha tocado.

## Qué NO hacer

- No reescribas todo `docs/` en cada fase.
- No copies el chat al Markdown.
- No llames a `.claude/alfred-continuity.py`.
