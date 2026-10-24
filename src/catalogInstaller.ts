/** Conservative reconciliation of the catalog bundled in the VSIX. */
import { constants, promises as fs } from 'fs';
import { createHash, randomUUID } from 'crypto';
import * as os from 'os';
import * as path from 'path';

export const CATALOG_MARKER = '.alfred-dev-catalog.json';
const OWNER = 'alfred-ralph-suite';
type Kind = 'agents' | 'skills' | 'instructions' | 'templates';
interface ResourceState { hash: string; version: string }
interface Marker {
  owner?: string;
  version: string;
  catalogHash?: string;
  resources?: Record<string, ResourceState>;
}
interface Resource { key: string; target: string; kind: Kind; bytes: Buffer }
export interface CatalogInstallResult {
  agents: number;
  skills: number;
  instructions: number;
  templates: number;
  changed: boolean;
  conflicts: string[];
  warnings: string[];
  /** Another process owns the profile lock; no marker or catalog was read. */
  busy?: true;
}
export interface CatalogInstallOptions {
  extensionPath: string;
  version: string;
  homeDir?: string;
  appDataDir?: string;
  platform?: NodeJS.Platform;
  /** Rechecks all bytes; never allows overwriting customizations. */
  force?: boolean;
}

/** VS Code user instructions directory (stable Code). */
export function userInstructionsDir(platform: NodeJS.Platform, homeDir: string, appDataDir: string): string {
  if (platform === 'win32') return path.join(appDataDir, 'Code', 'User', 'instructions');
  if (platform === 'darwin') return path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'instructions');
  return path.join(homeDir, '.config', 'Code', 'User', 'instructions');
}
function hash(bytes: Buffer | string): string {
  const digest = createHash('sha256');
  digest.end(bytes);
  return digest.digest('hex');
}
const code = (error: unknown): string => {
  const value = (error as NodeJS.ErrnoException)?.code;
  return typeof value === 'string' && /^[A-Z0-9_]+$/.test(value) ? value : 'IO_ERROR';
};
function rejectUnsafe(): never { throw Object.assign(new Error('Unsafe catalog path'), { code: 'UNSAFE_PATH' }); }

// Check every ancestor, including dangling symlinks and Windows junctions.
async function checkPath(target: string): Promise<void> {
  let current = path.resolve(target);
  while (true) {
    try { if ((await fs.lstat(current)).isSymbolicLink()) rejectUnsafe(); }
    catch (error) { if (code(error) !== 'ENOENT') throw error; }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}
async function readBytes(file: string): Promise<Buffer> {
  await checkPath(file);
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    if (!(await handle.stat()).isFile()) rejectUnsafe();
    return await handle.readFile();
  } finally { await handle.close(); }
}

async function loadMarker(file: string): Promise<{ marker: Marker; raw?: string }> {
  try {
    const raw = (await readBytes(file)).toString('utf8');
    const value = JSON.parse(raw);
    if (!value || typeof value.version !== 'string') rejectUnsafe();
    return { marker: value, raw };
  } catch (error) {
    if (code(error) === 'ENOENT') return { marker: { version: '' } };
    throw error;
  }
}

// Unknown versions are deliberately incomparable, not an implicit upgrade.
function compareVersion(a: string, b: string): number | undefined {
  const pattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z.-]+)?$/;
  const left = pattern.exec(a), right = pattern.exec(b);
  if (!left || !right) return a === b ? 0 : undefined;
  for (let i = 1; i <= 3; i++) {
    const x = BigInt(left[i]), y = BigInt(right[i]);
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}
function mayUpdate(previous: string, next: string): boolean {
  const order = compareVersion(previous, next);
  return order !== undefined && order <= 0;
}
function managedResources(marker: Marker): Record<string, ResourceState> {
  const resources: Record<string, ResourceState> = Object.create(null);
  if (marker.owner !== OWNER || !marker.resources || typeof marker.resources !== 'object') return resources;
  for (const [key, value] of Object.entries(marker.resources)) {
    if (value && /^[a-f0-9]{64}$/.test(value.hash) && typeof value.version === 'string') resources[key] = value;
  }
  return resources;
}

