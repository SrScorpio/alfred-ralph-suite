import * as vscode from 'vscode';
import { HOST_CHAT_SETTING_KEYS, readHostChatDefaults } from '../hostChatDefaults';
import { requireWorkspaceTrust } from '../workspaceTrust';

const combinedFilter = HOST_CHAT_SETTING_KEYS.map((key) => `@id:${key}`).join(' ');
const NOTICE = 'Ajustes globales del host; no limitados a esta tarea/carpeta. La autoaprobación puede permitir acciones sin confirmación. Ralph no modifica ajustes ni acredita permisos efectivos';

async function openOfficialSettings(): Promise<void> {
	try {
		await vscode.commands.executeCommand('workbench.action.openSettings', combinedFilter);
	} catch {
		let opened = false;
		for (const key of HOST_CHAT_SETTING_KEYS) {
			try {
				await vscode.commands.executeCommand('workbench.action.openSettings', `@id:${key}`);
				opened = true;
			} catch { /* Se prueban las demás claves antes de informar del fallo total. */ }
		}
		if (!opened) throw new Error('All five settings navigation attempts failed.');
	}
}

export async function showHostChatDefaults(): Promise<void> {
	if (!requireWorkspaceTrust('consultar la configuración del chat')) return;
	try {
		while (true) {
			const snapshot = readHostChatDefaults();
			const items: (vscode.QuickPickItem & { action?: 'refresh' | 'settings' })[] = [
				...snapshot.settings.map(({ key, value, support }) => ({
					label: key, description: support === 'unknown' ? `${value} (soporte no verificado)` : value,
				})),
				{ label: 'Confianza del workspace completo', description: snapshot.hasWorkspaceFolders ? (snapshot.workspaceTrusted ? 'de confianza' : 'no es de confianza') : 'sin carpetas abiertas' },
				{ label: 'Versión de VS Code', description: snapshot.vscodeVersion },
				{ label: 'Policy: no determinable' },
				{ label: 'Permisos efectivos de la sesión: no determinables' },
				{ label: 'Actualizar', action: 'refresh' },
				{ label: 'Abrir ajustes oficiales', action: 'settings' },
			];
			const selected = await vscode.window.showQuickPick(items, { title: 'Configuración actual del chat de VS Code', ignoreFocusOut: true });
			if (selected?.action === 'refresh') continue;
			if (selected?.action === 'settings') await openHostChatSettings();
			return;
		}
	} catch {
		await vscode.window.showErrorMessage('Ralph: no se pudo consultar la configuración del chat de VS Code.');
	}
}

export async function openHostChatSettings(): Promise<void> {
	if (!requireWorkspaceTrust('abrir los ajustes del chat')) return;
	try {
		const choice = await vscode.window.showWarningMessage(NOTICE, 'Abrir ajustes oficiales');
		if (choice === 'Abrir ajustes oficiales') await openOfficialSettings();
	} catch {
		await vscode.window.showErrorMessage('Ralph: no se pudieron abrir los ajustes del chat de VS Code.');
	}
}
