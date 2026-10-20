/**
 * backup.ts — Backup previo a escrituras destructivas del runtime (issue #22)
 *
 * Copia un fichero a `.ralph/backups/<ISO-timestamp-millis>/<nombre>` antes
 * de que el runtime lo sobreescriba o lo borre, y devuelve la ruta de la
 * copia (forma de restaurarlo: copiar de vuelta el fichero respaldado).
 *
 * Contención estricta: solo se respaldan (y solo se borran en la retención)
 * rutas resueltas DENTRO del workspace root. Nada se escribe jamás fuera de
 * `.ralph/backups/` y la retención nunca es recursiva: se borra únicamente el
 * fichero respaldado concreto y, si queda vacío, su directorio de timestamp.
 *
 * Filosofía fail-open documentada: si el origen no existe, la ruta escapa del
 * workspace o la copia falla por IO, se devuelve `null` y el flujo del
 * llamador sigue adelante (el guard nunca rompe el runtime); la ausencia de
 * backup queda reflejada por el propio `null`.
 */

import * as fs from 'fs';
import * as path from 'path';

const BACKUPS_RELPATH = path.join('.ralph', 'backups');
/** Retención mínima: los 10 backups más recientes por fichero. */
export const MAX_BACKUPS_PER_FILE = 10;

/** Directorio raíz de backups dentro de un workspace. */
export function backupsDir(root: string): string {
	return path.join(path.resolve(root), BACKUPS_RELPATH);
}

/** `2026-10-20T17-26-24-927Z` — ISO con milisegundos, válido como nombre de directorio. */
function timestampName(date: Date): string {
	return date.toISOString().replace(/[:.]/g, '-');
}

/** true si `child` es `parent` o cae estrictamente debajo de él. */
function isInside(parent: string, child: string): boolean {
	const rel = path.relative(parent, child);
	return rel === '' || (rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function isFile(p: string): boolean {
	try { return fs.statSync(p).isFile(); } catch { return false; }
}

/**
 * Respalda `absPath` (dentro de `root`) antes de sobreescribirlo.
 * Devuelve la ruta absoluta del backup, o `null` si el origen no existe, cae
 * fuera del workspace o la copia falla. Nunca lanza ni borra el origen.
 */
export function backupFile(root: string, absPath: string): string | null {
	try {
		const rootAbs = path.resolve(root);
		const src = path.resolve(absPath);
		// Contención estricta: nada fuera del workspace.
		if (!isInside(rootAbs, src)) { return null; }
		if (!isFile(src)) { return null; }

		const base = backupsDir(rootAbs);
		const name = path.basename(src);
		// Directorio propio por backup; si colisiona el mismo milisegundo,
		// se sufija con -2, -3... para no pisar la copia anterior.
		let dir = path.join(base, timestampName(new Date()));
		for (let suffix = 2; fs.existsSync(path.join(dir, name)); suffix++) {
			dir = path.join(base, `${timestampName(new Date())}-${suffix}`);
		}
		fs.mkdirSync(dir, { recursive: true });
		const dest = path.join(dir, name);
		fs.copyFileSync(src, dest);
		pruneBackups(base, name);
		return dest;
	} catch {
		return null; // fail-open documentado
	}
}

/**
 * Retención: deja los `MAX_BACKUPS_PER_FILE` backups más recientes de `name`
 * y borra los más antiguos. Solo toca `<backups>/<ts>/<name>` y directorios
 * de timestamp vacíos; nunca sale de `.ralph/backups/` ni borra en cascada.
 */
function pruneBackups(backupsRoot: string, name: string): void {
	if (!fs.existsSync(backupsRoot)) { return; }
	const dirs = fs.readdirSync(backupsRoot, { withFileTypes: true })
		.filter(entry => entry.isDirectory())
		.map(entry => entry.name)
		.sort()      // los nombres derivan de ISO: orden léxico = cronológico
		.reverse();  // más recientes primero
	let kept = 0;
	for (const dirName of dirs) {
		const target = path.join(backupsRoot, dirName, name);
		if (!isInside(backupsRoot, target)) { continue; }          // defensivo
		if (!isFile(target)) { continue; }                          // no es de este fichero
		kept += 1;
		if (kept <= MAX_BACKUPS_PER_FILE) { continue; }
		fs.unlinkSync(target);
		try { fs.rmdirSync(path.join(backupsRoot, dirName)); } catch { /* quedan otros ficheros */ }
	}
}
