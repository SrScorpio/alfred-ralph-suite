import { markTaskRunSending, markTaskRunSent, releaseTaskRunReservation, reserveTaskRun } from '../taskRunReservation';
import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { runnerStopMessage } from '../commands/task';
import { existingAgentsChoice, setupProject } from '../commands/project';
import { getBoardContent } from '../webview/kanbanHtml';
import { KanbanPanel } from '../kanbanPanel';
import { PrdManager } from '../prdManager';
import { RalphStateManager } from '../stateManager';

describe('ISSUE-004 runner start and existing AGENTS.md', () => {
	const prd = {
		project: 'Demo',
		description: '',
		version: '1.0.0',
		issues: [{ id: 'ISSUE-001', title: 'Busy', description: '', status: 'inprogress', priority: 'P1', epic: 'General', dependencies: [], acceptanceCriteria: [] }],
	};

	it('explains on the board why auto-run stopped without an eligible task', () => {
		for (const reason of ['no-prd', 'in-progress', 'none-eligible'] as const) {
			assert.match(runnerStopMessage(reason, 'es'), /no ha lanzado/);
		}
		const html = getBoardContent(prd as any, null, {}, {
			autoRun: false,
			maxLoops: 1,
			guardrails: [],
			boundaries: [],
			view: 'board',
			locale: 'es',
			runnerNotice: runnerStopMessage('none-eligible', 'es'),
		});
		assert.match(html, /runner-notice/);
		assert.match(html, /No hay ninguna tarea elegible/);
		assert.match(html, /⚙ AGENTS\.md/);
		assert.doesNotMatch(html, /⚙ Agents</);
	});

	it('blocks Auto Run duplicates while a task is active in this instance', async () => {
		const root = path.resolve('runner-live-task');
		const panel = Object.create(KanbanPanel.prototype) as any;
		panel.root = root;
		panel.folders = [{ index: 0, root }];
		panel.autoRun = true;
		panel.loopCount = 0;
		let scheduled = 0;
		let launched = 0;
		panel.scheduleNextTask = () => { scheduled++; };
		KanbanPanel.beginTask(root, 'ISSUE-001');
		const executeCommand = vscode.commands.executeCommand;
		(vscode.commands as any).executeCommand = async () => { launched++; };
		try {
			await panel.runNextTask();
			assert.strictEqual(scheduled, 1);
			assert.strictEqual(launched, 0);
			assert.strictEqual(panel.autoRun, true);
		} finally {
			KanbanPanel.endTask(root, 'ISSUE-001');
			(vscode.commands as any).executeCommand = executeCommand;
		}
	});

	for (const choice of ['Recover and retry', undefined]) {
		it(`requires explicit stale-marker recovery (${choice ? 'accepts' : 'declines'}) without writing the PRD`, async () => {
			const root = path.resolve(`runner-stale-${choice ?? 'decline'}`);
			const prd = {
				project: 'Demo', description: '', version: '1.0.0',
				issues: [{ id: 'ISSUE-001', title: 'Busy', description: '', status: 'inprogress', priority: 'P1', epic: 'General', dependencies: [], acceptanceCriteria: [] }],
			};
			const originalPrd = JSON.stringify(prd);
			const panel = Object.create(KanbanPanel.prototype) as any;
			panel.root = root;
			panel.folders = [{ index: 0, root }];
			panel.autoRun = true;
			panel.loopCount = 0;
			panel.aggregatedPrd = () => prd;
			panel.haltRunner = () => { panel.autoRun = false; };
			const original = {
				getStatus: RalphStateManager.getStatus,
				setTodoOverride: RalphStateManager.setTodoOverride,
				showWarningMessage: vscode.window.showWarningMessage,
				nextPending: PrdManager.nextPending,
				executeCommand: vscode.commands.executeCommand,
			};
			let overrides = 0;
			let launched = 0;
			(RalphStateManager as any).getStatus = () => 'todo';
			(RalphStateManager as any).setTodoOverride = () => { overrides++; };
			(PrdManager as any).nextPending = (value: any) => value.issues.find((issue: any) => issue.status === 'todo') ?? null;
			(vscode.window as any).showWarningMessage = async () => choice;
			(vscode.commands as any).executeCommand = async () => { launched++; };
			try {
				await panel.runNextTask();
				assert.strictEqual(overrides, choice ? 1 : 0);
				assert.strictEqual(launched, choice ? 1 : 0);
				assert.strictEqual(JSON.stringify(prd), originalPrd);
			} finally {
				(RalphStateManager as any).getStatus = original.getStatus;
				(RalphStateManager as any).setTodoOverride = original.setTodoOverride;
				(vscode.window as any).showWarningMessage = original.showWarningMessage;
				(PrdManager as any).nextPending = original.nextPending;
				(vscode.commands as any).executeCommand = original.executeCommand;
			}
		});
	}


	it('does not dispatch while a reservation is sending or sent', async () => {
		const root = path.resolve('runner-reserved-task');
		const panel = Object.create(KanbanPanel.prototype) as any;
		panel.root = root;
		panel.folders = [{ index: 0, root }];
		panel.autoRun = true;
		panel.loopCount = 0;
		let scheduled = 0;
		let launched = 0;
		panel.scheduleNextTask = () => { scheduled++; };
		const executeCommand = vscode.commands.executeCommand;
		(vscode.commands as any).executeCommand = async () => { launched++; };
		const reservation = reserveTaskRun(root, 'ISSUE-001');
		assert.ok(reservation);
		try {
			for (const mark of [markTaskRunSending, markTaskRunSent]) {
				assert.strictEqual(mark(reservation!), true);
				scheduled = 0;
				await panel.runNextTask();
				assert.strictEqual(scheduled, 1);
				assert.strictEqual(launched, 0);
				assert.strictEqual(panel.loopCount, 0);
			}
		} finally {
			releaseTaskRunReservation(reservation!);
			(vscode.commands as any).executeCommand = executeCommand;
		}
	});

	it('does not generate anything when AGENTS.md already exists and the choice is dismissed', async () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-agents-'));
		const agentsPath = path.join(root, 'AGENTS.md');
		fs.writeFileSync(agentsPath, '# existing\n', 'utf-8');
		const messages: string[] = [];
		const original = {
			workspaceFolders: vscode.workspace.workspaceFolders,
			showInformationMessage: vscode.window.showInformationMessage,
			getConfiguration: vscode.workspace.getConfiguration,
		};
		(vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: root } }];
		(vscode.workspace as any).getConfiguration = () => ({ get: (_key: string, fallback?: unknown) => fallback });
		(vscode.window as any).showInformationMessage = async () => undefined;
		try {
			await setupProject({ appendLine: (line: string) => messages.push(line) } as any);
			assert.strictEqual(fs.readFileSync(agentsPath, 'utf-8'), '# existing\n');
			assert.ok(messages.some(line => line.includes('already exists')));
			assert.strictEqual(await existingAgentsChoice(), undefined);
		} finally {
			(vscode.workspace as any).workspaceFolders = original.workspaceFolders;
			(vscode.window as any).showInformationMessage = original.showInformationMessage;
			(vscode.workspace as any).getConfiguration = original.getConfiguration;
			fs.rmSync(root, { recursive: true, force: true });
		}
	});
});