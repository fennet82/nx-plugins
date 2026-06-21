# nx-graphify: Inferred Tasks + Agent-Install Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `nx-graphify`'s `init`-generator project scaffolding with Nx inferred tasks (`createNodes`), so the `graphify` target attaches automatically to every project and `graphify-workspace` to the workspace root, and shrink `init` to a pure `graphify install --platforms ...` passthrough.

**Architecture:** A new `src/plugin/index.ts` exports the canonical Nx 23 `CreateNodes` tuple (`[glob, fn]`), registered by consumers via `nx.json`'s `plugins` array (pointing at the new `nx-graphify/plugin` subpath export). It globs on `project.json`/`package.json` — the same marker files Nx itself uses to discover projects — and returns a `graphify` target for every match, plus a `graphify-workspace` target when the match is at the workspace root. Defaults come from the plugin's own `options` block in `nx.json`; per-project overrides continue to work via each project's own `project.json`, using Nx's standard inferred-vs-explicit merge (no custom code needed). The `init` generator drops all `Tree` mutation and becomes a thin executor-style passthrough.

**Tech Stack:** TypeScript, `@nx/devkit` ^23.0.0 (canonical `CreateNodes`/`CreateNodesContext`/`createNodesFromFiles` APIs — the `V2`-suffixed names are deprecated aliases in this version), Vitest.

## Global Constraints

- Spec source of truth: `docs/superpowers/specs/2026-06-20-nx-graphify-inferred-tasks-design.md`. Original executor/agent-list spec: `docs/superpowers/specs/2026-06-18-nx-graphify-design.md`.
- This is a pre-1.0, unpublished plugin (never published to npm) — no backward-compatibility shims, no deprecation warnings, no dual-mode support. Delete old behavior outright.
- `installAgent` keeps its existing closed enum (`claude`, `codex`, `opencode`, `kilo`, `aider`, `copilot`, `claw`, `droid`, `trae`, `trae-cn`, `hermes`, `kiro`, `pi`, `codebuddy`, `antigravity`, `antigravity-windows`, `windows`, `kimi`, `amp`, `devin`, `gemini`, `cursor`) — do not remove it or make it free-form.
- `logger` from `@nx/devkit`, never `console.log`.
- TDD throughout: write the failing test, watch it fail, write minimal code, watch it pass, commit.
- Run `npx nx test nx-graphify` and `npx nx build nx-graphify` after every task; both must be green before moving on.

---

### Task 1: Simplify `init` generator to pure agent-install passthrough

**Files:**

- Modify: `packages/nx-graphify/src/generators/init/generator.ts`
- Modify: `packages/nx-graphify/src/generators/init/generator.spec.ts`
- Modify: `packages/nx-graphify/src/generators/init/schema.json`
- Modify: `packages/nx-graphify/src/generators/init/schema.d.ts`

**Interfaces:**

- Produces: `InitGeneratorSchema { installAgent?: InstallAgent[] }` (from `schema.d.ts`), `InstallAgent` enum unchanged from current `schema.d.ts`. Default export `initGenerator(tree: Tree, options: InitGeneratorSchema): Promise<void>`.
- Consumes: `checkGraphifyInstalled` from `../../utils/check-graphify` (unchanged).

- [ ] **Step 1: Replace generator.spec.ts with passthrough-only tests**

