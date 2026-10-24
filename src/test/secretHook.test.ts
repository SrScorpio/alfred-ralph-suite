import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync, spawnSync } from 'child_process';
import { buildSecretHook, installSecretHook, SECRET_HOOK_SCRIPT } from '../security/secretHook';

describe('Integrity audit Secret Guard composition', () => {
	let root: string;
	let hooks: string;
	const gitExecPath = execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim();
	const shell = process.platform === 'win32' ? path.resolve(gitExecPath, '..', '..', '..', 'bin', 'sh.exe') : 'sh';
	let gitEnvironment: Record<string, string | undefined>;
	beforeEach(() => {
		gitEnvironment = {};
		for (const key of Object.keys(process.env).filter(key => /^GIT_/i.test(key))) {
			gitEnvironment[key] = process.env[key];
			delete process.env[key];
		}
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-hook-fixture-'));
		const globalHooks = path.join(root, 'global-hooks');
		fs.mkdirSync(globalHooks);
		fs.writeFileSync(path.join(globalHooks, 'pre-commit'), '#!/bin/sh\nexit 91\n');
		const globalConfig = path.join(root, 'global-config');
		fs.writeFileSync(globalConfig, '');
		process.env.GIT_CONFIG_GLOBAL = globalConfig;
		process.env.GIT_CONFIG_SYSTEM = path.join(root, 'absent-system-config');
		process.env.GIT_CONFIG_NOSYSTEM = '1';
		execFileSync('git', ['config', '--global', 'core.hooksPath', globalHooks]);
		const templates = path.join(root, 'empty-templates');
		fs.mkdirSync(templates);
		execFileSync('git', ['init', '--quiet', '--template=' + templates, root]);
		execFileSync('git', ['config', '--local', 'core.hooksPath', '.git/hooks'], { cwd: root });
		hooks = path.join(root, '.git', 'hooks');
		fs.mkdirSync(hooks, { recursive: true });
		assertEffectiveHooks(hooks);
		assert.deepStrictEqual(fs.readdirSync(hooks), []);
		fs.writeFileSync(path.join(root, 'staged.txt'), 'harmless fixture');
		execFileSync('git', ['add', 'staged.txt'], { cwd: root });
	});
	afterEach(() => {
		for (const key of Object.keys(process.env).filter(key => /^GIT_/i.test(key))) { delete process.env[key]; }
		for (const [key, value] of Object.entries(gitEnvironment)) { process.env[key] = value; }
		fs.rmSync(root, { recursive: true, force: true });
	});
	function assertEffectiveHooks(expected: string) {
		const effective = path.resolve(root, execFileSync('git', ['rev-parse', '--git-path', 'hooks'], { cwd: root, encoding: 'utf8' }).trim());
		assert.strictEqual(effective, expected);
		assert.ok(path.relative(root, effective) && !path.relative(root, effective).startsWith('..') && !path.isAbsolute(path.relative(root, effective)));
	}
	function run() {
		return spawnSync(shell, [path.join(hooks, 'pre-commit')], { cwd: root, encoding: 'utf8' });
	}
	it('runs without a previous hook and installs idempotently', async () => {
		await installSecretHook(root);
		const first = fs.readFileSync(path.join(hooks, 'pre-commit'), 'utf8');
		await installSecretHook(root);
		assert.strictEqual(fs.readFileSync(path.join(hooks, 'pre-commit'), 'utf8'), first);
		assert.strictEqual(run().status, 0);
	});
	it('an early exit 0 in the previous hook cannot bypass the guard', async () => {
		const previous = '#!/bin/sh\nprintf previous > previous-ran\nexit 0\n';
		fs.writeFileSync(path.join(hooks, 'pre-commit'), previous);
		fs.writeFileSync(path.join(root, 'staged.txt'), 'gh' + 'p_' + 'x'.repeat(24));
		execFileSync('git', ['add', 'staged.txt'], { cwd: root });
		await installSecretHook(root);
		const result = run();
		assert.strictEqual(result.status, 1, result.stderr);
		assert.ok(fs.existsSync(path.join(root, 'previous-ran')));
	});
	it('preserves the previous failure code and does not run the guard after failure', async () => {
		fs.writeFileSync(path.join(hooks, 'pre-commit'), '#!/bin/sh\nexit 23\n');
		await installSecretHook(root);
		fs.writeFileSync(path.join(hooks, 'alfred-secret-guard.js'), 'require("fs").writeFileSync("guard-ran", "yes");');
		assert.strictEqual(run().status, 23);
		assert.ok(!fs.existsSync(path.join(root, 'guard-ran')));
	});
	it('preserves a failing last command without an explicit exit', async () => {
		fs.writeFileSync(path.join(hooks, 'pre-commit'), '#!/bin/sh\nfalse\n');
		await installSecretHook(root);
		assert.strictEqual(run().status, 1);
	});
	it('preserves hook bytes, arguments, working directory and guard failure', async () => {
		const previous = '#!/bin/sh\nprintf "%s" "$1" > previous-arg\nexit 0\n';
		fs.writeFileSync(path.join(hooks, 'pre-commit'), previous);
		await installSecretHook(root);
		assert.strictEqual(fs.readFileSync(path.join(hooks, 'pre-commit.alfred-previous'), 'utf8'), previous);
		await installSecretHook(root);
		assert.strictEqual(fs.readFileSync(path.join(hooks, 'pre-commit.alfred-previous'), 'utf8'), previous);
		fs.writeFileSync(path.join(hooks, 'alfred-secret-guard.js'), 'process.exit(17);');
		const result = spawnSync(shell, [path.join(hooks, 'pre-commit'), 'argument'], { cwd: root, encoding: 'utf8' });
		assert.strictEqual(result.status, 17, result.stderr);
		assert.strictEqual(fs.readFileSync(path.join(root, 'previous-arg'), 'utf8'), 'argument');
	});
	it('refuses an occupied preservation path without overwriting either hook', async () => {
		const previous = '#!/bin/sh\nexit 23\n';
		fs.writeFileSync(path.join(hooks, 'pre-commit'), previous);
		fs.writeFileSync(path.join(hooks, 'pre-commit.alfred-previous'), 'unrelated');
		await assert.rejects(installSecretHook(root), /EEXIST/);
		assert.strictEqual(fs.readFileSync(path.join(hooks, 'pre-commit'), 'utf8'), previous);
		assert.strictEqual(fs.readFileSync(path.join(hooks, 'pre-commit.alfred-previous'), 'utf8'), 'unrelated');
	});
	it('refuses an unrelated guard script without overwriting it or the previous hook', async () => {
		const previous = '#!/bin/sh\nexit 0\n';
		fs.writeFileSync(path.join(hooks, 'pre-commit'), previous);
		fs.writeFileSync(path.join(hooks, 'alfred-secret-guard.js'), 'unrelated script');
		await assert.rejects(installSecretHook(root), /integración explícita/);
		assert.strictEqual(fs.readFileSync(path.join(hooks, 'pre-commit'), 'utf8'), previous);
		assert.strictEqual(fs.readFileSync(path.join(hooks, 'alfred-secret-guard.js'), 'utf8'), 'unrelated script');
		assert.ok(!fs.existsSync(path.join(hooks, 'pre-commit.alfred-previous')));
	});
	it('refuses special hook paths before creating any guard files', async () => {
		fs.mkdirSync(path.join(hooks, 'pre-commit'));
		await assert.rejects(installSecretHook(root), /integración explícita/);
		assert.ok(fs.statSync(path.join(hooks, 'pre-commit')).isDirectory());
		assert.ok(!fs.existsSync(path.join(hooks, 'alfred-secret-guard.js')));
	});
	it('uses the configured hooks directory in the disposable fixture only', async () => {
		execFileSync('git', ['config', '--local', 'core.hooksPath', 'custom-hooks'], { cwd: root });
		assertEffectiveHooks(path.join(root, 'custom-hooks'));
		await installSecretHook(root);
		assert.ok(fs.existsSync(path.join(root, 'custom-hooks', 'pre-commit')));
		assert.ok(!fs.existsSync(path.join(hooks, 'pre-commit')));
	});
	it('isolates an inherited absolute global hooksPath before installation', async () => {
		const globalHook = path.join(root, 'global-hooks', 'pre-commit');
		const original = fs.readFileSync(globalHook);
		await installSecretHook(root);
		assertEffectiveHooks(hooks);
		assert.deepStrictEqual(fs.readFileSync(globalHook), original);
		assert.deepStrictEqual(fs.readdirSync(path.dirname(globalHook)), ['pre-commit']);
	});
	it('refuses a Husky-style basename dispatcher without changing any paths on retry', async () => {
		const previous = '#!/bin/sh\nname=$(basename "$0")\nscript="$(dirname "$0")/../$name"\n[ -f "$script" ] || exit 0\nsh "$script" "$@"\n';
		fs.writeFileSync(path.join(hooks, 'pre-commit'), previous);
		fs.writeFileSync(path.join(root, '.git', 'pre-commit'), '#!/bin/sh\nexit 29\n');
		assert.strictEqual(run().status, 29);
		const reproduction = path.join(root, '.git', 'dispatcher-reproduction');
		fs.mkdirSync(reproduction);
		for (const name of ['pre-commit', 'pre-commit.alfred-previous']) {
			fs.writeFileSync(path.join(reproduction, name), previous);
			const result = spawnSync(shell, [path.join(reproduction, name)], { cwd: root, encoding: 'utf8' });
			assert.strictEqual(result.status, name === 'pre-commit' ? 29 : 0, result.stderr);
		}
		const before = fs.readdirSync(hooks);
		for (let attempt = 0; attempt < 2; attempt++) {
			await assert.rejects(installSecretHook(root), /integración manual.*\$0/);
			assert.strictEqual(fs.readFileSync(path.join(hooks, 'pre-commit'), 'utf8'), previous);
			assert.deepStrictEqual(fs.readdirSync(hooks), before);
			assert.strictEqual(run().status, 29);
		}
	});
	for (const identity of ['$(dirname "$0")', '${0%/*}', '${0##*/}', '$BASH_SOURCE']) {
		it(`refuses identity-dependent shell hook ${identity} before writing`, async () => {
			const previous = `#!/bin/sh\nprintf '%s' "${identity}"\n`;
			fs.writeFileSync(path.join(hooks, 'pre-commit'), previous);
			await assert.rejects(installSecretHook(root), /integración manual/);
			assert.strictEqual(fs.readFileSync(path.join(hooks, 'pre-commit'), 'utf8'), previous);
			assert.deepStrictEqual(fs.readdirSync(hooks), ['pre-commit']);
		});
	}
	it('refuses unsupported hook interpreters rather than assuming identity is preserved', async () => {
		const previous = '#!/usr/bin/env node\nprocess.exit(0);\n';
		fs.writeFileSync(path.join(hooks, 'pre-commit'), previous);
		await assert.rejects(installSecretHook(root), /integración manual/);
		assert.strictEqual(fs.readFileSync(path.join(hooks, 'pre-commit'), 'utf8'), previous);
		assert.deepStrictEqual(fs.readdirSync(hooks), ['pre-commit']);
	});
	it('revalidates a preserved dispatcher on reinstall without altering existing files', async () => {
		const previous = '#!/bin/sh\nbasename "$0"\n';
		fs.writeFileSync(path.join(hooks, 'pre-commit'), buildSecretHook(true));
		fs.writeFileSync(path.join(hooks, 'pre-commit.alfred-previous'), previous);
		fs.writeFileSync(path.join(hooks, 'alfred-secret-guard.js'), SECRET_HOOK_SCRIPT);
		const before = fs.readdirSync(hooks).map(file => [file, fs.readFileSync(path.join(hooks, file), 'utf8')]);
		await assert.rejects(installSecretHook(root), /integración manual.*\$0/);
		assert.deepStrictEqual(fs.readdirSync(hooks).map(file => [file, fs.readFileSync(path.join(hooks, file), 'utf8')]), before);
	});
	it('refuses unrecognized legacy marker instead of claiming installation', async () => {
		const previous = '#!/bin/sh\nexit 0\n# alfred-ralph-secret-guard\n';
		fs.writeFileSync(path.join(hooks, 'pre-commit'), previous);
		await assert.rejects(installSecretHook(root), /integración explícita/);
		assert.strictEqual(fs.readFileSync(path.join(hooks, 'pre-commit'), 'utf8'), previous);
	});
});
