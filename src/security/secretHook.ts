/** Instala el Secret Guard como hook pre-commit. No intercepta lo que se escribe en el editor. */
import { execFile } from 'child_process';
import { constants, promises as fs } from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const SECRET_HOOK_MARKER = '# alfred-ralph-secret-guard';

export const SECRET_HOOK_SCRIPT = `const cp = require('node:child_process');
const files = cp.execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { encoding: 'utf8' }).split('\\0').filter(Boolean);
const patterns = [/gh[pousr]_[A-Za-z0-9]{20,}/, /sk-[A-Za-z0-9_-]{20,}/, /Authorization\\s*:\\s*Bearer\\s+\\S+/i, /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/, /(?:AKIA|ASIA)[0-9A-Z]{16}/, /(?:api[_-]?key|access[_-]?key|secret|token|password)\\s*[:=]\\s*["']?[A-Za-z0-9_./+=-]{12,}/i];
let findings = 0;
for (const file of files) {
  let text;
  try {
    text = cp.execFileSync('git', ['show', ':' + file], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  } catch {
    console.error('Alfred Ralph Secret Guard: no se pudo analizar un blob staged.');
    process.exit(2);
  }
  if (patterns.some((pattern) => pattern.test(text))) findings += 1;
}
if (findings > 0) { console.error('Alfred Ralph Secret Guard: posibles secretos en ' + findings + ' archivo(s) staged.'); process.exit(1); }
`;

export function buildSecretHook(hasPrevious: boolean): string {
	return [
		'#!/bin/sh',
		SECRET_HOOK_MARKER,
		'# composed-v1: previous hook runs in a separate process',
		'hook_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd) || exit $?',
		...(hasPrevious ? ['"$hook_dir/pre-commit.alfred-previous" "$@" || exit $?'] : []),
		'exec node "$hook_dir/alfred-secret-guard.js"',
		'',
	].join('\n');
}

async function readHookFile(filePath: string): Promise<string | null> {
	const stat = await fs.lstat(filePath).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') { return null; }
		throw error;
	});
	if (!stat) { return null; }
	if (!stat.isFile() || stat.isSymbolicLink()) {
		throw new Error('El hook requiere integración explícita: no se sustituyen enlaces ni archivos especiales.');
	}
	return fs.readFile(filePath, 'utf8');
}

function assertComposableHook(hook: string): void {
	// Renaming changes shell identity, even when dirname happens to stay the same.
	if (/\$(?:0|\{0\b|\{?BASH_SOURCE\b)/.test(hook)) {
		throw new Error('El hook requiere integración manual: no se puede preservar la identidad $0/BASH_SOURCE al renombrarlo (incluidos dispatchers Husky). No se ha instalado el Secret Guard.');
	}
	if (!/^#![ \t]*\/(?:usr\/bin|bin)\/(?:env[ \t]+)?(?:sh|bash|dash)[ \t]*(?:\r?\n|$)/.test(hook)) {
		throw new Error('El hook requiere integración manual: formato o intérprete no compatible con la composición conservadora. No se ha instalado el Secret Guard.');
	}
}

/** Conserva hooks shell compatibles en otro proceso; rechaza identidad no preservable. */
export async function installSecretHook(workspaceRoot: string): Promise<void> {
	const hooksPath = await resolveHooksPath(workspaceRoot);
	const scriptPath = path.join(hooksPath, 'alfred-secret-guard.js');
	const preCommitPath = path.join(hooksPath, 'pre-commit');
	const previousPath = path.join(hooksPath, 'pre-commit.alfred-previous');
	const current = await readHookFile(preCommitPath);
	const guard = await readHookFile(scriptPath);
	if (guard !== null && guard !== SECRET_HOOK_SCRIPT) {
		throw new Error('El script del guard existente requiere integración explícita: no se sobrescriben archivos ajenos.');
	}
	const composed = current === buildSecretHook(true) || current === buildSecretHook(false);
	if (current?.includes(SECRET_HOOK_MARKER) && !composed) {
		throw new Error('El hook existente requiere integración explícita manual: formato antiguo o no reconocido; no se puede garantizar la composición del Secret Guard. No se ha instalado el Secret Guard.');
	}
	if (composed && current === buildSecretHook(true)) {
		const previous = await readHookFile(previousPath);
		if (previous === null) {
			throw new Error('Falta el hook preservado; se requiere integración explícita.');
		}
		assertComposableHook(previous);
	} else if (current !== null && !composed) {
		assertComposableHook(current);
	}
	await fs.mkdir(hooksPath, { recursive: true });
	if (current !== null && !composed) {
		// Exclusive copy preserves original bytes and refuses an occupied backup.
		await fs.copyFile(preCommitPath, previousPath, constants.COPYFILE_EXCL);
		await fs.chmod(previousPath, 0o700);
	}
	await fs.writeFile(scriptPath, SECRET_HOOK_SCRIPT, { encoding: 'utf8', mode: 0o700 });
	if (!composed) {
		await fs.writeFile(preCommitPath, buildSecretHook(current !== null), { mode: 0o700 });
	}
	await fs.chmod(preCommitPath, 0o700);
}

async function resolveHooksPath(workspaceRoot: string): Promise<string> {
	try {
		const { stdout } = await execFileAsync('git', ['rev-parse', '--git-path', 'hooks'], {
			cwd: workspaceRoot,
			encoding: 'utf8',
		});
		const gitHooksPath = stdout.trim();
		if (!gitHooksPath) throw new Error('Git no devolvio una ruta de hooks');
		return path.resolve(workspaceRoot, gitHooksPath);
	} catch {
		throw new Error('No se encontro un repositorio Git compatible para instalar el hook');
	}
}
