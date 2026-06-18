# nx-graphify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `nx-graphify` Nx plugin — two executors (`graphify`, `graphify-workspace`) and an `init` generator that wrap the Graphify Python CLI as cacheable Nx targets.

**Architecture:** A pnpm/Nx monorepo at the repo root containing a single publishable package, `packages/nx-graphify`. Executors are thin wrappers that validate the CLI is installed, build a CLI args array via a pure utility function, and shell out via `execSync`. The `init` generator scaffolds the `graphify` target onto project configurations using `@nx/devkit`'s Tree API.

**Tech Stack:** TypeScript, `@nx/devkit`, `@nx/plugin` (dev-only, for scaffolding), Vitest (matches the rest of the workspace), pnpm.

**Reference spec:** `docs/superpowers/specs/2026-06-18-nx-graphify-design.md`

---

## Task 1: Scaffold the Nx workspace

`create-nx-workspace` refuses to scaffold into a non-empty directory, and this repo already has `.git` and `docs/`. Scaffold into a temp directory, then move the generated files in (excluding `.git`).

**Files:**
- Create (via tool, not by hand): `package.json`, `nx.json`, `tsconfig.json`, `tsconfig.base.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `vitest.config.ts`, `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `.vscode/extensions.json`, `.verdaccio/config.yml`, `README.md` at repo root
- Remove after move: `CLAUDE.md`, `AGENTS.md`, `opencode.json`, `.opencode/`, `.gemini/`, `.cursor/`, `.codex/`, `.claude/`, `.agents/`, `packages/utils/`, `packages/strings/`, `packages/colors/`, `packages/async/` (template's AI-agent boilerplate and sample libs — not needed for this plugin)

- [ ] **Step 1: Scaffold into a temp directory**

```bash
rm -rf /tmp/nx-graphify-scaffold
CLAUDECODE=1 npx --yes create-nx-workspace@latest /tmp/nx-graphify-scaffold \
  --template=typescript --pm=pnpm --interactive=false --skipGit \
  --nxCloud=skip --useGitHub=false
```

Expected: JSON progress lines ending with `"stage":"complete","success":true`.

- [ ] **Step 2: Move generated files into the repo, excluding `.git`**

```bash
cd /home/fennet/git_repos/nx-graphify
rsync -a --exclude='.git' /tmp/nx-graphify-scaffold/ ./
rm -rf /tmp/nx-graphify-scaffold
```

Expected: `ls -la` now shows `package.json`, `nx.json`, `pnpm-workspace.yaml`, `packages/`, etc. alongside the existing `docs/` and `.git/`.

- [ ] **Step 3: Remove unneeded AI-agent boilerplate and sample packages**

```bash
rm -rf CLAUDE.md AGENTS.md opencode.json .opencode .gemini .cursor .codex .claude .agents
rm -rf packages/utils packages/strings packages/colors packages/async
```

- [ ] **Step 4: Remove the now-dangling references in root `tsconfig.json`**

Edit `tsconfig.json` at repo root — remove the `references` entries for the deleted packages, keeping only `nx-graphify` (which doesn't exist yet, so remove the whole array entry too; Task 2 will add it back):

```json
{
  "extends": "./tsconfig.base.json",
  "compileOnSave": false,
  "files": [],
  "references": []
}
```

- [ ] **Step 5: Remove the now-dangling `release.projects` entries in `nx.json`**

Edit `nx.json` — change:

```json
  "release": {
    "projects": ["*", "!utils", "!@org/source"],
```

to:

```json
  "release": {
    "projects": ["*", "!@org/source"],
```

- [ ] **Step 6: Install dependencies and verify Nx runs**

```bash
pnpm install
npx nx --version
```

Expected: prints the installed Nx version with no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Scaffold Nx/pnpm workspace for nx-graphify"
```

---

## Task 2: Generate the `nx-graphify` package skeleton

**Files:**
- Modify: root `package.json` (adds `@nx/plugin` devDependency, `@nx/devkit` becomes available)
- Create: `packages/nx-graphify/package.json`, `tsconfig.json`, `tsconfig.lib.json`, `src/index.ts`, `README.md`
- Modify: root `tsconfig.json` (adds reference), root `nx.json` (release projects)

- [ ] **Step 1: Add the `@nx/plugin` dev dependency**

```bash
pnpm add -D @nx/plugin@23.0.0
```

- [ ] **Step 2: Run the plugin generator**

```bash
npx nx g @nx/plugin:plugin packages/nx-graphify --publishable --importPath=nx-graphify --no-interactive
```

Expected output includes:
```
CREATE packages/nx-graphify/tsconfig.lib.json
CREATE packages/nx-graphify/tsconfig.json
UPDATE tsconfig.json
CREATE packages/nx-graphify/src/index.ts
CREATE packages/nx-graphify/README.md
CREATE packages/nx-graphify/package.json
UPDATE nx.json
UPDATE package.json
```

- [ ] **Step 3: Verify the build target works on the empty skeleton**

```bash
npx nx build nx-graphify
```

Expected: `NX   Successfully ran target build for project nx-graphify`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Generate nx-graphify plugin package skeleton"
```

---

## Task 3: `utils/check-graphify.ts`

**Files:**
- Create: `packages/nx-graphify/src/utils/check-graphify.ts`
- Create: `packages/nx-graphify/src/utils/check-graphify.spec.ts`
- Create: `packages/nx-graphify/vite.config.ts` (enables Vitest for this package, modeled on the deleted `packages/async/vite.config.ts`)
- Create: `packages/nx-graphify/tsconfig.spec.json`
- Modify: `packages/nx-graphify/tsconfig.json` (add reference to `tsconfig.spec.json`)

- [ ] **Step 1: Wire up Vitest for this package**

Create `packages/nx-graphify/vite.config.ts`:

```ts
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/nx-graphify',
  plugins: [],
  test: {
    name: 'nx-graphify',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
```

Create `packages/nx-graphify/tsconfig.spec.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./out-tsc/vitest",
    "types": ["vitest/globals", "vitest/importMeta", "vite/client", "node", "vitest"],
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "vite.config.ts",
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "src/**/*.d.ts"
  ],
  "references": [{ "path": "./tsconfig.lib.json" }]
}
```

Edit `packages/nx-graphify/tsconfig.json` to add the spec reference:

```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.lib.json" },
    { "path": "./tsconfig.spec.json" }
  ]
}
```

- [ ] **Step 2: Write the failing test**

Create `packages/nx-graphify/src/utils/check-graphify.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from './check-graphify';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('checkGraphifyInstalled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when `graphify --version` succeeds', () => {
    (execSync as ReturnType<typeof vi.fn>).mockReturnValue(Buffer.from(''));

    expect(checkGraphifyInstalled()).toBe(true);
    expect(execSync).toHaveBeenCalledWith('graphify --version', {
      stdio: 'ignore',
    });
  });

  it('returns false when `graphify --version` throws', () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('command not found');
    });

    expect(checkGraphifyInstalled()).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx nx test nx-graphify
```

Expected: FAIL — `Cannot find module './check-graphify'` (or similar, since the source file doesn't exist yet).

- [ ] **Step 4: Write the implementation**

Create `packages/nx-graphify/src/utils/check-graphify.ts`:

```ts
import { execSync } from 'child_process';

export function checkGraphifyInstalled(): boolean {
  try {
    execSync('graphify --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx nx test nx-graphify
```

Expected: PASS — 2 tests passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add checkGraphifyInstalled utility"
```

---

## Task 4: `utils/build-args.ts`

**Files:**
- Create: `packages/nx-graphify/src/utils/build-args.ts`
- Create: `packages/nx-graphify/src/utils/build-args.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/nx-graphify/src/utils/build-args.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildGraphifyArgs, type GraphifyArgsOptions } from './build-args';

describe('buildGraphifyArgs', () => {
  it('returns just the target path and --project for default options', () => {
    const options: GraphifyArgsOptions = {};

    expect(buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--project',
      'foo',
    ]);
  });

  it('adds --mode deep when mode is "deep"', () => {
    const options: GraphifyArgsOptions = { mode: 'deep' };

    expect(buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--mode',
      'deep',
      '--project',
      'foo',
    ]);
  });

  it('omits --mode when mode is "normal"', () => {
    const options: GraphifyArgsOptions = { mode: 'normal' };

    expect(buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--project',
      'foo',
    ]);
  });

  it('adds every boolean flag when set', () => {
    const options: GraphifyArgsOptions = {
      update: true,
      clusterOnly: true,
      noViz: true,
      wiki: true,
      obsidian: true,
      svg: true,
      graphml: true,
      neo4j: true,
    };

    expect(buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--update',
      '--cluster-only',
      '--no-viz',
      '--wiki',
      '--obsidian',
      '--svg',
      '--graphml',
      '--neo4j',
      '--project',
      'foo',
    ]);
  });

  it('adds --neo4j-push with its value when set', () => {
    const options: GraphifyArgsOptions = { neo4jPush: 'bolt://localhost:7687' };

    expect(buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--neo4j-push',
      'bolt://localhost:7687',
      '--project',
      'foo',
    ]);
  });

  it('omits boolean flags that are false', () => {
    const options: GraphifyArgsOptions = {
      update: false,
      clusterOnly: false,
      noViz: false,
      wiki: false,
      obsidian: false,
      svg: false,
      graphml: false,
      neo4j: false,
    };

    expect(buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--project',
      'foo',
    ]);
  });

  it('always appends --project last, using the workspace constant for graphify-workspace', () => {
    expect(buildGraphifyArgs({}, '/repo', 'workspace')).toEqual([
      '/repo',
      '--project',
      'workspace',
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx nx test nx-graphify
```

Expected: FAIL — `Cannot find module './build-args'`.

- [ ] **Step 3: Write the implementation**

Create `packages/nx-graphify/src/utils/build-args.ts`:

```ts
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
}

export function buildGraphifyArgs(
  options: GraphifyArgsOptions,
  targetPath: string,
  projectName: string
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
  args.push('--project', projectName);
  return args;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx nx test nx-graphify
```

Expected: PASS — 7 new tests passed (9 total including Task 3's).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add buildGraphifyArgs utility"
```

---

## Task 5: `executors/graphify`

**Files:**
- Create: `packages/nx-graphify/src/executors/graphify/schema.json`
- Create: `packages/nx-graphify/src/executors/graphify/schema.d.ts`
- Create: `packages/nx-graphify/src/executors/graphify/executor.ts`
- Create: `packages/nx-graphify/src/executors/graphify/executor.spec.ts`

- [ ] **Step 1: Write the schema**

Create `packages/nx-graphify/src/executors/graphify/schema.json`:

```json
{
  "$schema": "https://json-schema.org/schema",
  "version": 2,
  "title": "Graphify executor",
  "description": "Run Graphify on a single Nx project",
  "type": "object",
  "properties": {
    "outputDir": {
      "type": "string",
      "description": "Where Graphify outputs are written",
      "default": "graphify-out"
    },
    "mode": {
      "type": "string",
      "enum": ["normal", "deep"],
      "description": "Extraction mode: \"normal\" or \"deep\" (more aggressive inference)",
      "default": "normal"
    },
    "update": {
      "type": "boolean",
      "description": "Re-extract changed files only, merge into the existing graph",
      "default": false
    },
    "clusterOnly": {
      "type": "boolean",
      "description": "Rerun clustering without re-extraction",
      "default": false
    },
    "noViz": {
      "type": "boolean",
      "description": "Skip graph.html, produce report + JSON only",
      "default": false
    },
    "wiki": {
      "type": "boolean",
      "description": "Export Wikipedia-style markdown per community",
      "default": false
    },
    "obsidian": {
      "type": "boolean",
      "description": "Export an Obsidian vault",
      "default": false
    },
    "svg": {
      "type": "boolean",
      "description": "Export graph.svg",
      "default": false
    },
    "graphml": {
      "type": "boolean",
      "description": "Export graph.graphml (Gephi/yEd)",
      "default": false
    },
    "neo4j": {
      "type": "boolean",
      "description": "Generate cypher.txt",
      "default": false
    },
    "neo4jPush": {
      "type": "string",
      "description": "bolt:// URL to push directly to Neo4j"
    }
  },
  "required": []
}
```

Create `packages/nx-graphify/src/executors/graphify/schema.d.ts`:

```ts
import type { GraphifyArgsOptions } from '../../utils/build-args';

export interface GraphifyExecutorSchema extends GraphifyArgsOptions {
  outputDir: string;
}
```

- [ ] **Step 2: Write the failing tests**

Create `packages/nx-graphify/src/executors/graphify/executor.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutorContext } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import executor from './executor';
import type { GraphifyExecutorSchema } from './schema';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('../../utils/check-graphify', () => ({
  checkGraphifyInstalled: vi.fn(),
}));

const baseOptions: GraphifyExecutorSchema = { outputDir: 'graphify-out' };

function makeContext(): ExecutorContext {
  return {
    root: '/repo',
    cwd: '/repo',
    isVerbose: false,
    projectName: 'foo',
    projectGraph: { nodes: {}, dependencies: {} },
    projectsConfigurations: {
      version: 2,
      projects: {
        foo: { root: 'apps/foo' },
      },
    },
    nxJsonConfiguration: {},
  } as unknown as ExecutorContext;
}

describe('graphify executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await expect(executor(baseOptions, makeContext())).rejects.toThrow(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install'
    );
    expect(execSync).not.toHaveBeenCalled();
  });

  it('runs graphify with the resolved project root and cwd, returning success', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (execSync as ReturnType<typeof vi.fn>).mockReturnValue(Buffer.from(''));

    const result = await executor(baseOptions, makeContext());

    expect(result).toEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith('graphify apps/foo --project foo', {
      stdio: 'inherit',
      cwd: '/repo',
    });
  });

  it('returns success: false and logs when execSync throws', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('graphify exited with code 1');
    });

    const result = await executor(baseOptions, makeContext());

    expect(result).toEqual({ success: false });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
npx nx test nx-graphify
```

Expected: FAIL — `Cannot find module './executor'`.

- [ ] **Step 4: Write the implementation**

Create `packages/nx-graphify/src/executors/graphify/executor.ts`:

```ts
import type { ExecutorContext, PromiseExecutor } from '@nx/devkit';
import { logger } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import { buildGraphifyArgs } from '../../utils/build-args';
import type { GraphifyExecutorSchema } from './schema';

const runExecutor: PromiseExecutor<GraphifyExecutorSchema> = async (
  options,
  context: ExecutorContext
) => {
  if (!checkGraphifyInstalled()) {
    throw new Error(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install'
    );
  }

  const projectName = context.projectName as string;
  const projectRoot = context.projectsConfigurations.projects[projectName].root;
  const args = buildGraphifyArgs(options, projectRoot, projectName);
  const command = `graphify ${args.join(' ')}`;

  logger.info(`Running: ${command}`);

  try {
    execSync(command, { stdio: 'inherit', cwd: context.root });
    return { success: true };
  } catch (error) {
    logger.error((error as Error).message);
    return { success: false };
  }
};

export default runExecutor;
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx nx test nx-graphify
```

Expected: PASS — 3 new tests passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add graphify executor"
```

---

## Task 6: `executors/graphify-workspace`

**Files:**
- Create: `packages/nx-graphify/src/executors/graphify-workspace/schema.json`
- Create: `packages/nx-graphify/src/executors/graphify-workspace/schema.d.ts`
- Create: `packages/nx-graphify/src/executors/graphify-workspace/executor.ts`
- Create: `packages/nx-graphify/src/executors/graphify-workspace/executor.spec.ts`

- [ ] **Step 1: Write the schema**

Create `packages/nx-graphify/src/executors/graphify-workspace/schema.json` — identical to the `graphify` schema, with an updated title/description:

```json
{
  "$schema": "https://json-schema.org/schema",
  "version": 2,
  "title": "Graphify workspace executor",
  "description": "Run Graphify on the entire workspace",
  "type": "object",
  "properties": {
    "outputDir": {
      "type": "string",
      "description": "Where Graphify outputs are written",
      "default": "graphify-out"
    },
    "mode": {
      "type": "string",
      "enum": ["normal", "deep"],
      "description": "Extraction mode: \"normal\" or \"deep\" (more aggressive inference)",
      "default": "normal"
    },
    "update": {
      "type": "boolean",
      "description": "Re-extract changed files only, merge into the existing graph",
      "default": false
    },
    "clusterOnly": {
      "type": "boolean",
      "description": "Rerun clustering without re-extraction",
      "default": false
    },
    "noViz": {
      "type": "boolean",
      "description": "Skip graph.html, produce report + JSON only",
      "default": false
    },
    "wiki": {
      "type": "boolean",
      "description": "Export Wikipedia-style markdown per community",
      "default": false
    },
    "obsidian": {
      "type": "boolean",
      "description": "Export an Obsidian vault",
      "default": false
    },
    "svg": {
      "type": "boolean",
      "description": "Export graph.svg",
      "default": false
    },
    "graphml": {
      "type": "boolean",
      "description": "Export graph.graphml (Gephi/yEd)",
      "default": false
    },
    "neo4j": {
      "type": "boolean",
      "description": "Generate cypher.txt",
      "default": false
    },
    "neo4jPush": {
      "type": "string",
      "description": "bolt:// URL to push directly to Neo4j"
    }
  },
  "required": []
}
```

Create `packages/nx-graphify/src/executors/graphify-workspace/schema.d.ts`:

```ts
import type { GraphifyArgsOptions } from '../../utils/build-args';

export interface GraphifyWorkspaceExecutorSchema extends GraphifyArgsOptions {
  outputDir: string;
}
```

- [ ] **Step 2: Write the failing tests**

Create `packages/nx-graphify/src/executors/graphify-workspace/executor.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutorContext } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import executor from './executor';
import type { GraphifyWorkspaceExecutorSchema } from './schema';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('../../utils/check-graphify', () => ({
  checkGraphifyInstalled: vi.fn(),
}));

const baseOptions: GraphifyWorkspaceExecutorSchema = { outputDir: 'graphify-out' };

function makeContext(): ExecutorContext {
  return {
    root: '/repo',
    cwd: '/repo',
    isVerbose: false,
    projectGraph: { nodes: {}, dependencies: {} },
    projectsConfigurations: { version: 2, projects: {} },
    nxJsonConfiguration: {},
  } as unknown as ExecutorContext;
}

describe('graphify-workspace executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await expect(executor(baseOptions, makeContext())).rejects.toThrow(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install'
    );
    expect(execSync).not.toHaveBeenCalled();
  });

  it('runs graphify against the workspace root', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (execSync as ReturnType<typeof vi.fn>).mockReturnValue(Buffer.from(''));

    const result = await executor(baseOptions, makeContext());

    expect(result).toEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith('graphify /repo --project workspace', {
      stdio: 'inherit',
      cwd: '/repo',
    });
  });

  it('returns success: false when execSync throws', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('graphify exited with code 1');
    });

    const result = await executor(baseOptions, makeContext());

    expect(result).toEqual({ success: false });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
