/**
 * memoryUnification.test.ts — ADR-020 / issue #23 (ISSUE-017)
 *
 * docs/project/status.md es el ÚNICO fichero de memoria del proyecto:
 * el runtime deja de crear y escribir .agent/memories.md, y la migración
 * legacy se hace en una sola pasada (sin borrar el original).
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RalphStateManager } from '../stateManager';

describe('ADR-020 — memoria única en docs/project/status.md', () => {
	let root: string;

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-adr020-'));
		RalphStateManager.ensure(root);
	});

	afterEach(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	it('setCompleted escribe solo .ralph/ y no crea .agent/memories.md', () => {
		RalphStateManager.setCompleted(root, 'ISSUE-001', 'NOTA: shipped the memory unification', ['src/stateManager.ts'], '.agent/memories.md');

		assert.strictEqual(
			fs.readFileSync(RalphStateManager.statusPath(root, 'ISSUE-001'), 'utf-8').trim(),
			'completed',
		);
		const log = RalphStateManager.getLog(root, 'ISSUE-001');
		assert.ok(log, 'el log debe existir en .ralph/');
		assert.strictEqual(log!.summary, 'NOTA: shipped the memory unification');
		assert.ok(!fs.existsSync(path.join(root, '.agent', 'memories.md')), 'el runtime no crea memories.md');
	});

	it('processNoteFile guarda la nota en el log sin escribir memories.md', () => {
		RalphStateManager.setInProgress(root, 'ISSUE-002', 'Task');
		fs.writeFileSync(RalphStateManager.notePath(root, 'ISSUE-002'), 'NOTA: DECISION: single memory file\n', 'utf-8');

		RalphStateManager.processNoteFile(root, 'ISSUE-002');

		assert.strictEqual(RalphStateManager.getLog(root, 'ISSUE-002')?.note, 'DECISION: single memory file');
		assert.ok(!fs.existsSync(RalphStateManager.notePath(root, 'ISSUE-002')), 'la señal se consume');
		assert.ok(!fs.existsSync(path.join(root, '.agent', 'memories.md')), 'la nota no promueve a memories.md');
	});

	it('initMemories no crea el fichero y no toca un memories.md existente', () => {
		RalphStateManager.initMemories(root, 'Goal');
		assert.ok(!fs.existsSync(path.join(root, '.agent', 'memories.md')));

		const legacy = path.join(root, '.agent', 'memories.md');
		fs.writeFileSync(legacy, '# legacy\n', 'utf-8');
		RalphStateManager.initMemories(root, 'Goal');
		assert.strictEqual(fs.readFileSync(legacy, 'utf-8'), '# legacy\n');
	});

	it('migrateMemories fusiona el contenido en status.md creado desde la plantilla y no borra el original', () => {
		const legacyContent = '# Project Memories\n\n## Project\n- Goal: legacy goal\n\n## Conventions\n- UTF-8 sin BOM en ficheros nuevos\n';
		const legacy = path.join(root, '.agent', 'memories.md');
		fs.writeFileSync(legacy, legacyContent, 'utf-8');

		const result = RalphStateManager.migrateMemories(root);

		assert.strictEqual(result.migrated, true);
		assert.strictEqual(result.statusPath, RalphStateManager.statusMdPath(root));
		assert.strictEqual(result.lines, 7);
		const status = fs.readFileSync(result.statusPath, 'utf-8');
		assert.ok(status.includes('# Estado del flujo'), 'status.md nace de la plantilla catalog/templates/status.md');
		assert.ok(status.includes('## Conocimiento migrado (memories.md)'));
		assert.ok(status.includes('- Goal: legacy goal'));
		assert.ok(status.includes('- UTF-8 sin BOM en ficheros nuevos'));
		assert.strictEqual(fs.readFileSync(legacy, 'utf-8'), legacyContent, 'el original NUNCA se borra');
	});

	it('migrateMemories respeta un status.md existente', () => {
		const statusDir = path.join(root, 'docs', 'project');
		fs.mkdirSync(statusDir, { recursive: true });
		fs.writeFileSync(path.join(statusDir, 'status.md'), '# Estado existente\n\n## Flujo activo\n- Fase 2\n', 'utf-8');
		fs.writeFileSync(path.join(root, '.agent', 'memories.md'), '## Decisions\n- ADR-020 manda\n', 'utf-8');

		const result = RalphStateManager.migrateMemories(root);

		assert.strictEqual(result.migrated, true);
		const status = fs.readFileSync(result.statusPath, 'utf-8');
		assert.ok(status.startsWith('# Estado existente'), 'el snapshot previo no se machaca');
		assert.ok(status.includes('## Conocimiento migrado (memories.md)'));
		assert.ok(status.includes('- ADR-020 manda'));
	});

	it('migrateMemories sin memories.md devuelve migrated:false', () => {
		const result = RalphStateManager.migrateMemories(root);

		assert.strictEqual(result.migrated, false);
		assert.strictEqual(result.lines, 0);
		assert.strictEqual(result.statusPath, RalphStateManager.statusMdPath(root));
		assert.ok(!fs.existsSync(result.statusPath), 'sin contenido no se crea status.md');
	});

	it('migrateMemories con memories.md vacío devuelve migrated:false', () => {
		fs.writeFileSync(path.join(root, '.agent', 'memories.md'), '   \n', 'utf-8');
		const result = RalphStateManager.migrateMemories(root);
		assert.strictEqual(result.migrated, false);
		assert.ok(!fs.existsSync(result.statusPath));
	});
});
