# Guía y consulta de defaults globales del chat

Estado: alcance aprobado por el maintainer el 21 de octubre de 2026 mediante la opción C; implementación pendiente. El security-officer ha validado el diseño con veredicto **APROBADO CON CONDICIONES**. Las condiciones de seguridad de la gate de fase 2 recogidas en esta historia son obligatorias para el desarrollo y su aceptación. La evidencia del host indicada abajo ya estaba verificada; no equivale a validar esta funcionalidad de la suite.

Decisión: [ADR-022](../adr/ADR-022-defaults-globales-del-chat-mediante-configuracion-oficial-del-host.md), que enmienda parcialmente ADR-019 sin modificarlo. Referencias: SrScorpio/alfred-ralph-suite#14 y SrScorpio/alfred-ralph-suite#15. Esta historia no cambia su estado en GitHub ni acredita su cierre.

## Alcance

Aplicar la **opción C**: orientar al usuario hacia los ajustes oficiales del host y consultar su configuración en solo lectura.

- El host conserva la autoridad para configurar defaults, aplicar política empresarial y presentar consentimiento y warnings.
- La suite muestra una fotografía de cuatro claves del host, trust actual y versión informativa, con actualización manual.
- Se permite únicamente la excepción de lectura definida en ADR-022; no se leen ajustes de `alfred-dev.*`.
- No hay escrituras de configuración, settings propios equivalentes, aviso en primer arranque, aplicación automática ni comando de reversión.
- No se controla el modo o los permisos de una tarea ni de una sesión ya abierta. No se crean sesiones aisladas.
- Runner serial y `maxLoops` sin cambios. #12 y #13 siguen bloqueadas por las gates de ADR-019 y ADR-016, recogidas en ADR-022.
- Si #14/#15 exigen activación automática desde la suite, esta historia no basta para cerrarlas: requiere acuerdo explícito sobre su alcance reducido.

La configuración manual añade un paso, pero evita dos dueños del mismo ajuste y cambios globales persistentes al instalar o desinstalar la suite.

## Evidencia verificada del host

Evidencia de partida ya comprobada en el bundle local de **VS Code 1.142.0, commit `6d62b1d5`**, y en el repositorio `microsoft/vscode`. No se atribuye el commit del bundle a todas las revisiones remotas consultadas ni se deduce la versión de introducción de cada clave.

