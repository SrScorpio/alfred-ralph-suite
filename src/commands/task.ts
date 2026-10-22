/**
 * task.ts — Runner de tareas: ejecución, reintentos y polling
 *
 * Extraído de extension.ts durante la modularización (ADR-014).
 */

import * as vscode from 'vscode';
import { RalphStateManager } from '../stateManager';
import { KanbanPanel } from '../kanbanPanel';
import { sendToChatWithOutcome } from '../chatLauncher';
import { checkDangerousCommand } from '../security/dangerGuard';
import {
	markTaskRunSending,
	markTaskRunNotSent,
	markTaskRunSent,
	markTaskRunUnknown,
	getTaskRunReservation,
	releaseTaskRunReservation,
	reserveTaskRun,
	recoverTaskRunReservation,
	type TaskRunReservation,
} from '../taskRunReservation';

// ── Sleep utility ────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
	return new Promise(r => setTimeout(r, ms));
}

export function getTaskRunBlockReason(
	task: { id: string; status: string; dependencies?: string[] },
	runtimeStatuses: Record<string, string>,
	prdStatuses: Record<string, string>,
): string | null {
	if (task.status !== 'todo') {
		return `Task ${task.id} cannot run because its status is ${task.status}.`;
	}
	const dependency = (task.dependencies ?? []).find(id =>
		runtimeStatuses[id] !== 'completed' && prdStatuses[id] !== 'completed'
	);
	return dependency
		? `Task ${task.id} is blocked: dependency ${dependency} is not completed.`
		: null;
}

export type RunnerStopReason = 'no-prd' | 'in-progress' | 'none-eligible';

export function runnerStopMessage(reason: RunnerStopReason, locale: 'en' | 'es' = 'en'): string {
	const messages = {
		en: {
			'no-prd': 'No PRD loaded. Auto-run did not start any task.',
			'in-progress': 'A task is already in progress. Auto-run did not start another task.',
			'none-eligible': 'No eligible task. Auto-run did not start any task.',
		},
		es: {
			'no-prd': 'No hay PRD cargado. Auto-ejecutar no ha lanzado ninguna tarea.',
			'in-progress': 'Hay una tarea en curso. Auto-ejecutar no ha lanzado otra.',
			'none-eligible': 'No hay ninguna tarea elegible. Auto-ejecutar no ha lanzado ninguna.',
		},
	};
	return messages[locale][reason];
}

export function pendingTasksMessage(
	issues: readonly { status: string }[],
	emptyMessage: string,
	blockedMessage = 'No hay tareas todo elegibles; quedan tareas bloqueadas o fallidas.',
): string {
	return issues.some(issue => issue.status === 'blocked' || issue.status === 'failed')
		? blockedMessage
		: emptyMessage;
}