npx nx test nx-graphify
```

Expected: FAIL — `Cannot find module './executor'`.

- [ ] **Step 4: Write the implementation**

Create `packages/nx-graphify/src/executors/graphify-workspace/executor.ts`:

```ts
import type { ExecutorContext, PromiseExecutor } from '@nx/devkit';
import { logger } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import { buildGraphifyArgs } from '../../utils/build-args';
import type { GraphifyWorkspaceExecutorSchema } from './schema';

const runExecutor: PromiseExecutor<GraphifyWorkspaceExecutorSchema> = async (
  options,
  context: ExecutorContext
) => {
  if (!checkGraphifyInstalled()) {
    throw new Error(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install'
    );
  }

  const args = buildGraphifyArgs(options, context.root, 'workspace');
  const command = `graphify ${args.join(' ')}`;

  logger.info(`Running: ${command}`);

  try {
    execSync(command, { stdio: 'inherit', cwd: context.root });
    return { success: true };
  } catch (error) {
    logger.error((error as Error).message);
    return { success: false };
  }
};

export default runExecutor;
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx nx test nx-graphify
```

Expected: PASS — 3 new tests passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add graphify-workspace executor"
```

---

## Task 7: Wire up `executors.json` and `package.json`

**Files:**
- Create: `packages/nx-graphify/executors.json`
- Modify: `packages/nx-graphify/package.json`