async function collect(source: string, target: string, kind: Kind, prefix: string,
  resources: Resource[], warnings: string[]): Promise<void> {
  try {
    await checkPath(source);
    const entries = await fs.readdir(source, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.name || entry.name === '.' || entry.name === '..' || /[\\/:\x00-\x1f]/.test(entry.name)) rejectUnsafe();
      const file = path.join(source, entry.name), dest = path.join(target, entry.name);
      const key = `${prefix}/${entry.name}`;
      if (entry.isSymbolicLink()) { warnings.push(`${file}: UNSAFE_PATH`); continue; }
      if (entry.isDirectory() && kind === 'skills') {
        await collect(file, dest, kind, key, resources, warnings);
      } else if (entry.isFile() && (kind === 'skills' ||
        (kind === 'agents' ? /\.agent\.md$/ : kind === 'instructions' ? /\.instructions\.md$/ : /\.md$/).test(entry.name))) {
        try { resources.push({ key, target: dest, kind, bytes: await readBytes(file) }); }
        catch (error) { warnings.push(`${file}: ${code(error)}`); }
      }
    }
  } catch (error) { warnings.push(`${source}: ${code(error)}`); }
}

async function destinationSnapshot(target: string) {
  await checkPath(target);
  let handle;
  try { handle = await fs.open(target, constants.O_RDONLY | (constants.O_NOFOLLOW || 0)); }
  catch (error) { if (code(error) === 'ENOENT') return undefined; throw error; }
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink > 1) rejectUnsafe();
    return { hash: hash(await handle.readFile()), mode: stat.mode, dev: stat.dev, ino: stat.ino };
  } finally { await handle.close(); }
}

// Only our exclusively created staging file may be unlinked; never the destination.
async function publish(file: string, bytes: Buffer, validate: () => Promise<void>, mode?: number): Promise<void> {
  await checkPath(file);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await checkPath(file);
  const staged = path.join(path.dirname(file), `.alfred-catalog-${randomUUID()}.pending`);
  const handle = await fs.open(staged, 'wx', mode === undefined ? 0o600 : mode & 0o777);
  let published = false;
  try {
    try {
      let offset = 0;
      while (offset < bytes.length) {
        const written = await handle.write(bytes, offset, bytes.length - offset, offset);
        if (!written.bytesWritten) throw Object.assign(new Error('Incomplete write'), { code: 'SHORT_WRITE' });
        offset += written.bytesWritten;
      }
      await handle.sync();
    } finally { await handle.close(); }
    await validate();
    await checkPath(file);
    // No unlink/retry fallback: an unsupported replacement preserves the old file.
    await fs.rename(staged, file);
    published = true;
  } finally { if (!published) { await checkPath(staged); await fs.unlink(staged); } }
}

async function reconcile(resource: Resource, previous: ResourceState | undefined, version: string,
  markerVersion: string, result: CatalogInstallResult): Promise<ResourceState | undefined> {
  const { target, bytes } = resource;
  const before = await destinationSnapshot(target);
  const desired = hash(bytes);
  if (before) {
    if (before.hash === desired) return previous?.hash === desired ? previous : { hash: desired, version };
    if (!previous || before.hash !== previous.hash) { result.conflicts.push(target); return previous; }
    if (!mayUpdate(previous.version, version) || (markerVersion && !mayUpdate(markerVersion, version))) {
      result.warnings.push(`${target}: DOWNGRADE_OR_UNKNOWN_VERSION`);
      return previous;
    }
  }
  try {
    await publish(target, bytes, async () => {
      const current = await destinationSnapshot(target);
      if (current?.hash !== before?.hash || current?.dev !== before?.dev || current?.ino !== before?.ino) {
        throw Object.assign(new Error('Destination changed during staging'), { code: 'DESTINATION_CHANGED' });
      }
    }, before?.mode);
  } catch (error) {
    if (code(error) !== 'DESTINATION_CHANGED') throw error;
    result.conflicts.push(target);
    return previous;
  }
  result.changed = true;
  result[resource.kind]++;
  return { hash: desired, version };
}

