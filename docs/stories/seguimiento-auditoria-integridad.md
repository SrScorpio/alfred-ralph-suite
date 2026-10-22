# Seguimiento de la auditoría de integridad

Fecha de referencia: 22 de octubre de 2026.

## Alcance y fuente de estado

Este documento conserva el alcance de los siete hallazgos de la auditoría y su
secuencia de corrección. No es un backlog alternativo ni sustituye el estado
colaborativo de GitHub o su [snapshot](../project/status.md).
Las fases y los números de hallazgo son referencias de este documento, no IDs
Ralph, números de issue ni ADR. Las unidades de seguimiento son
SrScorpio/alfred-ralph-suite#35, SrScorpio/alfred-ralph-suite#36 y
SrScorpio/alfred-ralph-suite#37. No se ha modificado el backlog.

«Validado en local» no significa integrado ni validado interactivamente con la
extensión instalada. QA de fase 1 y QA final H3–H7 están aprobados para su
alcance; la revisión final de seguridad de hook/fixtures es favorable y acotada.
Las evidencias están registradas en las issues; no equivalen a certificación de
seguridad global. La instalación CLI del VSIX en un entorno aislado está
confirmada como `srscorpio.alfred-ralph-suite@1.12.5`; la validación UI sigue
pendiente y motiva la entrega como PR draft.

## Mapa completo

| Fase | Trabajo | Hallazgos originales | Situación al registrar | Dependencia real |
|---|---|---|---|---|
| 1 | Propiedad y recuperación de la ejecución | 1 y 2 | Implementada y validada en local; entrega pendiente | Contrato aprobado por el maintainer |
| 2 | Identidad literal y sincronización determinista | 4 y 5 | Implementada y revisada en local; integración pendiente | Encargo autónomo autoriza rechazo explícito y sincronización por comando, sin nueva codificación |
| 3 | Correcciones acotadas de hook, estados y lecturas | 3, 6 y 7 | Implementada y revisada en local; integración pendiente | Hook implementado y probado solo en fixtures; instalación real no autorizada |
| Transversal | Evidencia, documentación e integración | Todas | Pendiente de integración/publicación | Gates de cada cambio y autorización de commit/entrega |

El orden recomendado es 1 → 2 → 3. Las tareas de la fase 3 no dependen
funcionalmente de la fase 2 y pueden prepararse en superficies separadas.

## Fase 1 — Propiedad de la ejecución

### Implementación y regresiones validadas

- [x] Reserva única por instancia de extension host para entradas manuales y
  autorunner, también con raíces o tareas distintas.
- [x] Adquisición síncrona antes de esperar la identidad; liberación solo con el
  token propietario.
- [x] Resultado desconocido tras timeout, parada o envío ambiguo: sin reset
  automático a disponible, sin reintento ni avance automático.
- [x] Recuperación explícita; llamadas concurrentes comparten confirmación y la
  cancelación queda vinculada a la reserva.
- [x] Una señal `completed` durante un envío ambiguo no libera la reserva.
- [x] No copiar al portapapeles un prompt de envío desconocido.
- [x] Autorunner con reserva activa: esperar y retornar sin otro despacho ni
  incremento del contador de tareas.
- [x] Documentar compatibilidad de `taskRetries` y límites de la protección.
- [x] Limpiar los tres directorios de fixtures creados accidentalmente, con
  autorización expresa; ejecuciones posteriores no los reprodujeron.
- [x] Suite completa: **321 passing**; `npm run compile`: correcto.
- [x] QA y seguridad: **APROBADO** en la revisión final del alcance.
- [x] Backlog real intacto: SHA-256
  `223BC6BE579528DFBDA261A82FC561801C3F27BF214863FCACBC35D8E6C09873`.

### Cierre documental y entrega todavía pendientes

- [x] Registrar alcance y evidencia de las revisiones en
  SrScorpio/alfred-ralph-suite#35, sin inferir IDs Ralph.
- [x] Actualizar el [modelo de amenazas](../project/threat-model.md) para reflejar
  reserva, resultado desconocido, consentimiento y limitaciones vigentes
  (actualización documental de este encargo, no nueva firma de seguridad).
