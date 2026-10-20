# Alfred Ralph Suite

Una extension. El equipo de Alfred Dev y el tablero de Ralph, sin preguntarte cual de las dos esta hablando.

## Que junta

- Los 12 agentes de Alfred Dev (orquestacion, quality gates, TDD, seguridad). El VSIX los trae en `catalog/` y, al activarse, los copia a `~/.copilot/agents`. Recarga la ventana para verlos en el selector del chat.
- El tablero Kanban, el runner, la memoria de proyecto y la barra lateral de Ralph Suite.
- El despacho nombra al subagente. Una tarea de implementacion abre el chat con `@junior-dev`; init con `@alfred`; analisis con `@product-owner`; memoria con `@tech-writer`. Si ademas tienes instalada Alfred Dev por separado, se usa la identidad que esa extension anuncia.

## Que no cambia

- GitHub sigue siendo la fuente de verdad del trabajo colaborativo.
- El backlog local vive en `docs/ralph/prd.json` y el runtime en `.ralph/`.
- El runner sigue siendo en serie. No lanza varias tareas a la vez.
- No se publica en el Marketplace.

## Instalar

```powershell
npm install
npm run compile
npm run package
code --install-extension alfred-ralph-suite-1.12.4.vsix
```

Despues, paleta de comandos, Developer: Reload Window.

No la instales a la vez que Ralph Suite: las dos registran los comandos `ralph-suite.*` y VS Code se queda con una. Alfred Dev por separado es opcional y, si esta, manda su identidad.

## Modelos

La ficha de cada agente trae la cadena, de izquierda a derecha. Copilot usa el
primero que exista en el selector. El nombre del selector manda: si no coincide
con el de la ficha, se corrige la ficha, no al reves.

- Dia a dia (junior-dev, product-owner, tech-writer, devops, selina, seo, lucius):
  GPT 6 Luna, `deepseek-v4-flash`, GLM 5.3 Flash, y al final `qwen3.8-flash`.
- Complicado (alfred, architect, qa-engineer, security-officer):
  Grok 4.7, GLM 5.3, `glm5.3`, GLM 5.3 Flash.
- Muy complicado (senior-dev): GPT 6.1 Sol, Grok 4.7, GLM 5.3.

Copilot usa el primero que exista. `qwen3.8-flash` solo entra si los anteriores
no estan instalados. `gemma4` no esta en ninguna ficha: no sostiene el protocolo
del junior (TDD, herramientas, escalar cuando no entiende). Quien la quiera la
elige en el selector. Los ids de NAN salen de nan.builders y de los modelos ya
instalados en este equipo. No se guarda ninguna clave.

## De donde sale

El runtime es el de ralph-suite 1.12.0. El catalogo de agentes es el de alfred-dev-vscode 0.9.0. Esta carpeta es el punto de union; esos dos repos siguen siendo los productos publicados.
