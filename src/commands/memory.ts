/**
 * memory.ts — Optimización de memories.md legacy y migración a status.md (ADR-020)
 *
 * Extraído de extension.ts durante la modularización (ADR-014).
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { RalphStateManager } from '../stateManager';
import { sendToChat } from '../chatLauncher';
import { AlfredIdentity } from '../alfredIdentity';
import { buildAlfredOptimizePrompt } from '../alfredPrompt';

// ── Prompt builder ───────────────────────────────────────────────────────────

export function buildOptimizePrompt(memoriesPath: string, memoriesContent: string, alfredIdentity?: AlfredIdentity | null): string {
	if (alfredIdentity) {
		return buildAlfredOptimizePrompt(alfredIdentity, memoriesPath, memoriesContent);
	}
	return `You are helping maintain a project memory file used by AI agents.

The file \`${memoriesPath}\` currently contains:

---
${memoriesContent}
---

Please optimize this file by:
1. **Remove duplicates** — if the same fact, convention, or note appears more than once, keep only the clearest version
2. **Consolidate related entries** — merge similar notes from different task completions into single concise statements
3. **Remove noise** — delete entries that are too vague, obvious, or no longer relevant
4. **Preserve structure** — keep the existing sections (## Project, ## Conventions, ## Known Issues, ## Completed Tasks, etc.)
5. **Keep all unique knowledge** — do not remove facts that are not duplicated, even if brief
6. **Completed Tasks section** — keep only the last 10 entries, summarising older ones into a single "## Earlier completions" paragraph if needed

The result should be significantly shorter than the original but contain all unique knowledge.

Write the optimized content to: \`${memoriesPath}\`

After writing the file, confirm with: "Memory optimized — reduced from X to Y lines."`;
}

// ── Optimize command ─────────────────────────────────────────────────────────

export async function optimizeMemory(
	root: string,
	output: vscode.OutputChannel,
	review: boolean,
	alfredIdentity?: AlfredIdentity | null
): Promise<void> {
	const configuredPath = vscode.workspace.getConfiguration('ralph-suite').get<string>('memoriesPath', '.agent/memories.md');
	const memoriesPath = RalphStateManager.memoriesPath(root, configuredPath);
	if (!fs.existsSync(memoriesPath)) {
		vscode.window.showInformationMessage('No memories.md found — project memory lives in docs/project/status.md (ADR-020). Nothing to optimize.');
		return;
	}

	const content = fs.readFileSync(memoriesPath, 'utf-8').trim();
	if (!content) {
		vscode.window.showInformationMessage('memories.md is empty — nothing to optimize.');
		return;
	}

	const lineCount = content.split('\n').length;
	output.appendLine(`[Memory] Optimizing memories.md (${lineCount} lines, ${content.length} chars)`);

	const prompt = buildOptimizePrompt(memoriesPath.replace(/\\/g, '/'), content, alfredIdentity);

	if (!review) {
		// Direct mode — agent rewrites the file without confirmation
		await sendToChat(prompt, {
			freshContext: true,
			fallbackMessage: 'Prompt copied — paste in Chat to optimize memories.',
			agent: alfredIdentity?.actions.optimizeMemory.agent,
		});
		output.appendLine('[Memory] Optimization prompt sent — agent will apply directly');
		vscode.window.showInformationMessage('Memory optimization started — agent will rewrite memories.md directly.');
	} else {
		// Review mode — show prompt in chat for user to confirm
		await sendToChat(prompt + '\n\n> ⚠️ Review the proposed changes before confirming. Only write the file if you are happy with the result.', {
			agent: alfredIdentity?.actions.optimizeMemory.agent,
			freshContext: true,
			fallbackMessage: 'Prompt copied — paste in Chat to review optimization.',
		});
		output.appendLine('[Memory] Optimization prompt sent for review');
		vscode.window.showInformationMessage('Review the optimization in Chat. Confirm to apply or discard.');
	}

}

// ── Migration memories.md → status.md (ADR-020) ──────────────────────────────

/**
 * Migra el contenido legacy de .agent/memories.md a docs/project/status.md.
 * Pide confirmación mostrando las líneas a migrar y nunca borra el original.
 */
export async function migrateMemories(root: string, output: vscode.OutputChannel): Promise<void> {
	const configuredPath = vscode.workspace.getConfiguration('ralph-suite').get<string>('memoriesPath', '.agent/memories.md');
	let memoriesFile: string;
	try {
		memoriesFile = RalphStateManager.memoriesPath(root, configuredPath);
	} catch (error: unknown) {
		vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Ralph: memories.md must remain inside the workspace.');
		return;
	}
	if (!fs.existsSync(memoriesFile)) {
		vscode.window.showInformationMessage('No .agent/memories.md to migrate — project memory already lives in docs/project/status.md (ADR-020).');
		return;
	}
	const content = fs.readFileSync(memoriesFile, 'utf-8').trim();
	if (!content) {
		vscode.window.showInformationMessage('.agent/memories.md is empty — nothing to migrate.');
		return;
	}
	const lines = content.split(/\r?\n/).length;
	const target = 'docs/project/status.md';
	const confirm = await vscode.window.showWarningMessage(
		`Migrate ${lines} line(s) from .agent/memories.md to ${target}? The original file is kept (ADR-020).`,
		'Migrate',
	);
	if (confirm !== 'Migrate') { return; }

	try {
		const result = RalphStateManager.migrateMemories(root, configuredPath);
		output.appendLine(`[Memory] Migrated ${result.lines} line(s) from ${memoriesFile.replace(/\\/g, '/')} to ${result.statusPath.replace(/\\/g, '/')}`);
		const open = await vscode.window.showInformationMessage(
			result.migrated
				? `Memory migrated to ${target} (${result.lines} line(s)) under "## Conocimiento migrado (memories.md)".`
				: `Nothing to migrate — ${target} is the single project memory (ADR-020).`,
			'Open status.md',
		);
		if (open === 'Open status.md') {
			const doc = await vscode.workspace.openTextDocument(result.statusPath);
			await vscode.window.showTextDocument(doc);
		}
	} catch (error: unknown) {
		vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Ralph: memory migration failed.');
	}
}

// ── Auto-optimize check (implemented in KanbanPanel.checkAutoOptimize) ───────