- [ ] Validación manual de la extensión instalada: ejecución normal, doble
  lanzamiento, timeout/parada, cancelación de recuperación y cierre del panel.
- [x] Revisar el diff final aislando los cambios ajenos que ya estaban presentes.
- [x] Autorización explícita de commit, push normal y PR en rama separada.
- [ ] CI y revisión del diff efectivamente publicado antes del merge.
  El merge lo decide el usuario y no está autorizado en este encargo.
- [x] Paquete VSIX de comprobación e instalación CLI aislada confirmados;
  validación UI pendiente. No se ha generado ni publicado una release.

### Límites que no deben perderse

- No hay cancelación remota acreditada ni coordinación entre ventanas.
- Las señales siguen identificadas por ID local; tras recuperación no se pueden
  atribuir con certeza a un intento concreto si llega una señal antigua.
- Cancelar la recuperación no equivale a permitir otro lanzamiento. Cualquier
  cambio de esa semántica exige definir y validar de nuevo el consentimiento.
- Paralelismo, leases entre procesos y protocolo por intento no forman parte de
  esta corrección; no se reabren implícitamente.

## Fase 2 — Identidad y sincronización

### Hallazgo 4: preservar identidad literal

- [x] Contrastar `uniqueId`, `safeTaskId`, dependencias, rutas runtime y lectores.
- [x] Reproducir colisiones por sanitización/truncado y reasignación por orden.
- [x] Aplicar el tratamiento solicitado: diagnóstico y rechazo de IDs inválidos
  o duplicados, sin renombrado, renumeración ni migración del backlog.
- [x] Determinar que no hace falta codificación nueva: se conserva el alfabeto
  runtime existente `[A-Za-z0-9_.-]`, longitud 1–80, sin trim ni sustituciones.
  Se rechazan también colisiones por mayúsculas/minúsculas, para Windows.
- [x] Implementar validación literal en productores y consumidores afectados;
  los IDs numéricos legacy conservan su representación decimal existente.
- [x] Probar colisiones, duplicados, longitud, reordenación, dependencias y IDs
  válidos. Aplicar todos los overrides antes de evaluar dependencias evita
  que su resultado dependa del orden del backlog.
- [x] Documentar errores y procedimiento para datos incompatibles: el error
  identifica el ID o elemento; el maintainer debe resolverlo explícitamente
  antes de reintentar. Ralph no repara, renombra ni migra automáticamente.

**Criterio de aceptación:** leer o reordenar el backlog no cambia la identidad ni
asigna a otra tarea sus dependencias o señales. No se modifica ningún `prd.json`.

### Hallazgo 5: una sola sincronización determinista

- [x] Contrastar prompts masivos, comando individual y mapeo por repositorio.
- [x] Aplicar la política solicitada de labels locales explícitos `github:#N`
  u `owner/repo#N`; los cuerpos no son autoridad.
- [x] El prompt masivo invoca `ralph-suite.syncIssue` por issue, con número,
  estado y raíz: el comando vuelve a cargar el backlog y valida pertenencia,
  unicidad y estado. Sin capacidad de invocar comandos, informa que no sincronizó.
- [x] Eliminar instrucciones al chat para escribir estados en el filesystem.
- [x] Probar ausencia de labels, duplicados, IDs ajenos/cuerpos, coincidencias
  entre repositorios y estados permitidos; preservar el caso válido.
- [x] Verificar rechazo antes de escribir runtime y backlog intacto.
- [x] Alinear prompts, mensajes, documentación y pruebas de contrato/integración
  con el mock (no equivalen a un E2E del host).

La API numérica existente no incorpora un argumento nuevo de repositorio:
rechaza varias tareas con el mismo número y también varios repositorios o
números en una única tarea. Alias equivalentes `github:#N` + `owner/repo#N`
son compatibles cuando identifican un único mapeo. El prompt exige identificar el repositorio
remoto y contrastarlo con el label cualificado; ante duda omite y reporta.
`github:#N` conserva su alcance no cualificado legacy; no acredita por sí solo
la identidad de un repositorio remoto.

