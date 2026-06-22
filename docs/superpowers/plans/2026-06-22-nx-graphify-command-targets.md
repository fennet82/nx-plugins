# nx-graphify Command-Based Targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `@fennet82/nx-graphify`'s custom executors and typed plugin options with command-based targets (mirroring `@nx/docker`'s `buildTarget`/`runTarget` pattern) covering graphify's `extract`, `update`, `query`, `path`, `explain`, `prs`, and `uninstall --purge` subcommands, and split agent-skill install/uninstall out of `init` into a new `agents` generator.

**Architecture:** `src/plugin/index.ts`'s `createNodes` builds 7 configurable, command-based `TargetConfiguration`s per project (string-or-object option, default name, raw `args` passthrough via Nx's native `{args}` interpolation) instead of invoking custom executors. `init` becomes registration-only. A new `agents` generator (positional `install`/`uninstall` action) replaces both `init`'s old install-skills logic and the standalone `uninstall-agents` generator.

**Tech Stack:** TypeScript, `@nx/devkit`, Vitest, `@nx/plugin/testing` (e2e), pnpm workspace.

## Global Constraints

- Work happens directly on `master`, no worktree. Do **not** push to any git remote without explicit fresh instruction.
- This is a breaking change to the published `@fennet82/nx-graphify` package (removes structured options, the `graphify`/`purge` executors, and the `uninstall-agents` generator) — every commit that removes/changes public API must use `feat(nx-graphify)!:` with a `BREAKING CHANGE:` footer.
- Follow this repo's existing conventions: Vitest for unit tests (`vi.mock`, `vi.clearAllMocks()` in `beforeEach`), `@nx/plugin/testing` for e2e, conventional commits, `logger`/`Tree`/`readNxJson`/`updateNxJson` from `@nx/devkit`.
- `vi.clearAllMocks()` resets call history but **not** mock implementations — any test that makes a mock throw must run last in its file, or a later test will silently inherit the throwing implementation.
- Default target names: `graphify:gen`, `graphify:update`, `graphify:query`, `graphify:path`, `graphify:explain`, `graphify:prs`, `graphify:purge`.
- No token interpolation (`{projectName}`, etc.) in `args` — out of scope per the approved design.

---

### Task 1: Plugin core — command-based targets, delete old executors

**Files:**

- Modify: `packages/nx-graphify/src/plugin/schema.d.ts`
- Modify: `packages/nx-graphify/src/plugin/index.ts`
- Modify: `packages/nx-graphify/src/plugin/index.spec.ts`
- Modify: `packages/nx-graphify/src/utils/types.ts`
- Modify: `packages/nx-graphify/package.json`
- Delete: `packages/nx-graphify/src/executors/graphify/executor.ts`
- Delete: `packages/nx-graphify/src/executors/graphify/executor.spec.ts`
- Delete: `packages/nx-graphify/src/executors/graphify/schema.json`
- Delete: `packages/nx-graphify/src/executors/graphify/schema.d.ts`
- Delete: `packages/nx-graphify/src/executors/purge/executor.ts`
- Delete: `packages/nx-graphify/src/executors/purge/executor.spec.ts`
- Delete: `packages/nx-graphify/src/executors/purge/schema.json`
- Delete: `packages/nx-graphify/src/executors/purge/schema.d.ts`
- Delete: `packages/nx-graphify/executors.json`
- Delete: `packages/nx-graphify/src/utils/build-args.ts`
- Delete: `packages/nx-graphify/src/utils/build-args.spec.ts`

**Interfaces:**

- Produces: `GraphifyTargetOptions` (`{ name: string; args?: string[]; env?: Record<string,string>; envFile?: string; cwd?: string; configurations?: Record<string, Omit<GraphifyTargetOptions, 'configurations'|'name'>> }`) and `GraphifyPluginOptions` (`{ genTarget?, updateTarget?, queryTarget?, pathTarget?, explainTarget?, prsTarget?, purgeTarget?: string | GraphifyTargetOptions }`) from `src/plugin/schema.d.ts` — consumed by Task 2's `init` generator for the default-options object it writes into `nx.json`.
- Produces: `normalizePluginOptions(options?: GraphifyPluginOptions)` exported from `src/plugin/index.ts`, returning all 7 keys fully resolved to `{ name, ...rest }`.
- Consumes: nothing from other tasks (this is the foundational task).

- [ ] **Step 1: Delete the old executors, their schemas, and build-args**

```bash
cd /home/fennet/git_repos/nx-plugins
rm -rf packages/nx-graphify/src/executors
rm packages/nx-graphify/executors.json
rm packages/nx-graphify/src/utils/build-args.ts packages/nx-graphify/src/utils/build-args.spec.ts
```

- [ ] **Step 2: Remove `ProviderBackend` from `src/utils/types.ts`**

Replace the full file contents with:

```ts
export type InstallAgent = 'claude' | 'codex' | 'opencode' | 'kilo' | 'aider' | 'copilot' | 'claw' | 'droid' | 'trae' | 'trae-cn' | 'hermes' | 'kiro' | 'pi' | 'codebuddy' | 'antigravity' | 'antigravity-windows' | 'windows' | 'kimi' | 'amp' | 'devin' | 'gemini' | 'cursor';
```

- [ ] **Step 3: Replace `src/plugin/schema.d.ts` with the new plugin option types**

```ts
export interface GraphifyTargetOptions {
  name: string;
  args?: string[];
  env?: Record<string, string>;
  envFile?: string;
  cwd?: string;
  configurations?: Record<string, Omit<GraphifyTargetOptions, 'configurations' | 'name'>>;
}

export interface GraphifyPluginOptions {
  genTarget?: string | GraphifyTargetOptions;
  updateTarget?: string | GraphifyTargetOptions;
  queryTarget?: string | GraphifyTargetOptions;
  pathTarget?: string | GraphifyTargetOptions;
  explainTarget?: string | GraphifyTargetOptions;
  prsTarget?: string | GraphifyTargetOptions;
  purgeTarget?: string | GraphifyTargetOptions;
}
```

- [ ] **Step 4: Write the failing spec for `src/plugin/index.spec.ts`**

Replace the full file contents with:

