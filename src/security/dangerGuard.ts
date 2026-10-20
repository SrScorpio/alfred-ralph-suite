/**
 * dangerGuard.ts — Detección de comandos destructivos (issue #22)
 *
 * Adaptación del guard de rsc-harness a la superficie de VS Code.
 *
 * Filosofía FAIL-OPEN (deliberada y documentada): `checkDangerousCommand`
 * devuelve `null` cuando no hay coincidencia y NUNCA lanza; cualquier error
 * interno se trata como "sin coincidencia". Un guard que rompe el flujo del
 * runtime es peor que un guard que deja pasar un caso dudoso.
 *
 * Límite documentado de VS Code: esta extensión construye prompts y escribe
 * el runtime de `.ralph/`, pero NO ejecuta los comandos que los agentes
 * corren en el chat (no existen hooks de terminal tipo Claude Code). Por eso
 * el guard analiza el texto que la extensión embebe en prompts (descripción y
 * criterios de la tarea del backlog) y produce una advertencia visible; la
 * interceptación real de comandos no es posible y vive, como refuerzo, en las
 * fichas del catálogo de agentes y en `security/secretHook.ts` (pre-commit).
 *
 * Decisiones heurísticas documentadas (regex, no parser):
 * - Se ignoran las líneas de comentario (`--`, `//`, `#`, `/*`, `*`) antes de
 *   evaluar: una mención del patrón en comentario de código legítimo no es un
 *   comando en ejecución.
 * - En SQL destructivo se exige un identificador tras TABLE/DATABASE/SCHEMA y
 *   se descarta la coincidencia si la palabra clave va inmediatamente
 *   precedida de comilla o `%` (literal SQL / patrón LIKE). Un `SELECT` de
 *   ejemplo con `'drop table'` como texto no bloquea; `DROP TABLE usuarios;` sí.
 * - `rm` solo bloquea con recursivo+forzado a la vez (`-rf`, `-fr`, `-rvf`,
 *   `--recursive --force`...): un `rm archivo` simple o `rm -r` a secas no.
 * - El `.drop()` de colecciones se detecta como llamada con receptor
 *   (`db.users.drop()`, `collection.drop()`); `deleteMany` solo con filtro
 *   vacío (`{}`), que borra toda la colección.
 */

/** Coincidencia de un patrón destructivo. `blocked` es siempre `true`. */
export interface DangerousCommandMatch {
	blocked: boolean;
	/** Identificador estable del patrón (p. ej. `sql-drop-table`). */
	pattern: string;
	/** Por qué es destructivo. */
	reason: string;
	/** Cómo continuar: backup previo o alternativa segura. */
	guidance: string;
}

interface DangerousPattern {
	id: string;
	regex: RegExp;
	reason: string;
	guidance: string;
}

// Ventana "misma línea / mismo comando": un `;`, `&`, `|` o salto de línea
// corta el lookahead para no atribuir a un comando un flag de otro.
const SAME_COMMAND = '[^;&|\\r\\n]*';

