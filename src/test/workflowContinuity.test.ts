import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { builtinAlfredIdentity } from '../builtinIdentity';
import { buildPromptInAlfredMode, selectTaskPrompt, buildPrompt } from '../promptBuilders';
import { _doActivate } from '../activate';
import { PrdManager } from '../prdManager';
import { RalphStateManager } from '../stateManager';
import { KanbanPanel } from '../kanbanPanel';
import { getTaskRunReservation, recoverTaskRunReservation } from '../taskRunReservation';
import { ALFRED_EXTENSION_ID, ANNOUNCE_IDENTITY_COMMAND } from '../alfredIdentity';
import { getBoardContent } from '../webview/kanbanHtml';

const root = path.resolve(__dirname, '../..');
const task = {
	id: 'LOCAL-A-042', title: 'Preserve workflow continuity', description: 'Implement the authorized fix',
	status: 'todo', acceptanceCriteria: ['Focused tests pass'], labels: [], dependencies: [], priority: 'P1', epic: 'Continuity',
};
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), 'utf8');

describe('workflow continuity', () => {
	const restores: Array<() => void> = [];
	function stub(target: any, key: string, value: any) {
		const previous = target[key];
		target[key] = value;
		restores.push(() => { target[key] = previous; });
	}
	beforeEach(() => {
		stub(vscode.workspace, 'workspaceFolders', [{ uri: { fsPath: root }, name: 'continuity' }]);
		stub(vscode.workspace, 'isTrusted', true);
	});
	afterEach(() => {
		const reservation = getTaskRunReservation();
		if (reservation?.phase === 'recovery') { recoverTaskRunReservation(reservation, true); }
		while (restores.length) { restores.pop()!(); }
	});

	it('routes the integrated runTask identity through Alfred without changing other roles', () => {
		const identity = builtinAlfredIdentity();
		assert.strictEqual(identity.actions.runTask.agent, 'alfred');
		assert.strictEqual(identity.actions.runTask.mention, '@alfred');
		assert.strictEqual(identity.actions.optimizeMemory.agent, 'tech-writer');
		assert.strictEqual(identity.actions.analyzeProject.agent, 'product-owner');
	});

	it('carries an immutable Ralph handoff with scope, gates and parent-owned closure', () => {
		const prompt = buildPromptInAlfredMode(builtinAlfredIdentity(), task, {
			kind: 'ralph-execution', localTaskId: task.id, workspaceRoot: root,
		});
		assert.ok(prompt.includes('RALPH EXECUTION HANDOFF'));
		assert.ok(prompt.includes('"kind":"ralph-execution"'));
		assert.ok(prompt.includes(`"localTaskId":"${task.id}"`));
		assert.ok(prompt.includes(JSON.stringify(root)));
		assert.ok(prompt.includes('"scope":'));
		assert.ok(prompt.includes('Focused tests pass'));
		assert.ok(prompt.includes('"gates":'));
		assert.ok(prompt.includes('"closureOwner":"alfred"'));
		assert.ok(prompt.includes('Forward this contract unchanged'));
		assert.ok(prompt.includes('Never write completion signals during rejection, blocking, review, or partial handoff.'));
		assert.ok(prompt.includes('task_complete'));
		assert.ok(prompt.includes('ONLY the word "completed"'));
	});

	it('does not grant Ralph completion authority to absent, mismatched or unknown contexts', () => {
		for (const context of [undefined, {},
			{ kind: 'ralph-execution', localTaskId: 'OTHER', workspaceRoot: root },
			{ kind: 'ralph-execution', localTaskId: task.id, workspaceRoot: path.join(root, 'docs') },
			{ kind: 'ad-hoc', localTaskId: task.id, workspaceRoot: root },
			{ kind: 'ralph-execution', localTaskId: task.id, workspaceRoot: path.join(root, 'does-not-exist') },
		]) {
			const prompt = buildPromptInAlfredMode(builtinAlfredIdentity(), task, context);
			assert.ok(!prompt.includes('RALPH EXECUTION HANDOFF'));
			assert.ok(!prompt.includes('COMPLETION SIGNALS'));
		}
	});

	it('preserves the off-mode prompt and externally announced runTask role', () => {
		assert.strictEqual(selectTaskPrompt(task, {}, undefined, null), buildPrompt(task, {}, undefined));
		const external = builtinAlfredIdentity();
		external.actions.runTask = { agent: 'senior-dev', mention: '@senior-dev', preamble: 'External identity' };
		const prompt = buildPromptInAlfredMode(external, task, { kind: 'ralph-execution', localTaskId: task.id, workspaceRoot: root });
		assert.ok(prompt.includes('Agente: senior-dev (@senior-dev)'));
		assert.ok(prompt.includes('"closureOwner":"senior-dev"'));
	});

	it('leaves all twelve catalogue models to the host without changing role declarations', () => {
		const directory = path.join(root, 'catalog', 'agents');
		const agents = fs.readdirSync(directory).filter(name => name.endsWith('.agent.md'));
		assert.strictEqual(agents.length, 12);
		for (const name of agents) {
			const frontmatter = read('catalog', 'agents', name).split('---')[1];
			assert.ok(!/^model:/m.test(frontmatter), `${name} must not lock a provider model`);
			assert.match(frontmatter, /^description:/m);
			assert.match(frontmatter, /^tools:/m);
		}
	});

	it('documents honest board reconciliation and role-preserving delegation centrally', () => {
		const alfred = read('catalog', 'agents', 'alfred.agent.md');
		const global = read('catalog', 'instructions', 'global-instructions.md.instructions.md');
		assert.ok(alfred.includes('Antes de implementar trabajo sustancial'));
		assert.ok(alfred.includes('sin seguimiento en el tablero'));
		assert.ok(alfred.includes('No inventes una API'));
		assert.ok(alfred.includes('bloquea solo la implementación dependiente'));
		assert.ok(!alfred.includes('si no la hay, se usa el alta del tablero'));
		assert.ok(alfred.includes('lecturas pequeñas inline'));
		assert.ok(alfred.includes('no implementas ni haces review inline'));
		assert.ok(global.includes('No sustituyas silenciosamente'));
		assert.ok(global.includes('task_complete'));
		assert.ok(global.includes('closureOwner'));
	});

	it('keeps global instructions scoped to Alfred/Ralph and adopts practices without a framework', () => {
		const global = read('catalog', 'instructions', 'global-instructions.md.instructions.md');
		assert.ok(global.includes('solo cuando se active un flujo Alfred/Ralph'));
		assert.ok(global.includes('test determinista ejecutable'));
		assert.ok(global.includes('No impone Engram'));
		assert.ok(global.includes('No inventes una API'));
		assert.ok(global.includes('commits requieren autorización'));
		assert.ok(!global.includes('Always follow Test-Driven Development'));
		assert.ok(!global.includes('Cargar siempre'));
	});

	it('renders changed status and consumes a note through the registered real watcher callbacks', async () => {
		const fixtureRoot = path.join(root, 'watcher-memory-fixture');
		const runtime = path.join(fixtureRoot, '.ralph');
		const statusPath = RalphStateManager.statusPath(fixtureRoot, task.id);
		const notePath = RalphStateManager.notePath(fixtureRoot, task.id);
		const logPath = RalphStateManager.logPath(fixtureRoot, task.id);
		const files = new Map<string, string>([
			[statusPath, 'inprogress'],
			[path.join(fixtureRoot, 'docs', 'ralph', 'prd.json'), JSON.stringify({ project: 'Memory fixture', issues: [{ ...task }] })],
		]);
		const callbacks = new Map<string, Map<string, () => void>>();
		const updates: any[] = [];
		const errors: string[] = [];
		const nativeFs = require('fs') as typeof fs;
		const originalRead = nativeFs.readFileSync;
		const originalExists = nativeFs.existsSync;
		stub(vscode.workspace, 'workspaceFolders', [{ uri: { fsPath: fixtureRoot }, name: 'memory' }]);
		stub(vscode.workspace, 'getConfiguration', () => ({
			get: (_key: string, fallback: any) => fallback,
			inspect: () => ({}),
		}));
		stub(vscode.extensions, 'getExtension', (id: string) => id === ALFRED_EXTENSION_ID
			? { packageJSON: { contributes: { commands: [{ command: ANNOUNCE_IDENTITY_COMMAND }] } } }
			: undefined);
		stub(vscode.commands, 'executeCommand', async (id: string) => {
			assert.strictEqual(id, ANNOUNCE_IDENTITY_COMMAND);
			return builtinAlfredIdentity();
		});
		stub(nativeFs, 'existsSync', (file: fs.PathLike) => String(file).startsWith(fixtureRoot + path.sep)
			? String(file) === runtime || files.has(String(file)) : originalExists(file));
		stub(nativeFs, 'readFileSync', (file: any, ...args: any[]) => {
			if (!String(file).startsWith(fixtureRoot + path.sep)) { return (originalRead as any)(file, ...args); }
			assert.ok(files.has(String(file)), `Unexpected fixture read: ${file}`);
			return files.get(String(file));
		});
		stub(nativeFs, 'readdirSync', (directory: string) => {
			assert.strictEqual(directory, runtime);
			return [...files.keys()].filter(file => path.dirname(file) === directory).map(file => path.basename(file));
		});
		stub(nativeFs, 'writeFileSync', (file: string, content: string) => {
			assert.strictEqual(file, logPath, 'only the memory log may be written');
			files.set(file, content);
		});
		stub(nativeFs, 'unlinkSync', (file: string) => {
			assert.strictEqual(file, notePath, 'only the memory note signal may be consumed');
			files.delete(file);
		});
		stub(vscode.workspace, 'createFileSystemWatcher', (pattern: any) => {
			assert.strictEqual(pattern.base, fixtureRoot);
			const events = new Map<string, () => void>();
			callbacks.set(pattern.pattern, events);
			return {
				onDidChange: (cb: () => void) => events.set('change', cb),
				onDidCreate: (cb: () => void) => events.set('create', cb),
				onDidDelete: (cb: () => void) => events.set('delete', cb),
				dispose() {},
			};
		});
		stub(KanbanPanel as any, 'output', { appendLine: (line: string) => errors.push(line) });
		// Skip the constructor, shell timer and autorunner, but retain real watcher/render methods.
		const board = Object.assign(Object.create(KanbanPanel.prototype), {
			root: fixtureRoot, folders: [{ root: fixtureRoot }], watchers: [], autoRun: false,
			disposed: false, shellLoaded: true, boardScope: 'folder', currentView: 'board',
			panel: { webview: { postMessage: (message: any) => { updates.push(message); return Promise.resolve(true); } } },
		});
		board.startWatchers();
		assert.strictEqual(updates.length, 0, 'registration alone must not render');
		const fire = async (pattern: string, event: string) => {
			const callback = callbacks.get(pattern)?.get(event);
			assert.ok(callback, `Missing ${event} callback for ${pattern}`);
			callback!();
			await new Promise<void>(resolve => setImmediate(resolve));
		};
		await fire('.ralph/task-*-status', 'change');
		assert.strictEqual(updates.length, 1);
		assert.ok(updates[0].data.html.includes(`data-id="${task.id}" data-status="inprogress"`));
		files.set(statusPath, 'completed');
		await fire('.ralph/task-*-status', 'change');
		assert.strictEqual(updates.length, 2);
		assert.ok(updates[1].data.html.includes(`data-id="${task.id}" data-status="completed"`));
		files.set(notePath, 'NOTA: Watcher fixture gates passed');
		assert.ok(!updates[1].data.html.includes('Watcher fixture gates passed'));
		await fire('.ralph/task-*-note', 'create');
		assert.strictEqual(updates.length, 3);
		assert.ok(updates[2].data.html.includes('Watcher fixture gates passed'));
		assert.strictEqual(JSON.parse(files.get(logPath)!).note, 'Watcher fixture gates passed');
		assert.strictEqual(files.has(notePath), false, 'the real processor must consume the note signal');
		assert.strictEqual(files.get(statusPath), 'completed');
		assert.ok(!errors.some(line => line.includes('Render error')), errors.join('\n'));
	});

	for (const mode of ['auto', 'off', 'external', 'unknown'] as const) {
		it(`runs the actual command and chat launcher with memory-only runtime (${mode})`, async () => {
			const handlers = new Map<string, (...args: any[]) => any>();
			const chats: any[] = [];
			const signals = new Map<string, string>();
			let polls = 0;
			const subscriptions: any[] = [];
			const external = builtinAlfredIdentity();
			external.actions.runTask = { agent: 'senior-dev', mention: '@senior-dev', preamble: 'External identity' };
			stub(vscode.workspace, 'getConfiguration', () => ({
				get: (key: string, fallback: any) => ({ alfredMode: mode === 'off' ? 'off' : 'auto', freshContext: false,
					minWaitMs: 0, taskTimeoutMs: 30, pollIntervalMs: 1 } as any)[key] ?? fallback,
				inspect: () => ({}),
			}));
			stub(vscode.extensions, 'getExtension', (id: string) => mode === 'external' && id === ALFRED_EXTENSION_ID
				? { packageJSON: { contributes: { commands: [{ command: ANNOUNCE_IDENTITY_COMMAND }] } } }
				: id === 'SrScorpio.alfred-ralph-suite' ? {} : undefined);
			stub(vscode.commands, 'registerCommand', (id: string, handler: any) => {
				handlers.set(id, handler); return { dispose() {} };
			});
			stub(PrdManager, 'load', () => ({ project: 'Memory fixture', issues: [{ ...task }] }));
			stub(RalphStateManager, 'getAllStatuses', () => ({}));
			stub(RalphStateManager, 'getStatus', (_root: string, id: string) => {
				assert.strictEqual(_root, root); assert.strictEqual(id, task.id);
				if (signals.get('status') === 'inprogress' && ++polls > 1) {
					// Simulated executor signals, not an actual host/subagent execution.
					signals.set('status', 'completed'); signals.set('note', 'NOTA: Fixture gates passed');
				}
				return signals.get('status') ?? 'todo';
			});
			stub(RalphStateManager, 'setInProgress', () => { signals.set('status', 'inprogress'); });
			stub(KanbanPanel, 'beginTask', () => undefined);
			stub(KanbanPanel, 'endTask', () => undefined);
			stub(KanbanPanel, 'refresh', () => undefined);
			stub(vscode.commands, 'executeCommand', async (id: string, args: any) => {
				if (id === ANNOUNCE_IDENTITY_COMMAND) { return external; }
				if (id === 'workbench.action.chat.open') {
					chats.push(args);
					if (mode === 'unknown') { await new Promise<void>(() => undefined); }
				}
			});
			try {
				_doActivate({ subscriptions } as any, { appendLine() {} } as any);
				const run = handlers.get('ralph-suite.runTask')!;
				await run('UNKNOWN', root);
				assert.strictEqual(chats.length, 0);
				await assert.rejects(() => run(task.id, path.join(root, 'docs')), /no permitida/);
				await run(task.id, root);
				if (mode === 'unknown') { await run(task.id, root); }
				assert.strictEqual(chats.length, 1, 'unknown dispatch must not retry');
				const agent = mode === 'off' ? undefined : mode === 'external' ? 'senior-dev' : 'alfred';
				assert.strictEqual(chats[0].agent, agent);
				assert.ok(chats[0].query.includes(task.id));
				if (mode !== 'off') {
					assert.ok(chats[0].query.startsWith(`@${agent}\n`));
					assert.ok(chats[0].query.includes(JSON.stringify(root)));
				}
				assert.strictEqual(signals.get('status'), mode === 'unknown' ? 'inprogress' : 'completed');
				assert.strictEqual(signals.has('note'), mode !== 'unknown');
				const status = signals.get('status')!;
				const html = getBoardContent({ project: 'Memory fixture', description: '', version: '1',
					issues: [{ ...task, status }] } as any, null,
					{ [task.id]: { status, note: signals.get('note') } } as any,
					{ autoRun: false, maxLoops: 1, guardrails: [], boundaries: [], view: 'board' });
				assert.ok(html.includes(`data-id="${task.id}" data-status="${status}"`));
				assert.strictEqual(html.includes('NOTA: Fixture gates passed'), mode !== 'unknown');
				assert.strictEqual(getTaskRunReservation()?.phase, mode === 'unknown' ? 'recovery' : undefined);
			} finally { subscriptions.forEach(item => item.dispose?.()); }
		});
	}
});
