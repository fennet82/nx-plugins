# nx-graphify: uninstall-agents, purge, provider backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project-scoped agent install/uninstall (`--project`), a new `uninstall-agents` generator, a new inferred `purge` executor target, and a `provider.backend`/`provider.model` extraction option to the `nx-graphify` plugin, plus unit and e2e test coverage and refreshed docs.

**Architecture:** Two new CLI-passthrough surfaces mirror the existing `init` generator / `graphify`+`graphify-workspace` executor pair exactly (no `Tree` mutation, `execSync` + `checkGraphifyInstalled` guard, inferred via `createNodes` where applicable). The new `provider` option is a nested field threaded through the existing `GraphifyArgsOptions` → `buildGraphifyArgs` → executor schema chain, no new architecture needed there.

**Tech Stack:** TypeScript, `@nx/devkit`, Vitest (unit), Jest + `@nx/plugin:e2e-project` scaffolding + local Verdaccio registry (e2e).

## Global Constraints

- `--project` (boolean, no value) is graphify's own project-vs-global distinction for `install`/`uninstall` subcommands — unrelated to the existing value-taking `--project <name>` used by `buildGraphifyArgs` for extraction. Never conflate the two.
- `init` and `uninstall-agents` always run from the workspace root and always pass `--project` unconditionally — there is no opt-out.
- `init` keeps its current warn-and-continue behavior on empty `installAgent` (do NOT make it throw — two existing spec assertions currently expect a throw; those are wrong and must be fixed to match the real, intended behavior instead).
- `uninstall-agents` throws when `agent` is empty/missing (no bare "remove everything" generator exists by design).
- `purge` is an inferred executor target (via `createNodes`), attached to **every** matched project including workspace root — not a generator, not cached, no `outputs` declared.
- `provider.model` without `provider.backend` is a hard error in `buildGraphifyArgs`.
- This is a pre-1.0, unpublished plugin — no backward-compatibility shims needed anywhere in this plan.
- Spec reference: `docs/superpowers/specs/2026-06-21-nx-graphify-uninstall-purge-provider-design.md`.

---

## File Structure

```
packages/nx-graphify/
  src/
    utils/
      agents.ts                          (NEW — shared InstallAgent type)
      build-args.ts                      (MODIFY — provider.backend/model)
      build-args.spec.ts                 (MODIFY — provider test cases)
    generators/
      init/
        generator.ts                     (MODIFY — add --project)
        generator.spec.ts                (MODIFY — fix throw assertions, add --project)
        schema.d.ts                      (MODIFY — import InstallAgent from utils/agents)
      uninstall-agents/                  (NEW)
        generator.ts
        generator.spec.ts
        schema.json
        schema.d.ts
    executors/
      graphify/schema.json               (MODIFY — add provider property)
      graphify-workspace/schema.json     (MODIFY — add provider property)
      purge/                             (NEW)
        executor.ts
        executor.spec.ts
        schema.json
        schema.d.ts
    plugin/
      index.ts                           (MODIFY — purge target, provider passthrough)
      index.spec.ts                      (MODIFY — purge target assertions)
  executors.json                         (MODIFY — register purge)
  generators.json                        (MODIFY — register uninstall-agents)
e2e/                                      (NEW — scaffolded by @nx/plugin:e2e-project)
README.md / CONTRIBUTING.md / RELEASE.md / PULL_REQUEST_TEMPLATE.md (MODIFY)
```

---

### Task 1: Extract shared `InstallAgent` type