async function saveMarker(file: string, marker: Marker, raw: string | undefined): Promise<void> {
  const text = JSON.stringify(marker);
  if (text === raw) return;
  await publish(file, Buffer.from(text), async () => { await checkPath(file); });
}

/** Always rereads bytes, including with force. Never removes extras or adopts conflicts. */
export async function installUserCatalog(options: CatalogInstallOptions): Promise<CatalogInstallResult> {
  const result: CatalogInstallResult = { agents: 0, skills: 0, instructions: 0, templates: 0,
    changed: false, conflicts: [], warnings: [] };
  const home = options.homeDir ?? os.homedir();
  const appData = options.appDataDir ?? process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');
  const targets: Record<Kind, string> = {
    agents: path.join(home, '.copilot', 'agents'), skills: path.join(home, '.copilot', 'skills'),
    instructions: userInstructionsDir(options.platform ?? process.platform, home, appData),
    templates: path.join(home, '.copilot', 'alfred-dev', 'templates'),
  };
  const markerPath = path.join(targets.agents, CATALOG_MARKER);
  const lockPath = path.join(targets.agents, '.alfred-dev-catalog.lock');
  let lock;
  try {
    await checkPath(lockPath);
    await fs.mkdir(targets.agents, { recursive: true });
    await checkPath(lockPath);
    lock = await fs.open(lockPath, 'wx', 0o600);
  } catch (error) {
    if (code(error) === 'EEXIST') {
      result.busy = true;
      result.warnings.push(`${lockPath}: CATALOG_BUSY; if stale after a crash, manual lock repair is required; never removed automatically`);
    } else { result.warnings.push(`${lockPath}: ${code(error)}`); }
    return result;
  }
  try {
    return await reconcileCatalog(options, targets, markerPath, result);
  } finally {
    try {
      let own;
      try { own = await lock.stat(); }
      finally {
        try { await lock.close(); }
        finally {
          if (own) {
            await checkPath(lockPath);
            const current = await fs.lstat(lockPath);
            if (current.dev !== own.dev || current.ino !== own.ino) rejectUnsafe();
            await fs.unlink(lockPath);
          }
        }
      }
    } catch (error) { result.warnings.push(`${lockPath}: LOCK_RELEASE_${code(error)}; manual repair required`); }
  }
}

async function reconcileCatalog(options: CatalogInstallOptions, targets: Record<Kind, string>,
  markerPath: string, result: CatalogInstallResult): Promise<CatalogInstallResult> {
  let loaded;
  try { loaded = await loadMarker(markerPath); }
  catch (error) { result.warnings.push(`${markerPath}: ${code(error)}`); return result; }
  const { marker, raw } = loaded;
  const resources = managedResources(marker);
  const bundled: Resource[] = [];
  for (const kind of Object.keys(targets) as Kind[]) {
    await collect(path.join(options.extensionPath, 'catalog', kind), targets[kind], kind, kind, bundled, result.warnings);
  }
  const updatedSkills = new Set<string>();
  for (const resource of bundled) {
    try {
      const before = resources[resource.key];
      const skillWrites = result.skills;
      const after = await reconcile(resource, before, options.version, marker.version, result);
      if (after) resources[resource.key] = after;
      if (resource.kind === 'skills' && result.skills > skillWrites) {
        updatedSkills.add(resource.key.split('/')[1]);
      }
    } catch (error) { result.warnings.push(`${resource.target}: ${code(error)}`); }
  }
  result.skills = updatedSkills.size;
  const complete = !result.conflicts.length && !result.warnings.length;
  const advance = !marker.version || mayUpdate(marker.version, options.version);
  const next: Marker = { owner: OWNER, version: complete && advance ? options.version : marker.version,
    catalogHash: complete && advance ? hash(JSON.stringify(bundled.map(r => [r.key, hash(r.bytes)]))) : marker.catalogHash,
    resources };
  if (marker.owner && marker.owner !== OWNER) {
    result.warnings.push(`${markerPath}: UNKNOWN_OWNER`);
    return result;
  }
  try { await saveMarker(markerPath, next, raw); }
  catch (error) { result.warnings.push(`${markerPath}: ${code(error)}`); }
  return result;
}
