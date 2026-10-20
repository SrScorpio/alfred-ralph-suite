# Registro de compliance

No es un dictamen jurídico. Es un registro técnico con evidencia.

**Fecha:** 19 de octubre de 2026
**Autor:** security-officer

> No existe evaluación formal previa: `plans/seguridad.md` (heredado, 2026-06-05) contenía reglas técnicas de datos y secretos, sin dictamen RGPD/NIS2/CRA. Este registro parte de esas reglas.

## Alcance

| Marco | Aplica | Motivo |
|-------|--------|--------|
| RGPD | parcial | Extensión local; no hay registro de tratamiento de datos personales. Se mantiene la regla heredada: sin PII en logs y enmascarar lo sensible antes de persistir. |
| NIS2 | no aplica (criterio actual, sin evaluación formal) | Herramienta de desarrollo local; no es proveedor de servicios de red ni sector crítico. |
| CRA | pendiente | Distribución actual como extensión VS Code de código abierto; no hay decisión registrada sobre comercialización en la UE. Revisar si el estado cambia. |

## Controles

| Control | Marco | Estado | Evidencia |
|---------|-------|--------|-----------|
| Sin secretos en el repositorio | General | cumple | Reglas de `AGENTS.md`; `.gitignore` ignora runtime y memoria; `src/test/repoIgnore.test.ts` |
| Sin PII ni tokens en logs ni notas; enmascarar lo sensible | RGPD | cumple | Regla heredada de `plans/seguridad.md`, aplicada en logs `.ralph/` y notas |
| Promoción a memoria estable solo con prefijos `DECISION:` / `MEMORIA:` / `BUG:` / `CONVENCION:` | RGPD | cumple | ADR-009; `stateManager.ts` / `contextInjector.ts` |
| Separación de datos: backlog (`prd.json`) / runtime (`.ralph/`) / memoria (`.agent/memories.md`) | General | cumple | ADR-009; `prdManager.ts`, `stateManager.ts` |
| HTTPS y tokens con scopes mínimos en comunicaciones remotas | General | pendiente | Regla heredada; hoy no hay endpoint remoto activo en la extensión |
| Packaging de releases correcto vía `vsce` | CRA | parcial | Flujo VSIX en CI (`.github/workflows/build.yml`); sin evaluación de firma dedicada |

Estados: `cumple` (con evidencia), `parcial`, `pendiente`, `no aplica`, `riesgo aceptado`.

## Riesgos aceptados

| Hueco | Quién | Cuándo | Motivo |
|-------|-------|--------|--------|

Ninguno registrado.
