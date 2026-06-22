# nx-graphify: command-based targets, full CLI coverage, agents generator

## Context

`@fennet82/nx-graphify` currently exposes two custom executors (`graphify`,
`purge`) with typed `schema.json` options (`mode`, `provider.backend`,
`provider.model`, `noViz`, `wiki`, `obsidian`, `svg`, `graphml`, `neo4j`,
`neo4jPush`, `update`, `clusterOnly`). While building support for more of the
graphify CLI's subcommands, we discovered the existing executor's flags are
stale against the installed `graphify` CLI (v0.8.41):

- `--svg`, `--wiki`, `--obsidian`, `--graphml`, `--neo4j` are not flags of the
  bare/extract command at all — they're `graphify export <format>`
  subcommands.
- `--update` and `--cluster-only` are not flags either — `update <path>` and
  `cluster-only <path>` are separate top-level subcommands.

So today's `graphify` target silently sends several bogus flags that graphify
ignores. Rather than patch around this, we're redesigning the plugin to match
graphify's real CLI surface, modeled directly on `@nx/docker`'s
`buildTarget`/`runTarget` pattern (string-or-object target config, raw `args`
passthrough, `command`-based targets, no custom executors).

## Goals

1. Cover graphify's `extract`, `update`, `query`, `path`, `explain`, `prs`,
   and `uninstall --purge` subcommands as inferred Nx targets.
2. Each target's name is configurable per-workspace (string or object form),
   mirroring `@nx/docker`.
3. All graphify-specific configuration (backend, model, mode, neo4j URL,
   etc.) is passed through as raw CLI args instead of a typed schema —
   eliminates the maintenance burden of keeping a schema in sync with
   graphify's CLI.
4. Split agent-skill install/uninstall out of `init` into a dedicated
   `agents` generator with `install`/`uninstall` actions; `init` becomes
   registration-only.

## Non-goals

