# Tests del proyecto

Guía de referencia. Los planes de prueba concretos viven junto a este fichero
(hoy: `model-profiles-test-plan.md`).

## Cómo correr la suite

```
npm test
```

`npm test` ejecuta `scripts/run-tests.js`, el runner del repo:

- Arranca mocha con `ts-node/register` sobre `src/test/**/*.test.ts`.
- Es Windows-safe: lanza `node mocha` con `spawnSync` sin shell intermedia,
  así que no depende de `&&` ni de rutas POSIX.
- Exporta `TS_NODE_PREFER_TS_EXTS=true` para que ts-node resuelva los `.ts` y
  no cargue `.js` compilados viejos que hayan quedado junto a las fuentes.
- Inyecta el mock de VS Code (`--require ./src/test/vscodeMock.js`) antes que
  los tests: todo `import 'vscode'` recibe el mismo singleton.

## Tests dirigidos

```
npm test -- --grep "nombre del describe o del it"
```

`run-tests.js` pasa sus argumentos extra a mocha. Úsalo para iterar sobre una
suite concreta; la suite completa es la referencia antes de cerrar.

## Regresiones de integridad

`integrityAudit.test.ts` cubre identidad literal, colisiones, dependencias tras
reordenación, mapeo GitHub unívoco, override `todo`, reset y lectura sin mutación.
`secretHook.test.ts` ejecuta shell/Node únicamente en repositorios Git fixture:
no instala hooks en el proyecto real ni necesita commits. Comprueba `exit 0`,
fallos con/sin `exit`, salida del guard, preservación e idempotencia.

Estas suites crean fixtures únicos en `os.tmpdir()` y los retiran en `afterEach`;
no redefinir `TEMP`/`TMP` dentro del proyecto. Los tests del hook aíslan las variables
`GIT_*` (restauradas al terminar), usan configuración global/system y templates
controlados dentro del fixture y fijan `core.hooksPath` local antes de instalar.
Comprueban la ruta efectiva dentro del fixture, incluso con una configuración
global de prueba que apunta a una ruta absoluta. Nunca utilizan hooks globales
reales. Cubren el rechazo sin escrituras de dispatchers Husky, referencias a
`$0`/`BASH_SOURCE`, intérpretes no compatibles y reinstalación de hooks preservados.
En Windows con ejecución de scripts restringida, `npm.cmd` evita el bloqueo de
`npm.ps1` sin cambiar la política de seguridad.

La prueba de `moveCard` utiliza el singleton `vscodeMock.js`; acredita el handler
y la recarga del modelo, no interacción visual real. El test de carrera de
`getStatus` intercepta una única lectura y publica otra señal inmediatamente
después: la consulta debe devolver su snapshot sin sobreescribir la nueva señal.

## Niveles

| Nivel | Qué cubre | Dónde |
|---|---|---|
| Unit | Lógica de `src/` aislada. La API de VS Code se sustituye por el mock `src/test/vscodeMock.js` (comandos, ventana, configuración, workspace). Sin red ni UI real | `src/test/*.test.ts` |
| Contrato | Ficheros que deben ser y decir algo concreto: `package.json`, NLS, prompts generados, layout de `docs/` | Mismos tests unit |
| Compile | Verificación aparte: `npm run compile` (`tsc -p ./`) tiene que salir limpio. El runner de tests no compila | Fuera de `npm test` |
| Empaquetado | `npm run package` (VSIX) sobre un árbol compilado | Fuera de `npm test` |
| E2E | Flujo completo con la extensión o la UI de verdad | Pendiente de adoptar |

Qué NO es E2E: un test unit con el mock no acredita conducta visual del chat
ni de la webview; solo contrato a nivel de código.

## Cuándo E2E

E2E cuando lo que se quiere acreditar no puede verificarse con unit ni con
contrato:

- Conducta visual o interactiva de la webview del tablero (render, arrastrar
  tarjetas, formularios).
- El flujo completo de un comando: paleta → comando → chat/panel → resultado.
- Regresiones de integración con el host (VS Code real) que el mock no
  reproduce.

Si el comportamiento puede verificarse con un test determinista contra el
mock, ese test unit basta y E2E no se justifica.