Replace the full contents of `packages/nx-graphify/src/generators/init/generator.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { logger, type Tree } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import initGenerator from './generator';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('../../utils/check-graphify', () => ({
  checkGraphifyInstalled: vi.fn(),
}));

describe('init generator', () => {
  let tree: Tree;

  beforeEach(() => {
    vi.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
  });

  it('throws when installAgent is not set', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await expect(initGenerator(tree, {})).rejects.toThrow('You must specify at least one --installAgent (e.g. --installAgent=claude --installAgent=cursor).');
  });

  it('throws when installAgent is an empty array', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await expect(initGenerator(tree, { installAgent: [] })).rejects.toThrow('You must specify at least one --installAgent (e.g. --installAgent=claude --installAgent=cursor).');
  });

  it('throws when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await expect(initGenerator(tree, { installAgent: ['claude'] })).rejects.toThrow('graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install');
    expect(execSync).not.toHaveBeenCalled();
  });

  it('runs a single `graphify install --platforms <agent>` call for one agent', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await initGenerator(tree, { installAgent: ['claude'] });

    expect(execSync).toHaveBeenCalledWith('graphify install --platforms claude', {
      stdio: 'inherit',
    });
  });

  it('joins multiple agents with "|" in a single install command', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await initGenerator(tree, { installAgent: ['claude', 'cursor', 'codex'] });

    expect(execSync).toHaveBeenCalledWith('graphify install --platforms claude|cursor|codex', { stdio: 'inherit' });
    expect(execSync).toHaveBeenCalledTimes(1);
  });

  it('logs the command before running it', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    await initGenerator(tree, { installAgent: ['claude'] });

    expect(infoSpy).toHaveBeenCalledWith('Running: graphify install --platforms claude');
  });

  it('propagates the error when the install command fails', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('command not found');
    });

    await expect(initGenerator(tree, { installAgent: ['claude'] })).rejects.toThrow('command not found');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test nx-graphify`
Expected: FAIL — the old `generator.ts` still requires `project`/`all`-related behavior and never throws the new "at least one --installAgent" message; several assertions about `getProjects`/`updateProjectConfiguration` behavior are gone so old tests referencing them no longer exist, but the new tests fail because the message text and throw conditions don't match yet.

- [ ] **Step 3: Replace generator.ts with the passthrough implementation**

Replace the full contents of `packages/nx-graphify/src/generators/init/generator.ts`:

```ts
import { logger, type Tree } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import type { InitGeneratorSchema } from './schema';

export default async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  const installAgents = options.installAgent ?? [];
  if (installAgents.length === 0) {
    throw new Error('You must specify at least one --installAgent (e.g. --installAgent=claude --installAgent=cursor).');
  }

  if (!checkGraphifyInstalled()) {
    throw new Error('graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install');
  }

  const command = `graphify install --platforms ${installAgents.join('|')}`;
  logger.info(`Running: ${command}`);
  execSync(command, { stdio: 'inherit' });
}
```

Note: `tree` is unused in the body but stays in the signature — Nx generator entry points are always called as `(tree, options)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test nx-graphify`
Expected: PASS — all tests in `generator.spec.ts` green.

- [ ] **Step 5: Update schema.json — drop `project`/`all`**

Replace `packages/nx-graphify/src/generators/init/schema.json`:

```json
{
  "$schema": "https://json-schema.org/schema",
  "$id": "NxGraphifyInit",
  "title": "Install AI assistant skills for Graphify",
  "type": "object",
  "properties": {
    "installAgent": {
      "type": "array",
      "description": "Run `graphify install --platforms <a>|<b>|...` for one or more AI coding assistants. Can be repeated (--installAgent=claude --installAgent=cursor).",
      "items": {
        "type": "string",
        "enum": ["claude", "codex", "opencode", "kilo", "aider", "copilot", "claw", "droid", "trae", "trae-cn", "hermes", "kiro", "pi", "codebuddy", "antigravity", "antigravity-windows", "windows", "kimi", "amp", "devin", "gemini", "cursor"]
      },
      "default": []
    }
  },
  "required": []
}
```

- [ ] **Step 6: Update schema.d.ts — drop `project`/`all`**

Replace `packages/nx-graphify/src/generators/init/schema.d.ts`:

```ts
export type InstallAgent = 'claude' | 'codex' | 'opencode' | 'kilo' | 'aider' | 'copilot' | 'claw' | 'droid' | 'trae' | 'trae-cn' | 'hermes' | 'kiro' | 'pi' | 'codebuddy' | 'antigravity' | 'antigravity-windows' | 'windows' | 'kimi' | 'amp' | 'devin' | 'gemini' | 'cursor';

export interface InitGeneratorSchema {
  installAgent?: InstallAgent[];
}
```

- [ ] **Step 7: Run full test suite and build**

Run: `npx nx test nx-graphify && npx nx build nx-graphify`
Expected: Both succeed.

- [ ] **Step 8: Commit**

