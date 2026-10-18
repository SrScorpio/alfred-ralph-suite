import * as vscode from 'vscode';
import { _doActivate } from './activate';
import { installUserCatalog } from './catalogInstaller';

function getExtensionVersion(): string {
	const pkg = require('../package.json');
	return pkg.version || 'unknown';
}

export function activate(context: vscode.ExtensionContext) {
	const output = vscode.window.createOutputChannel('Ralph Suite', { log: true });
	context.subscriptions.push(output);
	output.appendLine(`[Ralph] ===== ACTIVATING v${getExtensionVersion()} =====`);

	try {
		_doActivate(context, output);
		output.appendLine('[Ralph] ===== ACTIVATION COMPLETE =====');
		void installUserCatalog({
			extensionPath: context.extensionPath,
			version: getExtensionVersion(),
		}).then((result) => {
			if (!result.changed) return;
			output.appendLine(`[Alfred Ralph] ${result.agents} agentes copiados al perfil`);
			void vscode.window.showInformationMessage(
				`Alfred Ralph Suite instaló ${result.agents} agentes. Recarga la ventana para verlos en el selector del chat.`,
				'Recargar ventana',
			).then((choice) => {
				if (choice === 'Recargar ventana') {
					void vscode.commands.executeCommand('workbench.action.reloadWindow');
				}
			});
		}).catch((error: unknown) => {
			output.appendLine(`[Alfred Ralph] no se pudo instalar el catálogo: ${error}`);
		});
	} catch (e) {
		output.appendLine(`[Ralph] ===== ACTIVATION FAILED: ${e} =====`);
		output.appendLine(`[Ralph] Stack: ${(e as Error)?.stack ?? 'no stack'}`);
		output.show();
		vscode.window.showErrorMessage(`Ralph Suite activation failed: ${e}`);
	}
}

export function deactivate() {}
