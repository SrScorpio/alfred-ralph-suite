/**
 * dangerGuard.test.ts — Tests del guard de patrones destructivos (issue #22)
 *
 * Decisiones negativas documentadas:
 * - `drop table` dentro de un literal SQL (SELECT de ejemplo o patrón LIKE)
 *   no bloquea: la palabra clave va precedida de comilla o `%`.
 * - Patrones mencionados en líneas de comentario (`//`, `--`, `#`) no bloquean.
 * - `git push origin main`, `git reset --soft` y `rm archivo` (sin recursivo
 *   + forzado a la vez) no bloquean.
 */
import * as assert from 'assert';
import { checkDangerousCommand, DANGEROUS_PATTERN_IDS } from '../security/dangerGuard';
import { buildPrompt } from '../promptBuilders';

function task(partial: Record<string, unknown> = {}) {
	return {
		id: 'ISSUE-016',
		title: 'Limpieza',
		description: 'trabajo normal',
		epic: 'General',
		priority: 'P2',
		acceptanceCriteria: [],
		labels: [],
		...partial,
	};
}

describe('checkDangerousCommand (issue #22)', () => {
	const blocks: Array<[string, string]> = [
		['DROP TABLE users;', 'sql-drop-table'],
		['drop table if exists `orders`;', 'sql-drop-table'],
		['TRUNCATE TABLE logs;', 'sql-drop-table'],
		['DROP DATABASE tienda;', 'sql-drop-database'],
		['drop schema public CASCADE;', 'sql-drop-database'],
		['git push --force origin main', 'git-push-force'],
		['git push origin main --force-with-lease', 'git-push-force'],
		['git push -f', 'git-push-force'],
		['git reset --hard HEAD~1', 'git-reset-hard'],
		['rm -rf build/', 'rm-recursive-force'],
		['rm -fr .ralph', 'rm-recursive-force'],
		['rm -rvf node_modules', 'rm-recursive-force'],
		['rm --recursive --force dist', 'rm-recursive-force'],
		['Remove-Item -Recurse -Force .ralph', 'remove-item-recursive-force'],
		['remove-item .ralph -Force -Recurse', 'remove-item-recursive-force'],
		['db.dropDatabase()', 'mongo-drop-database'],
		['use test; db.dropDatabase();', 'mongo-drop-database'],
		['await db.users.deleteMany({})', 'mongo-delete-many-all'],
		['await collection.drop()', 'mongo-collection-drop'],
		['db.getCollection("sessions").drop()', 'mongo-collection-drop'],
	];

	for (const [input, patternId] of blocks) {
		it(`bloquea «${input}» como ${patternId}`, () => {
			const match = checkDangerousCommand(input);
			assert.ok(match, 'debe devolver coincidencia');
			assert.strictEqual(match.blocked, true);
			assert.strictEqual(match.pattern, patternId);
			assert.ok(match.reason.length > 10, 'razón descriptiva');
			assert.ok(match.guidance.length > 20, 'guía accionable (cómo continuar)');
		});
	}

	it('cubre con un caso positivo cada identificador exportado', () => {
		const covered = new Set(blocks.map(([, id]) => id));
		for (const id of DANGEROUS_PATTERN_IDS) {
			assert.ok(covered.has(id), `el patrón ${id} necesita caso positivo`);
		}
	});

	const allows: string[] = [
		'npm run compile',
		'git push origin main',
		'git push --follow-tags origin main',
		'git reset --soft HEAD~1',
		'git checkout -b feat/x',
		'rm archivo.txt',
		'rm -r build/',                        // recursivo sin force: documentado, no bloquea
		'Remove-Item docs',
		'Remove-Item .tmp -Recurse',           // sin -Force: documentado, no bloquea
		'db.users.deleteMany({ activo: false })',
		'SELECT * FROM docs WHERE body = \'drop table\'',
		"SELECT 'drop table users' FROM examples;",
		"SELECT * FROM logs WHERE msg LIKE '%drop table users%'",
		// eslint-disable-next-line no-useless-escape
		'// FIXME: nunca ejecutar drop table usuarios en producción',
		'-- truncate table logs: prohibido en este repo',
		'# sección: por qué rm -rf / es una mala idea',
		'la tabla se llama drop_table_backup',
		'',
	];

	for (const input of allows) {
		it(`no bloquea «${input}»`, () => {
			assert.strictEqual(checkDangerousCommand(input), null);
		});
	}

	it('es fail-open: nunca lanza con entradas degeneradas', () => {
		assert.strictEqual(checkDangerousCommand('   '), null);
		assert.strictEqual(checkDangerousCommand('🎉'.repeat(1000)), null);
	});

	it('detecta el patrón aunque llegue embebido en una tarea normal', () => {
		assert.ok(checkDangerousCommand(`Para limpiar el entorno: git reset --hard origin/main y listo.`));
	});
});

describe('Advertencia visible en el prompt (issue #22)', () => {
	it('buildPrompt añade el bloque de peligro cuando la tarea trae un comando destructivo', () => {
		const prompt = buildPrompt(task({ description: 'Limpiar el runtime: ejecuta rm -rf .ralph y sigue.' }), {}, {});
		assert.ok(prompt.includes('COMANDO DESTRUCTIVO DETECTADO'));
		assert.ok(prompt.includes('rm-recursive-force'));
		assert.ok(prompt.includes('.ralph/backups/'));
	});

	it('buildPrompt advierte también desde los criterios de aceptación', () => {
		const prompt = buildPrompt(task({ acceptanceCriteria: ['Resetear con git reset --hard'] }), {}, {});
		assert.ok(prompt.includes('COMANDO DESTRUCTIVO DETECTADO'));
	});

	it('buildPrompt sin patrones queda byte a byte igual (sin bloque de peligro)', () => {
		const prompt = buildPrompt(task(), {}, {});
		assert.ok(!prompt.includes('COMANDO DESTRUCTIVO'));
	});
});