**Dependencia:** usar el contrato literal de identidad aprobado; no mezclar una
nueva codificación de archivo con la sincronización sin probar ambos extremos.

**Gate de fase:** regresiones dirigidas, suite completa y compilación verdes;
QA y seguridad del diff, documentación y aprobación de los cambios de contrato.

## Fase 3 — Correcciones independientes

### Hallazgo 3: integración del Secret Guard

- [x] Reproducir `exit 0` anticipado (omite el guard) y último comando fallido
  (el guard lo convertía en éxito) en repositorios fixture desechables.
- [ ] Obtener autorización de instalación real: **no solicitada ni ejecutada**;
  este encargo solo autoriza implementación y pruebas aisladas.
- [x] Componer en procesos separados: el hook previo corre primero; su fallo
  conserva el código y corta la cadena; tras éxito, `exec node` conserva el
  código del guard. Un marcador legacy no reconocido exige integración explícita
  y rechaza la instalación sin anunciar éxito.
- [x] Conservar los bytes del hook en `pre-commit.alfred-previous`, con copia
  exclusiva: si la ruta está ocupada, no reemplazar ninguno de los hooks.
  Rechazar también scripts del guard ajenos y rutas especiales/enlaces en vez
  de seguirlos o sobrescribirlos.
- [x] Probar ausencia de hook, hook previo, `exit 0`, fallo con/sin `exit`, fallo
  del guard, argumentos/cwd, `core.hooksPath` en fixture e idempotencia.
- [x] Documentar funcionamiento: la instalación explícita requiere Git con shell
  compatible y Node en PATH. No modifica `core.hooksPath`; respeta la ruta que
  devuelve Git. No es un interceptor del editor ni garantía de detectar todo
  secreto. No se instalaron hooks ni se alteró configuración del repositorio real.

- [x] Corrección tras QA: rechazar antes de escribir los hooks que dependen de
  `$0`/`${0…}` o `BASH_SOURCE`, incluidos `dirname` y dispatchers Husky por nombre.
  Ejecutarlos como `pre-commit.alfred-previous` cambia su identidad y puede omitir
  sus controles con `exit 0`; no se intenta adaptar dispatchers arbitrarios.
- [x] Exigir integración manual para formatos antiguos/no reconocidos e
  intérpretes fuera de sh/bash/dash, sin anunciar instalación. Revalidar el hook
  preservado al reinstalar; un rechazo conserva bytes y rutas sin reparar ni
  desinstalar automáticamente una composición insegura existente.
- [x] Aislar Git en cada fixture: variables `GIT_*` restauradas en teardown,
  global/system controlados, templates vacíos y `core.hooksPath` local fijado y
  verificado antes de instalar. El global absoluto usado para la regresión es
  sintético y permanece intacto. Fixtures de hook/integridad en `os.tmpdir()`,
  sin redefinir `TEMP`/`TMP` ni instalar hooks fuera de los fixtures.

**Criterio de aceptación:** el guard se ejecuta cuando se anuncia activo y no
convierte en éxito un fallo del hook existente. Cuando no se puede conservar la
identidad del hook previo, se rechaza y se exige integración manual.

### Hallazgo 6: establecer «todo» de forma explícita

- [x] Separar drag-and-drop/`syncIssue(todo)` de reset.
- [x] Usar `setTodoOverride`: escribe literalmente `todo` en runtime para las
  acciones de establecer ese estado, independientemente del estado base.
- [x] Mantener reset como restauración de la base: retira el override, conserva
  historial y muestra «Restaurar estado del backlog» (también en inglés).
- [x] Probar bases `completed`, `failed` e `inprogress`, con/sin override,
  recarga del modelo y ruta `moveCard` del panel mediante el mock singleton.
- [x] Alinear texto del tablero, mensajes de trust, documentación y aserciones
  de activación. Las dependencias no completadas siguen bloqueando la ejecución.

**Criterio de aceptación:** elegir «todo» conserva ese estado tras recargar,
independientemente del estado base del backlog.

### Hallazgo 7: lectura de estados sin efectos secundarios

