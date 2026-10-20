---
name: project-docs
description: "Usar para saber dónde vive cada cosa y cómo se trabaja con la documentación y el estado del proyecto. También: docs, documentación viva, GitHub issues, board, tablero, prd.json, status.md, memoria del proyecto, dar de alta tareas, dónde escribo esto."
---

# Mapa de documentación y estado del proyecto

Esta skill es el mapa. Consúltala ANTES de crear, mover o dar de alta
documentación o trabajo. Las demás skills (`write-adr`, `sync-project-docs`,
`pr-workflow`, `threat-model`, `compliance-check`) cubren su dominio; esta dice
dónde vive cada cosa y quién lo escribe.

## El modelo (capas)

| Capa | Artefacto | Dueño de escritura | Para qué |
|---|---|---|---|
| Verdad colaborativa | GitHub Issues + PRs | El equipo vía flujo | Estado del trabajo, ramas, trabajo conjunto, rescate si lo local muere o se trabaja desde otros harnesses. Labels: `story`, `backlog`, `in-progress`, `in-review`, `blocked` |
| Organización del usuario | `docs/ralph/prd.json` (board) | Solo el maintainer; la ejecución agéntica JAMÁS sin autorización explícita en ese turno | Ver el backlog y pasar tareas. IDs `ISSUE-NNN` (padding 3). Enlace con GitHub solo por label `github:#N` u `owner/repo#N`; el que enlaza en tarjetas es `owner/repo#N` |
| Snapshot del equipo | `docs/project/status.md` | Solo `tech-writer` | Memoria offline: flujo, fase, gate, siguiente acción, issues, historial. Réplica de GitHub, nunca al revés |
| Runtime | `.ralph/` (gitignored) | El runner, solo con ID de tarea y raíz explícitos | Estado de ejecución; no es verdad del proyecto |
| Decisiones | `docs/adr/ADR-NNN` + `docs/project/architecture.md` | `architect` (ADR) y `tech-writer` (architecture) | Decisiones con alternativas; architecture resume vigentes y superadas |

Regla: en conflicto manda GitHub. Un snapshot desactualizado es peor que no
tenerlo.

## Identificadores

Tabla única de identificadores. El formato de un ID nuevo sale de aquí; nada
se renumera ni migra sobre lo existente.

| Identificador | Qué es | Quién lo asigna | Dónde vive |
|---|---|---|---|
| `ADR-NNN` | Decisión arquitectónica (número reservado a decisiones) | `architect` | `docs/adr/` |
| `ISSUE-NNN` (padding 3) | Backlog Ralph LOCAL, sin relación con GitHub | El maintainer en el alta | `docs/ralph/prd.json` |
| `#N` | Número de issue/PR de GitHub | GitHub; nunca se infiere desde `ISSUE-NNN` | GitHub |
| `docs/stories/NN-slug.md` | Documento de historia del desarrollo local (antes `docs/issues/`) | Quien abre la historia | `docs/stories/` |
| Label `github:#N` u `owner/repo#N` | Enlace explícito GitHub ↔ board; en tarjetas solo se enlaza `owner/repo#N` | Quien enlaza, con autorización | Labels del board |
| `feat/<slug>` | Rama de trabajo | Quien abre la PR | Git |
| `vN.N.N` | Release | El maintainer al publicar | Tags / GitHub Releases |

Prefijos de terceros (`A-01`, `F-01`, claves de Jira/Linear) quedan fuera de
la convención del repo: si un proyecto externo los usa, se respetan sin
traducir.

## Un fichero para cada cosa

| Fichero | Contenido |
|---|---|
| `docs/project/status.md` | Estado / snapshot |
| `docs/project/architecture.md` | Estructura y decisiones |
| `docs/project/threat-model.md` | STRIDE |
| `docs/project/compliance.md` | RGPD / NIS2 / CRA |
| `docs/project/dependencies.md` | Lo genera `evaluate-dependency` |
| SBOM | Lo genera `sbom-generate` |
| `docs/adr/` | Decisiones |
| `docs/ralph/prd.json` | Backlog (board) |
| `docs/stories/` | Detalle de historias locales |

Plantillas: `~/.copilot/alfred-dev/templates` o `catalog/templates` del repo.

## Convención única: `docs/`

`plans/` está retirado. Si un proyecto legacy trae `plans/`, su contenido se
migra a `docs/` con confirmación del maintainer; no se crea nada nuevo en
`plans/`.

## Forma de trabajar

1. **Alta de trabajo:** una issue GitHub por historia (labels `story` + estado)
   y, con autorización del maintainer en ese turno, alta en el board
   (`ISSUE-NNN` siguiente, label `owner/repo#N`). Nunca se infiere `ISSUE-NNN`
   desde `#N`.
2. **Ejecución:** rama `feat/`, PR con `Closes #N`; nadie commitea a `main`.
3. **Cierre de fase:** gate con evidencia (salida de tests, checks, artefacto);
   GitHub refleja el cierre (label movido, PR merged).
4. **Sincronía:** `tech-writer` replica GitHub → `status.md` (solo lo tocado
   por la fase).
5. **Verificación:** antes de dar una gate por cerrada, comparar GitHub ↔
   `status.md` ↔ board; divergencia → `tech-writer` sincroniza; la gate no se
   cierra hasta reconciliar.

## Si falta una skill

Si una convencion que repites no esta cubierta por las skills instaladas,
propon crearla: `SKILL.md` con frontmatter disparador y cuerpo minimo, o
instalar la que exista. Las skills de stack de terceros no se adoptan sin
decision explicita. Una skill solo paga su descripcion hasta invocarse
(carga progresiva): manten las descripciones como disparadores cortos.

## Qué NO hacer

- No escribas `status.md` si no eres `tech-writer`; ni `prd.json` sin
  autorización del turno.
- No crees estructuras paralelas ni dupliques contenido entre capas.
- No copies chats a los Markdown; replica estado y decisiones.
- No inventes estado ni números de issue.