- [ ] **Step 1: Create `executors.json`**

Create `packages/nx-graphify/executors.json`:

```json
{
  "executors": {
    "graphify": {
      "implementation": "./dist/executors/graphify/executor",
      "schema": "./dist/executors/graphify/schema.json",
      "description": "Run Graphify on a single Nx project",
      "inputs": ["default", "^default"],
      "outputs": ["{options.outputDir}"]
    },
    "graphify-workspace": {
      "implementation": "./dist/executors/graphify-workspace/executor",
      "schema": "./dist/executors/graphify-workspace/schema.json",
      "description": "Run Graphify on the entire workspace",
      "inputs": ["default", "^default"],
      "outputs": ["{options.outputDir}"]
    }
  }
}
```

- [ ] **Step 2: Point `package.json` at it**

Edit `packages/nx-graphify/package.json` — add `"executors": "./executors.json"` and add `"executors.json"` to the `files` array:

```json
  "files": [
    "dist",
    "!**/*.tsbuildinfo",
    "executors.json"
  ],
```

```json
  "executors": "./executors.json"
```

- [ ] **Step 3: Build and verify the schema/implementation paths resolve**

```bash
npx nx build nx-graphify
test -f packages/nx-graphify/dist/executors/graphify/executor.js && echo OK
test -f packages/nx-graphify/dist/executors/graphify/schema.json && echo OK
test -f packages/nx-graphify/dist/executors/graphify-workspace/executor.js && echo OK
```

