import * as assert from 'assert';
import * as vscode from 'vscode';
import { openHostChatSettings, showHostChatDefaults } from '../commands/hostChatSettings';

describe('hostChatSettings', () => {
	it('no lee ni abre UI si el workspace no es de confianza', async () => {
		const trusted = (vscode.workspace as any).isTrusted;
		const warning = vscode.window.showWarningMessage;
		(vscode.workspace as any).isTrusted = false;
		let opened = false;
		(vscode.window as any).showWarningMessage = async () => { opened = true; };
		try {
			await (openHostChatSettings as any)('argumento-no-operativo');
			assert.strictEqual(opened, false);
		} finally {
			(vscode.workspace as any).isTrusted = trusted;
			(vscode.window as any).showWarningMessage = warning;
		}
	});

	it('consulta en solo lectura y presenta acciones sin activar valores como comandos', async () => {
		const originalPick = vscode.window.showQuickPick;
		const originalExecute = vscode.commands.executeCommand;
		let shown: any[] = [];
		const executed: unknown[][] = [];
		(vscode.window as any).showQuickPick = async (items: any[]) => { shown = items; return undefined; };
		(vscode.commands as any).executeCommand = async (...args: unknown[]) => { executed.push(args); };
		try {
			await (showHostChatDefaults as any)('argumento ignorado');
			assert.ok(shown.some((item) => item.label === 'Policy: no determinable'));
			assert.ok(shown.some((item) => item.label === 'Permisos efectivos de la sesión: no determinables'));
			assert.strictEqual(executed.length, 0);
		} finally {
			(vscode.window as any).showQuickPick = originalPick;
			(vscode.commands as any).executeCommand = originalExecute;
		}
	});
});