```ts
import { describe, it, expect } from 'vitest';
import type { CreateNodesContext } from '@nx/devkit';
import { createNodes, normalizePluginOptions } from './index';

function fakeContext(): CreateNodesContext {
  return {
    nxJsonConfiguration: {},
    workspaceRoot: '/workspace',
    configFiles: [],
  } as CreateNodesContext;
}

describe('normalizePluginOptions', () => {
  it('fills in default target names when no options are given', () => {
    expect(normalizePluginOptions()).toEqual({
      genTarget: { name: 'graphify:gen' },
      updateTarget: { name: 'graphify:update' },
      queryTarget: { name: 'graphify:query' },
      pathTarget: { name: 'graphify:path' },
      explainTarget: { name: 'graphify:explain' },
      prsTarget: { name: 'graphify:prs' },
      purgeTarget: { name: 'graphify:purge' },
    });
  });

  it('treats a string option as just the target name', () => {
    expect(normalizePluginOptions({ genTarget: 'extract' }).genTarget).toEqual({ name: 'extract' });
  });

  it('preserves object option fields and defaults the name if missing', () => {
    expect(
      normalizePluginOptions({
        queryTarget: { args: ['--budget', '500'] },
      }).queryTarget,
    ).toEqual({ name: 'graphify:query', args: ['--budget', '500'] });
  });
});

describe('createNodes', () => {
  const [, createNodesFunction] = createNodes;

  it('attaches all 7 default-named, command-based targets to a matched project', async () => {
    const result = await createNodesFunction(['apps/foo/project.json'], {}, fakeContext());

    const [, { projects }] = result[0];
    const targets = projects!['apps/foo'].targets!;

    expect(targets['graphify:gen']).toEqual({
      command: 'graphify extract . {args}',
      options: { cwd: 'apps/foo' },
      cache: true,
      inputs: ['default', '^default'],
      outputs: ['{projectRoot}/graphify-out'],
    });
    expect(targets['graphify:update']).toEqual({
      command: 'graphify update . {args}',
      options: { cwd: 'apps/foo' },
      cache: true,
      inputs: ['default', '^default'],
      outputs: ['{projectRoot}/graphify-out'],
    });
    expect(targets['graphify:query']).toEqual({
      command: 'graphify query {args}',
      options: { cwd: 'apps/foo' },
    });
    expect(targets['graphify:path']).toEqual({
      command: 'graphify path {args}',
      options: { cwd: 'apps/foo' },
    });
    expect(targets['graphify:explain']).toEqual({
      command: 'graphify explain {args}',
      options: { cwd: 'apps/foo' },
    });
    expect(targets['graphify:prs']).toEqual({
      command: 'graphify prs {args}',
      options: { cwd: 'apps/foo' },
    });
    expect(targets['graphify:purge']).toEqual({
      command: 'graphify uninstall --project --purge {args}',
      options: { cwd: 'apps/foo' },
    });
  });

  it('uses a custom target name from a string option', async () => {
    const result = await createNodesFunction(['apps/foo/project.json'], { genTarget: 'extract' }, fakeContext());

    const [, { projects }] = result[0];
    const targets = projects!['apps/foo'].targets!;
    expect(targets['extract']).toBeDefined();
    expect(targets['graphify:gen']).toBeUndefined();
  });

  it('passes through args/env/envFile/cwd overrides from an object option', async () => {
    const result = await createNodesFunction(
      ['apps/foo/project.json'],
      {
        queryTarget: {
          name: 'graphify:query',
          args: ['--budget', '500'],
          env: { GRAPHIFY_DEBUG: '1' },
          envFile: '.env.graphify',
          cwd: 'apps/foo/custom',
        },
      },
      fakeContext(),
    );

    const [, { projects }] = result[0];
    expect(projects!['apps/foo'].targets!['graphify:query']).toEqual({
      command: 'graphify query {args}',
      options: {
        cwd: 'apps/foo/custom',
        args: ['--budget', '500'],
        env: { GRAPHIFY_DEBUG: '1' },
        envFile: '.env.graphify',
      },
    });
  });

  it('builds per-configuration option overrides for a target', async () => {
    const result = await createNodesFunction(
      ['apps/foo/project.json'],
      {
        genTarget: {
          name: 'graphify:gen',
          configurations: { ci: { args: ['--no-cluster'] } },
        },
      },
      fakeContext(),
    );

    const [, { projects }] = result[0];
    expect(projects!['apps/foo'].targets!['graphify:gen'].configurations).toEqual({
      ci: { cwd: 'apps/foo', args: ['--no-cluster'] },
    });
  });

  it('attaches targets to the workspace root the same way as any other project', async () => {
    const result = await createNodesFunction(['package.json', 'apps/foo/project.json'], {}, fakeContext());

    const projectsByRoot = Object.fromEntries(result.flatMap(([, { projects }]) => Object.entries(projects ?? {})));

    expect(projectsByRoot['.'].targets!['graphify:gen']).toEqual({
      command: 'graphify extract . {args}',
      options: { cwd: '.' },
      cache: true,
      inputs: ['default', '^default'],
      outputs: ['{projectRoot}/graphify-out'],
    });
  });

  it('attaches a target for every matched project independently', async () => {
    const result = await createNodesFunction(['apps/foo/project.json', 'libs/bar/package.json'], {}, fakeContext());

    const projectRoots = result.flatMap(([, { projects }]) => Object.keys(projects ?? {}));
    expect(projectRoots.sort()).toEqual(['apps/foo', 'libs/bar']);
  });
});
```

- [ ] **Step 5: Run the spec to verify it fails**

Run: `npx nx test nx-graphify --skip-nx-cache`
Expected: FAIL — `index.ts` still imports from the deleted `../executors/graphify/schema` and doesn't export `normalizePluginOptions`, so this won't even compile/run yet.

- [ ] **Step 6: Replace `src/plugin/index.ts` with the command-based implementation**