- [x] Contrastar `getStatus`, consumidores y watchers.
- [x] Eliminar reescrituras; una sola lectura del contenido por consulta.
- [x] Conservar la primera línea no vacía, con trim; un valor desconocido o
  fichero ausente devuelve `todo`, sin reparar el contenido.
- [x] No introducir reparación automática ni una API de reparación nueva.
- [x] Probar bytes, mtime y lectura única, incluyendo una señal nueva concurrente
  que antes podía ser sobrescrita; cubrir consultas individuales y agregadas.
- [x] Documentar: los nombres runtime inválidos se ignoran con diagnóstico y sin
  cambios de archivo; un ID inválido en el backlog rechaza la carga completa.

**Criterio de aceptación:** consultar un estado no altera el archivo ni provoca
un evento de escritura de la propia extensión.

**Gate por corrección:** prueba de regresión, preservación del comportamiento
válido, documentación, suite/compilación y QA/seguridad del alcance. No es
necesario esperar a terminar las tres para revisar cada una.

## Tareas transversales y checkpoints

- [x] Unidades de trabajo dadas de alta: SrScorpio/alfred-ralph-suite#35,
  SrScorpio/alfred-ralph-suite#36 y SrScorpio/alfred-ralph-suite#37.
  No se crean ni renumeran IDs Ralph.
- [x] Diagnóstico y aprobaciones acotadas registrados en las issues.
- [x] Conservar cambios ajenos en la rama original; la entrega autorizada usa
  exclusivamente una rama y un worktree separados.
- [x] Añadir pruebas de regresión y preservación; ejecutar primero selectores
  dirigidos y después suite completa y compilación (evidencia abajo).
- [x] Distinguir expresamente mocks/contratos de comportamiento real del host.
- [x] Persistir evidencia de QA/seguridad en las issues; no declarar
  compliance global ni ausencia de CVEs basándose en estas revisiones acotadas.
- [ ] `tech-writer` sincroniza GitHub → snapshot al cierre de cada fase; no usar
  este documento para dar por cerrada una issue aún abierta.
- [x] Respetar checkpoints: solo se limpian fixtures autorizados; no se cambia
  seguridad real, esquema, dependencias ni arquitectura fuera del alcance.
- [x] No escribir señales de completado runtime para este seguimiento ad hoc.

## Trabajo existente que debe mantenerse separado

Consulta GitHub del 22/10/2026; no implica cierre ni aprobación de esos trabajos:

| Referencia | Trabajo | Estado consultado |
|---|---|---|
| SrScorpio/alfred-ralph-suite#9 | Validar la extensión instalada sola | `in-progress`; el ID local enlazado sigue `todo` |
| SrScorpio/alfred-ralph-suite#10 | Decidir qué sobra de las dos extensiones | `backlog` |
| SrScorpio/alfred-ralph-suite#12 | Paralelismo real de Auto Run | `blocked`, condicionado por ADR-019 |
| SrScorpio/alfred-ralph-suite#13 | Política de sesión por acción | `blocked`, condicionado por ADR-019 |
| SrScorpio/alfred-ralph-suite#14 | Modo de lanzamiento por defecto | `blocked`, condicionado por ADR-019 |
| SrScorpio/alfred-ralph-suite#15 | Permisos de autorizar todo | `blocked`, condicionado por ADR-019 |
| SrScorpio/alfred-ralph-suite#34 | PR de guía de defaults del chat | Abierto; rama `feat/guia-defaults-chat` |

El snapshot consultado no recoge el PR abierto anterior ni el cierre local de la
fase 1. Esa reconciliación queda pendiente; no se modifica el snapshot ni el
backlog en este encargo documental.

## Evidencia local de las fases 2 y 3

Evidencia histórica de implementación del encargo autónomo del 22/10/2026,
previa a las revisiones finales registradas al cierre. Los cambios de fase 1 ya
existían al comenzar y se han preservado.

- RED inicial de identidad/sync/estados: **2 passing, 13 failing**. RED del hook:
  **2 passing, 3 failing**, más reproducción dirigida del último comando fallido
  convertido en éxito (**0 passing, 1 failing**). También se reprodujo la
  dependencia sensible al orden antes de corregirla.
