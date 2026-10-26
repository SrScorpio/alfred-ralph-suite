import * as assert from 'assert';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { installUserCatalog, CATALOG_MARKER } from '../catalogInstaller';

// All profile paths are explicit fixture paths; the real user profile is never used.
describe('safe catalog installer', () => {
  let root: string;
  let extensionPath: string;
  let homeDir: string;
  let appDataDir: string;
  let markerPath: string;
  let restores: Array<() => void>;
  const relative = ['agents/alfred.agent.md', 'skills/process/SKILL.md', 'instructions/global.instructions.md', 'templates/feature.md'];
  const source = (name: string) => path.join(extensionPath, 'catalog', name);
  const target = (name: string) => {
    const [kind, ...parts] = name.split('/');
    const directory = kind === 'instructions' ? path.join(appDataDir, 'Code', 'User', 'instructions')
      : kind === 'templates' ? path.join(homeDir, '.copilot', 'alfred-dev', 'templates')
      : path.join(homeDir, '.copilot', kind);
    return path.join(directory, ...parts);
  };
  async function put(file: string, text: string) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, text);
  }
  const run = (version = '1.12.6', force = false) => installUserCatalog({ extensionPath, homeDir, appDataDir, platform: 'win32', version, force });
  const marker = async () => JSON.parse(await fs.readFile(markerPath, 'utf8'));
  function stub(key: string, value: any) {
    const api = fs as any;
    const previous = api[key];
    api[key] = value;
    restores.push(() => { api[key] = previous; });
  }
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'alfred-catalog-test-'));
    extensionPath = path.join(root, 'extension');
    homeDir = path.join(root, 'home');
    appDataDir = path.join(root, 'appdata');
    markerPath = path.join(homeDir, '.copilot', 'agents', CATALOG_MARKER);
    restores = [];
    for (const name of relative) { await put(source(name), `bundled:${name}`); }
  });
  afterEach(async () => {
    restores.reverse().forEach(restore => restore());
    await fs.rm(root, { recursive: true, force: true });
  });

  it('installs every resource and records owner, catalog and successful resource hashes', async () => {
    const result = await run();
    assert.strictEqual(result.changed, true);
    assert.deepStrictEqual([result.agents, result.skills, result.instructions, result.templates], [1, 1, 1, 1]);
    const state = await marker();
    assert.strictEqual(state.owner, 'alfred-ralph-suite');
    assert.match(state.catalogHash, /^[a-f0-9]{64}$/);
    for (const name of relative) {
      assert.strictEqual(await fs.readFile(target(name), 'utf8'), `bundled:${name}`);
      assert.match(state.resources[name].hash, /^[a-f0-9]{64}$/);
    }
  });

  it('is byte-idempotent including the marker and force', async () => {
    await run();
    const before = await Promise.all([...relative.map(target), markerPath].map(file => fs.stat(file)));
    stub('writeFile', async () => { throw new Error('Unexpected write'); });
    const result = await run('1.12.6', true);
    assert.strictEqual(result.changed, false);
    assert.deepStrictEqual((result as any).warnings, []);
    const after = await Promise.all([...relative.map(target), markerPath].map(file => fs.stat(file)));
    assert.deepStrictEqual(after.map(stat => stat.mtimeMs), before.map(stat => stat.mtimeMs));
  });

  function failResourceWrite() {
    const original = fs.open;
    let failed = false;
    stub('open', async (file: any, ...args: any[]) => {
      const handle = await (original as any)(file, ...args);
      const name = String(file);
      if (!failed && (name === target(relative[0]) ||
        (path.dirname(name) === path.dirname(target(relative[0])) && path.basename(name).startsWith('.alfred-catalog-')))) {
        const write = handle.write.bind(handle);
        let partial = false;
        handle.write = async (bytes: Buffer, offset: number, length: number, position: number) => {
          if (partial) { failed = true; throw Object.assign(new Error('private disk detail'), { code: 'ENOSPC' }); }
          partial = true;
          return write(bytes, offset, Math.min(3, length), position);
        };
      }
      return handle;
    });
  }

  for (const existing of [false, true]) {
    it(`preserves ${existing ? 'managed bytes and fingerprints' : 'missing destination'} on mid-write ENOSPC and retries safely`, async () => {
      if (existing) await run();
      const previous = existing ? (await marker()).resources[relative[0]] : undefined;
      await put(source(relative[0]), 'replacement agent with enough bytes');
      failResourceWrite();
      const result = await run('1.12.7');
      assert.ok(result.warnings.some(warning => warning.includes('ENOSPC')));
      if (existing) assert.strictEqual(await fs.readFile(target(relative[0]), 'utf8'), `bundled:${relative[0]}`);
      else await assert.rejects(fs.stat(target(relative[0])), { code: 'ENOENT' });
      assert.deepStrictEqual((await marker()).resources[relative[0]], previous);
      await assert.rejects(fs.stat(path.join(path.dirname(markerPath), '.alfred-dev-catalog.lock')), { code: 'ENOENT' });
      assert.ok(!(await fs.readdir(path.dirname(markerPath))).some(name => name.endsWith('.pending')));
      restores.pop()!();
      const retry = await run('1.12.7');
      assert.deepStrictEqual(retry.conflicts, []);
      assert.strictEqual(await fs.readFile(target(relative[0]), 'utf8'), 'replacement agent with enough bytes');
    });
  }

  it('acquires the profile lock before reading the marker and returns busy without a stale snapshot', async () => {
    await run();
    await put(source(relative[0]), 'new pack');
    const read = fs.open;
    let entered!: () => void;
    let release!: () => void;
    const paused = new Promise<void>(resolve => { entered = resolve; });
    const resume = new Promise<void>(resolve => { release = resolve; });
    let markerReads = 0;
    stub('open', async (file: any, ...args: any[]) => {
      if (String(file) === markerPath) {
        markerReads++;
        if (markerReads === 1) { entered(); await resume; }
      }
      return (read as any)(file, ...args);
    });
    const newer = run('2.0.0');
    await paused;
    let older: Awaited<ReturnType<typeof run>>;
    try {
      older = await run('1.12.6');
      assert.strictEqual((older as any).busy, true);
      assert.strictEqual(older.changed, false);
      assert.ok(older.warnings.some(warning => warning.includes('CATALOG_BUSY') && warning.includes('manual')));
      assert.strictEqual(markerReads, 1);
      const child = execFileSync(process.execPath, ['-r', 'ts-node/register', '-e',
        `require(${JSON.stringify(require.resolve('../catalogInstaller'))}).installUserCatalog(${JSON.stringify({
          extensionPath, homeDir, appDataDir, platform: 'win32', version: '1.12.6',
        })}).then(result => process.stdout.write(JSON.stringify(result)))`], { encoding: 'utf8' });
      assert.strictEqual(JSON.parse(child).busy, true);
    } finally { release(); await newer; }
    await put(source(relative[0]), 'old pack');
    await run('1.12.6');
    assert.strictEqual(await fs.readFile(target(relative[0]), 'utf8'), 'new pack');
    assert.strictEqual((await marker()).version, '2.0.0');
  });

  it('preserves a foreign or crash-stale lock and performs no marker or catalog reads', async () => {
    const lock = path.join(path.dirname(markerPath), '.alfred-dev-catalog.lock');
    await put(lock, 'foreign lock');
    const open = fs.open;
    stub('open', async (file: any, ...args: any[]) => {
      assert.strictEqual(String(file), lock);
      return (open as any)(file, ...args);
    });
    const result = await run();
    assert.strictEqual((result as any).busy, true);
    assert.strictEqual(await fs.readFile(lock, 'utf8'), 'foreign lock');
    assert.deepStrictEqual(await fs.readdir(path.dirname(lock)), ['.alfred-dev-catalog.lock']);
  });

  it('releases its own lock after marker read errors', async () => {
    await put(markerPath, 'invalid json');
    const result = await run();
    assert.ok(result.warnings.length);
    await assert.rejects(fs.stat(path.join(path.dirname(markerPath), '.alfred-dev-catalog.lock')), { code: 'ENOENT' });
    await put(markerPath, JSON.stringify({ version: '1.12.6' }));
    assert.strictEqual((await run() as any).busy, undefined);
    assert.ok((await marker()).resources[relative[0]]);
  });

  function onResourceSync(action: () => Promise<void>) {
    const open = fs.open;
    let intercepted = false;
    stub('open', async (file: any, ...args: any[]) => {
      const handle = await (open as any)(file, ...args);
      const name = String(file);
      if (!intercepted && path.dirname(name) === path.dirname(markerPath) && path.basename(name).startsWith('.alfred-catalog-')) {
        intercepted = true;
        const sync = handle.sync.bind(handle);
        handle.sync = async () => { await sync(); await action(); };
      }
      return handle;
    });
  }

  for (const existing of [false, true]) {
    it(`revalidates ${existing ? 'managed' : 'missing'} destination after staging and preserves a concurrent user edit`, async () => {
      if (existing) await run();
      const previous = existing ? (await marker()).resources[relative[0]] : undefined;
      await put(source(relative[0]), 'replacement agent');
      onResourceSync(async () => { await put(target(relative[0]), 'user edit during staging'); });
      const result = await run('1.12.7');
      assert.ok(result.conflicts.includes(target(relative[0])));
      assert.strictEqual(await fs.readFile(target(relative[0]), 'utf8'), 'user edit during staging');
      assert.deepStrictEqual((await marker()).resources[relative[0]], previous);
      assert.ok(!(await fs.readdir(path.dirname(markerPath))).some(name => name.endsWith('.pending')));
    });
  }

  it('rejects an ancestor changed to a junction after staging without touching external bytes', async () => {
    await run();
    await put(source(relative[1]), 'replacement skill');
    const directory = path.dirname(target(relative[1]));
    const moved = path.join(root, 'original-skill');
    const external = path.join(root, 'external-skill');
    await fs.mkdir(external);
    await put(path.join(external, 'SKILL.md'), 'external private bytes');
    const open = fs.open;
    let swapped = false;
    stub('open', async (file: any, ...args: any[]) => {
      const handle = await (open as any)(file, ...args);
      if (!swapped && path.dirname(String(file)) === directory && path.basename(String(file)).startsWith('.alfred-catalog-')) {
        const close = handle.close.bind(handle);
        handle.close = async () => {
          await close();
          swapped = true;
          await fs.rename(directory, moved);
          await fs.symlink(external, directory, process.platform === 'win32' ? 'junction' : 'dir');
        };
      }
      return handle;
    });
    const result = await run('1.12.7');
    assert.ok(result.warnings.some(warning => warning.includes('UNSAFE_PATH')));
    assert.strictEqual(await fs.readFile(path.join(external, 'SKILL.md'), 'utf8'), 'external private bytes');
    assert.deepStrictEqual(await fs.readdir(external), ['SKILL.md']);
    assert.strictEqual(await fs.readFile(path.join(moved, 'SKILL.md'), 'utf8'), `bundled:${relative[1]}`);
  });

  for (const failure of ['sync', 'rename']) {
    it(`preserves originals and cleans its staging file and lock when resource ${failure} fails`, async () => {
      await run();
      const previous = await fs.readFile(markerPath, 'utf8');
      await put(source(relative[0]), 'replacement agent');
      if (failure === 'sync') {
        onResourceSync(async () => { throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }); });
      } else {
        const rename = fs.rename;
        stub('rename', async (file: any, destination: any) => {
          if (String(destination) === target(relative[0])) throw Object.assign(new Error('replacement unsupported'), { code: 'EACCES' });
          return rename(file, destination);
        });
      }
      const result = await run('1.12.7');
      assert.ok(result.warnings.some(warning => warning.includes(failure === 'sync' ? 'ENOSPC' : 'EACCES')));
      assert.strictEqual(result.changed, false);
      assert.strictEqual(await fs.readFile(target(relative[0]), 'utf8'), `bundled:${relative[0]}`);
      assert.strictEqual(await fs.readFile(markerPath, 'utf8'), previous);
      assert.deepStrictEqual((await fs.readdir(path.dirname(markerPath))).sort(), [CATALOG_MARKER, 'alfred.agent.md'].sort());
    });
  }

  it('detects changed catalog bytes in the same version', async () => {
    await run();
    const previous = await marker();
    await put(source(relative[0]), 'updated same version');
    const result = await run();
    assert.strictEqual(result.changed, true);
    assert.strictEqual(await fs.readFile(target(relative[0]), 'utf8'), 'updated same version');
    assert.notStrictEqual((await marker()).catalogHash, previous.catalogHash);
  });

  for (const name of relative) {
    it(`repairs missing ${name} even with Alfred present`, async () => {
      await run();
      await fs.unlink(target(name));
      const result = await run();
      assert.strictEqual(result.changed, true);
      assert.strictEqual(await fs.readFile(target(name), 'utf8'), `bundled:${name}`);
    });
    it(`preserves customized ${name} even with force and does not adopt its hash`, async () => {
      await run();
      const previous = (await marker()).resources[name];
      await put(target(name), 'private customization');
      await put(source(name), 'new bundled text');
      const result: any = await run('1.12.7', true);
      assert.ok(result.conflicts.includes(target(name)));
      assert.strictEqual(await fs.readFile(target(name), 'utf8'), 'private customization');
      assert.deepStrictEqual((await marker()).resources[name], previous);
      assert.ok(!JSON.stringify(result).includes('private customization'));
    });
  }

  it('migrates a legacy marker only for exact byte matches and preserves divergent files', async () => {
    await put(markerPath, JSON.stringify({ version: '1.12.6' }));
    await put(target(relative[0]), 'legacy customization');
    await put(target(relative[1]), `bundled:${relative[1]}`);
    const result: any = await run();
    assert.ok(result.conflicts.includes(target(relative[0])));
    const state = await marker();
    assert.strictEqual(state.resources[relative[0]], undefined);
    assert.match(state.resources[relative[1]].hash, /^[a-f0-9]{64}$/);
  });

  it('adopts an exact legacy match without rewriting its bytes', async () => {
    await put(markerPath, JSON.stringify({ version: '1.12.6' }));
    for (const name of relative) { await put(target(name), `bundled:${name}`); }
    const before = await fs.stat(target(relative[0]));
    const result = await run();
    assert.strictEqual(result.changed, false);
    assert.strictEqual((await fs.stat(target(relative[0]))).mtimeMs, before.mtimeMs);
    assert.ok((await marker()).resources[relative[0]]);
  });

  it('never downgrades managed content or the marker, even with force', async () => {
    await run('2.0.0');
    const previous = await fs.readFile(markerPath, 'utf8');
    await put(source(relative[0]), 'old pack');
    const result: any = await run('1.12.6', true);
    assert.strictEqual(await fs.readFile(target(relative[0]), 'utf8'), `bundled:${relative[0]}`);
    assert.ok(result.warnings.length > 0);
    assert.strictEqual(await fs.readFile(markerPath, 'utf8'), previous);
  });

  it('never restores a deleted managed resource with older bytes', async () => {
    await run('2.0.0');
    const previous = await fs.readFile(markerPath, 'utf8');
    await fs.unlink(target(relative[0]));
    await put(source(relative[0]), 'old pack');
    const result: any = await run('1.12.6', true);
    await assert.rejects(fs.readFile(target(relative[0]), 'utf8'));
    assert.ok(result.warnings.some((warning: string) => warning.includes('DOWNGRADE_OR_UNKNOWN_VERSION')));
    assert.strictEqual(result.agents, 0);
    assert.strictEqual(await fs.readFile(markerPath, 'utf8'), previous);
  });
  it('preserves extras and removed catalog members without invoking deletion APIs', async () => {
    await run();
    await put(target('skills/process/custom.txt'), 'extra');
    await fs.unlink(source(relative[0]));
    for (const name of ['rm', 'unlink', 'rmdir']) {
      const original = (fs as any)[name];
      stub(name, async (file: any, ...args: any[]) => {
        if (name === 'unlink' && String(file) === path.join(path.dirname(markerPath), '.alfred-dev-catalog.lock')) {
          return original(file, ...args);
        }
        throw new Error('Deletion forbidden');
      });
    }
    await run('1.12.7');
    assert.strictEqual(await fs.readFile(target('skills/process/custom.txt'), 'utf8'), 'extra');
    assert.strictEqual(await fs.readFile(target(relative[0]), 'utf8'), `bundled:${relative[0]}`);
  });

  it('reports partial failures without recording failed resources as successfully installed', async () => {
    const original = fs.open;
    stub('open', async (file: any, ...args: any[]) => {
      if (String(file) === target(relative[0])) { throw Object.assign(new Error('sensitive detail'), { code: 'EACCES' }); }
      return (original as any)(file, ...args);
    });
    const copy = fs.copyFile;
    stub('copyFile', async (file: any, dest: any, ...args: any[]) => {
      if (String(dest) === target(relative[0])) { throw Object.assign(new Error('sensitive detail'), { code: 'EACCES' }); }
      return (copy as any)(file, dest, ...args);
    });
    const result: any = await run();
    assert.ok(result.warnings.length > 0);
    assert.ok(!JSON.stringify(result).includes('sensitive detail'));
    const state = await marker();
    assert.strictEqual(state.resources[relative[0]], undefined);
    assert.ok(state.resources[relative[1]]);
    assert.ok(!state.catalogHash);
  });

  it('rejects symlinked source files, destination files and ancestor directories', async () => {
    await run();
    const original = fs.lstat;
    const blocked = [source(relative[0]), target(relative[1]), path.dirname(target(relative[2]))];
    stub('lstat', async (file: any, ...args: any[]) => {
      const stat = await (original as any)(file, ...args);
      if (blocked.includes(String(file))) { stat.isSymbolicLink = () => true; }
      return stat;
    });
    await put(source(relative[1]), 'changed skill');
    await put(source(relative[2]), 'changed instruction');
    const result: any = await run('1.12.7');
    assert.ok(result.warnings.length >= 3);
    assert.strictEqual(await fs.readFile(target(relative[1]), 'utf8'), `bundled:${relative[1]}`);
    assert.strictEqual(await fs.readFile(target(relative[2]), 'utf8'), `bundled:${relative[2]}`);
  });

  it('rejects a real junction in bundled skills without following it', async () => {
    const linked = path.join(root, 'linked-skill');
    await fs.rename(source('skills/process'), linked);
    await fs.symlink(linked, source('skills/process'), process.platform === 'win32' ? 'junction' : 'dir');
    const result: any = await run();
    assert.ok(result.warnings.some((warning: string) => warning.includes('UNSAFE_PATH')));
    assert.strictEqual((await marker()).resources[relative[1]], undefined);
    assert.strictEqual(await fs.readFile(path.join(linked, 'SKILL.md'), 'utf8'), `bundled:${relative[1]}`);
  });

  it('rejects a real junction in profile ancestors before any installation', async () => {
    const external = path.join(root, 'linked-profile');
    await fs.mkdir(external);
    await fs.mkdir(homeDir, { recursive: true });
    await fs.symlink(external, path.join(homeDir, '.copilot'), process.platform === 'win32' ? 'junction' : 'dir');
    const result: any = await run();
    assert.strictEqual(result.changed, false);
    assert.ok(result.warnings.some((warning: string) => warning.includes('UNSAFE_PATH')));
    assert.deepStrictEqual(await fs.readdir(external), []);
  });

  it('preserves hard-linked destination bytes without modifying the other link', async () => {
    await run();
    const link = path.join(root, 'linked-agent.md');
    await fs.link(target(relative[0]), link);
    await put(source(relative[0]), 'new agent');
    const result: any = await run('1.12.7');
    assert.ok(result.warnings.some((warning: string) => warning.includes('UNSAFE_PATH')));
    assert.strictEqual(await fs.readFile(link, 'utf8'), `bundled:${relative[0]}`);
  });

  it('keeps incomparably versioned managed content instead of assuming an upgrade', async () => {
    await run('2.0.0-preview');
    await put(source(relative[0]), 'unknown upgrade');
    const result: any = await run('3.0.0');
    assert.ok(result.warnings.some((warning: string) => warning.includes('DOWNGRADE_OR_UNKNOWN_VERSION')));
    assert.strictEqual(await fs.readFile(target(relative[0]), 'utf8'), `bundled:${relative[0]}`);
  });

  it('reports conflicts and warnings in Output even when no files changed', async () => {
    const vscode = require('vscode');
    const activation = require('../activate');
    const installer = require('../catalogInstaller');
    const lines: string[] = [];
    const saved = [activation._doActivate, installer.installUserCatalog, vscode.window.createOutputChannel,
      vscode.window.showWarningMessage, vscode.window.showInformationMessage];
    try {
      activation._doActivate = () => undefined;
      installer.installUserCatalog = async () => ({ agents: 0, skills: 0, instructions: 0, templates: 0,
        changed: false, conflicts: [target(relative[0])], warnings: [`${target(relative[1])}: EACCES`] });
      vscode.window.createOutputChannel = () => ({ appendLine: (line: string) => lines.push(line), show: () => undefined });
      vscode.window.showWarningMessage = async () => undefined;
      vscode.window.showInformationMessage = async () => { throw new Error('No changes to announce'); };
      require('../extension').activate({ extensionPath, subscriptions: [] });
      await new Promise(resolve => setImmediate(resolve));
      assert.ok(lines.some(line => line.includes(target(relative[0]))));
      assert.ok(lines.some(line => line.includes('EACCES')));
    } finally {
      [activation._doActivate, installer.installUserCatalog, vscode.window.createOutputChannel,
        vscode.window.showWarningMessage, vscode.window.showInformationMessage] = saved;
    }
  });

  it('reports marker commit failure without deleting or claiming complete catalog metadata', async () => {
    await run();
    const previous = await fs.readFile(markerPath, 'utf8');
    await put(source(relative[0]), 'updated agent');
    const rename = fs.rename;
    stub('rename', async (file: any, destination: any) => {
      if (String(destination) === markerPath) throw Object.assign(new Error('private failure'), { code: 'EACCES' });
      return rename(file, destination);
    });
    const result: any = await run('1.12.7');
    assert.ok(result.warnings.some((warning: string) => warning.includes(markerPath)));
    assert.strictEqual(await fs.readFile(markerPath, 'utf8'), previous);
    assert.ok(!JSON.stringify(result).includes('private failure'));
  });

  it('preserves last successful hashes after an update error and repairs safely on retry', async () => {
    await run();
    const previous = (await marker()).resources[relative[0]];
    await put(source(relative[0]), 'updated agent');
    const original = fs.open;
    stub('open', async (file: any, ...args: any[]) => {
      if (String(file) === target(relative[0])) throw Object.assign(new Error('private'), { code: 'EACCES' });
      return (original as any)(file, ...args);
    });
    const result: any = await run('1.12.7');
    assert.ok(result.warnings.length);
    assert.deepStrictEqual((await marker()).resources[relative[0]], previous);
    restores.pop()!();
    await run('1.12.7');
    assert.strictEqual(await fs.readFile(target(relative[0]), 'utf8'), 'updated agent');
  });

  it('rejects traversal names returned by a compromised catalog enumeration', async () => {
    const original = fs.readdir;
    stub('readdir', async (directory: any, ...args: any[]) => String(directory) === path.join(extensionPath, 'catalog', 'agents')
      ? [{ name: '..\\escape.agent.md', isSymbolicLink: () => false, isFile: () => true, isDirectory: () => false }]
      : (original as any)(directory, ...args));
    const result: any = await run();
    assert.ok(result.warnings.some((warning: string) => warning.includes('UNSAFE_PATH')));
    assert.strictEqual((await marker()).resources['agents/../escape.agent.md'], undefined);
  });

  it('does not trust hashes from an unknown owner', async () => {
    await run();
    const state = await marker();
    state.owner = 'another-product';
    await put(markerPath, JSON.stringify(state));
    await put(source(relative[0]), 'changed pack');
    const result: any = await run();
    assert.ok(result.conflicts.includes(target(relative[0])));
    assert.strictEqual(await fs.readFile(target(relative[0]), 'utf8'), `bundled:${relative[0]}`);
  });
});
