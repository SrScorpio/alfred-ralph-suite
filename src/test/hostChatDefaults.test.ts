import * as assert from 'assert';
import * as vscode from 'vscode';
import { HOST_CHAT_SETTING_KEYS, normalizeHostChatValue, readHostChatDefaults } from '../hostChatDefaults';

describe('hostChatDefaults', () => {
	it('does not certify support from inspect, has, defaults, or manually configured values', () => {
		const config = vscode.workspace.getConfiguration;
		(vscode.workspace as any).getConfiguration = () => ({
			has: () => true,
			inspect: (key: string) => key === 'chat.autopilot.advanced.enabled' ? undefined :
				({ key, globalValue: key === 'chat.tools.global.autoApprove' ? false : 'manual', defaultValue: 'host-default' }),
			get: (key: string) => key === 'chat.tools.global.autoApprove' ? false : 'manual',
		});
		try {
			const result = readHostChatDefaults();
			assert.deepStrictEqual(result.settings.map((setting) => (setting as any).support),
				['unknown', 'unknown', 'unknown', 'unavailable']);
			assert.strictEqual(result.settings[0].value, 'manual');
			assert.strictEqual(result.settings[1].value, 'false');
		} finally {
			(vscode.workspace as any).getConfiguration = config;
		}
	});
	it('expone únicamente las cuatro claves oficiales permitidas', () => {
		assert.deepStrictEqual(HOST_CHAT_SETTING_KEYS, [
			'chat.permissions.default',
			'chat.tools.global.autoApprove',
			'chat.newSession.defaultMode',
			'chat.autopilot.advanced.enabled',
		]);
	});

	it('normaliza a texto plano acotado y neutraliza controles, iconos y bidi', () => {
		assert.strictEqual(normalizeHostChatValue('valor$(run)\u202E\n', 'string'), 'valor(run)  ');
		assert.strictEqual(normalizeHostChatValue('x'.repeat(130), 'string')?.length, 120);
	});

	it('preserva false y cadena vacía como valores configurados válidos', () => {
		assert.strictEqual(normalizeHostChatValue(false, 'boolean'), 'false');
		assert.strictEqual(normalizeHostChatValue('', 'string'), '');
		assert.strictEqual(normalizeHostChatValue(1, 'boolean'), undefined);
	});

	it('distingue claves no registradas de valores sin configurar y no escribe ajustes', () => {
		const previous = vscode.workspace.getConfiguration;
		const values: Record<string, unknown> = {
			'chat.permissions.default': '',
			'chat.tools.global.autoApprove': false,
			'chat.newSession.defaultMode': undefined,
			'chat.autopilot.advanced.enabled': undefined,
		};
		(vscode.workspace as any).getConfiguration = () => ({
			get: (key: string) => values[key],
			inspect: (key: string) => key === 'chat.autopilot.advanced.enabled' ? undefined :
				({ globalValue: values[key], workspaceValue: undefined, workspaceFolderValue: undefined }),
		});
		try {
			const result = readHostChatDefaults();
			assert.strictEqual(result.settings[0].value, '');
			assert.strictEqual(result.settings[1].value, 'false');
			assert.strictEqual(result.settings[2].value, 'sin configurar');
			assert.strictEqual(result.settings[3].value, 'no disponible');
		} finally {
			(vscode.workspace as any).getConfiguration = previous;
		}
	});
});