```ts
import type { CreateNodes, CreateNodesContext, TargetConfiguration } from '@nx/devkit';
import { createNodesFromFiles } from '@nx/devkit';
import { dirname } from 'node:path';
import type { GraphifyPluginOptions, GraphifyTargetOptions } from './schema';

const GRAPHIFY_CONFIG_GLOB = '{**/project.json,**/package.json}';

interface NormalizedGraphifyPluginOptions {
  genTarget: GraphifyTargetOptions;
  updateTarget: GraphifyTargetOptions;
  queryTarget: GraphifyTargetOptions;
  pathTarget: GraphifyTargetOptions;
  explainTarget: GraphifyTargetOptions;
  prsTarget: GraphifyTargetOptions;
  purgeTarget: GraphifyTargetOptions;
}

function normalizeTarget(target: string | GraphifyTargetOptions | undefined, defaultName: string): GraphifyTargetOptions {
  if (typeof target === 'string') {
    return { name: target };
  }
  if (target && typeof target === 'object') {
    return { ...target, name: target.name ?? defaultName };
  }
  return { name: defaultName };
}

export function normalizePluginOptions(options: GraphifyPluginOptions = {}): NormalizedGraphifyPluginOptions {
  return {
    genTarget: normalizeTarget(options.genTarget, 'graphify:gen'),
    updateTarget: normalizeTarget(options.updateTarget, 'graphify:update'),
    queryTarget: normalizeTarget(options.queryTarget, 'graphify:query'),
    pathTarget: normalizeTarget(options.pathTarget, 'graphify:path'),
    explainTarget: normalizeTarget(options.explainTarget, 'graphify:explain'),
    prsTarget: normalizeTarget(options.prsTarget, 'graphify:prs'),
    purgeTarget: normalizeTarget(options.purgeTarget, 'graphify:purge'),
  };
}

function buildTargetOptions(target: GraphifyTargetOptions, projectRoot: string): Record<string, unknown> {
  const options: Record<string, unknown> = {
    cwd: target.cwd ?? projectRoot,
  };
  if (target.args) {
    options.args = target.args;
  }
  if (target.env) {
    options.env = target.env;
  }
  if (target.envFile) {
    options.envFile = target.envFile;
  }
  return options;
}

function buildTargetConfigurations(target: GraphifyTargetOptions, projectRoot: string): Record<string, unknown> | undefined {
  if (!target.configurations) {
    return undefined;
  }

  const configurations: Record<string, unknown> = {};
  for (const [configName, configOptions] of Object.entries(target.configurations)) {
    configurations[configName] = buildTargetOptions({ ...configOptions, name: target.name }, projectRoot);
  }
  return configurations;
}

function buildCommandTarget(target: GraphifyTargetOptions, projectRoot: string, command: string, cacheable: boolean): TargetConfiguration {
  const configurations = buildTargetConfigurations(target, projectRoot);
  return {
    command,
    options: buildTargetOptions(target, projectRoot),
    ...(configurations && { configurations }),
    ...(cacheable && {
      cache: true,
      inputs: ['default', '^default'],
      outputs: ['{projectRoot}/graphify-out'],
    }),
  };
}

export const createNodes: CreateNodes<GraphifyPluginOptions> = [
  GRAPHIFY_CONFIG_GLOB,
  (configFiles: readonly string[], options: GraphifyPluginOptions | undefined, context: CreateNodesContext) => {
    return createNodesFromFiles(
      (configFile) => {
        const projectRoot = dirname(configFile);
        const normalized = normalizePluginOptions(options);

        const targets: Record<string, TargetConfiguration> = {
          [normalized.genTarget.name]: buildCommandTarget(normalized.genTarget, projectRoot, 'graphify extract . {args}', true),
          [normalized.updateTarget.name]: buildCommandTarget(normalized.updateTarget, projectRoot, 'graphify update . {args}', true),
          [normalized.queryTarget.name]: buildCommandTarget(normalized.queryTarget, projectRoot, 'graphify query {args}', false),
          [normalized.pathTarget.name]: buildCommandTarget(normalized.pathTarget, projectRoot, 'graphify path {args}', false),
          [normalized.explainTarget.name]: buildCommandTarget(normalized.explainTarget, projectRoot, 'graphify explain {args}', false),
          [normalized.prsTarget.name]: buildCommandTarget(normalized.prsTarget, projectRoot, 'graphify prs {args}', false),
          [normalized.purgeTarget.name]: buildCommandTarget(normalized.purgeTarget, projectRoot, 'graphify uninstall --project --purge {args}', false),
        };

        return {
          projects: {
            [projectRoot]: { targets },
          },
        };
      },
      configFiles,
      options ?? {},
      context,
    );
  },
];

export const createNodesV2 = createNodes;
```

- [ ] **Step 7: Run the spec to verify it passes**

