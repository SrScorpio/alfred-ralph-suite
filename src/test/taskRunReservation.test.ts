import * as assert from 'assert';
import * as vscode from 'vscode';
import { runTaskWithRetry } from '../commands/task';
import { RalphStateManager } from '../stateManager';
import {
	getTaskRunReservation,
	markTaskRunSending,
	markTaskRunNotSent,
	markTaskRunSent,
	markTaskRunUnknown,
	recoverTaskRunReservation,
	releaseTaskRunReservation,
	reserveTaskRun,
	withTaskRunReservation,
} from '../taskRunReservation';

describe('global Ralph task-run reservation', () => {
	it('keeps the taskRetries setting available for configuration compatibility', () => {
		const manifest = require('../../package.json');
		const retries = manifest.contributes.configuration.properties['ralph-suite.taskRetries'];
		assert.strictEqual(retries.default, 1);
		assert.strictEqual(retries.maximum, 5);
	});

	it('reserves synchronously before the async identity/action can yield', async () => {
		let finishIdentity: (() => void) | undefined;
		const entry = withTaskRunReservation('identity-root', 'IDENTITY', async () => {
			await new Promise<void>(resolve => { finishIdentity = resolve; });
		});
		assert.strictEqual(getTaskRunReservation()?.taskId, 'IDENTITY');
		assert.strictEqual(reserveTaskRun('another-root', 'OTHER'), null);
		finishIdentity?.();
		assert.strictEqual(await entry, true);
		assert.strictEqual(getTaskRunReservation(), undefined);
	});

	it('allows only one reservation across tasks and workspace roots', () => {
		const first = reserveTaskRun('workspace-a', 'TASK-A');
		assert.ok(first);
		assert.strictEqual(reserveTaskRun('workspace-a', 'TASK-A'), null);
		assert.strictEqual(reserveTaskRun('workspace-a', 'TASK-B'), null);
		assert.strictEqual(reserveTaskRun('workspace-b', 'TASK-C'), null);
		releaseTaskRunReservation(first!);
	});

	it('requires the owning token to release a reservation', () => {
		const old = reserveTaskRun('workspace', 'OLD');
		assert.ok(old);
		releaseTaskRunReservation(old!);
		const current = reserveTaskRun('workspace', 'CURRENT');
		assert.ok(current);
		releaseTaskRunReservation(old!);
		assert.strictEqual(getTaskRunReservation(), current);
		releaseTaskRunReservation(current!);
	});

	it('retains an ambiguous send until explicit recovery is approved', () => {
		const reservation = reserveTaskRun('workspace', 'TASK');
		assert.ok(reservation);
		assert.strictEqual(markTaskRunSending(reservation!), true);
		assert.strictEqual(releaseTaskRunReservation(reservation!), false);
		assert.strictEqual(markTaskRunUnknown(reservation!), true);
		assert.strictEqual(getTaskRunReservation()?.phase, 'recovery');
		assert.strictEqual(reserveTaskRun('other', 'OTHER'), null);
		assert.strictEqual(recoverTaskRunReservation(reservation!, false), false);
		assert.strictEqual(getTaskRunReservation(), reservation);
		assert.strictEqual(recoverTaskRunReservation(reservation!, true), true);
		assert.strictEqual(getTaskRunReservation(), undefined);
	});

	it('releases a reservation after an unequivocal pre-send failure', () => {
		const reservation = reserveTaskRun('workspace', 'TASK');
		assert.ok(reservation);
		releaseTaskRunReservation(reservation!);
		assert.strictEqual(getTaskRunReservation(), undefined);
	});

	it('sends only once across concurrent runner calls for different tasks and roots', async () => {
		const execute = vscode.commands.executeCommand;
		const controller = new AbortController();
		const rootBase = require('path').join(require('os').tmpdir(), `ralph-global-${Date.now()}`);
		let opens = 0;
		(vscode.commands as any).executeCommand = async (command: string) => {
			if (command === 'workbench.action.chat.open') { opens++; }
		};
		const output = { appendLine: () => undefined } as any;
		try {
			const first = runTaskWithRetry({ id: 'SERIAL-A', title: 'A' }, 'A', require('path').join(rootBase, 'a'), false, 5000, 6000, 3, output, controller.signal);
			await new Promise(resolve => setTimeout(resolve, 0));
			await runTaskWithRetry({ id: 'SERIAL-A', title: 'A' }, 'A', require('path').join(rootBase, 'a'), false, 0, 100, 3, output);
			await runTaskWithRetry({ id: 'SERIAL-B', title: 'B' }, 'B', require('path').join(rootBase, 'b'), false, 0, 100, 3, output);
			assert.strictEqual(opens, 1);
			controller.abort();
			await first;
			const pending = getTaskRunReservation();
			assert.strictEqual(pending?.phase, 'recovery');
			assert.strictEqual(recoverTaskRunReservation(pending!, true), true);
		} finally {
			(vscode.commands as any).executeCommand = execute;
			const pending = getTaskRunReservation();
			if (pending?.phase === 'recovery') { recoverTaskRunReservation(pending, true); }
		}
	});

	it('releases a pre-aborted runner without sending', async () => {
		const controller = new AbortController();
		controller.abort();
		const execute = vscode.commands.executeCommand;
		let opens = 0;
		(vscode.commands as any).executeCommand = async (command: string) => {
			if (command === 'workbench.action.chat.open') { opens++; }
		};
		try {
			await runTaskWithRetry({ id: 'PRE-ABORT', title: 'A' }, 'A', 'root', false, 0, 100, 0, { appendLine: () => undefined } as any, controller.signal);
			assert.strictEqual(opens, 0);
			assert.strictEqual(getTaskRunReservation(), undefined);
		} finally {
			(vscode.commands as any).executeCommand = execute;
		}
	});

	it('does not release after send timeout even when the host command finishes late', async () => {
		const execute = vscode.commands.executeCommand;
		let finishLate: (() => void) | undefined;
		(vscode.commands as any).executeCommand = async (command: string) => {
			if (command === 'workbench.action.chat.open') {
				return new Promise<void>(resolve => { finishLate = resolve; });
			}
		};
		try {
			await runTaskWithRetry({ id: 'LATE-SEND', title: 'A' }, 'A', require('os').tmpdir(), false, 0, 10, 2, { appendLine: () => undefined } as any);
			const pending = getTaskRunReservation();
			assert.strictEqual(pending?.phase, 'recovery');
			finishLate?.();
			await new Promise(resolve => setTimeout(resolve, 0));
			assert.strictEqual(getTaskRunReservation(), pending);
			assert.strictEqual(recoverTaskRunReservation(pending!, true), true);
		} finally {
			(vscode.commands as any).executeCommand = execute;
			const pending = getTaskRunReservation();
			if (pending?.phase === 'recovery') { recoverTaskRunReservation(pending, true); }
		}
	});

	it('preserves normal completion and releases the global reservation', async () => {
		const execute = vscode.commands.executeCommand;
		const root = require('os').tmpdir();
		const id = `COMPLETED-NORMALLY-${Date.now()}`;
		(vscode.commands as any).executeCommand = async (command: string) => {
			if (command === 'workbench.action.chat.open') { RalphStateManager.setCompleted(root, id); }
		};
		try {
			await runTaskWithRetry({ id, title: 'A' }, 'A', root, false, 0, 100, 0, { appendLine: () => undefined } as any);
			assert.strictEqual(RalphStateManager.getStatus(root, id), 'completed');
			assert.strictEqual(getTaskRunReservation(), undefined);
		} finally {
			(vscode.commands as any).executeCommand = execute;
		}
	});
});
