/**
 * backup.test.ts — Tests del backup previo a escrituras y su integración con
 * RalphStateManager (issue #22).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { backupFile, backupsDir, MAX_BACKUPS_PER_FILE } from '../security/backup';
import { RalphStateManager } from '../stateManager';

function tempRoot(prefix: string): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function backupsOf(root: string, name: string): string[] {
	const base = backupsDir(root);
	if (!fs.existsSync(base)) { return []; }
	const found: string[] = [];
	for (const dir of fs.readdirSync(base)) {
		const candidate = path.join(base, dir, name);
		if (fs.existsSync(candidate)) { found.push(candidate); }
	}
	return found.sort();
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('backupFile (issue #22)', () => {
	it('copia el fichero con su contenido y devuelve la ruta del backup', () => {
		const root = tempRoot('ralph-backup-copy-');
		try {
			const src = path.join(root, 'task-X-status');
			fs.writeFileSync(src, 'completed', 'utf-8');
			const backup = backupFile(root, src);
			assert.ok(backup, 'debe devolver la ruta del backup');
			assert.ok(backup.startsWith(backupsDir(root)), 'el backup vive en .ralph/backups/');
			assert.strictEqual(fs.readFileSync(backup, 'utf-8'), 'completed');
			assert.strictEqual(fs.readFileSync(src, 'utf-8'), 'completed', 'el origen no se toca');
			assert.strictEqual(path.basename(backup), 'task-X-status', 'conserva el nombre del fichero');
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('devuelve null si el origen no existe', () => {
		const root = tempRoot('ralph-backup-missing-');
		try {
			assert.strictEqual(backupFile(root, path.join(root, 'no-hay.txt')), null);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('rechaza con null rutas fuera del workspace y no escribe nada', () => {
		const root = tempRoot('ralph-backup-inside-');
		const outside = tempRoot('ralph-backup-outside-');
		try {
			const foreign = path.join(outside, 'secreto.txt');
			fs.writeFileSync(foreign, 'x', 'utf-8');
			assert.strictEqual(backupFile(root, foreign), null);
			assert.ok(!fs.existsSync(backupsDir(root)), 'no crea nada fuera de la contención');
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
			fs.rmSync(outside, { recursive: true, force: true });
		}
	});

	it('retención: deja solo los 10 backups más recientes por fichero', async () => {
		const root = tempRoot('ralph-backup-retention-');
		try {
			const src = path.join(root, 'task-R-status');
			for (let i = 1; i <= 12; i++) {
				fs.writeFileSync(src, `v${i}`, 'utf-8');
				assert.ok(backupFile(root, src), `backup #${i}`);
				await sleep(4); // timestamps ISO distintos
			}
			const kept = backupsOf(root, 'task-R-status');
			assert.strictEqual(kept.length, MAX_BACKUPS_PER_FILE, 'exactamente 10 respaldos');
			assert.strictEqual(fs.readFileSync(kept[kept.length - 1], 'utf-8'), 'v12', 'el más reciente se conserva');
			assert.strictEqual(fs.readFileSync(kept[0], 'utf-8'), 'v3', 'los 2 más antiguos se purgaron');
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('la retención de un fichero no toca backups de otros ficheros', async () => {
		const root = tempRoot('ralph-backup-mixed-');
		try {
			const a = path.join(root, 'task-A-status');
			const b = path.join(root, 'task-B-status');
			fs.writeFileSync(a, 'a1', 'utf-8');
			fs.writeFileSync(b, 'b1', 'utf-8');
			assert.ok(backupFile(root, a));
			await sleep(4);
			assert.ok(backupFile(root, b));
			const keptB = backupsOf(root, 'task-B-status');
			assert.strictEqual(keptB.length, 1, 'el backup de B sigue ahí');
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});
});

describe('RalphStateManager: backup antes de sobrescribir (issue #22)', () => {
	it('setTodoOverride sobre un status existente distinto deja backup con el valor previo', () => {
		const root = tempRoot('ralph-sm-override-');
		try {
			RalphStateManager.setCompleted(root, 'ISSUE-9', 'resumen');
			const before = backupsOf(root, 'task-ISSUE-9-status').length;
			RalphStateManager.setTodoOverride(root, 'ISSUE-9');
			assert.strictEqual(RalphStateManager.getStatus(root, 'ISSUE-9'), 'todo');
			const kept = backupsOf(root, 'task-ISSUE-9-status');
			assert.strictEqual(kept.length, before + 1, 'backup nuevo');
			assert.strictEqual(fs.readFileSync(kept[kept.length - 1], 'utf-8'), 'completed', 'guarda el valor previo');
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('setTodoOverride idempotente (mismo valor) no genera backup extra', () => {
		const root = tempRoot('ralph-sm-idem-');
		try {
			RalphStateManager.setTodoOverride(root, 'ISSUE-1');
			const before = backupsOf(root, 'task-ISSUE-1-status').length;
			RalphStateManager.setTodoOverride(root, 'ISSUE-1');
			assert.strictEqual(backupsOf(root, 'task-ISSUE-1-status').length, before);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('setInProgress con status previo existente respalda el valor anterior', () => {
		const root = tempRoot('ralph-sm-progress-');
		try {
			RalphStateManager.setTodoOverride(root, 'ISSUE-2');
			RalphStateManager.setInProgress(root, 'ISSUE-2', 'Título');
			assert.strictEqual(RalphStateManager.getStatus(root, 'ISSUE-2'), 'inprogress');
			const kept = backupsOf(root, 'task-ISSUE-2-status');
			assert.strictEqual(kept.length, 1, 'un backup del valor previo');
			assert.strictEqual(fs.readFileSync(kept[0], 'utf-8'), 'todo');
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('setInProgress sin status previo no crea backups', () => {
		const root = tempRoot('ralph-sm-fresh-');
		try {
			RalphStateManager.setInProgress(root, 'ISSUE-3', 'Título');
			assert.strictEqual(backupsOf(root, 'task-ISSUE-3-status').length, 0);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('resetTask respalda el status antes de borrarlo', () => {
		const root = tempRoot('ralph-sm-reset-');
		try {
			RalphStateManager.setInProgress(root, 'ISSUE-4', 'Título');
			RalphStateManager.reset(root, 'ISSUE-4');
			assert.strictEqual(RalphStateManager.getStatus(root, 'ISSUE-4'), 'todo', 'el fichero desaparece');
			const kept = backupsOf(root, 'task-ISSUE-4-status');
			assert.strictEqual(kept.length, 1);
			assert.strictEqual(fs.readFileSync(kept[0], 'utf-8'), 'inprogress', 'queda restaurable');
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});
});
