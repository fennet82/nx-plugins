# nx-graphify design

## Summary

An Nx plugin that integrates Graphify (Python CLI knowledge graph tool,
`pip install graphifyy`, CLI command `graphify`) into Nx monorepos. Provides
two executors (per-project and workspace-wide) and one generator (`init`)
to scaffold targets and optionally install an AI-assistant skill manifest.

Reference implementations for structure/discipline: nx-go
(https://github.com/nx-go/nx-go) and nx-biome
(https://github.com/berenddeboer/nx-plugins/tree/main/packages/nx-biome).

## Workspace setup

The repo is currently empty. Scaffold via:

```
npx create-nx-workspace@latest . --preset=ts --pm=pnpm
nx g @nx/plugin:plugin packages/nx-graphify --publishable --importPath=nx-graphify
```

Package manager: pnpm. This produces the standard Nx plugin layout
(executors.json, generators.json, src/, test runner config) which we then
fill in per the structure below.

## File structure

```
packages/nx-graphify/
├── src/
│   ├── executors/
│   │   ├── graphify/
│   │   │   ├── executor.ts
│   │   │   ├── executor.spec.ts
│   │   │   ├── schema.json
│   │   │   └── schema.d.ts
│   │   └── graphify-workspace/
│   │       ├── executor.ts
│   │       ├── executor.spec.ts
│   │       ├── schema.json
│   │       └── schema.d.ts
│   ├── generators/
│   │   └── init/
│   │       ├── generator.ts
│   │       ├── generator.spec.ts
│   │       ├── schema.json
│   │       └── schema.d.ts
│   └── utils/
│       ├── check-graphify.ts
│       ├── check-graphify.spec.ts
│       ├── build-args.ts
│       └── build-args.spec.ts
├── executors.json
├── generators.json
├── package.json
└── README.md
```

## Executor: `graphify`

Runs `graphify <projectRoot> [flags] --project <projectName>` for a single
Nx project.

### Schema options

| Option      | Type    | Default        | Description                                   |
|-------------|---------|----------------|-----------------------------------------------|
| outputDir   | string  | "graphify-out" | Where outputs are written                     |
| mode        | enum    | "normal"       | "normal" or "deep"                            |
| update      | boolean | false          | Re-extract changed files only, merge graph    |
| clusterOnly | boolean | false          | Rerun clustering without re-extraction        |
| noViz       | boolean | false          | Skip graph.html, produce report + JSON only   |
| wiki        | boolean | false          | Export Wikipedia-style markdown per community |
| obsidian    | boolean | false          | Export an Obsidian vault                      |
| svg         | boolean | false          | Export graph.svg                              |
| graphml     | boolean | false          | Export graph.graphml                          |
| neo4j       | boolean | false          | Generate cypher.txt                           |
| neo4jPush   | string  | undefined      | bolt:// URL to push directly to Neo4j         |

`project` (the project name passed as `--project`) is NOT a user-facing
schema option — it's derived internally from `context.projectName` and
always appended by the executor.

### executor.ts logic

1. Call `checkGraphifyInstalled()`. If false, throw:
   `"graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install"`
2. Resolve project root from
   `context.projectsConfigurations.projects[context.projectName].root`.
3. Build args via `buildGraphifyArgs(options, targetPath, context.projectName)`.
4. Log the full command before running.
5. Run `graphify <args>` via `execSync` with `stdio: 'inherit'` and
   `cwd: context.root`.
6. Return `{ success: true }`; on thrown/caught error, log via
   `logger.error` and return `{ success: false }`.

### Caching (executors.json)

```
"inputs": ["default", "^default"],
"outputs": ["{options.outputDir}"]
```

## Executor: `graphify-workspace`

Identical schema and logic, but targets `context.root` instead of the
project root, and passes `'workspace'` as the project-name argument to
`buildGraphifyArgs` (or omits `--project` — see build-args section).

## Generator: `init`

### Schema options

| Option       | Type    | Default   | Description                                  |
|--------------|---------|-----------|-----------------------------------------------|
| project      | string  | undefined | Specific project to add the target to        |
| all          | boolean | false     | Add target to all projects                    |
| installAgent | string  | "none"    | Run `graphify <agent> install` for an AI tool |

`installAgent` enum: none, claude, codex, opencode, kilo, aider, copilot,
claw, droid, trae, trae-cn, hermes, kiro, pi, codebuddy, antigravity,
antigravity-windows, windows, kimi, amp, devin, gemini, cursor.

### generator.ts logic

1. Throw if neither `project` nor `all` is set.
2. Call `checkGraphifyInstalled()`. If false, **warn** (don't throw):
   `"graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install\nTargets have been scaffolded and will work once graphify is installed."`
3. `getProjects(tree)`, filter to target project(s).
4. For each target project, `updateProjectConfiguration` to merge in:
   ```json
   {
     "graphify": {
       "executor": "nx-graphify:graphify",
       "options": { "outputDir": "graphify-out" }
     }
   }
   ```
5. If `installAgent !== 'none'`:
   - If graphify is installed: run `graphify <installAgent> install` via
     `execSync` with `stdio: 'inherit'`, after target scaffolding.
   - If graphify is not installed: skip, and warn:
     `"Skipping agent installation — graphify must be installed first. Run \`graphify <agent> install\` manually after installing graphify."`
6. `formatFiles(tree)`.
7. Print a summary: which projects were updated, and which assistant (if
   any) was configured.

### Explicitly out of scope for `init`

- `graphify hook install` (redundant with Nx task graph)
- Running `graphify <agent> install` from any executor (one-time,
  generator-only concern)

## src/utils/check-graphify.ts

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

Executors throw on false; the generator warns on false. Both messages
point to the install docs link above.

## src/utils/build-args.ts

Pure function, fully unit-testable, no side effects.

```ts
export function buildGraphifyArgs(
  options: GraphifyExecutorSchema,
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

For `graphify-workspace`, `targetPath` is `context.root`; `projectName` is
the constant `'workspace'`.

## Testing scope (this pass)

Unit tests included now:
- `build-args.spec.ts`: every flag combination, default omissions,
  `--project` always appended.
- `check-graphify.spec.ts`: mocked `execSync` for installed/not-installed.
- `executor.spec.ts` (both executors): throws with exact message when
  CLI missing; builds correct command and cwd when present; returns
  `{ success: false }` on caught error.
- `generator.spec.ts`: throws when neither `project` nor `all` set; warns
  (doesn't throw) when CLI missing; merges target config correctly for
  single project vs. `all`; runs/skips agent install per CLI-presence.

E2e tests remain deferred to the publishing checklist, per the original
spec — not part of this implementation pass.

## package.json requirements

```json
{
  "name": "nx-graphify",
  "version": "0.1.0",
  "description": "Nx plugin for Graphify — build knowledge graphs from your monorepo projects",
  "keywords": ["nx-plugin"],
  "repository": {
    "type": "git",
    "url": "https://github.com/<you>/nx-graphify.git"
  },
  "main": "src/index.js",
  "dependencies": {
    "@nx/devkit": "^22.0.0"
  }
}
```

Rules: `@nx/devkit` must be a dependency (not peer); `nx` itself must not
be listed as a dependency or peerDependency; `"nx-plugin"` keyword required
for registry discoverability.

## executors.json / generators.json

As specified verbatim in the original request — `graphify` and
`graphify-workspace` executors with `inputs: ["default", "^default"]` and
`outputs: ["{options.outputDir}"]`; single `init` generator.

## Code style

- TypeScript throughout.
- Executors stay thin — delegate to `build-args.ts` / `check-graphify.ts`.
- All user-facing error/warning messages include the fix and the install
  link.
- `logger` from `@nx/devkit`, never `console.log`.
- Log the full command before running it.

## Explicitly out of scope (whole plugin)

- `--watch` (Nx has its own watch mode)
- `--mcp` (long-running server, incompatible with executor model)
- `graphify hook install`/`uninstall`
- `/graphify add <url>` (manual workflow)
- `/graphify query`, `explain`, `path` (interactive, not cacheable targets)

## Publishing (deferred — not part of this implementation pass)

1. `nx release` — bump version, tag.
2. `nx nx-release-publish nx-graphify` — publish to npm.
3. Submit to `nx list` registry: fork nrwl/nx, add entry to
   `astro-docs/src/content/approved-community-plugins.json`, commit as
   `chore(core): nx plugin submission [nx-graphify]`, run
   `pnpm submit-plugin`. Requires e2e tests, `repository.url` set,
   `@nx/devkit` in dependencies.