**Files:**
- Create: `packages/nx-graphify/src/utils/agents.ts`
- Modify: `packages/nx-graphify/src/generators/init/schema.d.ts`
- Test: existing `packages/nx-graphify/src/generators/init/generator.spec.ts` (must still pass unchanged after this task — it doesn't import the type directly)

**Interfaces:**
- Produces: `InstallAgent` type, exported from `packages/nx-graphify/src/utils/agents.ts`, consumed by both `init` and the new `uninstall-agents` generator schemas (Task 3).

- [ ] **Step 1: Create the shared type file**

```ts
// packages/nx-graphify/src/utils/agents.ts
export type InstallAgent =
  | 'claude'
  | 'codex'
  | 'opencode'
  | 'kilo'
  | 'aider'
  | 'copilot'
  | 'claw'
  | 'droid'
  | 'trae'
  | 'trae-cn'
  | 'hermes'
  | 'kiro'
  | 'pi'
  | 'codebuddy'
  | 'antigravity'
  | 'antigravity-windows'
  | 'windows'
  | 'kimi'
  | 'amp'
  | 'devin'
  | 'gemini'
  | 'cursor';
```

- [ ] **Step 2: Update `init/schema.d.ts` to import it instead of declaring its own copy**

```ts
// packages/nx-graphify/src/generators/init/schema.d.ts
import type { InstallAgent } from '../../utils/agents';

export interface InitGeneratorSchema {
  installAgent?: InstallAgent[];
}
```

- [ ] **Step 3: Run the existing test suite to confirm nothing broke**

Run: `npx nx test nx-graphify -t "init generator"`
Expected: same 5 passing / 2 failing as before this task (the 2 failures are the known-wrong throw assertions, fixed in Task 2) — this task must not change pass/fail counts.

- [ ] **Step 4: Commit**

```bash
git add packages/nx-graphify/src/utils/agents.ts packages/nx-graphify/src/generators/init/schema.d.ts
git commit -m "refactor(nx-graphify): extract shared InstallAgent type"
```

---

### Task 2: `init` generator — add `--project`, fix wrong test expectations

**Files:**
- Modify: `packages/nx-graphify/src/generators/init/generator.ts`
- Modify: `packages/nx-graphify/src/generators/init/generator.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `init` now always runs `graphify install --project --platforms <agents>` (was `graphify install --platforms <agents>`).

- [ ] **Step 1: Update the two wrong "throws" tests to assert the real warn-and-continue behavior, and update every command-string assertion to include `--project`**

```ts
// packages/nx-graphify/src/generators/init/generator.spec.ts
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

  it('warns and runs an empty --platforms install when installAgent is not set', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    await initGenerator(tree, {});

    expect(warnSpy).toHaveBeenCalledWith(
      "You didn't specify an agent to install you can use --installAgent (e.g. --installAgent=claude --installAgent=cursor), or run graphify install manually (e.g. `graphify install --platforms claude|cursor`)."
    );
    expect(execSync).toHaveBeenCalledWith('graphify install --project --platforms ', {
      stdio: 'inherit',
    });
  });

  it('warns and runs an empty --platforms install when installAgent is an empty array', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    await initGenerator(tree, { installAgent: [] });

    expect(warnSpy).toHaveBeenCalled();
    expect(execSync).toHaveBeenCalledWith('graphify install --project --platforms ', {
      stdio: 'inherit',
    });
  });

  it('throws when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await expect(initGenerator(tree, { installAgent: ['claude'] })).rejects.toThrow(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install'
    );
    expect(execSync).not.toHaveBeenCalled();
  });

  it('runs a single `graphify install --project --platforms <agent>` call for one agent', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await initGenerator(tree, { installAgent: ['claude'] });

    expect(execSync).toHaveBeenCalledWith('graphify install --project --platforms claude', {
      stdio: 'inherit',
    });
  });

  it('joins multiple agents with "|" in a single install command', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await initGenerator(tree, { installAgent: ['claude', 'cursor', 'codex'] });

    expect(execSync).toHaveBeenCalledWith(
      'graphify install --project --platforms claude|cursor|codex',
      { stdio: 'inherit' }
    );
    expect(execSync).toHaveBeenCalledTimes(1);
  });

  it('logs the command before running it', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    await initGenerator(tree, { installAgent: ['claude'] });

    expect(infoSpy).toHaveBeenCalledWith('Running: graphify install --project --platforms claude');
  });

  it('propagates the error when the install command fails', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('command not found');
    });

    await expect(initGenerator(tree, { installAgent: ['claude'] })).rejects.toThrow(
      'command not found'
    );
  });
});
```

- [ ] **Step 2: Run the spec to confirm it still fails (generator not yet updated)**

Run: `npx nx test nx-graphify -t "init generator"`
Expected: FAIL — command-string assertions expect `--project` which isn't emitted yet.

- [ ] **Step 3: Update the generator to add `--project`**

```ts
// packages/nx-graphify/src/generators/init/generator.ts
import { logger, type Tree } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import type { InitGeneratorSchema } from './schema';

export default async function initGenerator(
  tree: Tree,
  options: InitGeneratorSchema,
) {
  if (!checkGraphifyInstalled()) {
    throw new Error(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install',
    );
  }

  const installAgents = options.installAgent ?? [];
  if (options.installAgent && options.installAgent.length === 0) {
    logger.warn(
      "You didn't specify an agent to install you can use --installAgent (e.g. --installAgent=claude --installAgent=cursor), or run graphify install manually (e.g. `graphify install --platforms claude|cursor`).",
    );
  }

  const command = `graphify install --project --platforms ${installAgents.join('|')}`;
  logger.info(`Running: ${command}`);
  execSync(command, { stdio: 'inherit' });
}
```

- [ ] **Step 4: Run the spec again to confirm it passes**

Run: `npx nx test nx-graphify -t "init generator"`
Expected: PASS (all 8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/nx-graphify/src/generators/init/generator.ts packages/nx-graphify/src/generators/init/generator.spec.ts
git commit -m "fix(nx-graphify): pass --project on init install, fix wrong throw assertions"
```

---

### Task 3: `uninstall-agents` generator (new)

**Files:**
- Create: `packages/nx-graphify/src/generators/uninstall-agents/schema.json`
- Create: `packages/nx-graphify/src/generators/uninstall-agents/schema.d.ts`
- Create: `packages/nx-graphify/src/generators/uninstall-agents/generator.ts`
- Create: `packages/nx-graphify/src/generators/uninstall-agents/generator.spec.ts`
- Modify: `packages/nx-graphify/generators.json`

**Interfaces:**
- Consumes: `InstallAgent` from `../../utils/agents` (Task 1), `checkGraphifyInstalled` from `../../utils/check-graphify`.
- Produces: `uninstallAgentsGenerator(tree, options)` default export, `UninstallAgentsGeneratorSchema { agent?: InstallAgent[] }`.

- [ ] **Step 1: Write the schema files**

```json
// packages/nx-graphify/src/generators/uninstall-agents/schema.json
{
  "$schema": "https://json-schema.org/schema",
  "$id": "NxGraphifyUninstallAgents",
  "title": "Uninstall AI assistant skills for Graphify",
  "type": "object",
  "properties": {
    "agent": {
      "type": "array",
      "description": "Run `graphify uninstall --project --platform <a>|<b>|...` for one or more AI coding assistants. Can be repeated (--agent=claude --agent=cursor).",
      "items": {
        "type": "string",
        "enum": [
          "claude",
          "codex",
          "opencode",
          "kilo",
          "aider",
          "copilot",
          "claw",
          "droid",
          "trae",
          "trae-cn",
          "hermes",
          "kiro",
          "pi",
          "codebuddy",
          "antigravity",
          "antigravity-windows",
          "windows",
          "kimi",
          "amp",
          "devin",
          "gemini",
          "cursor"
        ]
      },
      "default": []
    }
  },
  "required": []
}
```