- Validación dirigida final:
  `npm.cmd test -- --grep "Integrity audit|activation command guards|PRD normalization|GitHub sync|AC8"`:
  **58 passing**.
- Suite completa: `npm.cmd test -- --reporter dot`: **356 passing**, sin pendientes
  ni fallos. `npm.cmd run compile`: correcto. Diagnósticos del editor: sin errores
  en los archivos de código cambiados. `git diff --check`: correcto.
- Los comandos de pruebas definieron `TEMP`/`TMP` en `.test-fixtures` bajo el cwd;
  los fixtures nuevos tienen prefijos únicos y cleanup autorizado. No se
  instalaron dependencias ni se cambió la política de ejecución PowerShell.
- SHA-256 del backlog real antes/después:
  `223BC6BE579528DFBDA261A82FC561801C3F27BF214863FCACBC35D8E6C09873`.
  No se ha escrito ningún `prd.json` real; solo fixtures aislados.
- Diferencias esperadas del contrato: IDs incompatibles se rechazan en vez de
  renombrarse; `syncIssue(todo)` conserva un archivo `todo` en vez de retirarlo;
  la consulta ya no repara archivos; el hook conserva fallos previos y ejecuta el
  guard tras un `exit 0`. Los tests existentes de activación y normalización se
  actualizaron exclusivamente en esas expectativas solicitadas.

### Evidencia de la corrección acotada tras QA

- RED, tras aislar Git y antes de corregir el instalador:
  `npm.cmd test -- --grep "Integrity audit Secret Guard" --reporter dot`:
  **11 passing, 7 failing** (rechazos ausentes: dispatcher, cuatro variantes
  de identidad shell, intérprete no compatible y reinstalación insegura).
  El dispatcher original devuelve **29**; renombrarlo sin preservar `$0` pierde
  el script por nombre y permite éxito. El test conserva el fallo original y
  comprueba rechazo sin cambios en dos intentos consecutivos.
- GREEN final dirigido:
  `npm.cmd test -- --grep "Integrity audit" --reporter dot`: **43 passing**.
- Suite completa: `npm.cmd test -- --reporter dot`: **364 passing**;
  `npm.cmd run compile`: correcto; `git diff --check`: correcto (solo avisos de
  conversión LF/CRLF preexistentes). Sin nuevas dependencias ni commits.
- Backlog real intacto, SHA-256 antes/después:
  `223BC6BE579528DFBDA261A82FC561801C3F27BF214863FCACBC35D8E6C09873`.
  Sin hooks reales, configuración global/system real, señales runtime del
  proyecto ni cambios en `docs/project/status.md`.
- Esta ejecución reemplaza la recomendación anterior de redefinir `TEMP`/`TMP`:
  validación final con temporales del sistema, únicos y limpiados por cada test.
- Archivos de este ajuste: `src/security/secretHook.ts`,
  `src/test/secretHook.test.ts`, `src/test/integrityAudit.test.ts` (solo ubicación
  de fixtures), `docs/test/README.md`, `docs/project/threat-model.md` y este listado.
- QA independiente y revisión de seguridad acotada favorables registradas
  posteriormente en las issues y al cierre; estos resultados de tests por sí
  solos no son una aprobación de seguridad ni una validación de UI instalada.

### Archivos del alcance

- Identidad y estados: `src/stateManager.ts`, `src/prdManager.ts`,
  `src/boardSanitizers.ts`.
- Sync: `src/commands/syncIssue.ts`, `src/kanban/gitHubSync.ts`.
- UI/mensajes: cambios acotados en `src/kanbanPanel.ts`, `src/activate.ts` y
  `src/i18n.ts`, sin reemplazar las correcciones de fase 1.
- Hook: `src/security/secretHook.ts`; solo implementación y fixtures.
- Pruebas: nuevas `src/test/integrityAudit.test.ts` y `src/test/secretHook.test.ts`;
  ajustes de expectativas en `src/test/activate.test.ts` y `src/test/sanitization.test.ts`.
- Documentación: este seguimiento, `docs/test/README.md`,
  `docs/project/architecture.md` y `docs/project/threat-model.md`.