```bash
git add packages/nx-graphify/src/generators/init/generator.ts \
        packages/nx-graphify/src/generators/init/generator.spec.ts \
        packages/nx-graphify/src/generators/init/schema.json \
        packages/nx-graphify/src/generators/init/schema.d.ts
git commit -m "$(cat <<'EOF'
Simplify init generator to pure agent-install passthrough

Drops --project/--all scaffolding now that target attachment is handled
by inferred tasks; init's only remaining job is graphify install.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add `GraphifyPluginOptions` type for plugin-level defaults

**Files:**

- Create: `packages/nx-graphify/src/plugin/schema.d.ts`

**Interfaces:**

- Consumes: `GraphifyExecutorSchema` from `../executors/graphify/schema` (existing: `{ outputDir: string } & GraphifyArgsOptions`, where `GraphifyArgsOptions` is `{ mode?, update?, clusterOnly?, noViz?, wiki?, obsidian?, svg?, graphml?, neo4j?, neo4jPush? }` from `../utils/build-args`).
- Produces: `GraphifyPluginOptions = Partial<GraphifyExecutorSchema>` — consumed by Task 3/4's `plugin/index.ts`.

This is a type-only file with no runtime behavior, so it has no dedicated spec file — its correctness is verified through the `plugin/index.spec.ts` tests in Task 4, which import and use this type.

- [ ] **Step 1: Create schema.d.ts**

```ts
import type { GraphifyExecutorSchema } from '../executors/graphify/schema';

export type GraphifyPluginOptions = Partial<GraphifyExecutorSchema>;
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx nx build nx-graphify`
Expected: Succeeds (no consumers yet, but confirms the import path resolves and the file is valid TypeScript).

- [ ] **Step 3: Commit**

```bash
git add packages/nx-graphify/src/plugin/schema.d.ts
git commit -m "$(cat <<'EOF'
Add GraphifyPluginOptions type for plugin-level target defaults

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Implement `createNodes` — per-project `graphify` target inference

**Files:**

- Create: `packages/nx-graphify/src/plugin/index.ts`
- Create: `packages/nx-graphify/src/plugin/index.spec.ts`

**Interfaces:**