Run: `npx nx test nx-graphify --skip-nx-cache`
Expected: PASS — all tests in `plugin/index.spec.ts` green. (Other spec files will still fail right now since they reference deleted modules — that's expected and fixed in later tasks. If the test runner aborts entirely instead of reporting per-file results, run `npx vitest run packages/nx-graphify/src/plugin/index.spec.ts` directly instead.)

- [ ] **Step 8: Update `package.json` to drop the executors reference**

In `packages/nx-graphify/package.json`:

- Remove the top-level `"executors": "./executors.json"` line.
- Remove `"executors.json"` from the `"files"` array (keep `"dist"`, `"!**/*.tsbuildinfo"`, `"generators.json"`).

- [ ] **Step 9: Commit**

```bash
git add packages/nx-graphify/src/plugin packages/nx-graphify/src/utils/types.ts packages/nx-graphify/src/executors packages/nx-graphify/executors.json packages/nx-graphify/src/utils/build-args.ts packages/nx-graphify/src/utils/build-args.spec.ts packages/nx-graphify/package.json
git commit -m "$(cat <<'EOF'
feat(nx-graphify)!: replace executors with command-based targets

Drop the graphify/purge executors and their typed schema options in
favor of command-based targets (nx:run-commands shorthand), mirroring
@nx/docker's buildTarget/runTarget pattern: each target's name is
configurable (string or object), and all graphify CLI flags pass
through as raw args instead of a typed schema kept in sync by hand.

Adds genTarget/updateTarget/queryTarget/pathTarget/explainTarget/
prsTarget/purgeTarget, covering graphify's extract, update, query,
path, explain, prs, and uninstall --purge subcommands.

BREAKING CHANGE: the graphify and purge executors are removed, along
with the mode/provider/noViz/wiki/obsidian/svg/graphml/neo4j/
neo4jPush/update/clusterOnly options (several of which were already
silently no-ops against the real graphify CLI). Configure targets via
genTarget/updateTarget/queryTarget/pathTarget/explainTarget/prsTarget/
purgeTarget plugin options instead, passing graphify flags as args.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `init` generator — registration-only

**Files:**

- Modify: `packages/nx-graphify/src/generators/init/generator.ts`
- Modify: `packages/nx-graphify/src/generators/init/generator.spec.ts`
- Modify: `packages/nx-graphify/src/generators/init/schema.json`
- Modify: `packages/nx-graphify/src/generators/init/schema.d.ts`

**Interfaces:**

- Consumes: nothing new from Task 1 (writes a plain object literal of default target options into `nx.json`, doesn't import plugin types).
- Produces: nothing consumed by later tasks (Task 3 is a separate generator).

- [ ] **Step 1: Replace `schema.json` (drop `installAgent`)**

```json
{
  "$schema": "https://json-schema.org/schema",
  "$id": "NxGraphifyInit",
  "title": "Register the Graphify plugin in nx.json",
  "type": "object",
  "properties": {},
  "required": []
}
```

- [ ] **Step 2: Replace `schema.d.ts`**

```ts
export type InitGeneratorSchema = Record<string, never>;
```

- [ ] **Step 3: Write the failing spec for `generator.spec.ts`**

Replace the full file contents with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { logger, readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import initGenerator from './generator';

vi.mock('../../utils/check-graphify', () => ({
  checkGraphifyInstalled: vi.fn(),
}));

const DEFAULT_PLUGIN_OPTIONS = {
  genTarget: { name: 'graphify:gen' },
  updateTarget: { name: 'graphify:update' },
  queryTarget: { name: 'graphify:query' },
  pathTarget: { name: 'graphify:path' },
  explainTarget: { name: 'graphify:explain' },
  prsTarget: { name: 'graphify:prs' },
  purgeTarget: { name: 'graphify:purge' },
};

describe('init generator', () => {
  let tree: Tree;

  beforeEach(() => {
    vi.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  it('registers the plugin with full default target options', async () => {
    await initGenerator(tree, {});

    expect(readNxJson(tree)?.plugins).toEqual([
      {
        plugin: '@fennet82/nx-graphify/plugin',
        options: DEFAULT_PLUGIN_OPTIONS,
      },
    ]);
  });

  it('does not duplicate the plugin in nx.json if already registered as a string', async () => {
    const nxJson = readNxJson(tree)!;
    nxJson.plugins = ['@fennet82/nx-graphify/plugin'];
    updateNxJson(tree, nxJson);

    await initGenerator(tree, {});

    expect(readNxJson(tree)?.plugins).toEqual(['@fennet82/nx-graphify/plugin']);
  });

  it('does not duplicate the plugin in nx.json if already registered as an object', async () => {
    const nxJson = readNxJson(tree)!;
    nxJson.plugins = [
      {
        plugin: '@fennet82/nx-graphify/plugin',
        options: { genTarget: 'extract' },
      },
    ];
    updateNxJson(tree, nxJson);

    await initGenerator(tree, {});

    expect(readNxJson(tree)?.plugins).toEqual([
      {
        plugin: '@fennet82/nx-graphify/plugin',
        options: { genTarget: 'extract' },
      },
    ]);
  });

  it('warns but still registers the plugin when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    await initGenerator(tree, {});

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('graphify CLI not found'));
    expect(readNxJson(tree)?.plugins).toEqual([
      {
        plugin: '@fennet82/nx-graphify/plugin',
        options: DEFAULT_PLUGIN_OPTIONS,
      },
    ]);
  });

  it('does not warn when graphify is installed', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    await initGenerator(tree, {});

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the spec to verify it fails**

Run: `npx vitest run packages/nx-graphify/src/generators/init/generator.spec.ts`
Expected: FAIL — `generator.ts` still has the old `installAgent`/`execSync` install logic and the old `options: {}` registration shape.

- [ ] **Step 5: Replace `generator.ts`**

```ts
import { logger, readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import type { InitGeneratorSchema } from './schema';

const PLUGIN_PATH = '@fennet82/nx-graphify/plugin';

const DEFAULT_PLUGIN_OPTIONS = {
  genTarget: { name: 'graphify:gen' },
  updateTarget: { name: 'graphify:update' },
  queryTarget: { name: 'graphify:query' },
  pathTarget: { name: 'graphify:path' },
  explainTarget: { name: 'graphify:explain' },
  prsTarget: { name: 'graphify:prs' },
  purgeTarget: { name: 'graphify:purge' },
};

export default async function initGenerator(tree: Tree, _options: InitGeneratorSchema) {
  if (!checkGraphifyInstalled()) {
    logger.warn('graphify CLI not found. The plugin will still be registered, but its targets will fail until graphify is installed. See: https://github.com/safishamsi/graphify#install');
  }

  registerPlugin(tree);
}

function registerPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson) {
    return;
  }

  const plugins = nxJson.plugins ?? [];
  const alreadyRegistered = plugins.some((plugin) => (typeof plugin === 'string' ? plugin === PLUGIN_PATH : plugin.plugin === PLUGIN_PATH));
  if (alreadyRegistered) {
    return;
  }

  nxJson.plugins = [...plugins, { plugin: PLUGIN_PATH, options: DEFAULT_PLUGIN_OPTIONS }];
  updateNxJson(tree, nxJson);
}
```

- [ ] **Step 6: Run the spec to verify it passes**

Run: `npx vitest run packages/nx-graphify/src/generators/init/generator.spec.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 7: Commit**

