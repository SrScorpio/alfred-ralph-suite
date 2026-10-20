# Feature doc ODD — {{nombre-de-la-feature}}

- **Id:** {{ODD-<slug>}}
- **Estado:** {{en-curso | entregado | descartado}}
- **Fecha:** {{fecha-de-creación}}
- **Feature doc de:** {{issue / historia / petición de la que nace}}

> Se abre solo para trabajo sustancial (ADR-021): si el trabajo se retoma con
> la petición + `git diff` (resume test), va inline y este doc no se crea.
> Los handoffs a este doc son **por referencia**, nunca paráfrasis.

## Especificación

Peticiones del usuario **verbatim** (S1..Sn). No se reescriben: se citan.

### S1 — {{título corto de la petición}}

> {{texto exacto de la petición, mensajes de error y ejemplos, verbatim}}

- Criterio de aceptación: {{qué debe cumplirse}}
- Checks: {{chequeos funcionales y tests que lo demuestran}}

## Registro

Cronológico. `L1` es la petición original verbatim; después, correcciones,
evidencia y rationale. Se añade, no se reescribe.

- **L1** ({{fecha}}): {{petición original verbatim}}
- **L2** ({{fecha}}): {{corrección / evidencia / decisión y su motivo}}

## Handoffs

Por referencia: quién recibe qué tarea y con qué especificación.

| Fecha | Agente | Tarea | Specs | Commit |
|-------|--------|-------|-------|--------|
| {{fecha}} | {{agente}} | {{tarea estable}} | S1, S2 | {{sha o —}} |

## Criterio de cierre

- **Resume test:** {{qué queda en el repo para retomar el trabajo sin reconstruir el plan}}
- Specs cubiertas con evidencia: {{S1 ✔ con <test/PR/commit>, ...}}
- Chequeos pendientes o fallidos declarados: {{lista o "ninguno"}}