function waitWithAbort(ms: number, signal?: AbortSignal): Promise<boolean> {
	return new Promise(resolve => {
		if (signal?.aborted) { resolve(false); return; }
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve(true);
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			signal?.removeEventListener('abort', onAbort);
			resolve(false);
		};
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}

// ── Task runner with retries ─────────────────────────────────────────────────

let recoveryConfirmation: Promise<boolean> | undefined;
let recoveryDeclined: TaskRunReservation | undefined;

/** Share one confirmation. A decline remains bound to that reservation token. */
export function confirmTaskRunRecovery(): Promise<boolean> {
	const pending = getTaskRunReservation();
	if (pending && pending === recoveryDeclined && pending.phase === 'recovery') { return Promise.resolve(false); }
	if (!recoveryConfirmation) {
		recoveryConfirmation = confirmTaskRunRecoveryOnce().finally(() => { recoveryConfirmation = undefined; });
	}
	return recoveryConfirmation;
}

async function confirmTaskRunRecoveryOnce(): Promise<boolean> {
	const pending = getTaskRunReservation();
	if (!pending || pending.phase !== 'recovery') { return false; }
	const confirm = 'He comprobado y detenido al agente anterior; recuperar';
	const answer = await vscode.window.showWarningMessage(
		`Ralph: el env?o de ${pending.taskId} pudo llegar al agente y no se puede confirmar su estado. Comprueba el chat y det?n el agente anterior antes de recuperar.`,
		{ modal: true }, confirm,
	);
	if (answer !== confirm || getTaskRunReservation() !== pending || pending.phase !== 'recovery') {
		if (getTaskRunReservation() === pending && pending.phase === 'recovery') { recoveryDeclined = pending; }
		return false;
	}
	recoveryDeclined = undefined;
	const recovered = recoverTaskRunReservation(pending, true);
	if (recovered) {
		if (RalphStateManager.getStatus(pending.root, pending.taskId) !== 'completed') {
			RalphStateManager.setTodoOverride(pending.root, pending.taskId);
		}
		KanbanPanel.endTask(pending.root, pending.taskId);
		KanbanPanel.refresh();
	}
	return recovered;
}

export async function runTaskWithRetry(
	task: any, prompt: string, root: string,
	freshContext: boolean, minWaitMs: number, timeoutMs: number,
	retries: number, output: vscode.OutputChannel, signal?: AbortSignal,
	agent?: string, reservation?: TaskRunReservation,
): Promise<void> {
	// Keep the setting/API compatible, but never retry work that may be active remotely.
	void retries;
	const owner = reservation ?? reserveTaskRun(root, task.id);
	if (!owner) {
		vscode.window.showWarningMessage('Ralph: ya hay una ejecuci?n reservada en esta instancia.');
		return;
	}
	let preserveReservation = false;
	let activeTracked = false;
	try {
		const pollMs = vscode.workspace.getConfiguration('ralph-suite').get<number>('pollIntervalMs', 5000);
		KanbanPanel.beginTask(root, task.id);
		activeTracked = true;
		const danger = checkDangerousCommand(prompt);
		if (danger) {
			output.appendLine(`[Ralph] ⚠ ${task.id}: comando destructivo en el prompt (${danger.pattern}) — ${danger.guidance}`);
		}
		if (signal?.aborted) { return; }
		if (!markTaskRunSending(owner)) { return; }
		let outcome;
		try {
			outcome = await sendToChatWithOutcome(prompt, {
				freshContext,
				fallbackMessage: 'Prompt copied ? paste in Chat.',
				timeoutMs: Math.min(timeoutMs, 10000),
				signal,
				agent,
			});
		} catch {
			// An exception after chat.open began does not prove that nothing was sent.
			outcome = 'unknown';
		}
		if (outcome === 'not-sent') {
			markTaskRunNotSent(owner);
			vscode.window.showWarningMessage(`Ralph: no se pudo abrir Chat para ${task.id}. La tarea no se ha iniciado.`);
			return;
		}
		if (outcome === 'unknown' || signal?.aborted) {
			preserveReservation = markTaskRunUnknown(owner);
			if (RalphStateManager.getStatus(root, task.id) !== 'completed') {
				RalphStateManager.setInProgress(root, task.id, task.title);
			}
			KanbanPanel.refresh();
			return;
		}
		if (!markTaskRunSent(owner)) { return; }
		if (RalphStateManager.getStatus(root, task.id) === 'completed') { return; }
		RalphStateManager.setInProgress(root, task.id, task.title);
		KanbanPanel.refresh();
		output.appendLine(`[Ralph] Task ${task.id} started ? waiting ${minWaitMs / 1000}s`);
		if (!await waitWithAbort(minWaitMs, signal)) {
			preserveReservation = markTaskRunUnknown(owner);
			return;
		}
		const startedAt = Date.now();
		while (Date.now() - startedAt < timeoutMs - minWaitMs) {
			if (RalphStateManager.getStatus(root, task.id) === 'completed') {
				output.appendLine(`[Ralph] ? ${task.id} completed`);
				return;
			}
			if (!await waitWithAbort(pollMs, signal)) {
				preserveReservation = markTaskRunUnknown(owner);
				return;
			}
		}
		if (RalphStateManager.getStatus(root, task.id) === 'completed') { return; }
		output.appendLine(`[Ralph] ? ${task.id} timed out; dispatch outcome remains unknown`);
		preserveReservation = markTaskRunUnknown(owner);
	} finally {
		if (!preserveReservation) {
			releaseTaskRunReservation(owner);
			if (activeTracked) { KanbanPanel.endTask(root, task.id); }
		}
	}
}
