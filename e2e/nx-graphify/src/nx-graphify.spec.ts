import {
  cleanup,
  ensureNxProject,
  readFile,
  runNxCommandAsync,
  tmpProjPath,
  updateFile,
} from '@nx/plugin/testing';
import { chmodSync, cpSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs';
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
    const pluginNodeModulesPath = tmpProjPath('node_modules/@fennet82/nx-graphify');
    const realPluginPath = realpathSync(pluginNodeModulesPath);
    rmSync(pluginNodeModulesPath, { recursive: true, force: true });
    cpSync(realPluginPath, pluginNodeModulesPath, { recursive: true, dereference: true });

    updateFile('nx.json', (content) => {
      const json = JSON.parse(content);
      json.plugins = [...(json.plugins ?? []), '@fennet82/nx-graphify/plugin'];
      return JSON.stringify(json, null, 2);
    });

    // A project for the `purge` target to run against (purge is inferred on
    // every project once the plugin above is registered).
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
        `echo "$@" >> "${graphifyLogFile}"`,
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
    if (originalPath !== undefined) {
      process.env.PATH = originalPath;
    }
  });

  it('runs `graphify install --project --platforms <agent>` via the init generator', async () => {
    await runNxCommandAsync('g @fennet82/nx-graphify:init --installAgent=claude');

    expect(readFile(graphifyLogFile)).toContain('install --project --platforms claude');
  });

  it('runs `graphify uninstall --project --platform <agent>` via the uninstall-agents generator', async () => {
    await runNxCommandAsync('g @fennet82/nx-graphify:uninstall-agents --agent=claude');

    expect(readFile(graphifyLogFile)).toContain('uninstall --project --platform claude');
  });

  it('runs `graphify uninstall --project --purge` via the inferred purge target', async () => {
    await runNxCommandAsync('run sample:purge');

    expect(readFile(graphifyLogFile)).toContain('uninstall --project --purge');
  });
});