```bash
git add packages/nx-graphify/src/generators/init
git commit -m "$(cat <<'EOF'
feat(nx-graphify)!: init only registers the plugin, warns if graphify is missing

init no longer installs agent skills (that moves to the new `agents`
generator in the next commit) — it now only registers the plugin in
nx.json, with explicit default target options instead of an empty
options object. Also downgrades the "graphify not found" check from a
throw to a warning, since registering the plugin doesn't itself
require graphify to be installed.

BREAKING CHANGE: init no longer accepts --installAgent and no longer
runs `graphify install`. Use the new `agents` generator instead:
`nx g @fennet82/nx-graphify:agents install --agent=claude`.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `agents` generator — replaces `uninstall-agents`

**Files:**

- Delete: `packages/nx-graphify/src/generators/uninstall-agents/generator.ts`
- Delete: `packages/nx-graphify/src/generators/uninstall-agents/generator.spec.ts`
- Delete: `packages/nx-graphify/src/generators/uninstall-agents/schema.json`
- Delete: `packages/nx-graphify/src/generators/uninstall-agents/schema.d.ts`
- Create: `packages/nx-graphify/src/generators/agents/schema.json`
- Create: `packages/nx-graphify/src/generators/agents/schema.d.ts`
- Create: `packages/nx-graphify/src/generators/agents/generator.ts`
- Create: `packages/nx-graphify/src/generators/agents/generator.spec.ts`
- Modify: `packages/nx-graphify/generators.json`

**Interfaces:**

- Consumes: `InstallAgent` from `src/utils/types.ts` (unchanged from Task 1), `checkGraphifyInstalled` from `src/utils/check-graphify.ts` (unchanged).
- Produces: `agentsGenerator(tree: Tree, options: AgentsGeneratorSchema)` where `AgentsGeneratorSchema = { action: 'install' | 'uninstall'; agent?: InstallAgent[] }` — not consumed elsewhere in this plan, but is the public generator entry point documented in Task 5.

- [ ] **Step 1: Delete `uninstall-agents`**

```bash
cd /home/fennet/git_repos/nx-plugins
rm -rf packages/nx-graphify/src/generators/uninstall-agents
```

- [ ] **Step 2: Create `src/generators/agents/schema.json`**

```json
{
  "$schema": "https://json-schema.org/schema",
  "$id": "NxGraphifyAgents",
  "title": "Install or uninstall AI assistant skills for Graphify",
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["install", "uninstall"],
      "description": "Whether to install or uninstall agent skills.",
      "$default": { "$source": "argv", "index": 0 }
    },
    "agent": {
      "type": "array",
      "description": "Run `graphify <action> --project --platform <a>|<b>|...` for one or more AI coding assistants. Can be repeated (--agent=claude --agent=cursor). Required for `uninstall`; if omitted for `install`, runs `graphify install --project` with no --platform flag.",
      "items": {
        "type": "string",
        "enum": ["claude", "codex", "opencode", "kilo", "aider", "copilot", "claw", "droid", "trae", "trae-cn", "hermes", "kiro", "pi", "codebuddy", "antigravity", "antigravity-windows", "windows", "kimi", "amp", "devin", "gemini", "cursor"]
      },
      "default": []
    }
  },
  "required": ["action"]
}
```

- [ ] **Step 3: Create `src/generators/agents/schema.d.ts`**

```ts
import type { InstallAgent } from '../../utils/types';

export interface AgentsGeneratorSchema {
  action: 'install' | 'uninstall';
  agent?: InstallAgent[];
}
```

- [ ] **Step 4: Write the failing spec for `src/generators/agents/generator.spec.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { logger, type Tree } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import agentsGenerator from './generator';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('../../utils/check-graphify', () => ({
  checkGraphifyInstalled: vi.fn(),
}));

describe('agents generator', () => {
  let tree: Tree;

  beforeEach(() => {
    vi.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  it('throws when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await expect(agentsGenerator(tree, { action: 'install', agent: ['claude'] })).rejects.toThrow('graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install');
    expect(execSync).not.toHaveBeenCalled();
  });

  it('throws when uninstall is run with no --agent', async () => {
    await expect(agentsGenerator(tree, { action: 'uninstall' })).rejects.toThrow('You must specify at least one --agent (e.g. --agent=claude --agent=cursor).');
    expect(execSync).not.toHaveBeenCalled();
  });

  it('runs `graphify uninstall --project --platform <agent>` for uninstall', async () => {
    await agentsGenerator(tree, { action: 'uninstall', agent: ['claude'] });

    expect(execSync).toHaveBeenCalledWith('graphify uninstall --project --platform claude', { stdio: 'inherit' });
  });

  it('joins multiple agents with "|" for uninstall', async () => {
    await agentsGenerator(tree, {
      action: 'uninstall',
      agent: ['claude', 'cursor', 'codex'],
    });

    expect(execSync).toHaveBeenCalledWith('graphify uninstall --project --platform claude|cursor|codex', { stdio: 'inherit' });
  });

  it('warns and omits --platform when install is run with no --agent', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    await agentsGenerator(tree, { action: 'install' });

    expect(warnSpy).toHaveBeenCalled();
    expect(execSync).toHaveBeenCalledWith('graphify install --project', {
      stdio: 'inherit',
    });
  });

  it('runs `graphify install --project --platform <agent>` for one agent', async () => {
    await agentsGenerator(tree, { action: 'install', agent: ['claude'] });

    expect(execSync).toHaveBeenCalledWith('graphify install --project --platform claude', { stdio: 'inherit' });
  });

  it('logs the command before running it', async () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    await agentsGenerator(tree, { action: 'install', agent: ['claude'] });

    expect(infoSpy).toHaveBeenCalledWith('Running: graphify install --project --platform claude');
  });

  it('propagates the error when the command fails', async () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('command not found');
    });

    await expect(agentsGenerator(tree, { action: 'install', agent: ['claude'] })).rejects.toThrow('command not found');
  });
});
```

- [ ] **Step 5: Run the spec to verify it fails**

Run: `npx vitest run packages/nx-graphify/src/generators/agents/generator.spec.ts`
Expected: FAIL — `generator.ts` doesn't exist yet.

- [ ] **Step 6: Create `src/generators/agents/generator.ts`**

```ts
import { logger, type Tree } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import type { AgentsGeneratorSchema } from './schema';

