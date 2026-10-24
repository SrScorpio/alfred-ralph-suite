import * as vscode from 'vscode';

export const HOST_CHAT_SETTING_KEYS = [
	'chat.permissions.default',
	'chat.tools.global.autoApprove',
	'chat.newSession.defaultMode',
	'chat.autopilot.advanced.enabled',
] as const;

type ExpectedType = 'string' | 'boolean';
const EXPECTED_TYPES: Record<(typeof HOST_CHAT_SETTING_KEYS)[number], ExpectedType> = {
	'chat.permissions.default': 'string',
	'chat.tools.global.autoApprove': 'boolean',
	'chat.newSession.defaultMode': 'string',
	'chat.autopilot.advanced.enabled': 'boolean',
};

export function normalizeHostChatValue(value: unknown, expectedType: ExpectedType): string | undefined {
	if (expectedType === 'string' && typeof value !== 'string') return undefined;
	if (expectedType === 'boolean' && typeof value !== 'boolean') return undefined;
	const plain = String(value)
		.replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, ' ')
		.replace(/\$\(/g, '(');
	return plain.length > 120 ? `${plain.slice(0, 119)}…` : plain;
}

export interface HostChatSettingSnapshot {
	key: (typeof HOST_CHAT_SETTING_KEYS)[number];
	value: string;
	support: 'unknown' | 'unavailable';
}

export interface HostChatDefaultsSnapshot {
	settings: HostChatSettingSnapshot[];
	workspaceTrusted: boolean;
	hasWorkspaceFolders: boolean;
	vscodeVersion: string;
}

export function readHostChatDefaults(): HostChatDefaultsSnapshot {
	const config = vscode.workspace.getConfiguration();
	const settings = HOST_CHAT_SETTING_KEYS.map((key): HostChatSettingSnapshot => {
		const inspected = config.inspect<unknown>(key);
		if (!inspected) return { key, value: 'no disponible', support: 'unavailable' };
		// inspect() also returns manually configured keys without certifying host schema support.
		const support = 'unknown';
		const resolved = config.get<unknown>(key);
		const explicit = inspected.globalValue !== undefined || inspected.workspaceValue !== undefined ||
			inspected.workspaceFolderValue !== undefined || inspected.globalLanguageValue !== undefined ||
			inspected.workspaceLanguageValue !== undefined || inspected.workspaceFolderLanguageValue !== undefined;
		if (!explicit) return { key, value: 'sin configurar', support };
		return { key, value: normalizeHostChatValue(resolved, EXPECTED_TYPES[key]) ?? 'sin configurar', support };
	});
	return {
		settings,
		workspaceTrusted: vscode.workspace.isTrusted,
		hasWorkspaceFolders: (vscode.workspace.workspaceFolders?.length ?? 0) > 0,
		vscodeVersion: normalizeHostChatValue(vscode.version, 'string') ?? 'no disponible',
	};
}
