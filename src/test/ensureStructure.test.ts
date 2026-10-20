import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RalphStateManager } from '../stateManager';
import { buildAnalyzeExistingProjectPrompt } from '../kanban/analyzeProject';

describe('estructura del proyecto al analizar/importar (issue #16)', () => {
	it('ensureProjectStatusMd crea status.md desde la plantilla y es idempotente', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-ensure-'));
		try {
			const first = RalphStateManager.ensureProjectStatusMd(root, 'Demo');
			assert.strictEqual(first.created, true);
			const content = fs.readFileSync(first.statusPath, 'utf-8');
			assert.ok(content.includes('Demo'), 'usa el nombre del proyecto');
			assert.ok(!content.includes('<nombre-del-proyecto>'), 'sin placeholder de nombre');
			assert.ok(!content.includes('<fecha-hora>'), 'sin placeholder de fecha');
			const before = fs.readFileSync(first.statusPath, 'utf-8');
			const second = RalphStateManager.ensureProjectStatusMd(root, 'Otro');
			assert.strictEqual(second.created, false, 'no sobreescribe un status existente');
			assert.strictEqual(fs.readFileSync(second.statusPath, 'utf-8'), before);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('ensureProjectStatusMd acepta nombre vacio con fallback', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-ensure-2-'));
		try {
			const result = RalphStateManager.ensureProjectStatusMd(root, '');
			assert.strictEqual(result.created, true);
			assert.ok(fs.readFileSync(result.statusPath, 'utf-8').includes('Proyecto'));
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('el prompt de analisis exige status.md sin tocar uno existente', () => {
		const prompt = buildAnalyzeExistingProjectPrompt([]);
		assert.ok(prompt.includes('docs/project/status.md'));
		assert.ok(prompt.includes('NEVER modify an existing docs/project/status.md'));
	});
});
