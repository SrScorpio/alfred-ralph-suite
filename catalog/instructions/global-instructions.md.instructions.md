---
applyTo: '**'
description: 'Reglas de desarrollo para flujos Alfred/Ralph: calidad, seguridad, continuidad y estándares subordinados al repositorio.'
---
# Reglas de Desarrollo Globales

## Alcance y autonomía
- Estas reglas operan solo cuando se active un flujo Alfred/Ralph. No convierten
  una consulta ad hoc en una ejecución del equipo ni en una tarea Ralph.
- Manda el alcance autorizado y la política del repositorio. Investigar o revisar
  no autoriza editar; implementar autoriza completar lo pedido con autonomía
  proporcional, sin introducir fases, herramientas o entregas no solicitadas.
- ODD mixto adopta prácticas de organización, no un framework externo ni una
  persona. No impone Engram, `odd/tasks`, espejos de memoria ni commits automáticos.
  Para trabajo sustancial usa el documento existente o la plantilla del equipo en
  `docs/` cuando corresponda; el trabajo pequeño sigue inline (ADR-021).
- Los commits requieren autorización conforme a la política del repositorio;
  comprobar tests no autoriza commit, push, PR ni publicación.
- Reconciliar el seguimiento existente no autoriza altas ni cambios de backlog.
  No inventes una API de tablero: si falta una tarjeta necesaria, solicita una
  operación UI autorizada al maintainer y bloquea solo el trabajo dependiente.

## Comunicación
- Responder en español. Código, nombres de archivos, variables, funciones, commit messages y commit descriptions en inglés.
- Respuestas directas y densas: ir al grano, cero relleno.
- Conclusión primero: el resultado, diagnóstico o bloqueo va en la primera línea; el desarrollo después.
- Candor radical: si los datos contradicen la petición, se dice con la evidencia; no se complaze por amabilidad.
- Sin evidencia suficiente, se declara la incertidumbre explícitamente. Nunca inventar.
- Alcance estricto: resolver primero lo pedido; las mejoras adicionales van después, separadas y breves.
- Antes de una operación que pueda romper datos, código o entorno, advertencia directa y concreta.
- Si hay un error o ambigüedad, explicarlo antes de asumir.
- Preferir ejemplo concreto sobre explicación teórica.
- **Progreso conversacional (modo B):** emitir como máximo una línea de estado
	solo ante un cambio relevante, bloqueos, decisiones, riesgos, confirmación o
	resultado. No narrar búsquedas, lecturas, comandos ni microacciones; tampoco
	comprobaciones internas que terminan correctamente.
- No repetir contexto, planes ni artefactos ya conocidos. Comunicar solo el
	cambio, la evidencia mínima y la siguiente acción.
- Los informes finales, veredictos, hallazgos, gates y evidencias conservan el
	detalle exigido por el rol y se emiten una sola vez al cierre.
- No imponer una personalidad ni protocolos de terceros. La política de
  comunicación del repositorio prevalece; conserva los avisos necesarios de
  seguridad, integridad, coste o aprobación explícita.
- **Tools no se heredan.** Cada agente usa solo las de su frontmatter. En VS Code
  Copilot el tool set de comandos es `execute` (`execute/runInTerminal`). No
  existe la tool `terminal`. Un subagente sin `execute` no puede correr
  comandos aunque el orquestador sí los tenga.
- **GitHub:** Issues y PRs van por GitHub MCP (`github/*`), el estándar de
  VS Code. `gh` por `execute` es fallback si el MCP no está disponible. Git
  local (rama, commit, push) sigue siendo `execute`. Si no hay MCP ni `gh`,
  el flujo queda en local y se dice. No se instala `gh` para cubrir el hueco.
- **Autopilot:** completar la petición actual y parar. No arrancar la fase
  siguiente, no reintentar el mismo paso en bucle, no improvisar tools que el
	rol no declara. No iniciar fases nuevas sin una petición explícita del usuario
	o un handoff que el usuario haya confirmado. Ante un bloqueo o una gate
	rechazada, informar con evidencia y cerrar la ejecución actual.
- **Estado del flujo:** GitHub Issues + PRs son la fuente de verdad.
  `tech-writer` duplica ese estado en `docs/project/status.md`. Alfred lee y
  verifica; no lo edita. Ningún otro agente escribe el snapshot.
- Tras cambiar un `.agent.md`, reseleccionar el agente o abrir un chat nuevo:
  las conversaciones abiertas no recargan la definición.
- Delegar al rol, no al modelo: el host selecciona el modelo; el catálogo no fija
  proveedor ni preferencias automáticas por rol. No uses `handoffs.model`.
  No sustituyas silenciosamente un rol no disponible por un agente genérico:
  informa de la limitación y solicita un handoff explícito. No inventes herramientas.
  Autopilot no autoriza a saltar gates ni a autoenviar handoffs (`send: false`).
- En Ralph, transmite sin cambios el contrato del prompt (`kind`, `localTaskId`,
  `workspaceRoot`, `scope`, `gates`, `closureOwner`) a cada ejecutor. Solo el
  `closureOwner` cierra la tarea padre tras verificar todo el alcance y las gates;
  los ejecutores devuelven evidencia, no señales. Sin contexto válido, en revisión,
  rechazo, bloqueo o handoff parcial, no escribas señales runtime. `task_complete`
  no registra una tarjeta ni sustituye `completed` y `NOTA:`. El trabajo ad hoc
  no requiere inventar ID Ralph ni escribir `.ralph/`.