const PATTERNS: DangerousPattern[] = [
	{
		id: 'sql-drop-table',
		regex: /(?<!['"`%])\b(?:drop\s+table|truncate\s+table)\s+(?:if\s+exists\s+)?["'`\[]?[A-Za-z_][\w$.-]*/i,
		reason: 'DROP/TRUNCATE TABLE elimina datos de la tabla sin recuperación vía undo.',
		guidance: 'Exporta un backup primero (pg_dump/mysqldump o COPY a fichero) y confirma el nombre exacto de la tabla; si es una limpieza, prefiere DELETE con WHERE acotado y transacción.',
	},
	{
		id: 'sql-drop-database',
		regex: /(?<!['"`%])\bdrop\s+(?:database|schema)\s+(?:if\s+exists\s+)?["'`\[]?[A-Za-z_][\w$.-]*/i,
		reason: 'DROP DATABASE/SCHEMA destruye el esquema completo y todo su contenido.',
		guidance: 'Haz un dump completo de la base de datos y verifícalo antes; considera renombrar la base de datos (ALTER DATABASE ... RENAME) como alternativa reversible.',
	},
	{
		id: 'git-push-force',
		regex: new RegExp(`\\bgit\\s+push(?=${SAME_COMMAND}\\s(?:--force-with-lease\\b|--force\\b|-f\\b))`, 'i'),
		reason: 'git push con fuerza reescribe la historia remota y puede borrar trabajo de otras personas.',
		guidance: 'Usa `git push --force-with-lease` solo tras verificar que nadie subió commits, o mejor `git revert` + push normal; si debes forzar, avisa al equipo primero.',
	},
	{
		id: 'git-reset-hard',
		regex: new RegExp(`\\bgit\\s+reset(?=${SAME_COMMAND}\\s--hard\\b)`, 'i'),
		reason: 'git reset --hard descarta cambios sin commitear de forma irreversible.',
		guidance: 'Crea un stash o un commit WIP antes (`git stash` / `git add -A && git commit -m wip`); para deshacer commits ya creados prefiere `git revert` o `git reset --soft`.',
	},
	{
		id: 'rm-recursive-force',
		regex: new RegExp(
			'\\brm\\s+(?:'
			+ '-[A-Za-z]*r[A-Za-z]*f[A-Za-z]*|-[A-Za-z]*f[A-Za-z]*r[A-Za-z]*'
			+ `|--recursive\\b(?=${SAME_COMMAND}--force\\b)|--force\\b(?=${SAME_COMMAND}--recursive\\b)`
			+ `|-r\\b(?=${SAME_COMMAND}\\s-[A-Za-z]*f\\b)|-f\\b(?=${SAME_COMMAND}\\s-[A-Za-z]*r\\b)`
			+ ')',
			'i'),
		reason: 'rm recursivo y forzado borra árboles de directorios completos sin confirmación.',
		guidance: 'Verifica la ruta con `ls` antes; muévela a una carpeta de cuarentena (backup) en lugar de borrar, o usa `rm -r` interactivo sin -f para revisar fichero a fichero.',
	},
	{
		id: 'remove-item-recursive-force',
		regex: new RegExp(
			`\\bremove-item\\b(?=${SAME_COMMAND}\\s-(?:recurse|r)\\b)(?=${SAME_COMMAND}\\s-(?:force|fo)\\b)`, 'i'),
		reason: 'Remove-Item -Recurse -Force borra árboles completos en Windows sin confirmación.',
		guidance: 'Lista el contenido antes (Get-ChildItem -Recurse), copia a una carpeta de cuarentena como backup y confirma la ruta absoluta; quita -Force si no hay ficheros de solo lectura.',
	},
	{
		id: 'mongo-drop-database',
		regex: /\bdropDatabase\s*\(\s*\)/i,
		reason: 'db.dropDatabase() elimina la base de datos Mongo completa.',
		guidance: 'Ejecuta mongodump de la base de datos y verifícalo antes; para vaciar datos concretos prefiere deleteMany con filtro acotado.',
	},
	{
		id: 'mongo-collection-drop',
		regex: /\.\s*drop\s*\(\s*\)/i,
		reason: '<colección>.drop() elimina la colección y sus índices.',
		guidance: 'Exporta la colección primero (mongoexport) como backup y confirma el nombre; para vaciarla conserva el esquema con deleteMany con filtro en vez de drop().',
	},
	{
		id: 'mongo-delete-many-all',
		regex: /\bdeleteMany\s*\(\s*\{\s*\}\s*\)/i,
		reason: 'deleteMany({}) sin filtro borra TODOS los documentos de la colección.',
		guidance: 'Añade siempre un filtro (p. ej. { deprecated: true }); si la intención es vaciar todo, haz mongoexport de respaldo antes y confírmalo con un segundo par de ojos.',
	},
];

/** Identificadores estables de todos los patrones (para tests y documentación). */
export const DANGEROUS_PATTERN_IDS: readonly string[] = PATTERNS.map(p => p.id);

/** Quita líneas de comentario (SQL, JS y markdown) donde un patrón solo se menciona. */
function stripCommentLines(input: string): string {
	return input
		.split(/\r?\n/)
		.filter(line => !/^\s*(?:--|\/\/|#|\/\*|\*)/.test(line))
		.join('\n');
}

/**
 * Devuelve la primera coincidencia destructiva del texto, o `null` si no hay
 * ninguna. Función pura: sin IO, sin estado, nunca lanza (fail-open).
 */
export function checkDangerousCommand(input: string): DangerousCommandMatch | null {
	if (typeof input !== 'string' || !input.trim()) { return null; }
	try {
		const text = stripCommentLines(input);
		for (const pattern of PATTERNS) {
			if (pattern.regex.test(text)) {
				return { blocked: true, pattern: pattern.id, reason: pattern.reason, guidance: pattern.guidance };
			}
		}
		return null;
	} catch {
		return null; // fail-open documentado: nunca romper el flujo por el guard
	}
}