```ts
// packages/nx-graphify/src/generators/uninstall-agents/schema.d.ts
import type { InstallAgent } from '../../utils/agents';

export interface UninstallAgentsGeneratorSchema {
  agent?: InstallAgent[];
}
```

- [ ] **Step 2: Write the failing test**

```ts
// packages/nx-graphify/src/generators/uninstall-agents/generator.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { logger, type Tree } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import uninstallAgentsGenerator from './generator';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('../../utils/check-graphify', () => ({
  checkGraphifyInstalled: vi.fn(),
}));

describe('uninstall-agents generator', () => {
  let tree: Tree;

  beforeEach(() => {
    vi.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
  });

  it('throws when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await expect(uninstallAgentsGenerator(tree, { agent: ['claude'] })).rejects.toThrow(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install'
    );
    expect(execSync).not.toHaveBeenCalled();
  });

  it('throws when agent is not set', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await expect(uninstallAgentsGenerator(tree, {})).rejects.toThrow(
      'You must specify at least one --agent (e.g. --agent=claude --agent=cursor).'
    );
    expect(execSync).not.toHaveBeenCalled();
  });

  it('throws when agent is an empty array', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await expect(uninstallAgentsGenerator(tree, { agent: [] })).rejects.toThrow(
      'You must specify at least one --agent (e.g. --agent=claude --agent=cursor).'
    );
    expect(execSync).not.toHaveBeenCalled();
  });

  it('runs a single `graphify uninstall --project --platform <agent>` call for one agent', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await uninstallAgentsGenerator(tree, { agent: ['claude'] });

    expect(execSync).toHaveBeenCalledWith('graphify uninstall --project --platform claude', {
      stdio: 'inherit',
    });
  });

  it('joins multiple agents with "|" in a single uninstall command', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await uninstallAgentsGenerator(tree, { agent: ['claude', 'cursor', 'codex'] });

    expect(execSync).toHaveBeenCalledWith(
      'graphify uninstall --project --platform claude|cursor|codex',
      { stdio: 'inherit' }
    );
    expect(execSync).toHaveBeenCalledTimes(1);
  });

  it('logs the command before running it', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    await uninstallAgentsGenerator(tree, { agent: ['claude'] });

    expect(infoSpy).toHaveBeenCalledWith(
      'Running: graphify uninstall --project --platform claude'
    );
  });

  it('propagates the error when the uninstall command fails', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('command not found');
    });

    await expect(uninstallAgentsGenerator(tree, { agent: ['claude'] })).rejects.toThrow(
      'command not found'
    );
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx nx test nx-graphify -t "uninstall-agents generator"`
Expected: FAIL with "Cannot find module './generator'" (file doesn't exist yet).

- [ ] **Step 4: Write the generator implementation**

```ts
// packages/nx-graphify/src/generators/uninstall-agents/generator.ts
import { logger, type Tree } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import type { UninstallAgentsGeneratorSchema } from './schema';

export default async function uninstallAgentsGenerator(
  tree: Tree,
  options: UninstallAgentsGeneratorSchema,
) {
  if (!checkGraphifyInstalled()) {
    throw new Error(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install',
    );
  }

  const agents = options.agent ?? [];
  if (agents.length === 0) {
    throw new Error(
      'You must specify at least one --agent (e.g. --agent=claude --agent=cursor).',
    );
  }

  const command = `graphify uninstall --project --platform ${agents.join('|')}`;
  logger.info(`Running: ${command}`);
  execSync(command, { stdio: 'inherit' });
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx nx test nx-graphify -t "uninstall-agents generator"`
Expected: PASS (all 7 tests).

- [ ] **Step 6: Register the generator**

```json
// packages/nx-graphify/generators.json
{
  "generators": {
    "init": {
      "factory": "./dist/generators/init/generator",
      "schema": "./dist/generators/init/schema.json",
      "description": "Install Graphify skills for one or more AI coding assistants"
    },
    "uninstall-agents": {
      "factory": "./dist/generators/uninstall-agents/generator",
      "schema": "./dist/generators/uninstall-agents/schema.json",
      "description": "Uninstall Graphify skills for one or more AI coding assistants"
    }
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/nx-graphify/src/generators/uninstall-agents packages/nx-graphify/generators.json
git commit -m "feat(nx-graphify): add uninstall-agents generator"
```

---

### Task 4: `provider.backend` / `provider.model` in `build-args.ts`

**Files:**
- Modify: `packages/nx-graphify/src/utils/build-args.ts`
- Modify: `packages/nx-graphify/src/utils/build-args.spec.ts`

**Interfaces:**
- Produces: `ProviderBackend` type and `provider?: { backend?: ProviderBackend; model?: string }` field on `GraphifyArgsOptions`, both exported from `packages/nx-graphify/src/utils/build-args.ts`. `GraphifyExecutorSchema` (`executors/graphify/schema.d.ts`) already extends `GraphifyArgsOptions`, so both executor schemas pick this up automatically with no further `.d.ts` changes.

- [ ] **Step 1: Write the failing tests**

Append to `packages/nx-graphify/src/utils/build-args.spec.ts` (inside the existing `describe('buildGraphifyArgs', ...)` block, after the last existing `it`):

```ts
  it('adds --backend when provider.backend is set', () => {
    const options: GraphifyArgsOptions = { provider: { backend: 'openai' } };

    expect(buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--backend',
      'openai',
      '--project',
      'foo',
    ]);
  });

  it('adds --backend and --model when both provider.backend and provider.model are set', () => {
    const options: GraphifyArgsOptions = {
      provider: { backend: 'openai', model: 'gpt-4' },
    };

    expect(buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--backend',
      'openai',
      '--model',
      'gpt-4',
      '--project',
      'foo',
    ]);
  });

  it('omits --backend/--model when provider is not set', () => {
    expect(buildGraphifyArgs({}, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--project',
      'foo',
    ]);
  });

  it('throws when provider.model is set without provider.backend', () => {
    const options: GraphifyArgsOptions = { provider: { model: 'gpt-4' } };

    expect(() => buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toThrow(
      'provider.model requires provider.backend to be set (e.g. provider: { backend: "openai", model: "gpt-4" }).'
    );
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx nx test nx-graphify -t "buildGraphifyArgs"`
Expected: FAIL — `provider` isn't a recognized field yet / no `--backend` emitted.

- [ ] **Step 3: Implement `provider` support**

```ts
// packages/nx-graphify/src/utils/build-args.ts
export type ProviderBackend =
  | 'azure'
  | 'bedrock'
  | 'claude'
  | 'claude-cli'
  | 'deepseek'
  | 'gemini'
  | 'kimi'
  | 'ollama'
  | 'openai';

export interface GraphifyArgsOptions {
  mode?: 'normal' | 'deep';
  update?: boolean;
  clusterOnly?: boolean;
  noViz?: boolean;
  wiki?: boolean;
  obsidian?: boolean;
  svg?: boolean;
  graphml?: boolean;
  neo4j?: boolean;
  neo4jPush?: string;
  provider?: {
    backend?: ProviderBackend;
    model?: string;
  };
}

export function buildGraphifyArgs(
  options: GraphifyArgsOptions,
  targetPath: string,
  projectName: string,
): string[] {
  const args: string[] = [targetPath];
  if (options.mode === 'deep') args.push('--mode', 'deep');
  if (options.update) args.push('--update');
  if (options.clusterOnly) args.push('--cluster-only');
  if (options.noViz) args.push('--no-viz');
  if (options.wiki) args.push('--wiki');
  if (options.obsidian) args.push('--obsidian');
  if (options.svg) args.push('--svg');
  if (options.graphml) args.push('--graphml');
  if (options.neo4j) args.push('--neo4j');
  if (options.neo4jPush) args.push('--neo4j-push', options.neo4jPush);
  if (options.provider?.model && !options.provider?.backend) {
    throw new Error(
      'provider.model requires provider.backend to be set (e.g. provider: { backend: "openai", model: "gpt-4" }).',
    );
  }
  if (options.provider?.backend) {
    args.push('--backend', options.provider.backend);
    if (options.provider.model) {
      args.push('--model', options.provider.model);
    }
  }
  args.push('--project', projectName);
  return args;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx nx test nx-graphify -t "buildGraphifyArgs"`
Expected: PASS (all tests, including pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add packages/nx-graphify/src/utils/build-args.ts packages/nx-graphify/src/utils/build-args.spec.ts
git commit -m "feat(nx-graphify): add provider.backend/provider.model extraction option"
```

---

### Task 5: Expose `provider` in the executor JSON schemas

**Files:**
- Modify: `packages/nx-graphify/src/executors/graphify/schema.json`
- Modify: `packages/nx-graphify/src/executors/graphify-workspace/schema.json`

**Interfaces:**
- Consumes: `ProviderBackend` enum values from Task 4 (duplicated literally in JSON, same convention as `InstallAgent` enums elsewhere in this codebase).
- Produces: nothing new for later tasks — this is JSON-schema-only documentation/validation, the actual TS typing already flows through `GraphifyExecutorSchema extends GraphifyArgsOptions` (Task 4).

- [ ] **Step 1: Add the `provider` property to `graphify/schema.json`**

Insert after the `neo4jPush` property (before the closing `},\n  "required": []`):

```json
    "provider": {
      "type": "object",
      "description": "Select an LLM backend for extraction. provider.model requires provider.backend to also be set.",
      "properties": {
        "backend": {
          "type": "string",
          "enum": [
            "azure",
            "bedrock",
            "claude",
            "claude-cli",
            "deepseek",
            "gemini",
            "kimi",
            "ollama",
            "openai"
          ],
          "description": "LLM backend to use for extraction"
        },
        "model": {
          "type": "string",
          "description": "Free-text model identifier, only valid alongside provider.backend"
        }
      }
    }
```

- [ ] **Step 2: Apply the identical block to `graphify-workspace/schema.json`** (same property, same position, after `neo4jPush`).

- [ ] **Step 3: Validate both JSON files parse and the build still succeeds**

Run: `npx nx build nx-graphify`
Expected: build succeeds (schema.json files are copied as assets, not type-checked, but must be valid JSON — a syntax error would surface as a copy/parse failure in consumers, not the build itself; visually confirm with `node -e "JSON.parse(require('fs').readFileSync('packages/nx-graphify/src/executors/graphify/schema.json'))"` and the same for `graphify-workspace`).

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/nx-graphify/src/executors/graphify/schema.json'))" && node -e "JSON.parse(require('fs').readFileSync('packages/nx-graphify/src/executors/graphify-workspace/schema.json'))" && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add packages/nx-graphify/src/executors/graphify/schema.json packages/nx-graphify/src/executors/graphify-workspace/schema.json
git commit -m "feat(nx-graphify): document provider.backend/model in executor schemas"
```

---

### Task 6: `purge` executor (new)

**Files:**
- Create: `packages/nx-graphify/src/executors/purge/schema.json`
- Create: `packages/nx-graphify/src/executors/purge/schema.d.ts`
- Create: `packages/nx-graphify/src/executors/purge/executor.ts`
- Create: `packages/nx-graphify/src/executors/purge/executor.spec.ts`
- Modify: `packages/nx-graphify/executors.json`

**Interfaces:**
- Consumes: `checkGraphifyInstalled` from `../../utils/check-graphify`.
- Produces: default-exported `PromiseExecutor<PurgeExecutorSchema>`, `PurgeExecutorSchema { outputDir?: string }` — consumed by Task 7's `createNodes` wiring as `nx-graphify:purge`.

- [ ] **Step 1: Write the schema files**

```json
// packages/nx-graphify/src/executors/purge/schema.json
{
  "$schema": "https://json-schema.org/schema",
  "version": 2,
  "title": "Purge executor",
  "description": "Remove a project's or the workspace's graphify-out directory",
  "type": "object",
  "properties": {
    "outputDir": {
      "type": "string",
      "description": "Where Graphify outputs are written. graphify does not yet support a custom directory for `uninstall --purge` (always graphify-out) — kept here only so this target's outputs declaration matches the real on-disk path.",
      "default": "graphify-out"
    }
  },
  "required": []
}
```

```ts
// packages/nx-graphify/src/executors/purge/schema.d.ts
export interface PurgeExecutorSchema {
  outputDir?: string;
}
```

- [ ] **Step 2: Write the failing test**

```ts
// packages/nx-graphify/src/executors/purge/executor.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutorContext } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import executor from './executor';
import type { PurgeExecutorSchema } from './schema';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('../../utils/check-graphify', () => ({
  checkGraphifyInstalled: vi.fn(),
}));

const baseOptions: PurgeExecutorSchema = { outputDir: 'graphify-out' };

function makeContext(projectName: string, projectRoot: string): ExecutorContext {
  return {
    root: '/repo',
    cwd: '/repo',
    projectName,
    isVerbose: false,
    projectGraph: { nodes: {}, dependencies: {} },
    projectsConfigurations: {
      version: 2,
      projects: { [projectName]: { root: projectRoot } },
    },
    nxJsonConfiguration: {},
  } as unknown as ExecutorContext;
}

describe('purge executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await expect(executor(baseOptions, makeContext('foo', 'apps/foo'))).rejects.toThrow(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install'
    );
    expect(execSync).not.toHaveBeenCalled();
  });

  it('runs `graphify uninstall --project --purge` with cwd set to the project root', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const result = await executor(baseOptions, makeContext('foo', 'apps/foo'));

    expect(execSync).toHaveBeenCalledWith('graphify uninstall --project --purge', {
      stdio: 'inherit',
      cwd: '/repo/apps/foo',
    });
    expect(result).toEqual({ success: true });
  });

  it('runs with cwd set to the workspace root when the project root is "."', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await executor(baseOptions, makeContext('workspace', '.'));

    expect(execSync).toHaveBeenCalledWith('graphify uninstall --project --purge', {
      stdio: 'inherit',
      cwd: '/repo',
    });
  });

  it('returns success: false when execSync throws', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('graphify exited with code 1');
    });

    const result = await executor(baseOptions, makeContext('foo', 'apps/foo'));

    expect(result).toEqual({ success: false });
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx nx test nx-graphify -t "purge executor"`
Expected: FAIL with "Cannot find module './executor'".

- [ ] **Step 4: Write the executor implementation**

```ts
// packages/nx-graphify/src/executors/purge/executor.ts
import type { ExecutorContext, PromiseExecutor } from '@nx/devkit';
import { logger } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import type { PurgeExecutorSchema } from './schema';

const runExecutor: PromiseExecutor<PurgeExecutorSchema> = async (
  options,
  context: ExecutorContext,
) => {
  if (!checkGraphifyInstalled()) {
    throw new Error(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install',
    );
  }

  const projectName = context.projectName as string;
  const projectRoot = context.projectsConfigurations.projects[projectName].root;
  const cwd = projectRoot === '.' ? context.root : `${context.root}/${projectRoot}`;

  // graphify does not yet support a custom output directory for `uninstall --purge`
  // (it always purges its hard-coded `graphify-out`). `options.outputDir` is kept
  // on this schema only so the inferred target's `outputs` declaration matches the
  // real on-disk path. Once graphify adds a flag for this, wire it in here:
  // if (options.outputDir && options.outputDir !== 'graphify-out') {
  //   args.push('--output-dir', options.outputDir);
  // }
  const command = `graphify uninstall --project --purge`;

  logger.info(`Running: ${command}`);

  try {
    execSync(command, { stdio: 'inherit', cwd });
    return { success: true };
  } catch (error) {
    logger.error((error as Error).message);
    return { success: false };
  }
};

export default runExecutor;
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx nx test nx-graphify -t "purge executor"`
Expected: PASS (all 4 tests).

- [ ] **Step 6: Register the executor**

```json
// packages/nx-graphify/executors.json
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
    },
    "purge": {
      "implementation": "./dist/executors/purge/executor",
      "schema": "./dist/executors/purge/schema.json",
      "description": "Remove a project's or the workspace's graphify-out directory"
    }
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/nx-graphify/src/executors/purge packages/nx-graphify/executors.json
git commit -m "feat(nx-graphify): add purge executor"
```

---

### Task 7: Wire `purge` into `createNodes`, thread `provider` through plugin defaults

**Files:**
- Modify: `packages/nx-graphify/src/plugin/index.ts`
- Modify: `packages/nx-graphify/src/plugin/index.spec.ts`

**Interfaces:**
- Consumes: `nx-graphify:purge` executor string (Task 6, must match `executors.json` key exactly — `index.spec.ts` already has a test asserting every emitted executor string is registered in `executors.json`).
- Produces: every matched project (including workspace root) gets a `purge` target; `resolveGraphifyOptions` forwards `provider` when set.

- [ ] **Step 1: Write the failing tests** — append to `packages/nx-graphify/src/plugin/index.spec.ts`, inside `describe('createNodes', ...)`, after the existing tests:

```ts
  it('attaches an uncached purge target to every matched project, including workspace root', async () => {
    const result = await createNodesFunction(
      ['package.json', 'apps/foo/project.json'],
      {},
      fakeContext()
    );

    const projectsByRoot = Object.fromEntries(
      result.flatMap(([, { projects }]) => Object.entries(projects ?? {}))
    );

    expect(projectsByRoot['.'].targets!.purge).toEqual({
      executor: 'nx-graphify:purge',
      options: { outputDir: 'graphify-out' },
    });
    expect(projectsByRoot['apps/foo'].targets!.purge).toEqual({
      executor: 'nx-graphify:purge',
      options: { outputDir: 'graphify-out' },
    });
  });

  it('uses the resolved outputDir override for the purge target options', async () => {
    const result = await createNodesFunction(
      ['apps/foo/project.json'],
      { outputDir: 'custom-out' },
      fakeContext()
    );

    const [, { projects }] = result[0];
    expect(projects!['apps/foo'].targets!.purge).toEqual({
      executor: 'nx-graphify:purge',
      options: { outputDir: 'custom-out' },
    });
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx nx test nx-graphify -t "createNodes"`
Expected: FAIL — `targets!.purge` is `undefined`.

- [ ] **Step 3: Update `resolveGraphifyOptions` and `createNodes` to add the `purge` target and forward `provider`**

```ts
// packages/nx-graphify/src/plugin/index.ts
import type { CreateNodes, CreateNodesContext, TargetConfiguration } from '@nx/devkit';
import { createNodesFromFiles } from '@nx/devkit';
import { dirname } from 'node:path';
import type { GraphifyExecutorSchema } from '../executors/graphify/schema';
import type { GraphifyPluginOptions } from './schema';

const GRAPHIFY_CONFIG_GLOB = '{**/project.json,**/package.json}';

export function resolveGraphifyOptions(
  pluginOptions: GraphifyPluginOptions = {}
): GraphifyExecutorSchema {
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
    ...(pluginOptions.provider !== undefined && { provider: pluginOptions.provider }),
  };
}

export const createNodes: CreateNodes<GraphifyPluginOptions> = [
  GRAPHIFY_CONFIG_GLOB,
  (
    configFiles: readonly string[],
    options: GraphifyPluginOptions | undefined,
    context: CreateNodesContext
  ) => {
    return createNodesFromFiles(
      (configFile) => {
        const projectRoot = dirname(configFile);
        const resolvedOptions = resolveGraphifyOptions(options);

        const targets: Record<string, TargetConfiguration> = {
          graphify: {
            executor: 'nx-graphify:graphify',
            options: resolvedOptions,
            inputs: ['default', '^default'],
            outputs: [`{projectRoot}/${resolvedOptions.outputDir}`],
            cache: true,
          },
          purge: {
            executor: 'nx-graphify:purge',
            options: { outputDir: resolvedOptions.outputDir },
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
      configFiles,
      options ?? {},
      context
    );
  },
];

export const createNodesV2 = createNodes;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx nx test nx-graphify -t "createNodes"`
Expected: PASS (all tests, including the pre-existing "only emits executor strings that are registered in executors.json" test — `purge` is registered as of Task 6).

- [ ] **Step 5: Run the full unit suite for the package**

Run: `npx nx test nx-graphify`
Expected: all tests pass except the one pre-existing, unrelated failure in `executors/graphify-workspace/executor.spec.ts` ("runs graphify against the workspace root" — a pre-existing bug where `graphify-workspace`'s executor calls `buildGraphifyArgs(options, context.root)` without the required third `projectName` argument; out of scope for this plan, do not fix it here).

- [ ] **Step 6: Commit**

```bash
git add packages/nx-graphify/src/plugin/index.ts packages/nx-graphify/src/plugin/index.spec.ts
git commit -m "feat(nx-graphify): infer purge target on every project, forward provider option"
```

---

### Task 8: Scaffold the e2e project

**Files:**
- Generates: `e2e/src/nx-graphify.spec.ts`, `e2e/tsconfig.json`, `e2e/package.json`, `e2e/.spec.swcrc`, `e2e/tsconfig.spec.json`, `e2e/jest.config.cts`, `jest.preset.js`, `jest.config.ts`, `tools/scripts/start-local-registry.ts`, `tools/scripts/stop-local-registry.ts`, `tools/scripts/registry.d.ts`
- Modifies: `nx.json`, `package.json`, `.vscode/extensions.json`, `.gitignore`, `pnpm-workspace.yaml`

This uses the official `@nx/plugin:e2e-project` generator (already a devDependency in this workspace) rather than hand-writing Verdaccio/Jest plumbing. Confirmed via `--dry-run` during planning to land the project at `e2e/` (not `e2e-e2e/`) using `--rootProject`.

- [ ] **Step 1: Remove the placeholder `.gitkeep` so the directory isn't empty when the generator writes into it**

```bash
git rm e2e/.gitkeep
```

- [ ] **Step 2: Run the generator**

```bash
npx nx g @nx/plugin:e2e-project --pluginName=@fennet82/nx-graphify --npmPackageName=@fennet82/nx-graphify --pluginOutputPath=packages/nx-graphify/dist --useProjectJson --rootProject
```

Expected output (confirmed via `--dry-run` during planning):
```
CREATE e2e/src/nx-graphify.spec.ts
CREATE e2e/tsconfig.json
CREATE e2e/package.json
UPDATE nx.json
UPDATE package.json
CREATE jest.preset.js
CREATE jest.config.ts
CREATE e2e/.spec.swcrc
CREATE e2e/tsconfig.spec.json
CREATE e2e/jest.config.cts
UPDATE .vscode/extensions.json
UPDATE .gitignore
CREATE tools/scripts/start-local-registry.ts
CREATE tools/scripts/stop-local-registry.ts
CREATE tools/scripts/registry.d.ts
UPDATE pnpm-workspace.yaml
```

- [ ] **Step 3: Verify the generated e2e target runs against the unmodified boilerplate test** (validates Verdaccio + create-nx-workspace plumbing works before we add our own scenarios)

Run: `npx nx e2e e2e`
Expected: PASS — the generated `it('should be installed', ...)` test creates a real temp workspace via `create-nx-workspace`, starts the local registry, installs `@fennet82/nx-graphify` into it, and confirms via `pnpm list`. This step is slow (real network + registry); allow several minutes.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(nx-graphify): scaffold e2e project via @nx/plugin:e2e-project"
```

---

### Task 9: Real e2e scenarios for init, uninstall-agents, and purge

**Files:**
- Modify: `e2e/src/nx-graphify.spec.ts` (replace generated boilerplate body, keep the `createTestProject` helper)

**Interfaces:**
- Consumes: the live, registry-installed `@fennet82/nx-graphify` package (built from current source by Task 8's `dependsOn: ['^build']` wiring) and the generators/executor registered in Tasks 2/3/6/7.

- [ ] **Step 1: Replace the file with the full scenario suite**

```ts
// e2e/src/nx-graphify.spec.ts
import { execSync, type ExecSyncOptions } from 'child_process';
import { join, dirname } from 'path';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';

describe('nx-graphify', () => {
  let projectDirectory: string;
  let fakeGraphifyBinDir: string;
  let graphifyLogFile: string;
  let execOptions: ExecSyncOptions;

  beforeAll(() => {
    projectDirectory = createTestProject();

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
      ].join('\n')
    );
    chmodSync(join(fakeGraphifyBinDir, 'graphify'), 0o755);

    execOptions = {
      cwd: projectDirectory,
      stdio: 'inherit',
      env: { ...process.env, PATH: `${fakeGraphifyBinDir}:${process.env.PATH}` },
    };
  });

  afterAll(() => {
    if (projectDirectory) {
      rmSync(projectDirectory, { recursive: true, force: true });
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
      execOptions
    );

    const log = readFileSync(graphifyLogFile, 'utf-8');
    expect(log).toContain('uninstall --project --platform claude');
  });

  it('runs `graphify uninstall --project --purge` via the inferred purge target', () => {
    const projects = JSON.parse(
      execSync('npx nx show projects', execOptions as { cwd: string; env: NodeJS.ProcessEnv })
        .toString()
    ) as string[];
    expect(projects.length).toBeGreaterThan(0);

    execSync(`npx nx run ${projects[0]}:purge`, execOptions);

    const log = readFileSync(graphifyLogFile, 'utf-8');
    expect(log).toContain('uninstall --project --purge');
  });
});