## Matriz funcional PR34: gates de host real

Preparación ejecutable de [SrScorpio/alfred-ralph-suite#34](https://github.com/SrScorpio/alfred-ralph-suite/pull/34),
sin modificar criterios de [ADR-022](../adr/ADR-022-defaults-globales-del-chat-mediante-configuracion-oficial-del-host.md)
ni de la [historia 03 preservada](../stories/03-guia-y-consulta-de-defaults-globales-del-chat.md).
Todas las comprobaciones funcionales siguientes están **pendientes**. No se
repiten los mocks existentes: acreditan código, no integración con el host.

### Referencia y límites de la evidencia

Consulta remota del 24/10/2026: head de PR34
`be5fadd7bc4648c1ef0fbdf2886a19a0d7075d6d`; check `build` de Build & Package
`COMPLETED / SUCCESS` en [CI 40115332695](https://github.com/SrScorpio/alfred-ralph-suite/actions/runs/40115332695).
El [último comentario de validación](https://github.com/SrScorpio/alfred-ralph-suite/pull/34#issuecomment-6387642699)
mantiene pendientes las gates reales; las distribuciones 1.141.1 y 1.143.1 no
sustituyen las requeridas. El checkout documental preservado es
`preserve/local-closure-20261024`, commit
`5117e03fb804a4771d741e8c44d54f025fcb0e75`: **no es el árbol corregido del PR**.
La evidencia futura debe identificar el commit exacto probado; si cambia el
head, no atribuirle automáticamente resultados del anterior.

`get()` e `inspect()` no certifican registro en el schema, disponibilidad,
policy empresarial ni permisos de una sesión activa. Contrastar con Settings
oficial del build probado; declarar «soporte no verificado» cuando no pueda
acreditarse. «Policy: no determinable» y «Permisos efectivos de la sesión: no
determinables» no conceden autorización. No fabricar defaults ni usar la
versión como detector universal. Una clave realmente inexistente tiene como
resultado esperado su correcta indisponibilidad, **no una gate artificial que
exija habilitarla**; incertidumbre no equivale a ausencia confirmada.

### Parámetros y casos por clave

Ejecutar el producto **versión × clave × escenario aplicable**: builds exactos
**VS Code 1.103.0 y 1.142.0**, no versiones cercanas. Registrar el commit completo
del host además del número de versión, OS y arquitectura.

| Clave literal del código | Tipo / interpretación de referencia | Comprobación de compatibilidad |
|---|---|---|
| `chat.permissions.default` | Cadena; permisos de sesiones nuevas, no modo de una sesión activa | En 1.103.0 soporte pendiente de acreditar; en 1.142.0 contrastar UI y enum `default / autoApprove / autopilot`, sin activarlos para esta preparación |
| `chat.tools.global.autoApprove` | Booleano; alcance global, policy y warning del host | Nombre actual ausente en 1.103 según el renombrado en 1.104 documentado en historia 03; confirmar observacionalmente. No migrar aliases |
| `chat.newSession.defaultMode` | Cadena; vacío válido significa default de la vista | Verificar por build; no inventar enum ni equiparar modo y nivel de permisos |
| `chat.autopilot.advanced.enabled` | Booleano; extras, no selección de Autopilot | Verificar por build; `false` no significa ausencia |

| Escenario (cada versión y clave aplicable) | Procedimiento observacional | Resultado esperado; estado inicial |
|---|---|---|
| Sin configurar | En perfil nuevo sin valor explícito, consultar Settings y el snapshot | Distinguir ausencia de valor explícito, default acreditado y resuelto; no inventar procedencia. Pendiente |
| Valor resuelto | Usar fixtures benignos previamente autorizados en el laboratorio; contrastar valores globales/workspace que exponga la API y refrescar manualmente | No atribuir `.get()` al global; conservar `false` y cadena vacía válidos, sin activar permisos. Pendiente |
| Clave ausente | Buscar la clave exacta en Settings y registrar la respuesta del host y de la suite | Indisponibilidad correcta si se confirma ausencia; no escribir claves desconocidas para forzar soporte. Pendiente |
| Soporte desconocido | Contrastar un valor expuesto cuya inscripción no pueda acreditarse; si requiere fixture, solo con harness autorizado | Conservar incertidumbre y valor normalizado; un objeto de `inspect()` no demuestra schema. Pendiente |

Si un escenario no puede reproducirse en un build, registrar motivo y evidencia
como no aplicable o bloqueado, nunca como aprobado sin observación.

### Flujo común y gates observacionales

Ejecutar en ambos builds, sin automatizar consentimiento ni cambios de permisos:

| Caso | Pasos / resultado esperado | Estado |
|---|---|---|
| Dos entradas a Settings | Paleta → `ralph-suite.openHostChatSettings`; después `ralph-suite.showHostChatDefaults` → «Abrir ajustes oficiales». Ambas muestran el mismo aviso global antes de navegar: ajustes no limitados a tarea/carpeta, riesgo de acciones sin confirmación, Ralph no modifica ajustes ni acredita permisos efectivos | Pendiente |
| Cancelación | Cancelar el aviso en cada entrada y cerrar la consulta. No se abre Settings ni se producen efectos laterales; seleccionar un valor tampoco lo activa | Pendiente |
| Consulta y actualización | Abrir consulta, comprobar las cuatro claves y etiquetas de policy/sesión; usar «Actualizar». Observar trust del workspace completo en multi-root y aclaración de contexto sin alcance de carpeta cuando no haya carpetas. Si la extensión no está activa, registrar esa limitación, no forzar trust | Pendiente |
| Apertura combinada y fallback | Confirmar destino del filtro con los cuatro `@id:` literales. Si el combinado falla, comprobar las alternativas por clave y su destino; si abre pero el filtro no es útil, registrar el hecho y contrastar búsqueda manual | Pendiente |
| Error total | Con harness interactivo autorizado que permita provocar fallo del combinado y de todas las alternativas, comprobar error visible al usuario y claves para búsqueda manual; no fingir éxito ni ejecutar chat/runner. Si no puede inducirse el fallo, queda bloqueado; un mock no cierra este caso de host | Pendiente |
| Renderizado y límites | Observar texto literal/no interactivo y truncado de fixtures autorizados con Markdown, `command:`, iconos y controles/bidi; no ejecutar sus contenidos. No convertir valores en filtros o enlaces | Pendiente |
| Policy empresarial real | En entorno managed autorizado, identificar con el administrador una restricción ya provisionada, observar su indicación en Settings y contrastar la consulta. No inferir «sin policy» de la API pública ni intentar vencerla | Pendiente |
| Warning oficial de primer uso | En laboratorio desechable autorizado y sin consentimiento previo, el operador verifica el flujo oficial de primer uso y captura el warning antes de cualquier aceptación. La suite no lo acepta ni lo oculta. Si la policy impide alcanzar ese punto, documentar bloqueo y usar otro entorno autorizado, no cambiarla | Pendiente |
| Ausencia de efectos automáticos | Observar activación, desactivación y reinvocación: sin escrituras de ajustes, aceptación de warnings, lanzamiento de chat/runner o cambios de permisos. Contrastar Settings antes/después; no inferir permisos efectivos de una sesión abierta | Pendiente |

Estas son instrucciones de **observación** en un entorno autorizado, no una guía
para activar «autorizar todo» en la máquina habitual. No elevar permisos, cambiar
policy ni habilitar autoapprove para preparar estas pruebas. Un perfil aislado
no elimina políticas de equipo ni aísla por sí solo todos los efectos de seguridad.

### Procedimiento de laboratorio (no ejecutado)

1. Obtener autorización y provisionar fuera del entorno habitual los dos builds
   exactos, un workspace de prueba y el artefacto de extensión correspondiente al
   commit exacto de PR34. No usar el checkout documental como sustituto del PR.
2. Reservar un `--user-data-dir` y un `--extensions-dir` distintos para cada build;
   también separar la ejecución managed y la de primer uso cuando proceda.
   Instalar el VSIX solo en esos directorios, nunca globalmente. No importar
   perfiles ni consentimientos del equipo habitual.
3. Registrar versión/build antes de abrir la UI. Los comandos PowerShell
   siguientes son **ejemplos documentales, no ejecutados**; las rutas deben
   apuntar a recursos previamente autorizados y provisionados:

   ```powershell
   # Repetir con 1.142.0 y directorios propios; no usar el code del PATH.
   $code = 'E:\PR34-lab\vscode-1.103.0\bin\code.cmd'
   $data = 'E:\PR34-lab\profiles\1.103.0'
   $extensions = 'E:\PR34-lab\extensions\1.103.0'
   & $code --version
   git -C 'E:\PR34-lab\pr34-checkout' rev-parse HEAD
   & $code --user-data-dir $data --extensions-dir $extensions --install-extension 'E:\PR34-lab\artifacts\pr34-exact-commit.vsix'
   & $code --user-data-dir $data --extensions-dir $extensions --list-extensions --show-versions
   & $code --user-data-dir $data --extensions-dir $extensions --new-window 'E:\PR34-lab\workspace'
   ```

4. Ejecutar los casos anteriores mediante UI y harness autorizado. Guardar junto
   a cada evidencia la salida íntegra de `code --version` (versión, commit,
   arquitectura), OS/build, identidad del VSIX y su hash, commit de extensión,
   contexto de perfil/policy sin datos sensibles, pasos y capturas/trazas.
   Compilación, tests y CI no sustituyen esas observaciones del host.
5. Completar una fila por escenario/caso, sin reutilizar resultados entre builds.
   No instalar hooks para PR34: no son un prerrequisito. La release **1.12.6** es
   independiente y no acredita estas gates ni requiere republicarse para probarlas.

### Registro de evidencia pendiente

Plantilla inicial; expandir cada fila por escenario y añadir filas para los casos
comunes, policy y primer uso. «Pendiente» no es un resultado funcional.

| Versión exacta | Build/commit host | OS/build/arquitectura | Extcommit / artefacto | Clave / escenario | Observado | Expected | Resultado | Evidencia |
|---|---|---|---|---|---|---|---|---|
| 1.103.0 | Pendiente | Pendiente | Pendiente | `chat.permissions.default` / por escenario | Pendiente | Según caso y soporte acreditado | Pendiente | Pendiente |
| 1.103.0 | Pendiente | Pendiente | Pendiente | `chat.tools.global.autoApprove` / por escenario | Pendiente | Indisponibilidad si se confirma ausencia del nombre actual | Pendiente | Pendiente |
| 1.103.0 | Pendiente | Pendiente | Pendiente | `chat.newSession.defaultMode` / por escenario | Pendiente | Según caso y soporte acreditado | Pendiente | Pendiente |
| 1.103.0 | Pendiente | Pendiente | Pendiente | `chat.autopilot.advanced.enabled` / por escenario | Pendiente | Según caso y soporte acreditado | Pendiente | Pendiente |
| 1.142.0 | Pendiente | Pendiente | Pendiente | `chat.permissions.default` / por escenario | Pendiente | Según caso y contraste con Settings | Pendiente | Pendiente |
| 1.142.0 | Pendiente | Pendiente | Pendiente | `chat.tools.global.autoApprove` / por escenario | Pendiente | Según caso; policy y warning requieren observación separada | Pendiente | Pendiente |
| 1.142.0 | Pendiente | Pendiente | Pendiente | `chat.newSession.defaultMode` / por escenario | Pendiente | Según caso; vacío válido no es fallo | Pendiente | Pendiente |
| 1.142.0 | Pendiente | Pendiente | Pendiente | `chat.autopilot.advanced.enabled` / por escenario | Pendiente | Según caso; extras no equivalen a modo/permisos | Pendiente | Pendiente |

**Falta para ejecutar:** builds exactos autorizados descargados/provisionados,
artefacto del commit exacto del PR, entorno managed real con permisos del
administrador y laboratorio de primer uso, y harness interactivo autorizado
para UI y errores de navegación. Las herramientas de esta tarea no proporcionan
GUI para esa validación. No se ha ejecutado ningún comando de instalación de los
ejemplos ni se ha cambiado configuración real. La preparación documental no
cierra las gates funcionales ni autoriza merge.

## Default propuesto: Playwright

Para E2E de apps y webview el default propuesto es **Playwright** (control de
la webview, trazas, runners por navegador). Su adopción real —instalarlo,
configurarlo y decidir el alcance— es una decisión aparte, no parte de esta
guía. No se inventa un runner propio.

## Instalador conservador del catálogo (validación aislada)

`src/test/catalogInstaller.test.ts` ejecuta el instalador con raíces explícitas
`extensionPath`, `homeDir` y `appDataDir` dentro de un fixture único en
`os.tmpdir()`, retirado al terminar. No usa perfiles reales, no instala agentes
en el host y no toca el backlog ni señales Ralph. Los fallos de FS y los enlaces
se verifican con interceptores restaurados. El instalador solo retira temporales
propios creados con `wx` y su propio lock; nunca elimina recursos, extras ni
directorios de usuario. La suite puede retirar sus fixtures completos.

Comando dirigido: `npm.cmd test -- --grep "safe catalog installer|workflow continuity"`.
Cobertura: cambio de bytes con igual versión, idempotencia incluyendo marcador,
reparación de cualquier miembro ausente, personalizaciones con/sin `force`,
migración legacy solo por coincidencia exacta, conflictos sin adopción,
downgrade conservador, extras y recursos retirados sin borrado, errores parciales
sin hashes de éxito falsos, fallo del `rename` del marcador, symlinks/junctions,
traversal y propietario desconocido. La activación informa conflictos y avisos
en Output aunque `changed` sea falso. El contrato de instrucciones verifica
alcance Alfred/Ralph, test-first condicionado y ausencia de framework impuesto.

Los recursos se publican desde un temporal exclusivo `.alfred-catalog-<UUID>.pending`
en el mismo directorio: escritura completa, `sync`, cierre, revalidación de bytes,
identidad y enlaces del destino, y `rename`. Un error antes del `rename` conserva
los bytes y fingerprints previos; una creación fallida no deja destino parcial.
No se cambia el modo de archivos del usuario con `chmod`. Si la plataforma no
permite reemplazar mediante `rename`, se informa el error y se conserva el destino;
no hay fallback de borrado. El marcador mantiene publicación por `rename`, ahora
con staging sincronizado y limpieza propia en caso de error. Un fallo del marcador
se informa; no acredita metadatos completos ni revierte recursos ya publicados.

Antes de leer el marcador se adquiere `.alfred-dev-catalog.lock` con `wx` en la
carpeta de agentes del perfil. Se mantiene durante toda la reconciliación y hasta
publicar el marcador. Otra invocación, también desde otro proceso, devuelve
`busy: true`, `changed: false`, contadores cero y aviso `CATALOG_BUSY` en `warnings`
(visible en Output); no lee marcador/catálogo ni escribe recursos. No lanza un
error global de activación. En las demás respuestas `busy` se omite. El propietario
cierra y retira su lock en `finally`, también ante errores. Nunca retira un lock
ajeno. Tras un crash el lock puede quedar: se falla cerrado con diagnóstico de
reparación manual, sin expiración, leases, scheduler, reintentos automáticos ni
heurísticas para declarar un lock obsoleto. El operador debe verificar que no
hay instalador activo antes de reparar manualmente el lock.

El lock serializa instaladores cooperantes que usan la misma ruta de perfil;
no bloquea editores ni procesos externos. La revalidación rechaza cambios observados
durante el staging, pero Node no ofrece un compare-and-swap de rutas: no se promete
inmunidad a cambios externos entre la última comprobación y `rename`, ni durabilidad
transaccional del catálogo completo ante un crash. Si un ancestro se sustituye por
un enlace, se rechaza seguirlo incluso para limpiar; pueden quedar temporales/lock
propios en la carpeta desplazada que exijan inspección manual. Los tests incluyen
ENOSPC tras escritura parcial, creación sin destino colgante, sync/rename fallidos,
reintento seguro, ediciones durante staging, junction tardía y contención desde un
proceso Node separado antes de leer el marcador.

La evidencia es de Node + mock, no de instalación ni UI real de VS Code. Los
conflictos legacy reales quedan pendientes de inspección y reconciliación
explícita por el operador con baseline verificado y respaldo; estos tests no
los resuelven ni autorizan sobrescribirlos. La matriz PR34 anterior permanece
sin cambios y sus gates continúan pendientes.