export default async function agentsGenerator(_tree: Tree, options: AgentsGeneratorSchema) {
  if (!checkGraphifyInstalled()) {
    throw new Error('graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install');
  }

  const agents = options.agent ?? [];

  if (options.action === 'uninstall' && agents.length === 0) {
    throw new Error('You must specify at least one --agent (e.g. --agent=claude --agent=cursor).');
  }

  let command = `graphify ${options.action} --project`;
  if (agents.length === 0) {
    logger.warn("You didn't specify an agent. You can use --agent (e.g. --agent=claude --agent=cursor), or run graphify install manually (e.g. `graphify install --platforms claude|cursor|...`).");
  } else {
    command = `${command} --platform ${agents.join('|')}`;
  }

  logger.info(`Running: ${command}`);
  execSync(command, { stdio: 'inherit' });
}
```

- [ ] **Step 7: Run the spec to verify it passes**

Run: `npx vitest run packages/nx-graphify/src/generators/agents/generator.spec.ts`
Expected: PASS — all 8 tests green.

- [ ] **Step 8: Update `generators.json`**

```json
{
  "generators": {
    "init": {
      "factory": "./dist/generators/init/generator",
      "schema": "./dist/generators/init/schema.json",
      "description": "Register the Graphify plugin in nx.json"
    },
    "agents": {
      "factory": "./dist/generators/agents/generator",
      "schema": "./dist/generators/agents/schema.json",
      "description": "Install or uninstall Graphify skills for one or more AI coding assistants"
    }
  }
}
```

- [ ] **Step 9: Commit**

```bash
git add packages/nx-graphify/src/generators packages/nx-graphify/generators.json
git commit -m "$(cat <<'EOF'
feat(nx-graphify)!: replace uninstall-agents with unified agents generator

Adds a single `agents` generator with a positional install/uninstall
action (nx g @fennet82/nx-graphify:agents install --agent=claude),
replacing both init's old embedded install logic and the standalone
uninstall-agents generator. install with no --agent warns and omits
--platform (same UX init had); uninstall with no --agent still throws
— there's no "uninstall everything" mode.

BREAKING CHANGE: the uninstall-agents generator is removed. Use
`nx g @fennet82/nx-graphify:agents uninstall --agent=<agent>` instead.
Use `nx g @fennet82/nx-graphify:agents install --agent=<agent>` in
place of init's old --installAgent option.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: e2e — cover command-based targets and the `agents` generator

**Files:**

- Modify: `e2e/nx-graphify-e2e/src/nx-graphify.spec.ts`

**Interfaces:**

