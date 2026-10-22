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

## Default propuesto: Playwright

Para E2E de apps y webview el default propuesto es **Playwright** (control de
la webview, trazas, runners por navegador). Su adopción real —instalarlo,
configurarlo y decidir el alcance— es una decisión aparte, no parte de esta
guía. No se inventa un runner propio.
