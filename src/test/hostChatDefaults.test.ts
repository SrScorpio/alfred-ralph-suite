import * as assert from 'assert';
import { HOST_CHAT_SETTING_KEYS, normalizeHostChatValue } from '../hostChatDefaults';

describe('hostChatDefaults', () => {
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
});