/**
 * Creates a test project with create-nx-workspace and installs the plugin
 * @returns The directory where the test project was created
 */
function createTestProject() {
  const projectName = 'test-project';
  const projectDirectory = join(process.cwd(), 'tmp', projectName);

  rmSync(projectDirectory, { recursive: true, force: true });
  mkdirSync(dirname(projectDirectory), { recursive: true });

  execSync(
    `pnpm dlx create-nx-workspace@latest ${projectName} --preset apps --nxCloud=skip --no-interactive`,
    {
      cwd: dirname(projectDirectory),
      stdio: 'inherit',
      env: process.env,
    }
  );
  console.log(`Created test project in "${projectDirectory}"`);

  return projectDirectory;
}
```

Note: `execSync(..., execOptions as ...)` returns a `Buffer` by default; `.toString()` on it is required for the `JSON.parse` call above to work — `execSync` returns `Buffer` unless `encoding` is set, and `execOptions` doesn't set one, so this is correct.

- [ ] **Step 2: Run the full e2e suite**

Run: `npx nx e2e e2e`
Expected: PASS — all 4 tests (`should be installed`, init, uninstall-agents, purge). This is slow (real `create-nx-workspace` + registry); allow several minutes.

- [ ] **Step 3: Commit**

```bash
git add e2e/src/nx-graphify.spec.ts
git commit -m "test(nx-graphify): add e2e coverage for init, uninstall-agents, purge"
```

---

### Task 10: Docs — README, CONTRIBUTING, RELEASE, PR template

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `RELEASE.md`
- Modify: `PULL_REQUEST_TEMPLATE.md`

This task has no test cycle of its own (docs); verify by reading the rendered files back and cross-checking every command mentioned actually exists in `package.json`/`nx.json` at the time of writing.

- [ ] **Step 1: Rewrite `README.md`** to document the package structure and the full command surface added in this plan, replacing the current minimal file:

```markdown
# nx-graphify