| Fuente en `microsoft/vscode` | Evidencia del conjunto verificado |
|---|---|
| [`src/vs/workbench/contrib/chat/common/agentHostConfigPolicy.ts`](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/chat/common/agentHostConfigPolicy.ts) | Configuración y política del agent host. |
| [`src/vs/platform/agentHost/node/sessionPermissions.ts`](https://github.com/microsoft/vscode/blob/main/src/vs/platform/agentHost/node/sessionPermissions.ts) | Resolución de permisos de sesión; `getDefaultPermissionLevel()` lee el default con fallback `default`. |
| [`src/vs/platform/agentHost/common/agentHostSchema.ts`](https://github.com/microsoft/vscode/blob/main/src/vs/platform/agentHost/common/agentHostSchema.ts) | Esquema de configuración del agent host. |
| [`src/vs/workbench/contrib/chat/common/constants.ts`](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/chat/common/constants.ts) | Identificadores de configuración del chat. |
| [`src/vs/workbench/contrib/chat/browser/chat.shared.contribution.ts`](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/chat/browser/chat.shared.contribution.ts) | Contribuciones y defaults de configuración del chat. |
| [`extensions/copilot/CHANGELOG.md`](https://github.com/microsoft/vscode/blob/main/extensions/copilot/CHANGELOG.md) | Renombrado de `chat.tools.global.autoApprove` en 1.104, sin migración automática. |

Los enlaces a `main` son navegables pero mutables; la referencia local comprobada es el bundle indicado. La futura validación funcional debe registrar la versión y el commit realmente probados, sin inventar permalinks históricos.

Hechos del conjunto de evidencia:

- `chat.permissions.default` admite `default | autoApprove | autopilot`; se aplica por defecto a sesiones nuevas y el host reacciona a cambios de configuración en una sesión vacía.
- `chat.tools.global.autoApprove` es booleano y actúa a nivel de aplicación. Está sujeto a enterprise policy y dispara el warning oficial del host en primer uso.
- `chat.newSession.defaultMode` es una cadena; vacío significa el default de la vista, no «Autopilot».
- `chat.autopilot.advanced.enabled` es booleano y habilita extras: goal banner y risk gate que omite herramientas de riesgo alto. No selecciona por sí solo Autopilot ni equivale a autorizar todo.
- Sigue sin existir la API necesaria para sesión aislada por tarea, override de permisos por tarea o política por acción.

## Matriz de compatibilidad por clave

`engines.vscode` admite `^1.103.0`: esto incluye 1.103 y versiones posteriores compatibles, no certifica la disponibilidad de estas claves en todo el rango. La columna 1.103 representa el mínimo admitido; las versiones intermedias se comprueban por clave.

| Clave | VS Code 1.103, mínimo de `^1.103.0` | VS Code 1.142.0 de referencia | Tratamiento en la suite |
|---|---|---|---|
| `chat.permissions.default` | Disponibilidad no acreditada con la evidencia de partida; probar, no asumir. | Verificada; enum `default`, `autoApprove`, `autopilot`. | Mostrar valor consultado; no usar fallback que simule disponibilidad. |
| `chat.tools.global.autoApprove` | Nombre actual ausente según el renombrado documentado en 1.104; validación funcional pendiente. | Verificada; booleano, alcance de aplicación, policy y warning oficial. | Sin migración ni uso de alias antiguos. Si no se expone, mostrar «no disponible o no expuesto». |
| `chat.newSession.defaultMode` | Disponibilidad no acreditada; probar, no asumir. | Verificada; cadena, vacío = default de la vista. | No inventar un enum o traducir permisos a modos. |
| `chat.autopilot.advanced.enabled` | Disponibilidad no acreditada; probar, no asumir. | Verificada; booleano para extras de Autopilot. | Mostrar como función independiente de la selección del modo. |

No se usará `vscode.version >= 1.104` como detector universal. La versión sirve para diagnóstico. Leer un valor o recibir un objeto de `inspect()` no certifica por sí solo el registro de la clave: puede existir configuración manual desconocida. La UI oficial es la referencia para confirmar disponibilidad y restricciones.

La API pública de configuración no garantiza exponer el `policyValue` interno del host. La suite no consultará registros internos, no declarará «sin política» por falta de información y remitirá a Settings cuando no pueda acreditar una restricción.

## Comandos previstos

| Comando | Título | Comportamiento |
|---|---|---|
| `ralph-suite.openHostChatSettings` | Ralph: Configurar permisos y modo del chat en VS Code | Comprobar trust, explicar alcance global y abrir la UI oficial mediante `workbench.action.openSettings`. |
| `ralph-suite.showHostChatDefaults` | Ralph: Ver configuración actual del chat de VS Code | Comprobar trust, leer las cuatro claves y mostrar versión, trust, valores y límites; ofrecer «Actualizar» y acceso a Settings. |

Probar la búsqueda combinada `@id:chat.permissions.default @id:chat.tools.global.autoApprove`; ofrecer alternativas por cada una de las cuatro claves si el filtro combinado no resulta útil. Si falla la apertura, mostrar los identificadores para buscarlos manualmente, sin reintentos automáticos.

La presentación distinguirá valor resuelto y valores de usuario/workspace que exponga `inspect()`, ausencia o error de lectura y disponibilidad no acreditada. `false` no significa ausencia; una cadena vacía válida no significa fallo. Cada lectura se hace por acción, sin caché persistente.

Advertencia fija:

> Configuración consultada en este contexto. No acredita el modo ni los permisos efectivos de una sesión de chat ya abierta.

El trust consultado solo corresponde al workspace actual. No convierte un ajuste global en una preferencia confinada al proyecto. Los comandos no aceptan argumentos para aplicar valores y nunca ejecutan herramientas para comprobar permisos.

## Plan de implementación acotado

Este apartado describe trabajo futuro, no cambios ya realizados.

- `package.json`: contribuir los dos comandos y entradas de paleta; ningún setting nuevo ni elevación inicial del mínimo de VS Code.
- `src/activate.ts`: registrar handlers y disposables; ninguna lectura del host ni UI automática durante la activación.
- `src/hostChatDefaults.ts`, nuevo: allowlist de cuatro claves, lectura y normalización del snapshot. Sin escrituras, persistencia ni APIs internas.
- `src/commands/hostChatSettings.ts`, nuevo: reutilizar `requireWorkspaceTrust()`, presentar estado y orientación, actualizar manualmente y abrir Settings; capturar errores.
- `package.nls.json` y `package.nls.es.json`: textos de comandos y advertencias conforme al mecanismo existente.
- `src/test/vscodeMock.js`: ampliar el mock solo para las capacidades necesarias y restaurar los cambios entre pruebas.
- `docs/project/architecture.md`: reflejar en una tarea autorizada posterior el diagrama y la excepción de lectura de ADR-022. No ampliar la excepción a escrituras.

Sin cambios funcionales en `chatLauncher.ts`, `commands/alfredPalette.ts`, `workspaceTrust.ts`, runner o Kanban. La paleta Alfred contiene flujos y prompts, no administración de permisos. No se añaden dependencias, polling ni infraestructura.

## Qué hay que comprobar

### Tests automatizados

Los tests del proyecto viven en `src/test/`, con Mocha y ts-node y mock local de `vscode`; no en un directorio raíz `test/`.

- `hostChatDefaults.test.ts`, nuevo: cuatro claves permitidas, `false`, cadena vacía, enum desconocido, ausencia, error de lectura y precedencia expuesta por el mock; sin defaults inventados ni afirmaciones sobre sesiones activas.
- `hostChatSettings.test.ts`, nuevo: trust denegado, cancelación, actualización manual, apertura combinada y por clave, error de apertura, cero escrituras y cero comandos de aceptación de permisos.
- `activate.test.ts`: ambos comandos registrados; activar no consulta ajustes del host ni abre UI.
- Regresión: `chatLauncher.test.ts`, `alfredMode.test.ts`, `securityRuntime.test.ts`, `runtimeControls.test.ts` y suite completa.
- Durante la implementación: `npm.cmd run compile` y `npm.cmd test`, con resultados registrados. No se dan por ejecutados al aprobar esta historia.

### Validación funcional

Como en `01-validar-lo-heredado.md`, validar con instalación aislada de esta extensión y separar evidencia de código, mocks y observación real de UI.

- VS Code 1.103: registrar disponibilidad y presentación de cada clave, sin migrar aliases ni escribir claves desconocidas.
- VS Code 1.142.0: registrar valores y UI por clave; anotar versión y commit realmente probados.
- Versiones intermedias usadas para soporte: registrar resultados por clave, sin extrapolar desde 1.104.
- Enterprise policy real: observar la restricción en el host y comprobar que la suite no intenta escribir ni vencerla. Los mocks no acreditan este punto.
- Primer uso en un entorno de prueba: observar el warning oficial al configurar manualmente la autoaprobación en el host, sin aceptación automática de la suite.
- Probar el filtro combinado, enlaces por clave, cancelación y alternativa manual ante error de apertura.
- Confirmar que la configuración global no se presenta como permiso exclusivo del workspace ni como estado de la sesión activa.
- Confirmar reversión manual en Settings y ausencia de cambios automáticos al activar, desactivar o volver a invocar los comandos de la suite.

## Condiciones de seguridad (gate de fase 2)

Veredicto del security-officer: **APROBADO CON CONDICIONES**. Los ocho puntos siguientes concretan el contrato obligatorio y prevalecen sobre cualquier descripción menos restrictiva de esta historia. La aprobación del diseño no acredita todavía su cumplimiento en código ni sus pruebas.

1. **Consulta inequívoca.** Allowlist literal: `chat.permissions.default`, `chat.tools.global.autoApprove`, `chat.newSession.defaultMode` y `chat.autopilot.advanced.enabled`. Separar valor global explícito, predeterminado y resuelto cuando la API lo acredite; nunca presentar un `.get()` como prueba de procedencia global.
2. **Ausencias.** Clave no registrada: «no disponible». Sin valor explícito: «sin configurar»; mostrar el predeterminado solo si consta. Si la API no permite acreditar el registro o la procedencia, declarar esa incertidumbre sin confundirla con ausencia comprobada. No fabricar valores para hosts antiguos admitidos por `^1.103.0`.
3. **Policy y sesión.** «Policy: no determinable» declara incertidumbre, nunca permiso para actuar. Mostrar aparte «Permisos efectivos de la sesión: no determinables». Ningún valor consultado acredita permisos de ejecución.
4. **Multi-root.** `workspace.isTrusted` representa el workspace completo. Consultar sin URI de carpeta, nunca según el editor activo ni `workspaceFolders[0]`. Usar la etiqueta «Confianza del workspace completo». Sin carpetas, no inferir una raíz: aplicar igualmente el guard de trust al contexto actual; si permite continuar, consultar sin URI y mostrar «Sin carpetas abiertas; consulta del contexto actual, sin alcance de carpeta». Si la extensión no está activa en ese contexto, no prometer disponibilidad de los comandos.
5. **Trust dentro de los handlers.** Ejecutar `requireWorkspaceTrust()` dentro de ambos handlers antes de leer ajustes o abrir UI. Un `when` de paleta no sustituye este control. Mantener `untrustedWorkspaces.supported: false`.
6. **Capacidad cerrada.** Comandos sin parámetros operativos; ignorar o rechazar argumentos externos sin utilizarlos. Única navegación: `workbench.action.openSettings`, con filtro `@id:` construido solo con constantes de la allowlist. Seleccionar un valor nunca lo activa. No construir filtros a partir de valores consultados o argumentos externos.
7. **Sin efectos laterales.** Cero escrituras de configuración, cero aceptación de warnings, cero lanzamiento de chat o runner, cero portapapeles y cero telemetría o logs con valores. No reutilizar `sendToChat`, tampoco como fallback ante errores.
8. **Contrato de renderizado y navegación.** Mostrar valores como texto plano, sin `MarkdownString` ni `isTrusted`, con tipos validados y longitud acotada; neutralizar controles, sintaxis de iconos y caracteres bidireccionales. Nunca convertir valores en comandos, URI o filtros. Antes de navegar a Settings, mostrar el aviso visible «Ajustes globales del host; no limitados a esta tarea/carpeta. La autoaprobación puede permitir acciones sin confirmación. Ralph no modifica ajustes ni acredita permisos efectivos», con acción neutral «Abrir ajustes oficiales», sin recomendar activar la autoaprobación. Cancelar no navega ni produce efectos laterales.

## Resultado de validación

Diseño validado por el security-officer con veredicto **APROBADO CON CONDICIONES**; condiciones incorporadas arriba antes del desarrollo. La aprobación del maintainer del 21/10/2026 valida la elección de C. La implementación, los tests, el comportamiento de policy y la observación del warning siguen pendientes. No se reutiliza el cierre de las historias 01 y 02 como evidencia funcional de esta nueva capacidad.

## Hecho cuando

- La validación de diseño **APROBADO CON CONDICIONES** queda vinculada a los ocho puntos de la gate de fase 2; su cumplimiento se acredita con pruebas, sin hallazgos críticos pendientes.
- La allowlist literal se respeta y las pruebas separan valor global explícito, predeterminado y resuelto, sin atribuir procedencia global a `.get()`; cubren «no disponible», «sin configurar» e incertidumbre no resuelta, sin fabricar defaults para hosts antiguos.
- Se muestran «Policy: no determinable» cuando corresponda y, aparte, «Permisos efectivos de la sesión: no determinables»; ninguno se interpreta como autorización.
- En multi-root y sin carpetas se consulta sin URI, sin editor activo ni `workspaceFolders[0]`; se presenta «Confianza del workspace completo» y se verifica el comportamiento sin carpetas definido en la gate.
- Ambos handlers ejecutan `requireWorkspaceTrust()` antes de leer o abrir UI, incluso con invocación directa y argumentos externos; no dependen de un `when` de paleta.
- Los argumentos externos se ignoran o rechazan; solo se navega mediante `workbench.action.openSettings` con filtros derivados de constantes de la allowlist. Seleccionar un valor no lo activa.
- Las pruebas acreditan cero escrituras, aceptación de warnings, lanzamiento de chat/runner, portapapeles y telemetría o logs con valores; no se utiliza `sendToChat`.
- Los valores se renderizan como texto plano, con tipos validados, límite de longitud definido y probado y controles, iconos y caracteres bidireccionales neutralizados; sin `MarkdownString`, `isTrusted` ni conversión en comandos, URI o filtros.
- Antes de toda navegación se muestra el aviso literal de la condición 8 y la acción «Abrir ajustes oficiales»; no se recomienda activar la autoaprobación y cancelar no navega. Se prueban valores manipulados, textos largos y caracteres de control.
- Los dos comandos están contribuidos y registrados, sin settings nuevos ni cambios de permisos automáticos.
- La activación no lee configuración del host ni abre UI. Activación y comandos realizan cero llamadas a `configuration.update()`.
- Solo se consultan las cuatro claves autorizadas del host, además del trust y la versión informativa.
- Se reutiliza el guard de trust; no cambia `untrustedWorkspaces.supported: false`. Settings sigue siendo la única ruta de modificación ofrecida.
- La UI diferencia configuración y sesión activa, modos y permisos, extras de Autopilot, ausencia y valores válidos como `false` o cadena vacía.
- Funcionan actualización manual, acceso por clave y tratamiento de valores desconocidos, settings ausentes y errores sin romper el extension host.
- La matriz tiene resultados funcionales por clave para el mínimo admitido y el host de referencia; no se atribuyen fechas de introducción sin evidencia.
- Policy real y warning de primer uso tienen evidencia observada, no solo mocks o trazas de código.
- Compilación, tests nuevos y regresión pasan con resultados registrados.
- No se han alterado PRD, protocolo runtime, runner serial, direccionamiento ni aislamiento de sesiones; #12/#13 mantienen sus gates.
- Se registra la evidencia y sus límites en esta historia. El cierre de #14/#15 solo se propone si el maintainer confirma que el alcance reducido satisface sus requisitos.
