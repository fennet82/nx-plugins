import { execSync, type ExecSyncOptions } from 'child_process';
import { join } from 'path';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';

describe('nx-graphify', () => {
  let testWorkspaceRoot: string;
  let projectDirectory: string;
  let fakeGraphifyBinDir: string;
  let graphifyLogFile: string;
  let execOptions: ExecSyncOptions;

  beforeAll(() => {
    ({ testWorkspaceRoot, projectDirectory } = createTestProject());

    // The plugin has been built and published to a local registry in the jest globalSetup.
    // Install the plugin built from the current source into the test workspace.
    execSync('pnpm add -D @fennet82/nx-graphify@e2e', {
      cwd: projectDirectory,
      stdio: 'inherit',
      env: process.env,
    });

    const nxJsonPath = join(projectDirectory, 'nx.json');
    const nxJson = JSON.parse(readFileSync(nxJsonPath, 'utf-8'));
    nxJson.plugins = [...(nxJson.plugins ?? []), '@fennet82/nx-graphify/plugin'];
    writeFileSync(nxJsonPath, JSON.stringify(nxJson, null, 2));

    // Stub a fake `graphify` binary on PATH that logs its argv instead of doing
    // real extraction/install work, so assertions don't depend on the real
    // graphify CLI being installed.
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

    execOptions = {
      cwd: projectDirectory,
      stdio: 'inherit',
      env: { ...process.env, PATH: `${fakeGraphifyBinDir}:${process.env.PATH}` },
    };
  });

  afterAll(() => {
    if (testWorkspaceRoot) {
      rmSync(testWorkspaceRoot, { recursive: true, force: true });
    }
    if (fakeGraphifyBinDir) {
      rmSync(fakeGraphifyBinDir, { recursive: true, force: true });
    }
  });

  it('should be installed', () => {
    execSync('pnpm list @fennet82/nx-graphify', {
      cwd: projectDirectory,
      stdio: 'inherit',
    });
  });

  it('runs `graphify install --project --platforms <agent>` via the init generator', () => {
    execSync('npx nx g @fennet82/nx-graphify:init --installAgent=claude', execOptions);

    const log = readFileSync(graphifyLogFile, 'utf-8');
    expect(log).toContain('install --project --platforms claude');
  });

  it('runs `graphify uninstall --project --platform <agent>` via the uninstall-agents generator', () => {
    execSync(
      'npx nx g @fennet82/nx-graphify:uninstall-agents --agent=claude',
      execOptions,
    );

    const log = readFileSync(graphifyLogFile, 'utf-8');
    expect(log).toContain('uninstall --project --platform claude');
  });

  it('runs `graphify uninstall --project --purge` via the inferred purge target', () => {
    // `execOptions` sets `stdio: 'inherit'` (so the other tests stream output
    // live), which makes `execSync` return `null` instead of a Buffer. This
    // call needs the captured stdout to parse as JSON, so it overrides
    // `stdio` to `'pipe'` while keeping the same `cwd`/`env`.
    const output = execSync('npx nx show projects', {
      ...execOptions,
      stdio: 'pipe',
    }).toString();
    const projects = JSON.parse(output) as string[];
    expect(projects.length).toBeGreaterThan(0);

    execSync(`npx nx run ${projects[0]}:purge`, execOptions);

    const log = readFileSync(graphifyLogFile, 'utf-8');
    expect(log).toContain('uninstall --project --purge');
  });
});

/**
 * Creates a test project with create-nx-workspace and installs the plugin.
 *
 * The scratch workspace is created under the OS temp directory (not inside
 * this repo's working tree). create-nx-workspace runs its own `git init` and
 * then `git add`s the generated files into that new repo; if the workspace
 * were nested inside this repo (e.g. under `<repo>/tmp/<project>`),
 * create-nx-workspace would detect the parent git repo, skip its own `git
 * init`, and then fail to `git add` because this repo's root .gitignore
 * ignores a bare `tmp` directory.
 *
 * @returns The mkdtemp root (for cleanup) and the nested project directory
 */
function createTestProject(): {
  testWorkspaceRoot: string;
  projectDirectory: string;
} {
  const projectName = 'test-project';
  const testWorkspaceRoot = mkdtempSync(join(tmpdir(), 'nx-graphify-e2e-'));

  execSync(
    `pnpm dlx create-nx-workspace@latest ${projectName} --preset apps --nxCloud=skip --no-interactive`,
    {
      cwd: testWorkspaceRoot,
      stdio: 'inherit',
      env: process.env,
    },
  );

  const projectDirectory = join(testWorkspaceRoot, projectName);
  console.log(`Created test project in "${projectDirectory}"`);

  return { testWorkspaceRoot, projectDirectory };
}