Este alcance no edita `docs/stories/01-*`, `02-*`, `03-*`, ADR-022 ni
`docs/project/status.md`. El runtime usado por los tests vive solo dentro de sus
fixtures. No se escriben señales `.ralph` del proyecto.

### Validación del árbol aislado para entrega

Sobre `origin/main` (`d78071e`), sin los cambios de PR34:

- `npm.cmd test -- --reporter dot`: **358 passing**, sin fallos ni pendientes.
  La diferencia frente a los 364 anteriores son los seis tests de PR34 excluidos.
- `npm.cmd run compile`: correcto.
- `git diff --check` y `git diff --cached --check`: correctos.
- Dependencias existentes reutilizadas mediante junction de `node_modules`;
  sin instalar paquetes ni cambiar manifests, lockfiles o dependencias.
- Backlog real original SHA-256 antes/después:
  `223BC6BE579528DFBDA261A82FC561801C3F27BF214863FCACBC35D8E6C09873`.
- El handoff coincide con el diff UTF-8 original y con los cinco archivos nuevos.
  El merge de tres vías aplica solo la auditoría sobre main sin conflictos ni
  dependencia de la guía de defaults; rama original y cambios ajenos preservados.

## Cierre de la ejecución autónoma

- Implementados los siete hallazgos en las tres fases; no se ha iniciado trabajo
  ajeno a esta auditoría.
- QA de fase 1 y QA H3–H7: aprobados para sus respectivos alcances, tras corregir
  composición de hooks dependientes de `$0` y aislamiento de fixtures respecto
  a hooks globales.
- Seguridad final del hook/fixtures: signoff acotado favorable, sin hallazgos
  sobre el umbral. La revisión anterior de identidad/sync/estados tampoco reportó
  vulnerabilidades demostrables sobre el umbral. No es certificación global.
- Límite de sync: el comando recibe número/estado/workspace, no una identidad de
  remoto verificada; no se garantiza aislamiento remoto extremo a extremo.
- Evidencia anterior al aislamiento: **364 passing**, compilación,
  `git diff --check` y empaquetado correctos; SHA-256 del backlog sin cambios.
  Esa suite incluía los tests de PR34; no se atribuye ese total al árbol de main.
- [x] VSIX de comprobación: `alfred-ralph-suite-audit-validation.vsix` en los
  archivos de sesión, versión de manifiesto 1.12.5. Instalación CLI aislada
  confirmada como `srscorpio.alfred-ralph-suite@1.12.5`; no acredita UI ni una
  release, ni valida por sí sola el árbol aislado para publicación. No se
  sobrescribieron los VSIX existentes y no se añade el paquete al PR.
- [x] Issues de seguimiento: SrScorpio/alfred-ralph-suite#35 (fase 1),
  SrScorpio/alfred-ralph-suite#36 (fase 2), SrScorpio/alfred-ralph-suite#37 (fase 3).
  Permanecen abiertas hasta revisión y merge; GitHub conserva su estado vigente.
- [x] Entrega autorizada explícitamente: commit en rama separada, push normal y
  PR a `main`. Auditoría aislada de PR34 y de los cambios ajenos mediante el
  manifiesto; sin dependencia funcional de la guía de defaults del chat.

### Pendientes que no pueden darse por terminados aquí

- Validación interactiva de la extensión instalada; los mocks no la acreditan.
  El PR se entrega como draft hasta completar esa gate.
- Instalación de hooks reales: checkpoint de configuración de seguridad;
  permanece fuera de esta entrega.
- CI: consultar checks del PR publicado, sin inferir éxito de las pruebas
  locales ni crear un pipeline. Merge y release no están autorizados.
- Sincronización de `docs/project/status.md`: el dueño `tech-writer` no pudo
  iniciarse por un identificador de modelo no reconocido. No se suplanta su
  ownership ni se cambia su modelo sin autorización explícita. GitHub conserva
  ya las unidades y evidencias para retomar sin depender del snapshot antiguo.
- Diferencia previa #9/ID local `todo`: no se corrige escribiendo el backlog.

No se declara todo integrado ni se cierra una issue por el mero resultado local.
