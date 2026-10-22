import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PrdManager } from '../prdManager';
import { RalphStateManager, safeTaskId } from '../stateManager';
import { cleanIssueFields, safeMessageId } from '../boardSanitizers';
import { syncIssue } from '../commands/syncIssue';
import { buildSyncPrompt } from '../kanban/gitHubSync';
import { KanbanPanel } from '../kanbanPanel';

describe('Integrity audit identity, sync and state', () => {
	let root: string;
	beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-integrity-fixture-')); });
	afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });
	function backlog(issues: any[]) {
		fs.writeFileSync(path.join(root, 'prd.json'), JSON.stringify({ project: 'Demo', issues }));
	}
	it('rejects invalid IDs instead of aliasing or truncating them', () => {
		for (const id of ['A/B', 'A B', ' A', 'A ', 'A\n', 'A\r', 'A\0', '', 'A'.repeat(81), undefined]) {
			backlog([{ id }, { id: 'A_B' }]);
			assert.throws(() => PrdManager.load(root), /ID.*inválido/);
			assert.throws(() => safeTaskId(id), /ID.*inválido/);
			assert.strictEqual(safeMessageId(id), null);
		}
	});
	it('rejects duplicate and case-colliding runtime identities regardless of order', () => {
		for (const ids of [['ONE', 'ONE'], ['One', 'ONE'], ['ONE', 'One']]) {
			backlog(ids.map(id => ({ id })));
			assert.throws(() => PrdManager.load(root), /duplicado|colisión/);
		}
	});
	it('keeps valid IDs, numeric legacy IDs, dependencies and signals through reorder', () => {
		const ids = ['A_B', 'A-B', 'A.B', 'A'.repeat(80), 'UNKNOWN', '__proto__', '1'];
		const items = ids.map(id => ({ id, status: 'completed' }));
		items.push({ id: 'NEXT', dependencies: ['A_B', 'A-B', 'A.B'], status: 'todo' } as any);
		RalphStateManager.setTodoOverride(root, 'A-B');
		RalphStateManager.setTodoOverride(root, '__proto__');
		for (const ordered of [items, [...items].reverse()]) {
			backlog(ordered);
			const before = fs.readFileSync(path.join(root, 'prd.json'));
			const prd = PrdManager.load(root)!;
			assert.deepStrictEqual(prd.issues.map(i => i.id), ordered.map(i => i.id));
			assert.deepStrictEqual(prd.issues.find(i => i.id === 'NEXT')!.dependencies, ['A_B', 'A-B', 'A.B']);
			assert.strictEqual(prd.issues.find(i => i.id === 'A-B')!.status, 'todo');
			assert.strictEqual(prd.issues.find(i => i.id === '__proto__')!.status, 'todo');
			assert.strictEqual(prd.issues.find(i => i.id === 'A_B')!.status, 'completed');
			assert.strictEqual(prd.issues.find(i => i.id === 'NEXT')!.status, 'blocked');
			assert.deepStrictEqual(fs.readFileSync(path.join(root, 'prd.json')), before);
		}
	});
	it('rejects invalid literal dependencies rather than rewriting them', () => {
		backlog([{ id: 'TASK', dependencies: [' A-B'] }]);
		assert.throws(() => PrdManager.load(root), /ID.*inválido/);
	});
	it('webview dependency validation never trims, renames or silently drops invalid input', () => {
		assert.deepStrictEqual(cleanIssueFields({ dependencies: ['A-B', 'A_B'] }).dependencies, ['A-B', 'A_B']);
		for (const dependencies of [[' A-B'], ['A/B'], 'A-B']) {
			assert.throws(() => cleanIssueFields({ dependencies }), /ID.*inválido/);
		}
	});
	it('rejects repo ambiguity even when both labels are on the same local task', () => {
		backlog([{ id: 'TASK', labels: ['one/repo#7', 'two/repo#7'] }]);
		assert.throws(() => syncIssue(7, 'completed', root), /ambiguo|único/);
		assert.ok(!fs.existsSync(RalphStateManager.ralphDir(root)));
	});
	it('rejects several GitHub numbers on one local task, but permits equivalent mapping aliases', () => {
		backlog([{ id: 'TASK', labels: ['one/repo#7', 'github:#8'] }]);
		assert.throws(() => syncIssue(7, 'completed', root), /ambiguo|único/);
		assert.ok(!fs.existsSync(RalphStateManager.ralphDir(root)));
		backlog([{ id: 'TASK', labels: ['one/repo#7', 'github:#7'] }]);
		syncIssue(7, 'completed', root);
		assert.strictEqual(RalphStateManager.getStatus(root, 'TASK'), 'completed');
	});
	it('rejects competing mappings, missing labels, body IDs and invalid statuses without writes', () => {
		for (const items of [
			[{ id: 'TASK', description: 'Ralph Suite ID: `TASK`' }],
			[{ id: 'TASK', labels: ['github:#7'] }, { id: 'OTHER', labels: ['one/repo#7'] }],
		]) {
			backlog(items);
			assert.throws(() => syncIssue(7, 'completed', root));
			assert.ok(!fs.existsSync(RalphStateManager.ralphDir(root)));
		}
		backlog([{ id: 'TASK', labels: ['github:#7'] }]);
		assert.throws(() => syncIssue(7, 'failed', root));
		assert.ok(!fs.existsSync(RalphStateManager.ralphDir(root)));
	});
	it('bulk prompt delegates each mutation to the validated sync command, never to chat filesystem tools', () => {
		backlog([{ id: 'TASK', labels: ['one/repo#7'] }]);
		const prompt = buildSyncPrompt(PrdManager.load(root)!, root);
		assert.ok(prompt.includes('ralph-suite.syncIssue'));
		assert.ok(prompt.includes('one/repo#7'));
		assert.ok(prompt.includes(JSON.stringify(root)));
		assert.ok(!prompt.includes('filesystem write tool'));
		assert.ok(!prompt.includes('task-<RALPH_ID>-status'));
		assert.ok(!prompt.includes('use that local ID'));
	});
	for (const base of ['completed', 'failed', 'inprogress']) {
		for (const override of [false, true]) {
			it(`sync todo overrides ${base}, existing runtime=${override}, while reset restores base`, () => {
				backlog([{ id: 'TASK', status: base, labels: ['github:#7'] }]);
				if (override) { RalphStateManager.setStatus(root, 'TASK', 'blocked'); }
				const before = fs.readFileSync(path.join(root, 'prd.json'));
				syncIssue(7, 'todo', root);
				assert.strictEqual(PrdManager.load(root)!.issues[0].status, 'todo');
				RalphStateManager.reset(root, 'TASK');
				assert.strictEqual(PrdManager.load(root)!.issues[0].status, base);
				assert.deepStrictEqual(fs.readFileSync(path.join(root, 'prd.json')), before);
			});
			it(`board todo overrides ${base}, existing runtime=${override}, and reset restores base`, async () => {
				backlog([{ id: 'TASK', status: base }]);
				if (override) { RalphStateManager.setStatus(root, 'TASK', 'blocked'); }
				const before = fs.readFileSync(path.join(root, 'prd.json'));
				const panel = Object.create(KanbanPanel.prototype) as any;
				panel.root = root;
				panel.folderFromMessage = () => ({ root });
				panel.render = () => undefined;
				await panel.handleMessage({ type: 'moveCard', id: 'TASK', status: 'todo' });
				assert.strictEqual(PrdManager.load(root)!.issues[0].status, 'todo');
				await panel.handleMessage({ type: 'resetTask', id: 'TASK' });
				assert.strictEqual(PrdManager.load(root)!.issues[0].status, base);
				assert.deepStrictEqual(fs.readFileSync(path.join(root, 'prd.json')), before);
			});
		}
	}
	it('invalid runtime IDs fail before creating runtime or gitignore', () => {
		for (const mutate of [
			() => RalphStateManager.setCompleted(root, 'A/B'),
			() => RalphStateManager.setFailed(root, 'A/B'),
			() => RalphStateManager.setInProgress(root, 'A/B'),
			() => RalphStateManager.setStatus(root, 'A/B', 'blocked'),
			() => RalphStateManager.setTodoOverride(root, 'A/B'),
		]) { assert.throws(mutate, /ID.*inválido/); }
		assert.deepStrictEqual(fs.readdirSync(root), []);
	});
	it('rejects missing identities, non-task entries and malformed dependency arrays', () => {
		for (const item of [null, 'task', {}, { id: true }, { id: 'TASK', dependencies: 'A' }]) {
			backlog([item]);
			assert.throws(() => PrdManager.load(root), /ID.*inválido/);
		}
	});
	it('reads one snapshot and never overwrites a newer concurrent signal', () => {
		RalphStateManager.ensure(root);
		const file = RalphStateManager.statusPath(root, 'TASK');
		fs.writeFileSync(file, 'completed\n');
		const filesystem = require('fs') as typeof fs;
		const read = filesystem.readFileSync;
		let reads = 0;
		(filesystem as any).readFileSync = (target: any, ...args: any[]) => {
			const snapshot = (read as any)(target, ...args);
			if (target === file) {
				reads++;
				fs.writeFileSync(file, 'failed');
			}
			return snapshot;
		};
		try {
			assert.strictEqual(RalphStateManager.getStatus(root, 'TASK'), 'completed');
			assert.strictEqual(reads, 1);
		} finally { (filesystem as any).readFileSync = read; }
		assert.strictEqual(fs.readFileSync(file, 'utf8'), 'failed');
	});
	it('status reads preserve bytes and mtime from a single snapshot', () => {
		RalphStateManager.ensure(root);
		const file = RalphStateManager.statusPath(root, 'TASK');
		for (const text of ['\r\n completed\r\nfailed\r\n', 'unknown\ninprogress', 'failed\n', '']) {
			fs.writeFileSync(file, text);
			const before = fs.statSync(file).mtimeMs;
			const expected = text.includes('completed') ? 'completed' : text.startsWith('failed') ? 'failed' : 'todo';
			assert.strictEqual(RalphStateManager.getStatus(root, 'TASK'), expected);
			assert.strictEqual(RalphStateManager.getAllStatuses(root).TASK, expected);
			assert.strictEqual(fs.readFileSync(file, 'utf8'), text);
			assert.strictEqual(fs.statSync(file).mtimeMs, before);
		}
	});
});
