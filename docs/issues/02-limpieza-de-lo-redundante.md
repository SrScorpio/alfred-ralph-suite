# Limpieza de lo que la extensión única vuelve redundante

Estado: abierta. Inventario, no borrado. Nada se quita hasta marcar aquí qué
sobra y por qué.

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

## Hecho cuando

Cada candidato tiene una decisión: se queda, se quita o se aplaza. Lo que se
quita lleva el test que demuestra que el comportamiento restante no cambia.
