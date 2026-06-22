import {
  cleanup,
  ensureNxProject,
  readFile,
  runNxCommandAsync,
  tmpProjPath,
  updateFile,
} from '@nx/plugin/testing';
import {
  chmodSync,
  cpSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('nx-graphify', () => {
  let fakeGraphifyBinDir: string;
  let graphifyLogFile: string;
  let originalPath: string | undefined;

  beforeAll(() => {
    ensureNxProject('@fennet82/nx-graphify', 'packages/nx-graphify');

    // `ensureNxProject` links the plugin into node_modules as a symlink back
    // to this repo's `packages/nx-graphify`. Nx detects that the resolved
    // generator/executor file lives outside any `node_modules` real path and
    // treats it as a local-in-development TS plugin, trying to run the .ts
    // source directly via a ts-node/swc fallback that needs a workspace
    // tsconfig this scratch workspace doesn't have. Replacing the symlink
    // with a real copy keeps the realpath inside node_modules, so Nx loads
    // the already-built dist/*.js files like a normal installed package.
    const pluginNodeModulesPath = tmpProjPath(
      'node_modules/@fennet82/nx-graphify',
    );
    const realPluginPath = realpathSync(pluginNodeModulesPath);
    rmSync(pluginNodeModulesPath, { recursive: true, force: true });
    cpSync(realPluginPath, pluginNodeModulesPath, {
      recursive: true,
      dereference: true,
    });

    // A project for the inferred targets to run against.
    updateFile(
      'libs/sample/package.json',
      JSON.stringify({ name: 'sample', version: '0.0.1' }, null, 2),
    );

    // Stub a fake `graphify` binary on PATH that logs its argv instead of
    // doing real extraction/install work, so assertions don't depend on the
    // real graphify CLI being installed.
    fakeGraphifyBinDir = mkdtempSync(join(tmpdir(), 'fake-graphify-'));
    graphifyLogFile = join(fakeGraphifyBinDir, 'graphify.log');
    writeFileSync(graphifyLogFile, '');
    writeFileSync(
      join(fakeGraphifyBinDir, 'graphify'),
      [
        '#!/usr/bin/env bash',
        `for a in "$@"; do printf '[%s]' "$a" >> "${graphifyLogFile}"; done`,
        `printf '\\n' >> "${graphifyLogFile}"`,
        'if [ "$1" = "--version" ]; then echo "graphify-fake 0.0.0"; fi',
        'exit 0',
        '',
      ].join('\n'),
    );
    chmodSync(join(fakeGraphifyBinDir, 'graphify'), 0o755);

    originalPath = process.env.PATH;
    process.env.PATH = `${fakeGraphifyBinDir}:${process.env.PATH}`;
  });

  afterAll(() => {
    cleanup();
    if (fakeGraphifyBinDir) {
      rmSync(fakeGraphifyBinDir, { recursive: true, force: true });
    }
    if (originalPath !== undefined) {
      process.env.PATH = originalPath;
    }
  });

  it('registers the plugin with all 7 default target names via the init generator', async () => {
    await runNxCommandAsync('g @fennet82/nx-graphify:init');

    const nxJson = JSON.parse(readFile('nx.json'));
    const plugin = nxJson.plugins.find(
      (p: { plugin?: string }) => p?.plugin === '@fennet82/nx-graphify/plugin',
    );
    expect(plugin.options).toEqual({
      extractGraphifyTargetName: 'graphify:extract',
      updateGraphifyTargetName: 'graphify:update',
      queryGraphifyTargetName: 'graphify:query',
      pathGraphifyTargetName: 'graphify:path',
      explainGraphifyTargetName: 'graphify:explain',
      prsGraphifyTargetName: 'graphify:prs',
      purgeGraphifyTargetName: 'graphify:purge',
    });
  });

  it('runs `graphify install --project --platform <agent>` via the agents generator', async () => {
    await runNxCommandAsync(
      'g @fennet82/nx-graphify:agents install --agent=claude',
    );

    expect(readFile(graphifyLogFile)).toContain(
      '[install][--project][--platform][claude]',
    );
  });

  it('runs `graphify uninstall --project --platform <agent>` via the agents generator', async () => {
    await runNxCommandAsync(
      'g @fennet82/nx-graphify:agents uninstall --agent=claude',
    );

    expect(readFile(graphifyLogFile)).toContain(
      '[uninstall][--project][--platform][claude]',
    );
  });

  it('runs `graphify extract . {args}` via the inferred graphify:extract target', async () => {
    await runNxCommandAsync('run sample:graphify:extract');

    expect(readFile(graphifyLogFile)).toContain('[extract][.]');
  });

  it('runs `graphify query {args}` via the inferred graphify:query target, forwarding extra args', async () => {
    await runNxCommandAsync('run sample:graphify:query -- "what does foo do"');

    expect(readFile(graphifyLogFile)).toContain('[query][what does foo do]');
  });

  it('runs `graphify uninstall --project --purge` via the inferred graphify:purge target', async () => {
    await runNxCommandAsync('run sample:graphify:purge');

    expect(readFile(graphifyLogFile)).toContain(
      '[uninstall][--project][--purge]',
    );
  });
});
