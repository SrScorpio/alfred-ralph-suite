import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadAndInjectContext } from '../contextInjector';
import { PrdManager } from '../prdManager';
import { RalphStateManager } from '../stateManager';

describe('Ralph runtime security contracts', () => {
	let root: string;

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-runtime-'));
		RalphStateManager.ensure(root);
	});

	afterEach(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	it('preserves failed as a runtime status and exposes it in all statuses', () => {
		fs.writeFileSync(RalphStateManager.statusPath(root, 'ISSUE-001'), 'failed', 'utf-8');

		assert.strictEqual(RalphStateManager.getStatus(root, 'ISSUE-001'), 'failed');
		assert.strictEqual(RalphStateManager.getAllStatuses(root)['ISSUE-001'], 'failed');
	});

	it('does not select failed tasks as the next pending task', () => {
		const prd = {
			project: 'Test',
			description: '',
			version: '1',
			issues: [
				{ id: 'FAILED', title: 'Failed', description: '', priority: 'P0', status: 'failed', acceptanceCriteria: [], dependencies: [], labels: [] },
				{ id: 'TODO', title: 'Todo', description: '', priority: 'P1', status: 'todo', acceptanceCriteria: [], dependencies: [], labels: [] },
			],
		};

		assert.strictEqual(PrdManager.nextPending(prd as any, root)?.id, 'TODO');
	});

	it('injects knowledge from docs/project/status.md and never from legacy memories.md', () => {
		const legacy = path.join(root, '.agent', 'memories.md');
		fs.writeFileSync(legacy, '# Project Memories\n\n## Project\n- Secret legacy', 'utf-8');

		// Sin status.md no hay memoria que inyectar; el legacy NO se inyecta (ADR-020).
		assert.strictEqual(loadAndInjectContext(root, 'task', [], [], undefined), null);

		const statusPath = path.join(root, 'docs', 'project', 'status.md');
		fs.mkdirSync(path.dirname(statusPath), { recursive: true });
		fs.writeFileSync(statusPath, '# Estado\n\n## Flujo activo\n- Fase 1\n\n## Bloqueos\n- ninguno\n', 'utf-8');
		const injection = loadAndInjectContext(root, 'task', [], [], undefined);
		assert.ok(injection, 'status.md debe inyectarse');
		assert.ok(injection.injected.includes('Flujo activo'));
		assert.ok(!injection.injected.includes('Secret legacy'));
	});

	it('ignores configured legacy memory paths outside the workspace', () => {
		const outside = path.join(path.dirname(root), 'ralph-outside-memories.md');
		fs.writeFileSync(outside, '# Outside\n\n## Project\n- Secret', 'utf-8');

		assert.strictEqual(
			loadAndInjectContext(root, 'task', [], [], undefined, outside),
			null,
		);
		assert.strictEqual(
			loadAndInjectContext(root, 'task', [], [], undefined, path.relative(root, outside)),
			null,
		);

		fs.rmSync(outside, { force: true });
	});

	it('migrates from the safe fallback when configured memory paths point outside the workspace', () => {
		const configured = path.join(path.dirname(root), 'ralph-configured-outside.md');
		const traversal = path.join('..', 'ralph-traversal-outside.md');
		const legacy = path.join(root, '.agent', 'memories.md');
		fs.writeFileSync(legacy, '# Project Memories\n\n## Project\n- Keep memory inside workspace\n', 'utf-8');

		const result = RalphStateManager.migrateMemories(root, configured);
		RalphStateManager.migrateMemories(root, traversal);

		assert.strictEqual(result.migrated, true);
		assert.ok(fs.existsSync(path.join(root, '.agent', 'memories.md')), 'el original no se borra');
		assert.ok(fs.readFileSync(result.statusPath, 'utf-8').includes('Keep memory inside workspace'));
		assert.ok(!fs.existsSync(configured));
		assert.ok(!fs.existsSync(path.resolve(root, traversal)));
	});

	it('does not migrate through a configured memory symlink outside the workspace (Windows may skip without symlink privileges)', function () {
		const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-memory-outside-'));
		const outsideMemory = path.join(outside, 'memories.md');
		const configuredDirectory = path.join(root, 'linked-memories');
		const configured = path.join(configuredDirectory, 'memories.md');
		fs.writeFileSync(outsideMemory, '# Outside\n', 'utf-8');
		try {
			fs.symlinkSync(outside, configuredDirectory, process.platform === 'win32' ? 'junction' : 'dir');
		} catch (error) {
			fs.rmSync(outside, { recursive: true, force: true });
			if (process.platform === 'win32') {
				this.skip();
			}
			throw error;
		}

		try {
			fs.writeFileSync(path.join(root, '.agent', 'memories.md'), '# Project Memories\n\n## Project\n- Legacy\n', 'utf-8');
			const result = RalphStateManager.migrateMemories(root, configured);
			assert.strictEqual(result.migrated, true);
			assert.ok(fs.existsSync(path.join(root, 'docs', 'project', 'status.md')));
			assert.strictEqual(fs.readFileSync(outsideMemory, 'utf-8'), '# Outside\n');
		} finally {
			fs.rmSync(configuredDirectory, { recursive: true, force: true });
			fs.rmSync(outside, { recursive: true, force: true });
		}
	});

	it('does not write when .agent is a symlink outside the workspace (Windows junction test may skip without privileges)', function () {
		const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-agent-outside-'));
		const agentPath = path.join(root, '.agent');
		fs.rmSync(agentPath, { recursive: true, force: true });
		try {
			fs.symlinkSync(outside, agentPath, process.platform === 'win32' ? 'junction' : 'dir');
		} catch (error) {
			fs.rmSync(outside, { recursive: true, force: true });
			if (process.platform === 'win32') {
				this.skip();
			}
			throw error;
		}

		try {
			assert.throws(() => RalphStateManager.migrateMemories(root));
			assert.strictEqual(fs.readdirSync(outside).length, 0);
			assert.ok(!fs.existsSync(RalphStateManager.statusMdPath(root)));
		} finally {
			fs.rmSync(agentPath, { recursive: true, force: true });
			fs.rmSync(outside, { recursive: true, force: true });
			fs.mkdirSync(agentPath, { recursive: true });
		}
	});
});