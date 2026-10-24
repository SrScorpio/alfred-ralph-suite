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
			for (const file of result.conflicts) output.appendLine(`[Alfred Ralph] personalizado preservado: ${file}`);
			for (const warning of result.warnings) output.appendLine(`[Alfred Ralph] aviso de catálogo: ${warning}`);
			if (result.conflicts.length || result.warnings.length) {
				output.show(true);
				void vscode.window.showWarningMessage('Alfred Ralph Suite preservó personalizaciones o encontró recursos pendientes. Consulta Output: Ralph Suite.');
			}
			if (!result.changed) return;
			output.appendLine(`[Alfred Ralph] actualizados: ${result.agents} agentes, ${result.skills} skills, ${result.instructions} instrucciones, ${result.templates} plantillas`);
			void vscode.window.showInformationMessage(
				'Alfred Ralph Suite actualizó recursos del catálogo. Recarga la ventana para cargar los cambios; los conflictos pendientes se detallan en Output.',
				'Recargar ventana',
			).then((choice) => {
				if (choice === 'Recargar ventana') {
					void vscode.commands.executeCommand('workbench.action.reloadWindow');
				}
			});
		}).catch(() => {
			output.appendLine('[Alfred Ralph] no se pudo reconciliar el catálogo; no se confirma su instalación completa.');
			output.show(true);
		});
	} catch (e) {
		output.appendLine(`[Ralph] ===== ACTIVATION FAILED: ${e} =====`);
		output.appendLine(`[Ralph] Stack: ${(e as Error)?.stack ?? 'no stack'}`);
		output.show();
		vscode.window.showErrorMessage(`Ralph Suite activation failed: ${e}`);
	}
}

export function deactivate() {}
