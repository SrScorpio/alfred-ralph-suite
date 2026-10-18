/** Instala el Secret Guard como hook pre-commit. No intercepta lo que se escribe en el editor. */
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
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

/** Instala el hook en un repositorio git no desnudo. */
export async function installSecretHook(workspaceRoot: string): Promise<void> {
	const hooksPath = await resolveHooksPath(workspaceRoot);
	const scriptPath = path.join(hooksPath, 'alfred-secret-guard.js');
	const preCommitPath = path.join(hooksPath, 'pre-commit');
	await fs.mkdir(hooksPath, { recursive: true });
	await fs.writeFile(scriptPath, SECRET_HOOK_SCRIPT, { encoding: 'utf8', mode: 0o700 });
	const current = await fs.readFile(preCommitPath, 'utf8').catch(() => '#!/bin/sh\n');
	if (!current.includes(SECRET_HOOK_MARKER)) {
		const next = `${current.trimEnd()}\n${SECRET_HOOK_MARKER}\nnode "$(dirname "$0")/alfred-secret-guard.js"\n`;
		await fs.writeFile(preCommitPath, next, { mode: 0o700 });
	}
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
