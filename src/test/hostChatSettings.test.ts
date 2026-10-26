import * as assert from 'assert';
import * as vscode from 'vscode';
import { openHostChatSettings, showHostChatDefaults } from '../commands/hostChatSettings';

describe('hostChatSettings', () => {
	for (const fromQuery of [false, true]) {
		for (const consent of [false, true]) {
			it(`requires global-scope consent before navigation (query=${fromQuery}, consent=${consent})`, async () => {
				const pick = vscode.window.showQuickPick;
				const warning = vscode.window.showWarningMessage;
				const execute = vscode.commands.executeCommand;
				const events: string[] = [];
				(vscode.window as any).showQuickPick = async () => ({ action: 'settings' });
				(vscode.window as any).showWarningMessage = async (message: string, action: string) => {
					assert.ok(message.includes('globales'));
					assert.ok(message.includes('autoaprobación'));
					events.push('warning');
					return consent ? action : undefined;
				};
				(vscode.commands as any).executeCommand = async () => { events.push('open'); };
				try {
					await (fromQuery ? showHostChatDefaults() : openHostChatSettings());
					assert.deepStrictEqual(events, consent ? ['warning', 'open'] : ['warning']);
				} finally {
					(vscode.window as any).showQuickPick = pick;
					(vscode.window as any).showWarningMessage = warning;
					(vscode.commands as any).executeCommand = execute;
				}
			});
		}

		it(`reports total navigation failure to the user (query=${fromQuery})`, async () => {
			const pick = vscode.window.showQuickPick;
			const warning = vscode.window.showWarningMessage;
			const error = vscode.window.showErrorMessage;
			const execute = vscode.commands.executeCommand;
			const opened: string[] = [];
			const errors: string[] = [];
			(vscode.window as any).showQuickPick = async () => ({ action: 'settings' });
			(vscode.window as any).showWarningMessage = async (_: string, action: string) => action;
			(vscode.window as any).showErrorMessage = async (message: string) => { errors.push(message); };
			(vscode.commands as any).executeCommand = async (_: string, filter: string) => {
				opened.push(filter);
				throw new Error('Navigation unavailable');
			};
			try {
				await (fromQuery ? showHostChatDefaults() : openHostChatSettings());
				assert.strictEqual(opened.length, 5);
				assert.strictEqual(new Set(opened).size, 5);
				assert.deepStrictEqual(errors, ['Ralph: no se pudieron abrir los ajustes del chat de VS Code.']);
			} finally {
				(vscode.window as any).showQuickPick = pick;
				(vscode.window as any).showWarningMessage = warning;
				(vscode.window as any).showErrorMessage = error;
				(vscode.commands as any).executeCommand = execute;
			}
		});
	}

	it('preserves individual-key fallbacks when combined navigation fails', async () => {
		const warning = vscode.window.showWarningMessage;
		const error = vscode.window.showErrorMessage;
		const execute = vscode.commands.executeCommand;
		let attempts = 0;
		const errors: string[] = [];
		(vscode.window as any).showWarningMessage = async (_: string, action: string) => action;
		(vscode.window as any).showErrorMessage = async (message: string) => { errors.push(message); };
		(vscode.commands as any).executeCommand = async () => {
			attempts++;
			if (attempts !== 3) throw new Error('Navigation unavailable');
		};
		try {
			await openHostChatSettings();
			assert.strictEqual(attempts, 5);
			assert.deepStrictEqual(errors, []);
		} finally {
			(vscode.window as any).showWarningMessage = warning;
			(vscode.window as any).showErrorMessage = error;
			(vscode.commands as any).executeCommand = execute;
		}
	});

	it('shows support uncertainty alongside inspected values', async () => {
		const config = vscode.workspace.getConfiguration;
		const pick = vscode.window.showQuickPick;
		let shown: any[] = [];
		(vscode.workspace as any).getConfiguration = () => ({
			inspect: () => ({ globalValue: true }), get: () => true,
		});
		(vscode.window as any).showQuickPick = async (items: any[]) => { shown = items; };
		try {
			await showHostChatDefaults();
			assert.ok(shown.find((item) => item.label === 'chat.tools.global.autoApprove')
				.description.includes('soporte no verificado'));
		} finally {
			(vscode.workspace as any).getConfiguration = config;
			(vscode.window as any).showQuickPick = pick;
		}
	});
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
