---
name: create-tests
description: "Usar al crear tests nuevos o decidir cómo testear. También: prueba, test, spec, coverage, E2E, Playwright, mocha, test plan."
---

# Crear tests

Antes de escribir el primer test: lee la guía de tests del proyecto
(`docs/test/README.md` y los planes que haya en `docs/test/`). Si el proyecto
tiene convenciones propias, mandan sobre esta skill.

## Convenciones del repo

- Los tests viven en `src/test/*.test.ts` y corren con `npm test`
  (`scripts/run-tests.js`): mocha + ts-node, Windows-safe.
- La API de VS Code no se importa de verdad: se sustituye por el mock
  `src/test/vscodeMock.js` (singleton inyectado por el runner). Espiar o
  mutar el mock, nunca simular el host a mano en cada test.
- Nunca dejes `.js` compilados junto a los `.ts` de `src/test`: el runner
  fuerza `TS_NODE_PREFER_TS_EXTS=true`, pero el `.js` huérfano es ruido que
  rompe la resolución. La única excepción es `vscodeMock.js`.
- Suites dirigidas con `npm test -- --grep "..."`; la suite completa antes de
  cerrar.
- La compilación se verifica aparte (`npm run compile`); el runner no compila.

## Cómo decidir el test (ADR-021: TDD condicionado)

- **Test-first por defecto** cuando existe un test determinista ejecutable y
  el resultado esperado es claro: RED → GREEN → REFACTOR.
- Si no existe, excepción explicada (por qué no hay test) + chequeos
  funcionales proporcionales al cambio.
- **Preserve-tests:** un test de preservación por cada comando u opción
  existente que se toque, y diff de salida (stdout/stderr/exit code) contra
  HEAD antes de cerrar. Toda diferencia que nadie pidió es una regresión.
- Features y fixes siempre llevan tests; esto no se relaja.

## E2E

Para apps y webview, el default es **Playwright** cuando toca E2E (conducta
visual o flujo completo que el mock no acredita). Si se puede verificar con un
test determinista contra el mock, unit basta. **Nunca inventes un runner** ni
un harness propio de E2E.

## Regla de oro

Si al crear tests repites un patrón que no está escrito —ubicación, mock,
setup, forma de aserción, criterio de E2E— actualiza esta skill o
`docs/test/README.md` para que la próxima vez ya esté dicho. Lo que se repite
dos veces se escribe una.
