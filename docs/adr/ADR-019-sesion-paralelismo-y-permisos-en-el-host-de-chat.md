# ADR-019: Sesión, paralelismo y permisos en el host de chat

- **Estado:** aceptado
- **Fecha:** 19 de octubre de 2026
- **Issue:** [SrScorpio/alfred-ralph-suite#11](https://github.com/SrScorpio/alfred-ralph-suite/issues/11) (cierra su alcance: documentar las decisiones)
- **Relacionado:** ADR-016 (dispatch paralelo y gate de reapertura), issues [#12](https://github.com/SrScorpio/alfred-ralph-suite/issues/12), [#13](https://github.com/SrScorpio/alfred-ralph-suite/issues/13), [#14](https://github.com/SrScorpio/alfred-ralph-suite/issues/14) y [#15](https://github.com/SrScorpio/alfred-ralph-suite/issues/15) (quedan bloqueadas por esta decisión)

## Contexto

La superficie pública de VS Code disponible para una extensión permite abrir el
chat (`workbench.action.chat.open`) y enviar un prompt, pero no permite:

- crear sesiones de agente programáticamente (una por tarea, con contexto propio);
- fijar el modo de la sesión (Interactive / Autopilot / Plan);
- declarar o ajustar permisos por sesión (qué herramientas puede usar sin pedir).

ADR-016 ya documentó esta limitación como razón para recortar el dispatch
paralelo. Desde entonces no ha cambiado: `maxParallelTasks`, la política de
sesión por acción (#13), el modo por defecto Autopilot (#14) y los permisos
«autorizar todo» (#15) chocan todos con el mismo muro.

Decisiones tomadas por el maintainer el 19/10/2026 y no renegotiables aquí:

- Auto Run serial: concurrencia 1. No se simula paralelismo.
- El límite total de tareas por ciclo (`maxLoops`) se mantiene.
- `maxParallelTasks` queda diferido hasta que exista API soportada.
- Las sesiones nuevas de trabajo entran por `@alfred` como orquestador.
- «Autorizar todo» solo vía la opción oficial del host, en workspaces de
  confianza.

## Decisión

1. **Auto Run serial (concurrencia 1).** Una sola tarea en ejecución; el límite
   de tareas por ciclo (`maxLoops`) no cambia. N llamadas concurrentes a un comando que
   comparte una única conversación y un único `AbortSignal` no son paralelismo:
   son una carrera (ADR-016, opción B, descartada de nuevo).

2. **`maxParallelTasks` diferido con gate de desbloqueo.** No se implementa
   hasta que se cumplan **todas** estas condiciones:

   - **API pública y soportada** para crear una sesión nueva por tarea,
     iniciada con `@alfred` y su primer prompt, sin trucos de UI.
   - **Aislamiento verificable:** contextos de chat que no compiten, demostrado
     por test, no asumido.
   - **Recuperación idempotente:** lease/heartbeat por tarea y estados
     terminales que un reinicio no duplica ni pierde.
   - **Permisos transparentes:** qué puede y no puede hacer cada sesión es
     visible para el usuario antes de lanzarla.

3. **Entrada por `@alfred`.** Toda sesión nueva de trabajo se inicia con
   `@alfred` como orquestador; él reparte hacia el resto del equipo. No se
   abren sesiones de trabajo dirigidas directamente a subagentes.

4. **«Autorizar todo» acotado.** Solo se activa mediante la opción oficial del
   host de chat, solo en workspaces de confianza, y nunca mediante comandos
   internos de la extensión que imiten, puenten o silencien el diálogo de
   permisos del host.

## Consecuencias

- Las issues #12, #13, #14 y #15 permanecen **blocked** hasta que el host
  exponga la API requerida; este ADR es su referencia de desbloqueo.
- No hay aumento de throughput: el coste asumido a cambio de no fingir
  aislamiento que no existe.
- Cuando la API llegue, la reapertura pasa por la gate de este ADR y por los
  criterios de ADR-016 (lease, abort por tarea, idempotencia, trust).
- Si el host cambia su superficie (p. ej. API estable de sesiones), se revisa
  este ADR; no se ajusta silenciosamente en código.