- Consumes: `GraphifyPluginOptions` from `./schema` (Task 2). `CreateNodes`, `CreateNodesContext`, `createNodesFromFiles` from `@nx/devkit` (canonical Nx 23 names — do not use the deprecated `CreateNodesV2`/`CreateNodesContextV2` aliases).
- Produces: `export const createNodes: CreateNodes<GraphifyPluginOptions>` — a `[glob, fn]` tuple. Also exports `createNodesV2` as an alias of `createNodes` (matches the convention every other Nx-authored plugin in this workspace's own `node_modules` uses, for compatibility with Nx versions/tooling that still look up `createNodesV2` by name). Also exports `resolveGraphifyOptions(pluginOptions?: GraphifyPluginOptions): GraphifyExecutorSchema` as a named export so Task 5 (workspace-root target) can reuse it without duplicating the default-resolution logic.

This task covers per-project `graphify` target inference only. Workspace-root `graphify-workspace` inference is Task 5 — kept separate because a reviewer could reasonably accept "every project gets a `graphify` target" while still rejecting "the root project also gets `graphify-workspace`" if that part has a bug; splitting lets each be tested and reviewed independently.

- [ ] **Step 1: Write the failing test**

Create `packages/nx-graphify/src/plugin/index.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { CreateNodesContext } from '@nx/devkit';
import { createNodes } from './index';

function fakeContext(): CreateNodesContext {
  return {
    nxJsonConfiguration: {},
    workspaceRoot: '/workspace',
    configFiles: [],
  } as CreateNodesContext;
}

describe('createNodes', () => {
  const [, createNodesFunction] = createNodes;

  it('attaches a graphify target to a matched project with default options', async () => {
    const result = await createNodesFunction(['apps/foo/project.json'], {}, fakeContext());

    const [, { projects }] = result[0];
    expect(projects['apps/foo'].targets.graphify).toEqual({
      executor: 'nx-graphify:graphify',
      options: { outputDir: 'graphify-out', mode: 'normal' },
      inputs: ['default', '^default'],
      outputs: ['{projectRoot}/graphify-out'],
      cache: true,
    });
  });

  it('applies plugin-level option overrides from nx.json', async () => {
    const result = await createNodesFunction(['apps/foo/project.json'], { outputDir: 'custom-out', mode: 'deep' }, fakeContext());

    const [, { projects }] = result[0];
    expect(projects['apps/foo'].targets.graphify.options).toEqual({
      outputDir: 'custom-out',
      mode: 'deep',
    });
    expect(projects['apps/foo'].targets.graphify.outputs).toEqual(['{projectRoot}/custom-out']);
  });

  it('attaches a target for every matched project independently', async () => {
    const result = await createNodesFunction(['apps/foo/project.json', 'libs/bar/package.json'], {}, fakeContext());

    const projectRoots = result.flatMap(([, { projects }]) => Object.keys(projects));
    expect(projectRoots.sort()).toEqual(['apps/foo', 'libs/bar']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test nx-graphify`
Expected: FAIL with "Cannot find module './index'" (or similar) — `plugin/index.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `packages/nx-graphify/src/plugin/index.ts`:

```ts
import type { CreateNodes, CreateNodesContext } from '@nx/devkit';
import { createNodesFromFiles } from '@nx/devkit';
import { dirname } from 'node:path';
import type { GraphifyExecutorSchema } from '../executors/graphify/schema';
import type { GraphifyPluginOptions } from './schema';

const GRAPHIFY_CONFIG_GLOB = '{**/project.json,**/package.json}';

export function resolveGraphifyOptions(pluginOptions: GraphifyPluginOptions = {}): GraphifyExecutorSchema {
  return {
    outputDir: pluginOptions.outputDir ?? 'graphify-out',
    mode: pluginOptions.mode ?? 'normal',
    ...(pluginOptions.update !== undefined && { update: pluginOptions.update }),
    ...(pluginOptions.clusterOnly !== undefined && {
      clusterOnly: pluginOptions.clusterOnly,
    }),
    ...(pluginOptions.noViz !== undefined && { noViz: pluginOptions.noViz }),
    ...(pluginOptions.wiki !== undefined && { wiki: pluginOptions.wiki }),
    ...(pluginOptions.obsidian !== undefined && { obsidian: pluginOptions.obsidian }),
    ...(pluginOptions.svg !== undefined && { svg: pluginOptions.svg }),
    ...(pluginOptions.graphml !== undefined && { graphml: pluginOptions.graphml }),
    ...(pluginOptions.neo4j !== undefined && { neo4j: pluginOptions.neo4j }),
    ...(pluginOptions.neo4jPush !== undefined && { neo4jPush: pluginOptions.neo4jPush }),
  };
}

export const createNodes: CreateNodes<GraphifyPluginOptions> = [
  GRAPHIFY_CONFIG_GLOB,
  (configFiles: readonly string[], options: GraphifyPluginOptions, context: CreateNodesContext) => {
    return createNodesFromFiles(
      (configFile) => {
        const projectRoot = dirname(configFile);
        const resolvedOptions = resolveGraphifyOptions(options);

        return {
          projects: {
            [projectRoot]: {
              targets: {
                graphify: {
                  executor: 'nx-graphify:graphify',
                  options: resolvedOptions,
                  inputs: ['default', '^default'],
                  outputs: [`{projectRoot}/${resolvedOptions.outputDir}`],
                  cache: true,
                },
              },
            },
          },
        };
      },
      configFiles,
      options,
      context,
    );
  },
];

export const createNodesV2 = createNodes;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test nx-graphify`
Expected: PASS — all three `index.spec.ts` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/nx-graphify/src/plugin/index.ts packages/nx-graphify/src/plugin/index.spec.ts
git commit -m "$(cat <<'EOF'
Infer graphify target on every project via createNodes

Replaces per-project project.json mutation with Nx inferred tasks,
globbing on project.json/package.json the same way Nx itself discovers
projects. Defaults resolve from nx.json plugin options, falling back to
outputDir=graphify-out / mode=normal.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Add workspace-root `graphify-workspace` target inference

**Files:**

- Modify: `packages/nx-graphify/src/plugin/index.ts`
- Modify: `packages/nx-graphify/src/plugin/index.spec.ts`

**Interfaces:**

- Consumes: `resolveGraphifyOptions` (Task 3, same file — no new import).
- Produces: no new exports; `createNodes`'s returned project node for `projectRoot === '.'` now additionally includes a `graphify-workspace` target. Nothing outside this file depends on the new target shape directly.

- [ ] **Step 1: Write the failing test**

Add to `packages/nx-graphify/src/plugin/index.spec.ts` (inside the existing `describe('createNodes', ...)` block):

```ts
it('attaches graphify-workspace only at the workspace root', async () => {
  const result = await createNodesFunction(['package.json', 'apps/foo/project.json'], {}, fakeContext());

  const projectsByRoot = Object.fromEntries(result.flatMap(([, { projects }]) => Object.entries(projects)));

  expect(projectsByRoot['.'].targets['graphify-workspace']).toEqual({
    executor: 'nx-graphify:graphify-workspace',
    options: { outputDir: 'graphify-out', mode: 'normal' },
    outputs: ['{workspaceRoot}/graphify-out'],
    cache: true,
  });
  expect(projectsByRoot['apps/foo'].targets['graphify-workspace']).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test nx-graphify`
Expected: FAIL — `projectsByRoot['.'].targets['graphify-workspace']` is `undefined` because the implementation doesn't add it yet.

- [ ] **Step 3: Add the root-target branch to the implementation**

In `packages/nx-graphify/src/plugin/index.ts`, modify the per-file callback inside `createNodesFromFiles` (replace the `return { projects: ... }` block):

```ts
      (configFile) => {
        const projectRoot = dirname(configFile);
        const resolvedOptions = resolveGraphifyOptions(options);

        const targets: Record<string, unknown> = {
          graphify: {
            executor: 'nx-graphify:graphify',
            options: resolvedOptions,
            inputs: ['default', '^default'],
            outputs: [`{projectRoot}/${resolvedOptions.outputDir}`],
            cache: true,
          },
        };

        if (projectRoot === '.') {
          targets['graphify-workspace'] = {
            executor: 'nx-graphify:graphify-workspace',
            options: resolvedOptions,
            outputs: [`{workspaceRoot}/${resolvedOptions.outputDir}`],
            cache: true,
          };
        }

        return {
          projects: {
            [projectRoot]: { targets },
          },
        };
      },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test nx-graphify`
Expected: PASS — all `index.spec.ts` tests green, including the new root-target test.

- [ ] **Step 5: Run full build**

Run: `npx nx build nx-graphify`
Expected: Succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/nx-graphify/src/plugin/index.ts packages/nx-graphify/src/plugin/index.spec.ts
git commit -m "$(cat <<'EOF'
Infer graphify-workspace target on the workspace root project

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Wire up package.json plugin export and clean up executors.json

**Files:**

- Modify: `packages/nx-graphify/package.json`
- Modify: `packages/nx-graphify/executors.json`

**Interfaces:**

- Produces: a resolvable `nx-graphify/plugin` subpath import, pointing at the compiled `dist/plugin/index.js` from Task 3/4 — this is the exact string consumers put in their `nx.json`'s `plugins: [{ "plugin": "nx-graphify/plugin", ... }]`.

- [ ] **Step 1: Add the `./plugin` export to package.json**

In `packages/nx-graphify/package.json`, modify the `"exports"` block:

```json
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./plugin": {
      "types": "./dist/plugin/index.d.ts",
      "import": "./dist/plugin/index.js",
      "default": "./dist/plugin/index.js"
    }
  },
```

- [ ] **Step 2: Remove the now-redundant static inputs/outputs from executors.json**

Replace `packages/nx-graphify/executors.json`:

```json
{
  "executors": {
    "graphify": {
      "implementation": "./dist/executors/graphify/executor",
      "schema": "./dist/executors/graphify/schema.json",
      "description": "Run Graphify on a single Nx project"
    },
    "graphify-workspace": {
      "implementation": "./dist/executors/graphify-workspace/executor",
      "schema": "./dist/executors/graphify-workspace/schema.json",
      "description": "Run Graphify on the entire workspace"
    }
  }
}
```

(`inputs`/`outputs` now come from the per-project target object `createNodes` returns; declaring them again here would just be stale, unused duplication for projects that get their target via inference. They remain meaningful only for someone manually wiring the executor into a `project.json` without the plugin registered — an already-deprecated-in-spirit path per the design doc — so dropping them here is intentional, not an oversight.)

- [ ] **Step 3: Run full build and test**

Run: `npx nx build nx-graphify && npx nx test nx-graphify`
Expected: Both succeed.

- [ ] **Step 4: Verify the plugin export resolves**

Run: `node -e "console.log(require.resolve('./packages/nx-graphify/package.json'))" && node -e "require('./packages/nx-graphify/dist/plugin/index.js')" `

Expected: No errors — confirms `dist/plugin/index.js` exists post-build and is loadable as a CommonJS module (matches this package's `"type": "commonjs"`).

- [ ] **Step 5: Commit**

```bash
git add packages/nx-graphify/package.json packages/nx-graphify/executors.json
git commit -m "$(cat <<'EOF'
Expose nx-graphify/plugin subpath, drop stale executors.json cache config

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Update README for the inferred-tasks workflow

**Files:**

- Modify: `packages/nx-graphify/README.md`

**Interfaces:**

- None — documentation only.

- [ ] **Step 1: Replace the "Setup" and agent-install sections**

In `packages/nx-graphify/README.md`, replace everything from `## Setup` through the end of the "AI coding assistant skills" subsection with:

````markdown
## Setup

Register the plugin in your workspace's `nx.json`:

```json
{
  "plugins": [
    {
      "plugin": "nx-graphify/plugin",
      "options": {
        "outputDir": "graphify-out",
        "mode": "normal"
      }
    }
  ]
}
```
````

That's it — every project automatically gets a `graphify` target, and the
workspace root automatically gets a `graphify-workspace` target. No
generator, no per-project scaffolding.

The `options` block sets workspace-wide defaults (any of the options in the
table below). An individual project can still override them by adding its
own `targets.graphify.options` to its `project.json` — Nx merges that over
the inferred defaults automatically.

### AI coding assistant skills

```bash
nx g nx-graphify:init --installAgent=claude
# or multiple at once, installed in a single call:
nx g nx-graphify:init --installAgent=claude --installAgent=cursor
```

This runs `graphify install --platforms claude|cursor` for you. It's a
one-time, workspace-root-level operation, unrelated to which projects have
a `graphify` target.

````

- [ ] **Step 2: Update the "Targets" section to describe automatic attachment**

Replace the `## Targets` section's `graphify-workspace` subsection:

```markdown
### `graphify-workspace` (whole monorepo)

Automatically attached to the workspace root once the plugin is registered
in `nx.json` (see Setup). Runs Graphify against the entire workspace from
`context.root`.
````

(Leave the `### \`graphify\` (per project)` subsection as-is — its description of what running the target does is unaffected by how the target gets attached.)

- [ ] **Step 3: Commit**

```bash
git add packages/nx-graphify/README.md
git commit -m "$(cat <<'EOF'
Document inferred-tasks setup and simplified agent-install in README

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Final verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Clean build and test from scratch**

Run: `npx nx reset && npx nx build nx-graphify --skip-nx-cache && npx nx test nx-graphify --skip-nx-cache`
Expected: Both succeed with no errors or warnings.

- [ ] **Step 2: Confirm no leftover references to the deleted generator options**

Run: `grep -rn "options.project\|options.all\b\|getProjects(tree)\|updateProjectConfiguration" packages/nx-graphify/src`
Expected: No matches (confirms Task 1's removal was complete — nothing in `src/` still references the deleted scaffolding path).

- [ ] **Step 3: Confirm the plugin export and executors are both registered correctly**

Run: `cat packages/nx-graphify/package.json | grep -A5 '"./plugin"'` and `cat packages/nx-graphify/executors.json`
Expected: `./plugin` subpath present pointing at `dist/plugin/index.js`; `executors.json` still registers both `graphify` and `graphify-workspace` without static `inputs`/`outputs`.

- [ ] **Step 4: Report**

No commit for this task — it's a verification pass. If any check fails, return to the relevant earlier task and fix it there (with its own commit), rather than patching here.