Nx workspace containing the `nx-graphify` plugin — wraps the
[graphify](https://github.com/safishamsi/graphify) CLI as a self-inferring
Nx plugin.

## Structure

```
packages/nx-graphify/   the published plugin (@fennet82/nx-graphify)
  src/
    executors/          graphify, graphify-workspace, purge
    generators/         init, uninstall-agents
    plugin/             createNodes target inference
    utils/              shared CLI-arg building, agent/backend enums
e2e/                    end-to-end tests against a local npm registry
docs/superpowers/       design specs and implementation plans
```

See [docs/superpowers/specs](./docs/superpowers/specs) for design specs and
[docs/superpowers/plans](./docs/superpowers/plans) for implementation plans.

## Setup

Register the plugin in your `nx.json`:

```json
{
  "plugins": ["@fennet82/nx-graphify/plugin"]
}
```

This infers a `graphify` target on every project, a `graphify-workspace`
target and a `purge` target on the workspace root, and a `purge` target on
every other project too.

## Commands

| Command | What it runs |
| --- | --- |
| `nx run <project>:graphify` | `graphify <projectRoot> [flags] --project <project>` |
| `nx run <root>:graphify-workspace` | `graphify <workspaceRoot> [flags] --project <root>` |
| `nx run <project>:purge` | `graphify uninstall --project --purge` (cwd = that project's root) |
| `nx g @fennet82/nx-graphify:init --installAgent=claude` | `graphify install --project --platforms claude` |
| `nx g @fennet82/nx-graphify:uninstall-agents --agent=claude` | `graphify uninstall --project --platform claude` |

`init` and `uninstall-agents` always run from the workspace root. `purge` can
run on any project, or the workspace root, since each cleans only that
project's own `graphify-out` directory.

Extraction targets (`graphify`/`graphify-workspace`) also accept
`provider.backend` (one of `azure`, `bedrock`, `claude`, `claude-cli`,
`deepseek`, `gemini`, `kimi`, `ollama`, `openai`) and an optional free-text
`provider.model`, e.g.:

```json
{
  "targets": {
    "graphify": {
      "options": { "provider": { "backend": "openai", "model": "gpt-4" } }
    }
  }
}
```

## Development

```bash
pnpm install
npx nx build nx-graphify
npx nx test nx-graphify
npx nx e2e e2e
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full contributor workflow
and [RELEASE.md](./RELEASE.md) for the release process.
```

- [ ] **Step 2: Read the current `CONTRIBUTING.md`** (already edited by the repo owner) and align its commands with this repo's actual tooling — replace any `npm`/Yarn-specific instructions with the `pnpm` equivalents actually used here, and add the e2e command:

Run: `! cat CONTRIBUTING.md` (or read the file directly) to get the current text before editing, then update at minimum:
- `npm i` → `pnpm install`
- `npm run build {plugin}` → `npx nx build {plugin}` (e.g. `npx nx build nx-graphify`)
- `npm run test {plugin}` → `npx nx test {plugin}`
- `npm run e2e {plugin}` → `npx nx e2e e2e`
- the `yarn link`/`npm link` "Testing Locally" section → replace with the local-registry flow already wired up by Task 8 (`npx nx local-registry`, then `pnpm add @fennet82/nx-graphify --registry http://localhost:4873` in a separate test workspace)
- any `@berenddeboer/{plugin}` references → `@fennet82/{plugin}`

Implementer note: read the file's current content first (it was edited directly by the repo owner in this session) and make targeted edits preserving their structure/headings — don't replace the whole file wholesale.

- [ ] **Step 3: Touch up `RELEASE.md`**

- Update "Package Information" section's package list/versions to include `@fennet82/nx-graphify` (current version `1.0.0`, per `packages/nx-graphify/package.json`) instead of (or alongside) the `@berenddeboer/nx-aws-cdk`/`@berenddeboer/nx-sst` entries, which don't exist in this repo's `packages/` directory — confirm via `ls packages/` before editing, and remove any package entries that don't correspond to a real package in this workspace.
- Update the **Repository**/**Organization** values in the Trusted Publishing instructions from `berenddeboer/nx-plugins` to `fennet82/nx-plugins`, matching `package.json`'s `repository.url`.

- [ ] **Step 4: Touch up `PULL_REQUEST_TEMPLATE.md`**

Add an explicit e2e checklist item distinguishing it from the existing generic "e2e tests have been added or updated if necessary" line, since e2e tests now exist in this repo as of this plan:

```markdown
# Description

# PR Checklist

- [ ] Migrations have been added if necessary
- [ ] Unit tests have been added or updated if necessary
- [ ] e2e tests have been added or updated if necessary (`npx nx e2e e2e`)
- [ ] Changelog has been updated if necessary
- [ ] Documentation has been updated if necessary
- [ ] `npx nx test`, `npx nx lint`, and `npx nx build` pass for all affected projects

# Issue

Resolves #
```

- [ ] **Step 5: Commit**

```bash
git add README.md CONTRIBUTING.md RELEASE.md PULL_REQUEST_TEMPLATE.md
git commit -m "docs: update README/CONTRIBUTING/RELEASE/PR template for uninstall-agents, purge, provider option, and e2e"
```

---

## Self-Review Notes

- **Spec coverage:** `--project` flag (Tasks 2, 3, 6) ✓; `uninstall-agents` generator (Task 3) ✓; `purge` inferred target (Tasks 6–7) ✓; `provider.backend`/`provider.model` (Tasks 4–5) ✓; shared types (Task 1) ✓; unit tests (every task) ✓; e2e (Tasks 8–9) ✓; docs (Task 10) ✓; "no bare remove-everything generator" — honored by omission (no such task exists) ✓.
- **Out-of-scope guard:** the pre-existing `graphify-workspace` executor bug (missing `projectName` arg to `buildGraphifyArgs`) is explicitly called out in Task 7 Step 5 as known and unrelated, not silently left unexplained.
- **Type/name consistency checked:** `InstallAgent` (Task 1) used identically in `init` (existing) and `uninstall-agents` (Task 3) schemas; `ProviderBackend` (Task 4) flows into `GraphifyExecutorSchema` via `extends GraphifyArgsOptions` with no separate redeclaration needed in Task 5; `nx-graphify:purge` executor string (Task 6's `executors.json` key `purge`) matches exactly what Task 7's `createNodes` emits, satisfying the existing "only emits executor strings that are registered in executors.json" test.