- Token interpolation in `args` (e.g. `{projectName}`, `{commitSha}` like
  docker's `imageRef`/`commitSha` tokens) — not requested, skipped for now.
- `PluginCache`-based hashing/caching of `createNodes` computation itself
  (docker's perf optimization) — unnecessary for our lightweight target
  construction.
- Changing how the plugin attaches to every project (still
  `{**/project.json,**/package.json}`, including the workspace root).

## Architecture

### Plugin options (`src/plugin/schema.d.ts`)

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

`normalizePluginOptions` resolves each `string | GraphifyTargetOptions` into
a fully-formed `GraphifyTargetOptions` (string form means "use this as the
target name, no other overrides"), exactly like `@nx/docker`'s
`normalizeTarget` helper.

### Default target names

| Plugin option   | Default name       |
| --------------- | ------------------ |
| `genTarget`     | `graphify:gen`     |
| `updateTarget`  | `graphify:update`  |
| `queryTarget`   | `graphify:query`   |
| `pathTarget`    | `graphify:path`    |
| `explainTarget` | `graphify:explain` |
| `prsTarget`     | `graphify:prs`     |
| `purgeTarget`   | `graphify:purge`   |

### Per-target commands

All targets run with `cwd: projectRoot` (or the configured `cwd` override),
using Nx's native `command` shorthand (`nx:run-commands` + `{args}`
interpolation, exactly like `@nx/docker`'s `docker build .`/`docker run
{args} <image>`):

| Target  | Command                                       | Cached?                                         |
| ------- | --------------------------------------------- | ----------------------------------------------- |
| gen     | `graphify extract . {args}`                   | yes — `outputs: ['{projectRoot}/graphify-out']` |
| update  | `graphify update . {args}`                    | yes — same outputs                              |
| query   | `graphify query {args}`                       | no                                              |
| path    | `graphify path {args}`                        | no                                              |
| explain | `graphify explain {args}`                     | no                                              |
| prs     | `graphify prs {args}`                         | no                                              |
| purge   | `graphify uninstall --project --purge {args}` | no                                              |

`gen`/`update` get `inputs: ['default', '^default']` (matches today's
behavior). No target runs a `checkGraphifyInstalled()` guard — if the binary
is missing, the shell command fails naturally with "command not found",
exactly like `@nx/docker` doesn't pre-check for `docker`.

### Removed

- `src/executors/graphify/` (executor, schema, spec) — deleted.
- `src/executors/purge/` (executor, schema, spec) — deleted.
- `executors.json` — deleted (no executors left).
- `src/utils/build-args.ts` + its spec — deleted (no more structured →
  flag-array translation; flags are user-supplied `args` directly).
- `ProviderBackend` type in `src/utils/types.ts` — deleted (provider
  selection is now just `args: ['--backend', 'openai', '--model', 'gpt-4']`).

## Generators

### `init` — registration-only

- Drops `checkGraphifyInstalled()` **hard guard** in favor of a
  `logger.warn` (does not throw, does not block registration) if graphify
  isn't found.
- Drops the `installAgent` option and the `execSync('graphify install ...')`
  call entirely.
- Registers the plugin with explicit default options (mirrors
  `@nx/docker`'s `addPluginToNxJson`, which writes
  `{buildTarget: {name: 'docker:build'}, ...}` rather than `{}`):

```ts
nxJson.plugins.push({
  plugin: '@fennet82/nx-graphify/plugin',
  options: {
    genTarget: { name: 'graphify:gen' },
    updateTarget: { name: 'graphify:update' },
    queryTarget: { name: 'graphify:query' },
    pathTarget: { name: 'graphify:path' },
    explainTarget: { name: 'graphify:explain' },
    prsTarget: { name: 'graphify:prs' },
    purgeTarget: { name: 'graphify:purge' },
  },
});
```

- Still a no-op (skips registration) if the plugin is already registered,
  as a string or as an object — unchanged from today.

### `agents` — new, replaces `uninstall-agents`

```bash
nx g @fennet82/nx-graphify:agents install --agent=claude --agent=cursor
nx g @fennet82/nx-graphify:agents uninstall --agent=claude --agent=cursor
```

- `schema.json` declares a positional `action` via
  `"$default": { "$source": "argv", "index": 0 }` (the same convention Nx
  core generators use for positional args, e.g. `nx g @nx/workspace:move
<path>`), constrained to `"install" | "uninstall"`.
- `agent: string[]` — same `InstallAgent` union as today.
- `install` with no `--agent`: warns and runs `graphify install --project`
  with no `--platform` (same UX as today's `init`).
- `uninstall` with no `--agent`: throws — no "uninstall everything" mode,
  same as today's `uninstall-agents`.
- **Keeps** the `checkGraphifyInstalled()` hard throw here (unlike `init`),
  since this generator actually shells out to `graphify install`/
  `uninstall`.
- `src/generators/uninstall-agents/` is deleted entirely, fully superseded.

## Docs

- `packages/nx-graphify/README.md` and root `README.md`: full rewrite.
  - Setup section shows the new `nx.json` shape with all 7 target options.
  - One section per target (gen/update/query/path/explain/prs/purge), each
    with a `nx run my-app:<target> -- <args>` example — since args are raw
    passthrough now, these examples double as the flag reference instead of
    a generated options table.
  - Per-project override example via `project.json`'s
    `targets["graphify:gen"].options.args`.
  - `agents install`/`agents uninstall` usage replaces the old `init
--installAgent` / `uninstall-agents` docs.
  - Drop the old structured Options table (`mode`/`provider`/etc.) entirely.

## Testing

- Delete: `build-args.spec.ts`, `executors/graphify/executor.spec.ts`,
  `executors/purge/executor.spec.ts`, `generators/uninstall-agents/generator.spec.ts`.
- Rewrite `plugin/index.spec.ts`: string vs. object option normalization,
  default names, per-target cache/outputs/inputs, `args` passthrough, for
  all 7 targets.
- Rewrite `generators/init/generator.spec.ts`: registration-only behavior,
  default options shape, idempotency, warn-not-throw when graphify missing.
- New `generators/agents/generator.spec.ts`: install/uninstall via
  positional `action`, missing-agent behavior for each action, the
  `checkGraphifyInstalled` throw.
- e2e (`nx-graphify-e2e`): exercise `gen`/`query`/`purge` via `nx run`, and
  the `agents` generator's install/uninstall, replacing the old
  install-agent/uninstall-agents flow.

## Breaking changes

This removes the structured-options API (`mode`, `provider`, `noViz`, etc.),
the `graphify`/`purge` executors, and the `uninstall-agents` generator.
Ships as `feat(nx-graphify)!:` with a `BREAKING CHANGE:` footer describing
the migration (old `nx.json` options → new target-name + `args` form).