Expected: three `OK` lines.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Wire up executors.json"
```

---

## Task 8: `generators/init`

**Files:**
- Create: `packages/nx-graphify/src/generators/init/schema.json`
- Create: `packages/nx-graphify/src/generators/init/schema.d.ts`
- Create: `packages/nx-graphify/src/generators/init/generator.ts`
- Create: `packages/nx-graphify/src/generators/init/generator.spec.ts`

- [ ] **Step 1: Write the schema**

Create `packages/nx-graphify/src/generators/init/schema.json`:

```json
{
  "$schema": "https://json-schema.org/schema",
  "$id": "NxGraphifyInit",
  "title": "Add graphify targets to Nx projects",
  "type": "object",
  "properties": {
    "project": {
      "type": "string",
      "description": "Specific project name to add the graphify target to"
    },
    "all": {
      "type": "boolean",
      "description": "Add the graphify target to all projects",
      "default": false
    },
    "installAgent": {
      "type": "string",
      "description": "Optionally run `graphify <agent> install` for your AI coding assistant",
      "enum": [
        "none",
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
      ],
      "default": "none"
    }
  },
  "required": []
}
```

Create `packages/nx-graphify/src/generators/init/schema.d.ts`:

```ts
export type InstallAgent =
  | 'none'
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

export interface InitGeneratorSchema {
  project?: string;
  all?: boolean;
  installAgent?: InstallAgent;
}
```

- [ ] **Step 2: Write the failing tests**

Create `packages/nx-graphify/src/generators/init/generator.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addProjectConfiguration, logger, readProjectConfiguration, type Tree } from '@nx/devkit';
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
    addProjectConfiguration(tree, 'foo', { root: 'apps/foo', targets: {} });
    addProjectConfiguration(tree, 'bar', { root: 'apps/bar', targets: {} });
  });

  it('throws when neither project nor all is set', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await expect(initGenerator(tree, {})).rejects.toThrow(
      'You must specify either --project=<name> or --all to add the graphify target.'
    );
  });

  it('adds the graphify target to the specified project only', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await initGenerator(tree, { project: 'foo' });

    const foo = readProjectConfiguration(tree, 'foo');
    expect(foo.targets?.graphify).toEqual({
      executor: 'nx-graphify:graphify',
      options: { outputDir: 'graphify-out' },
    });

    const bar = readProjectConfiguration(tree, 'bar');
    expect(bar.targets?.graphify).toBeUndefined();
  });

  it('adds the graphify target to every project when all is set', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await initGenerator(tree, { all: true });

    expect(readProjectConfiguration(tree, 'foo').targets?.graphify).toBeDefined();
    expect(readProjectConfiguration(tree, 'bar').targets?.graphify).toBeDefined();
  });

  it('warns instead of throwing when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    await initGenerator(tree, { project: 'foo' });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install'
      )
    );
    expect(readProjectConfiguration(tree, 'foo').targets?.graphify).toBeDefined();
  });

  it('runs `graphify <agent> install` after scaffolding when installAgent is set and graphify is installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await initGenerator(tree, { project: 'foo', installAgent: 'claude' });

    expect(execSync).toHaveBeenCalledWith('graphify claude install', {
      stdio: 'inherit',
    });
  });

  it('skips agent installation and warns when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    await initGenerator(tree, { project: 'foo', installAgent: 'claude' });

    expect(execSync).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Skipping agent installation — graphify must be installed first. Run `graphify claude install` manually after installing graphify.'
      )
    );
  });

  it('does not run agent installation when installAgent is "none"', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await initGenerator(tree, { project: 'foo', installAgent: 'none' });

    expect(execSync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
npx nx test nx-graphify
```

Expected: FAIL — `Cannot find module './generator'`.

- [ ] **Step 4: Write the implementation**

Create `packages/nx-graphify/src/generators/init/generator.ts`:

```ts
import {
  formatFiles,
  getProjects,
  logger,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import type { InitGeneratorSchema } from './schema';

export default async function initGenerator(
  tree: Tree,
  options: InitGeneratorSchema
) {
  if (!options.project && !options.all) {
    throw new Error(
      'You must specify either --project=<name> or --all to add the graphify target.'
    );
  }

  const graphifyInstalled = checkGraphifyInstalled();
  if (!graphifyInstalled) {
    logger.warn(
      'graphify CLI not found. See installation instructions at: ' +
        'https://github.com/safishamsi/graphify#install\n' +
        'Targets have been scaffolded and will work once graphify is installed.'
    );
  }

  const projects = getProjects(tree);
  const targetProjectNames = options.all
    ? Array.from(projects.keys())
    : [options.project as string];

  for (const projectName of targetProjectNames) {
    const config = projects.get(projectName);
    if (!config) {
      throw new Error(`Project "${projectName}" not found in the workspace.`);
    }

    updateProjectConfiguration(tree, projectName, {
      ...config,
      targets: {
        ...config.targets,
        graphify: {
          executor: 'nx-graphify:graphify',
          options: {
            outputDir: 'graphify-out',
          },
        },
      },
    });
  }

  const installAgent = options.installAgent ?? 'none';
  if (installAgent !== 'none') {
    if (!graphifyInstalled) {
      logger.warn(
        `Skipping agent installation — graphify must be installed first. ` +
          `Run \`graphify ${installAgent} install\` manually after installing graphify.`
      );
    } else {
      const command = `graphify ${installAgent} install`;
      logger.info(`Running: ${command}`);
      execSync(command, { stdio: 'inherit' });
    }
  }

  await formatFiles(tree);

  logger.info(
    `nx-graphify: added the "graphify" target to: ${targetProjectNames.join(', ')}` +
      (installAgent !== 'none' ? `\nConfigured AI assistant: ${installAgent}` : '')
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx nx test nx-graphify
```

Expected: PASS — 7 new tests passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add init generator"
```

---

## Task 9: Wire up `generators.json` and finalize `package.json`

**Files:**
- Create: `packages/nx-graphify/generators.json`
- Modify: `packages/nx-graphify/package.json`

- [ ] **Step 1: Create `generators.json`**

Create `packages/nx-graphify/generators.json`:

```json
{
  "generators": {
    "init": {
      "factory": "./dist/generators/init/generator",
      "schema": "./dist/generators/init/schema.json",
      "description": "Add graphify targets to Nx projects and optionally configure an AI coding assistant"
    }
  }
}
```

- [ ] **Step 2: Finalize `packages/nx-graphify/package.json`**

Edit `packages/nx-graphify/package.json` to its final form (merging in the new fields — keep the `exports`/`nx`/`dependencies` blocks generated in Task 2 as-is):

```json
{
  "name": "nx-graphify",
  "version": "0.1.0",
  "description": "Nx plugin for Graphify — build knowledge graphs from your monorepo projects",
  "keywords": ["nx-plugin"],
  "repository": {
    "type": "git",
    "url": "https://github.com/fennet82/nx-graphify.git"
  },
  "type": "commonjs",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "files": [
    "dist",
    "!**/*.tsbuildinfo",
    "executors.json",
    "generators.json"
  ],
  "nx": {
    "targets": {
      "build": {
        "executor": "@nx/js:tsc",
        "outputs": ["{options.outputPath}"],
        "options": {
          "outputPath": "packages/nx-graphify/dist",
          "main": "packages/nx-graphify/src/index.ts",
          "tsConfig": "packages/nx-graphify/tsconfig.lib.json",
          "rootDir": "packages/nx-graphify/src",
          "generatePackageJson": false,
          "assets": [
            {
              "input": "./packages/nx-graphify/src",
              "glob": "**/!(*.ts)",
              "output": "."
            },
            {
              "input": "./packages/nx-graphify/src",
              "glob": "**/*.d.ts",
              "output": "."
            }
          ]
        }
      }
    }
  },
  "dependencies": {
    "@nx/devkit": "^23.0.0",
    "tslib": "^2.3.0"
  },
  "executors": "./executors.json",
  "generators": "./generators.json"
}
```

Note: the `"@org/source"` conditional export from the scaffolded template is removed here — that condition is an internal workspace-dev convenience from the template and has no meaning once published.

- [ ] **Step 3: Build and verify all schema/json assets land in `dist`**

```bash
npx nx build nx-graphify
test -f packages/nx-graphify/dist/generators/init/generator.js && echo OK
test -f packages/nx-graphify/dist/generators/init/schema.json && echo OK
cat packages/nx-graphify/dist/package.json 2>/dev/null || echo "(no generated package.json — expected, generatePackageJson is false)"
```

Expected: two `OK` lines.

- [ ] **Step 4: Run the full test suite one more time**

```bash
npx nx test nx-graphify
```

Expected: PASS — all tests across utils, executors, and the generator (19 tests total: 2 + 7 + 3 + 3 + 7... recount: check-graphify 2, build-args 7, graphify executor 3, graphify-workspace executor 3, init generator 7 = 22 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Wire up generators.json and finalize package.json"
```

---

## Task 10: README and final workspace verification

**Files:**
- Modify: `packages/nx-graphify/README.md`

- [ ] **Step 1: Write the package README**

Replace the contents of `packages/nx-graphify/README.md`:

```markdown
# nx-graphify

Nx plugin for [Graphify](https://graphify.net/) — build multi-modal knowledge
graphs from your monorepo's source code using Tree-sitter + LLM semantic
extraction.

## Prerequisites

Graphify must be installed separately:

```bash
pip install graphifyy
```

See https://github.com/safishamsi/graphify#install for full installation
instructions.

## Setup

```bash
nx g nx-graphify:init --project=my-app
# or, for every project in the workspace:
nx g nx-graphify:init --all
```

Optionally configure an AI coding assistant's Graphify skill at the same time:

```bash
nx g nx-graphify:init --project=my-app --installAgent=claude
```

## Targets

### `graphify` (per project)

```bash
nx run my-app:graphify
```

Runs Graphify against a single project's root, scoped via `--project`.
Outputs (`graph.html`, `graph.json`, `GRAPH_REPORT.md`, and any optional
exports) are written to `options.outputDir` (default `graphify-out`) and are
cached by Nx like any other target.

### `graphify-workspace` (whole monorepo)

Add this target by hand to any `project.json`/`package.json` (e.g. the
workspace root project), pointing at the `nx-graphify:graphify-workspace`
executor, to build a single knowledge graph across the entire repo.

## Options

| Option        | Type    | Default        | Description                                    |
|---------------|---------|----------------|-------------------------------------------------|
| `outputDir`   | string  | `graphify-out` | Where outputs are written                        |
| `mode`        | enum    | `normal`       | `normal` or `deep` (more aggressive inference)   |
| `update`      | boolean | `false`        | Re-extract changed files only, merge into graph  |
| `clusterOnly` | boolean | `false`        | Rerun clustering without re-extraction           |
| `noViz`       | boolean | `false`        | Skip `graph.html`, produce report + JSON only    |
| `wiki`        | boolean | `false`        | Export Wikipedia-style markdown per community    |
| `obsidian`    | boolean | `false`        | Export an Obsidian vault                         |
| `svg`         | boolean | `false`        | Export `graph.svg`                               |
| `graphml`     | boolean | `false`        | Export `graph.graphml` (Gephi/yEd)                |
| `neo4j`       | boolean | `false`        | Generate `cypher.txt`                             |
| `neo4jPush`   | string  | —              | `bolt://` URL to push directly to Neo4j           |
```

- [ ] **Step 2: Run the entire workspace's checks**

```bash
npx nx run-many -t build,test
```

Expected: `Successfully ran target build, test for project nx-graphify` (and any other project) with no failures.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add nx-graphify README"
```

---

## Out of scope (do not implement)

Per the design spec: `--watch`, `--mcp`, `graphify hook install`/`uninstall`,
`/graphify add <url>`, `/graphify query`/`explain`/`path`, and the entire
publishing checklist (npm publish, `nx list` registry submission, e2e tests).
These are deliberately deferred — do not add them while executing this plan.