## Documentación y Estructura (Anti-Bloat)
- ZERO documentación redundante: un solo source of truth por concepto.
- Si un documento existe y cubre el tema, NO crear otro que repita lo mismo.
- Nombres de archivos y funciones descriptivos que se auto-documenten.
- Comentarios solo para el PORQUÉ, nunca para el QUÉ (el código lo explica).
- NO crear README, CHANGELOG, CONTRIBUTING ni archivos de proceso salvo que se pida explícitamente. Si una skill de stack exige un artefacto de plataforma, sigue esa skill; no lo inventes desde estas reglas.
- File and folder names must be lowercase and use hyphens.
- Assets (images, scripts, styles) must be placed in separate, well-organized folders.

## Documentación del proyecto (fuente de verdad)
- La convención de documentación es `docs/`: no se crean estructuras paralelas ni se duplica contenido. Si el proyecto trae `plans/`, su contenido se migra a `docs/` con confirmación del maintainer; no se crea nada nuevo en `plans/`.
- Antes de trabajar en un proyecto existente, leer su documentación viva (índice, arquitectura, decisiones/ADRs, seguridad) si existe.
- Si estas instrucciones chocan con la documentación del proyecto, gana el proyecto — salvo en seguridad y secretos, que no se negocian.
- Equivalencias habituales: `decisiones.md` ≈ ADRs (`docs/adr/`), `arquitectura.md` ≈ `docs/project/architecture.md`, `seguridad.md` ≈ threat-model + compliance.

## Estilo de Trabajo
- Planes completos pero precisos: orientados a implementación real, no mock ni placeholders.
- NO sobredimensionar: arquitectura simple para el scope actual, extensible después.
- NO over-engineering: no crear capas de abstracción, patrones ni infraestructura que no se necesitan ahora.
- Priorizar test local funcional antes de depender de despliegues cloud.
- Entender el contexto completo antes de proponer solución.
- Si hay varias opciones, presentar pros/contras breves y dar recomendación.
- Explicar el PORQUÉ de las decisiones técnicas, no solo el CÓMO.
- Ante errores, investigar causa raíz antes de parchear síntomas.
- Antes de mover o refactorizar código: localizar todos sus usos (callers, handlers inline, globales). Después: validar lo afectado y documentar fallos preexistentes en lugar de mezclar fixes.

## Tecnología
- Priorizar tecnologías empresariales, estables y bien testeadas (LTS, maduras).
- Evitar novedades beta/RC o librerías con <1 año de vida estable salvo justificación clara.
- Elegir la opción más simple que resuelva el problema. Menos dependencias = mejor.

## Calidad de Código
- Funciones pequeñas con responsabilidad única. Si tiene >30 líneas, probablemente necesita dividirse.
- Manejo de errores explícito: capturar excepciones específicas (no genéricas), no silenciarlas, y registrar contexto con logging estructurado en vez de prints sueltos.
- Nada de magic numbers ni magic strings: valores con nombre en constantes.
- Type hints/annotations donde el lenguaje lo soporte.
- NO hardcoded secrets, API keys, ni credenciales. Variables de entorno siempre.
- Priorizar conciseness, simplicity, scalability en código y lógica.
- Composición sobre herencia; jerarquías profundas solo con justificación.
- SOLID y DRY donde reduzcan complejidad real, no como dogma: extraer duplicación evidente al tocar código, no abstraer por anticipado.
- Seguir el linter/formatter del proyecto si está configurado; el estilo del proyecto manda sobre preferencias personales.
- All code must be reviewed before merging into the main branch.
- Test-first por defecto cuando exista un test determinista ejecutable y un
  resultado esperado claro: RED → GREEN → REFACTOR. Si no existe, explicar la
  excepción y realizar chequeos proporcionales. Features y fixes siempre llevan
  tests; preservar los comandos y opciones existentes (ADR-021).
- Delegar con un motivo concreto y conservar el rol; trabajo pequeño inline
  cuando el rol lo permita. Review acotada al cambio o slice, no a checkboxes.
  No añadir umbrales de líneas ni cadenas automáticas de PRs.

## Seguridad
- Input sanitization en todo punto de entrada (API endpoints, forms, CLI args).
- Parametrized queries SIEMPRE, nunca string interpolation en SQL.
- Principio de mínimo privilegio en permisos y access tokens.
- Dependencias actualizadas, revisar CVEs antes de añadir nuevas.
- Always include a .gitignore file and exclude macOS system files like .DS_Store.

## Rendimiento y Optimización
- Elegir la estructura de datos correcta para cada caso (no List para lookups, usar Map/Set).
- Evitar loops anidados O(n²) cuando existe alternativa O(n) o O(n log n).
- Async/no-blocking para I/O. No bloquear el hilo principal.
- Lazy loading y caching donde aporte valor medible.
- No optimizar prematuramente, pero tampoco escribir código ineficiente sabiéndolo.

## Control y Transparencia
- Siempre explicar QUÉ se va a cambiar y POR QUÉ antes de editar archivos.
- Mostrar rutas completas de archivos modificados.
- No eliminar ficheros ni ramas sin confirmación explícita.
- Si algo no se puede hacer, decirlo directamente y explicar por qué.

## Stack y convenciones de plataforma
- Detectar el stack por señales del repo (manifiestos, lockfiles, frameworks, `AGENTS.md`).
- Usar las skills instaladas que encajen: las de stack para el lenguaje o framework, y las de proceso para ADRs, PRs, threat-model, SBOM u otros ritos. Se descubren por nombre y `description`; no uses la ruta del plugin (`skills/stack/`).
- Si hay varias skills de stack aplicables, usa la más específica (p. ej. WordPress → `wordpress-pro`, no `php-pro` genérico).
- El estándar de código, empaquetado y artefactos de esa plataforma salen de la skill, no de estas reglas. Si no hay skill para el stack, sigue el linter/formatter del proyecto y no inventes convenciones de otra plataforma.
