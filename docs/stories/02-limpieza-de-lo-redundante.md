# Limpieza de lo que la extensión única vuelve redundante

Estado: cerrada el 21 de octubre de 2026. Cada candidato tiene decisión escrita;
no se ha eliminado ningún fichero ni comando. La ejecución de lo que se quita va
a historias posteriores, con su test.

## Candidatos

- Comandos `alfred-dev.ralph.*` del puente. Aquí no hay dos extensiones que
  conectar: el tablero y el runner son de esta misma.
- La detección de `SrScorpio.alfred-dev-vscode` como extensión hermana. Queda
  solo para el caso de tener las dos instaladas, y ese caso hay que decidirlo:
  o se prohíbe, o se respeta la identidad anunciada.
- `ralph-suite.modelProfiles` frente a la cadena `model:` de cada ficha. Las
  fichas ya dicen el modelo. El perfil de Ralph recomienda otro y no lo aplica.
- Guardrails por defecto que repiten reglas ya escritas en las fichas
  (`Never modify prd.json`, lectura de memorias, señales de completado).
- Ids de modelo viejos en cualquier prompt o ajuste: GPT 5.6, Grok 4.6 y
  `security-audit` ya no forman parte de la cadena.
- `plans/` como documentación viva. El layout vigente es `docs/`; `plans/`
  queda como histórico o se archiva.
- `prd.json` en la raíz como respaldo legado, cuando el proyecto ya tiene
  `docs/ralph/prd.json`.

## Decisiones

Criterio general: se queda lo que sostiene el contrato publicado o un caso real
del producto; se quita lo que ya no tiene sujeto (comportamiento, fichero o
ajuste) y solo genera deuda; se aplaza lo que depende de una decisión externa o
de una API que todavía no existe.

### 1. Comandos puente `alfred-dev.ralph.*` — **se queda** (solo el consumo)

Hecho verificado: `package.json` no contribuye ningún comando `alfred-dev.*`
(hoy ni en el historial de `git`), y `src/` no registra ninguno. Lo único que
existe es `ANNOUNCE_IDENTITY_COMMAND = 'alfred-dev.ralph.announceIdentity'` en
[alfredIdentity.ts](../../src/alfredIdentity.ts:20), que Ralph **llama**, no
publica. Es el contrato de lectura del modo Alfred (ADR-018 §2), y desde 1.12.x
la propia suite cubre ese papel con `builtinIdentity.ts` cuando Alfred Dev no
está instalada.

- Se queda: la llamada al comando anunciado como capacidad opcional.
- Se quita (en historia aparte): cualquier código que pretenda publicar o
  registrar comandos `alfred-dev.ralph.*` como puente entre dos extensiones. No
  existe hoy; se deja escrito para que no se reintroduzca. Test de la limpieza:
  aserción de que `contributes.commands` de `package.json` no contiene ningún
  id `alfred-dev.*` y que `ANNOUNCE_IDENTITY_COMMAND` solo aparece como lectura.

### 2. Detección de `SrScorpio.alfred-dev-vscode` — **se queda**

No es redundante: es la detección de una capacidad anunciada, con contrato
fail-closed y tests. La historia plantea dos salidas (prohibir la convivencia o
respetar la identidad anunciada) y la decisión ya está tomada en ADR-018: **se
respeta la identidad anunciada**, sin prohibir la convivencia y sin leer
configuración ajena.

Matiz de implementación ya vigente: si la extensión no está pero la suite sí
(`self`), se usa `builtinAlfredIdentity()`; por eso una instalación sola entra
en modo Alfred y la detección no queda muerta. Riesgo residual aceptado:
suplantación del id con extensión local (ADR-018, sección de riesgos).

- Se queda tal cual: `ALFRED_EXTENSION_ID`, `announcesIdentityCommand`,
  `resolveAlfredMode` y sus tests.
- No se añade ningún `deny`/`block` de convivencia.

### 3. `ralph-suite.modelProfiles` — **se queda**; el test de paleta se corrige

ADR-017 ya decidió Opción A: recomendación con vocabulario Ralph, sin router ni
paleta Alfred. No compite con la cadena `model:` de las fichas porque mide otro
eje (engine/mode) y las fichas mandan siempre que exista identidad (en modo
Alfred ni se lee). Quitarlo dejaría a un usuario solo-Ralph sin recomendación y
rompería ADR-007/ADR-017 sin ganar nada.

Queda una deuda real detectada: [modelProfiles.test.ts](../../src/test/modelProfiles.test.ts:153)
se llama «no lee `alfred-dev.modelProfile`» pero solo comprueba que el prompt no
contiene el texto; no verifica qué sección pide `getConfiguration`. El plan de
pruebas ya lo admite como hueco (test tautológico). Decisión: se queda el
ajuste y **se refuerza el test** para que inspeccione la sección solicitada. Es
una corrección de test, no un borrado; va en historia aparte.

### 4. Guardrails por defecto repetidos — **se queda el ajuste; se quita la duplicación**

`ralph-suite.guardrails` conserva su función (voz de Ralph cuando no hay modo
Alfred; el modo Alfred ya los silencia, ADR-018 §4). Lo que sobra es el texto
duplicado en cuatro sitios: defaults de `package.json`, `AGENTS.md` generado,
prompt de tarea y fichas del catálogo.

Duplicaciones concretas y decisión:

| Regla | Dónde se repite | Decisión |
|---|---|---|
| `Never modify prd.json` | `package.json` (default 1), `AGENTS.md` generado, `promptBuilders` (línea fija «Do NOT modify prd.json»), ficha de `alfred` | El ajuste **se queda** como configurable; el texto fijo del prompt **se aplaza** (quitarlo cambia el contrato del prompt, fuera de esta historia). El `AGENTS.md` generado **se queda**: es el manual del proyecto, no el prompt. |
| Lectura de memoria (`.agent/memories.md`) | default 10 y 16 de `package.json` | **Se quita** en historia aparte: contradice ADR-020 (la memoria es `docs/project/status.md`; `memories.md` no se inyecta). El ajuste `memoriesPath` ya está marcado obsoleto y solo sirve para migrar. |
| Señales de completado (`completed` + `NOTA:`) | defaults 7, 8 y 18 de `package.json` | **Se quita** del default en historia aparte: ya las emite un bloque dedicado del prompt y el protocolo de `AGENTS.md`. Mantenerlas en la lista invita a que se apliquen a trabajo ad hoc, justo lo que la regla 7 prohíbe. |
| IDs, GitHub, commits, tests, secretos | defaults 3-6, 9, 11-15, 17 | **Se quedan**: son la voz propia de Ralph para el Ralph autónomo y no están en el protocolo generado. |

Guardarraíl de la limpieza: los tests que hoy asertan estos defaults
([docsLayout.test.ts](../../src/test/docsLayout.test.ts:245)) se ajustan en el
mismo cambio que los quite. Sin test que demuestre que el resto del prompt no
cambia, no se toca el default.

### 5. Ids de modelo viejos — **se quita** (un resto) / **se aplaza** (el resto)

- `security-audit`, `gpt-5`, `gpt-5-codex`: ya fuera de defaults y normalizados
  en runtime (ADR-017). Solo sobreviven como cadenas de test negativas y en el
  ADR/CHANGELOG como historia. **Se quedan como test**; no son configuración.
- **Se quita**: `catalog/agents/lucius.agent.md:205` («**Modelo:** GPT 5.6 Luna
  (chat) o Codex CLI»). Es el único id viejo en un prompt de producto y
  contradice la cadena `model:` de la propia ficha. Cambio de una línea en
  historia aparte, con el test de que el catálogo no nombra modelos fuera de
  sus frontmatter. No requiere ADR: no cambia arquitectura.
- `Grok 4.6`: no aparece en el repositorio (la cadena vigente es Grok 4.7); no
  hay nada que quitar. Se aplaza solo la verificación de que no reaparezca: se
  cubre con el mismo test de catálogo del punto anterior.

### 6. `plans/` como documentación viva — **se quita** (ya retirado)

`plans/` no existe en el árbol (`Test-Path plans` → falso) y su contenido se
migró a `docs/` en `7fcd81f` («retiro de plans/»). No queda acción de borrado.
Se queda únicamente la lógica que **detecta y avisa** de overrides de usuario
que citan `plans/` o `/plan/` (ADR-018 §6, cero escrituras). Eso no es
documentación viva: es saneado de configuración de usuario.

- Se queda: `detectPlanOverrides`, la validación de `preamble` y sus tests.
- Se quita: cualquier resurrección de `plans/` como layout; ya cubierto por los
  tests de [docsLayout.test.ts](../../src/test/docsLayout.test.ts:214).

### 7. `prd.json` legado en la raíz — **se queda el fallback; se quita el fichero**

El fallback de [prdManager.ts](../../src/prdManager.ts:162) es una red para
workspaces heredados y está cubierto por tests (incluido «usa el PRD legado si
el moderno existe pero no tiene issues»). Quitarlo rompería proyectos que aún
no han migrado, sin ganar nada. **Se queda** con su precedencia actual:
`docs/ralph/prd.json` manda; el legado solo entra si el moderno falta o está
vacío.

El fichero en sí no existe en este repo (`Test-Path prd.json` → falso; está en
`.gitignore`), así que **no hay nada que borrar**. Si apareciera, la decisión es
**se quita el fichero, se queda el código**: migrar su contenido a
`docs/ralph/prd.json` con autorización del maintainer y retirarlo después, en
historia aparte y con confirmación explícita (checkpoint: borrado de ficheros).

## Resumen de decisiones

| Candidato | Decisión | Acción de limpieza |
|---|---|---|
| Comandos puente `alfred-dev.ralph.*` | Se queda el consumo; se quita el puente | Ninguna hoy: no existe el puente |
| Detección de `alfred-dev-vscode` | Se queda | Ninguna |
| `modelProfiles` | Se queda | Reforzar el test de sección ajena (historia aparte) |
| Guardrails repetidos | Se queda el ajuste; se quita la duplicación | Retirar memoria y señales de los defaults (historia aparte) |
| Ids de modelo viejos | Se quita `GPT 5.6` de `lucius`; el resto es historia | Historia aparte, una línea + test de catálogo |
| `plans/` | Se quita el layout; se queda el aviso de overrides | Ninguna: ya retirado en `7fcd81f` |
| `prd.json` legado | Se queda el fallback; se quita el fichero si existe | Ninguna: no existe en este repo |

Sin borrados en esta historia: los cambios enumerados (defaults, test de
`modelProfiles`, línea de `lucius`, retirada de un `prd.json` heredado) quedan
como trabajo posterior, cada uno con su test de preservación.

## Hecho cuando

Cada candidato tiene una decisión: se queda, se quita o se aplaza. Lo que se
quita lleva el test que demuestra que el comportamiento restante no cambia.
