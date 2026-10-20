# ADR-021: ODD mixto como forma de trabajar

- **Estado:** aceptado
- **Fecha:** 19 de octubre de 2026
- **Issue:** [SrScorpio/alfred-ralph-suite#21](https://github.com/SrScorpio/alfred-ralph-suite/issues/21) (ejecuta su decisión: postura mixta TDD→ODD)
- **Relacionado:** fichas actualizadas: `junior-dev`, `qa-engineer`, `alfred`, `product-owner`; plantilla nueva `catalog/templates/odd-feature.md`

## Contexto

La issue #21 evalúa virar el equipo de un TDD estricto en `junior-dev` hacia
ODD (Organic-Driven Development) tal como lo practica
[Gentleman-Programming/gentle-ai](https://github.com/Gentleman-Programming/gentle-ai).
El equipo ya tiene gates de calidad que funcionan (tests obligatorios en
features y fixes, review de QA) y un modelo de memoria recién decidido
(ADR-020). No se adopta un framework externo: se adoptan prácticas concretas.

Clasificación exigida por la issue (adoptar / adaptar / descartar, con motivo):

| Práctica de gentle-ai | Veredicto |
|---|---|
| Feature doc ODD (specs verbatim, log, handoffs por referencia) | **Adoptar** |
| Tamaño por «resume test», trabajo pequeño inline | **Adoptar** |
| Test-first condicionado + preserve-tests | **Adaptar** (sustituye al TDD estricto incondicional) |
| Bounded review (commit/slice, no checkboxes) | **Adoptar** |
| Delegate-for-a-reason | **Adoptar** |
| Engram (memoria MCP ajena) | **Descartar** |
| RDD: CLI de review con receipts | **Descartar** |
| Umbral de 400 líneas + auto-chain de PRs | **Descartar** |

## Decisión

Se adopta la postura **mixta**: ODD como forma de organizar el trabajo, con las
gates de calidad del equipo intactas. Cuatro prácticas entran:

1. **Feature doc ODD para trabajo sustancial.** El trabajo sustancial tiene un
   feature doc (plantilla `catalog/templates/odd-feature.md`): especificación
   con las peticiones del usuario **verbatim** (S1..Sn), registro cronológico
   L1..Ln (L1 = petición original) y handoffs **por referencia** al doc, nunca
   paráfrasis. El trabajo **pequeño va inline**, clasificado por el «resume
   test»: ¿se puede retomar desde la petición + `git diff`? Si sí, inline; si
   no, feature doc.

2. **TDD condicionado.** Test-first **por defecto** cuando existe un test
   determinista ejecutable y el resultado esperado es claro:
   RED → GREEN → REFACTOR. Si no existe, **excepción explicada** (por qué no
   hay test) + chequeos funcionales proporcionales al cambio.
   **Preserve-tests:** un test de preservación por cada comando u opción
   existente tocada, y diff de salida (stdout/stderr/exit code) contra HEAD
   antes de cerrar; toda diferencia que nadie pidió es regresión.
   **Las gates no se relajan:** features y fixes SIEMPRE llevan tests.

3. **Bounded review.** La review es acotada: máximo **una corrección acotada**
   y **una aceptación exacta**, sobre un commit o un slice del PR, nunca sobre
   checkboxes ni sobre la rama acumulada. Un hallazgo no amplía el alcance de
   la review.

4. **Delegate-for-a-reason.** Se delega solo con motivo explícito y nombrado
   (exploración que no cabe inline, escritores paralelos independientes,
   verificación de riesgo alto, descarga de contexto). Ante la duda, el padre
   trabaja inline.

### Descartes, con motivo

- **Engram**: memoria MCP de un ecosistema ajeno; la memoria del proyecto ya
  tiene dueño y forma en ADR-020 (GitHub + `status.md`).
- **RDD (CLI/receipts)**: obligaría a construir y mantener un harness de review
  con pruebas de procedencia; la bounded review manual sobre commit/slice
  cubre lo que el equipo necesita hoy.
- **Umbral de 400 líneas + auto-chain de PRs**: heurística de tamaño y
  automatización que no aporta sobre el «resume test» + gates existentes, y
  añade política de entrega que el equipo no ha pedido.

## Consecuencias

- `junior-dev` pasa de TDD estricto a TDD condicionado con preserve-tests y
  clasificación por resume test; sigue escalando igual y sus gates siguen
  siendo las mismas que las de `senior-dev`.
- `qa-engineer` revisa por commit/slice con bounded review; `alfred` delega
  con motivo explícito; `product-owner` abre feature docs ODD para historias
  sustanciales.
- El equipo gana trazabilidad (petición verbatim + log) sin burocracia para el
  trabajo pequeño.
- Riesgo asumido: «excepción explicada» puede convertirse en excusa para no
  testear; lo neutraliza la regla de que features y fixes siempre llevan tests
  y la review de QA.

## Fuentes

- [Gentleman-Programming/gentle-ai](https://github.com/Gentleman-Programming/gentle-ai):
  `README.md` (ODD, delegate-for-a-reason), `docs/usage.md` (protocolo ODD,
  resume test, test-first condicionado, preserve-tests, review candidate),
  `docs/skill-registry.md` (SDD retirado: prefijo `sdd-*` reservado).
- Prácticas de [ericrisco/rsc-harness](https://github.com/ericrisco/rsc-harness)
  evaluadas en #22 (guardrails) fuera del alcance de este ADR.