- Consumes: the real, built `@fennet82/nx-graphify` package (via `npx nx build nx-graphify` having run — `ensureNxProject` copies from `packages/nx-graphify`, which must have a `dist/` from Task 1-3's work). No new exported symbols are introduced by this task.

- [ ] **Step 1: Replace the full file contents**

```ts
import { cleanup, ensureNxProject, readFile, runNxCommandAsync, tmpProjPath, updateFile } from '@nx/plugin/testing';
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
    cpSync(realPluginPath, pluginNodeModulesPath, {
      recursive: true,
      dereference: true,
    });

    // A project for the inferred targets to run against.
    updateFile('libs/sample/package.json', JSON.stringify({ name: 'sample', version: '0.0.1' }, null, 2));

    // Stub a fake `graphify` binary on PATH that logs its argv instead of
    // doing real extraction/install work, so assertions don't depend on the
    // real graphify CLI being installed.
    fakeGraphifyBinDir = mkdtempSync(join(tmpdir(), 'fake-graphify-'));
    graphifyLogFile = join(fakeGraphifyBinDir, 'graphify.log');
    writeFileSync(graphifyLogFile, '');
    writeFileSync(join(fakeGraphifyBinDir, 'graphify'), ['#!/usr/bin/env bash', `echo "$@" >> "${graphifyLogFile}"`, 'if [ "$1" = "--version" ]; then echo "graphify-fake 0.0.0"; fi', 'exit 0', ''].join('\n'));
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
    const plugin = nxJson.plugins.find((p: { plugin?: string }) => p?.plugin === '@fennet82/nx-graphify/plugin');
    expect(plugin.options).toEqual({
      genTarget: { name: 'graphify:gen' },
      updateTarget: { name: 'graphify:update' },
      queryTarget: { name: 'graphify:query' },
      pathTarget: { name: 'graphify:path' },
      explainTarget: { name: 'graphify:explain' },
      prsTarget: { name: 'graphify:prs' },
      purgeTarget: { name: 'graphify:purge' },
    });
  });

  it('runs `graphify install --project --platform <agent>` via the agents generator', async () => {
    await runNxCommandAsync('g @fennet82/nx-graphify:agents install --agent=claude');

    expect(readFile(graphifyLogFile)).toContain('install --project --platform claude');
  });

  it('runs `graphify uninstall --project --platform <agent>` via the agents generator', async () => {
    await runNxCommandAsync('g @fennet82/nx-graphify:agents uninstall --agent=claude');

    expect(readFile(graphifyLogFile)).toContain('uninstall --project --platform claude');
  });

  it('runs `graphify extract . {args}` via the inferred graphify:gen target', async () => {
    await runNxCommandAsync('run sample:graphify:gen');

    expect(readFile(graphifyLogFile)).toContain('extract .');
  });

  it('runs `graphify query {args}` via the inferred graphify:query target, forwarding extra args', async () => {
    await runNxCommandAsync('run sample:graphify:query -- "what does foo do"');

    expect(readFile(graphifyLogFile)).toContain('query "what does foo do"');
  });

  it('runs `graphify uninstall --project --purge` via the inferred graphify:purge target', async () => {
    await runNxCommandAsync('run sample:graphify:purge');

    expect(readFile(graphifyLogFile)).toContain('uninstall --project --purge');
  });
});
```

Note: the first test (`init` registration) intentionally runs before the `graphify:gen`/`graphify:query`/`graphify:purge` tests, since those rely on the plugin already being registered in the scratch workspace's `nx.json`. This mirrors how the original file already relied on `beforeAll`/test ordering within the same `describe` block (Jest runs `it`s in file order, not in parallel, within one file).

- [ ] **Step 2: Build the plugin so e2e picks up the new dist output**

Run: `npx nx build nx-graphify`
Expected: build succeeds (no TypeScript errors referencing the deleted executors/build-args).

- [ ] **Step 3: Run the e2e suite**

Run: `npx nx e2e nx-graphify-e2e --skip-nx-cache`
Expected: PASS — all 6 tests green.

- [ ] **Step 4: Commit**

```bash
git add e2e/nx-graphify-e2e/src/nx-graphify.spec.ts
git commit -m "$(cat <<'EOF'
test(nx-graphify-e2e): cover command-based targets and agents generator

Replace the old install/uninstall-agents/purge-only e2e coverage with
the new agents generator (install + uninstall) and three of the
inferred command-based targets (graphify:gen, graphify:query with
forwarded args, graphify:purge), plus a check that init registers all
7 default target options.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Docs — README rewrite

**Files:**

- Modify: `packages/nx-graphify/README.md`
- Modify: `README.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Replace `packages/nx-graphify/README.md`**

````markdown
# @fennet82/nx-graphify

Nx plugin for [Graphify](https://graphify.net/) — build multi-modal knowledge
graphs from your monorepo's source code using Tree-sitter + LLM semantic
extraction.

## Prerequisites

Graphify must be installed separately:

```bash
pip install graphifyy
# or
uv tool install graphifyy
# or
pipx install graphifyy
```
````

See https://github.com/safishamsi/graphify#install for full installation
instructions.

## Setup

Register the plugin in your workspace's `nx.json`:

```json
{
  "plugins": [
    {
      "plugin": "@fennet82/nx-graphify/plugin",
      "options": {
        "genTarget": { "name": "graphify:gen" },
        "updateTarget": { "name": "graphify:update" },
        "queryTarget": { "name": "graphify:query" },
        "pathTarget": { "name": "graphify:path" },
        "explainTarget": { "name": "graphify:explain" },
        "prsTarget": { "name": "graphify:prs" },
        "purgeTarget": { "name": "graphify:purge" }
      }
    }
  ]
}
```

Or just run `nx g @fennet82/nx-graphify:init` — it writes exactly the above
into `nx.json` for you (skipping if the plugin is already registered, as a
string or as an object), and warns (without failing) if it can't find the
`graphify` CLI on your `PATH`.

That's it — every project automatically gets all 7 targets below, including
the workspace root: a root `package.json` (which every Nx workspace has, if
only to depend on its own plugins) makes the root a project too, so there's
no separate "whole workspace" target — running any target on the root
project already covers that case.

Each plugin option accepts either a plain string (just renames the target)
or an object — `{ name, args, env, envFile, cwd, configurations }`. All
graphify CLI flags are passed straight through as `args`; there's no
structured schema to keep in sync with graphify's own flags.

## Targets

### `graphify:gen` — `genTarget`

Runs `graphify extract . {args}` (cwd = the project's root). Creates
`graphify-out/` (`graph.json`, `manifest.json`, `.graphify_analysis.json`,
plus clustering output) and is cached by Nx like any other build target.

```bash
nx run my-app:graphify:gen
nx run my-app:graphify:gen -- --backend openai --model gpt-4
nx run my-app:graphify:gen -- --mode deep --max-workers 4
```

### `graphify:update` — `updateTarget`

Runs `graphify update . {args}`. Re-extracts changed files only and merges
into the existing graph — no LLM needed unless you also pass extract-style
flags. Cached the same way as `graphify:gen`.

```bash
nx run my-app:graphify:update
nx run my-app:graphify:update -- --force
```

### `graphify:query` — `queryTarget`

Runs `graphify query {args}` against the project's `graphify-out/graph.json`.
Not cached — it's a read, not a build.

```bash
nx run my-app:graphify:query -- "what calls the auth middleware?"
nx run my-app:graphify:query -- "what calls the auth middleware?" --dfs --budget 500
```

### `graphify:path` — `pathTarget`

Runs `graphify path {args}` — shortest path between two nodes in the graph.

```bash
nx run my-app:graphify:path -- "UserService" "Database"
```

### `graphify:explain` — `explainTarget`

Runs `graphify explain {args}` — plain-language explanation of a node and
its neighbors.

```bash
nx run my-app:graphify:explain -- "UserService.login"
```

### `graphify:prs` — `prsTarget`

Runs `graphify prs {args}` — a dashboard of open PRs against the repo, with
optional triage/conflict/graph-impact analysis.

```bash
nx run my-app:graphify:prs
nx run my-app:graphify:prs -- --triage
nx run my-app:graphify:prs -- --conflicts
```

### `graphify:purge` — `purgeTarget`

Runs `graphify uninstall --project --purge {args}`, scoped to that project's
own directory. Removes that project's `graphify-out/` directory only — no
agent skills are touched. Not cached, since deleting output isn't a
reproducible build step.

```bash
nx run my-app:graphify:purge
nx run-many -t graphify:purge
nx affected -t graphify:purge
```

## Overriding options per project

An individual project can override any target's `args`/`env`/`cwd` by adding
its own entry to `targets` in `project.json` — Nx merges that over the
inferred defaults automatically:

```json
{
  "name": "my-app",
  "targets": {
    "graphify:gen": {
      "options": {
        "args": ["--backend", "ollama", "--model", "llama3"]
      }
    }
  }
}
```

This works the same way for any of the 7 targets, and for the root project
too.

## Renaming a target

```json
{
  "plugins": [
    {
      "plugin": "@fennet82/nx-graphify/plugin",
      "options": {
        "genTarget": "extract"
      }
    }
  ]
}
```

Now every project's extraction target is `nx run my-app:extract` instead of
`nx run my-app:graphify:gen`.

## Per-configuration overrides

```json
{
  "plugins": [
    {
      "plugin": "@fennet82/nx-graphify/plugin",
      "options": {
        "genTarget": {
          "name": "graphify:gen",
          "configurations": {
            "ci": { "args": ["--no-cluster"] }
          }
        }
      }
    }
  ]
}
```

```bash
nx run my-app:graphify:gen:ci
```

## AI coding assistant skills

```bash
nx g @fennet82/nx-graphify:agents install --agent=claude
# or multiple at once, installed in a single call:
nx g @fennet82/nx-graphify:agents install --agent=claude --agent=cursor
```

This runs `graphify install --project --platform claude|cursor` for you.
It's a one-time, workspace-root-level operation, unrelated to which projects
have graphify targets. `--project` is graphify's own project-vs-global
install flag — this generator always passes it, so the skills are installed
for this workspace, not globally for your user account. If you omit
`--agent`, it runs `graphify install --project` with no `--platform` flag at
all (and logs a warning).

To remove agent skills again:

```bash
nx g @fennet82/nx-graphify:agents uninstall --agent=claude
# or multiple at once:
nx g @fennet82/nx-graphify:agents uninstall --agent=claude --agent=cursor
```

This runs `graphify uninstall --project --platform claude|cursor`. At least
one `--agent` is required for `uninstall` — there's no "uninstall
everything" mode; say which agents you want removed.

## Development

```bash
pnpm install
npx nx build nx-graphify
npx nx test nx-graphify
npx nx e2e nx-graphify-e2e
```

````

- [ ] **Step 2: Replace `README.md` (root)**

```markdown
# nx-plugins

A collection of third-party Nx plugins. Currently contains `@fennet82/nx-graphify`,
an Nx plugin that wraps the [graphify](https://github.com/safishamsi/graphify) CLI
as a self-inferring plugin.

## Structure

````

packages/nx-graphify/ the published plugin (@fennet82/nx-graphify)
src/
generators/ init, agents
plugin/ createNodes target inference (command-based, no executors)
utils/ agent-platform enum, graphify-installed check
e2e/
nx-graphify-e2e/ e2e tests for @fennet82/nx-graphify (@nx/plugin/testing)
docs/superpowers/
specs/ design specs
plans/ implementation plans

````

See [docs/superpowers/specs](./docs/superpowers/specs) for design specs and
[docs/superpowers/plans](./docs/superpowers/plans) for implementation plans.

## Setup

Register the plugin in your `nx.json`:

```json
{
  "plugins": [
    {
      "plugin": "@fennet82/nx-graphify/plugin",
      "options": {
        "genTarget": { "name": "graphify:gen" },
        "updateTarget": { "name": "graphify:update" },
        "queryTarget": { "name": "graphify:query" },
        "pathTarget": { "name": "graphify:path" },
        "explainTarget": { "name": "graphify:explain" },
        "prsTarget": { "name": "graphify:prs" },
        "purgeTarget": { "name": "graphify:purge" }
      }
    }
  ]
}
````

Or run `nx g @fennet82/nx-graphify:init`, which writes the above for you.

This infers 7 command-based targets on every project (including the
workspace root): `graphify:gen`, `graphify:update`, `graphify:query`,
`graphify:path`, `graphify:explain`, `graphify:prs`, `graphify:purge`. Each
target's name and its `args`/`env`/`cwd` are configurable — see
[packages/nx-graphify/README.md](./packages/nx-graphify/README.md) for the
full reference.

## Commands

| Command                                                      | What it runs                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `nx run <project>:graphify:gen`                              | `graphify extract . [args]`                                                              |
| `nx run <project>:graphify:update`                           | `graphify update . [args]`                                                               |
| `nx run <project>:graphify:query -- "<question>"`            | `graphify query "<question>" [args]`                                                     |
| `nx run <project>:graphify:path -- "A" "B"`                  | `graphify path "A" "B" [args]`                                                           |
| `nx run <project>:graphify:explain -- "X"`                   | `graphify explain "X" [args]`                                                            |
| `nx run <project>:graphify:prs`                              | `graphify prs [args]`                                                                    |
| `nx run <project>:graphify:purge`                            | `graphify uninstall --project --purge [args]` (cwd = that project's root)                |
| `nx g @fennet82/nx-graphify:init`                            | registers the plugin in `nx.json` (warns, doesn't fail, if graphify isn't installed yet) |
| `nx g @fennet82/nx-graphify:agents install --agent=claude`   | `graphify install --project --platform claude`                                           |
| `nx g @fennet82/nx-graphify:agents uninstall --agent=claude` | `graphify uninstall --project --platform claude`                                         |

All graphify-specific configuration (backend, model, mode, etc.) is passed
as raw CLI args via each target's `args` option — there's no separate typed
schema to keep in sync with graphify's own flags.

## Development

```bash
pnpm install
npx nx build nx-graphify
npx nx test nx-graphify
npx nx e2e nx-graphify-e2e
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full contributor workflow
and [RELEASE.md](./RELEASE.md) for the release process.

````

- [ ] **Step 3: Run prettier on both READMEs**

Run: `npx prettier --write packages/nx-graphify/README.md README.md`
Expected: exits 0; tables may get re-aligned.

- [ ] **Step 4: Commit**

```bash
git add packages/nx-graphify/README.md README.md
git commit -m "$(cat <<'EOF'
docs(nx-graphify): rewrite README for command-based targets and agents generator

Document the 7 configurable command-based targets (genTarget through
purgeTarget), per-project args overrides, target renaming, per-target
configurations, and the new agents generator — replacing the old
executor options table and init --installAgent / uninstall-agents docs.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
````

---

### Task 6: Final full verification

**Files:** none modified — verification only (fix-forward if something fails).

- [ ] **Step 1: Run the full nx-graphify + e2e suite**

Run: `npx nx run-many -t lint test build --projects=nx-graphify`
Expected: lint has no errors (pre-existing `@typescript-eslint/no-non-null-assertion` warnings are fine), all unit tests pass, build succeeds.

- [ ] **Step 2: Run e2e**

Run: `npx nx e2e nx-graphify-e2e --skip-nx-cache`
Expected: PASS.

- [ ] **Step 3: Confirm no leftover references to deleted modules**

Run: `grep -rn "build-args\|executors/graphify\|executors/purge\|uninstall-agents\|ProviderBackend" packages/nx-graphify/src packages/nx-graphify/executors.json packages/nx-graphify/generators.json README.md packages/nx-graphify/README.md 2>/dev/null`
Expected: no output (the `executors.json` path itself no longer exists, so `grep` will report it as missing — that's correct, confirming Task 1's deletion).

- [ ] **Step 4: If anything failed in Steps 1-3, fix it and commit the fix**

```bash
git add -A
git commit -m "fix(nx-graphify): <describe the fix>"
```

(Skip this step entirely if Steps 1-3 were all clean.)
