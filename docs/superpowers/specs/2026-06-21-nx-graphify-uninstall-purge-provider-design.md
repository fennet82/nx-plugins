# nx-graphify: uninstall/purge generators, project-scoped installs, and provider backend option

## Summary

Adds three pieces to `nx-graphify`:

1. **`--project` flag on agent install/uninstall.** `graphify`'s own CLI
   distinguishes a project-scoped agent install/uninstall (current
   directory) from a global/user-level one. The plugin always passes
   `--project` on agent install/uninstall commands, since this plugin only
   ever wants project-scoped behavior, never global.
2. **`uninstall-agents` generator** and **`purge` inferred executor target**
   — the uninstall-side counterparts to `init`'s install side and to the
   `graphify`/`graphify-workspace` extraction targets.
3. **`provider.backend` / `provider.model` extraction option** — a new
   nested option on the existing `graphify` / `graphify-workspace` executors
   for selecting an LLM backend (and optionally a free-text model) during
   extraction.

This supersedes nothing in
`docs/superpowers/specs/2026-06-20-nx-graphify-inferred-tasks-design.md`
except one point: that spec's `init` generator threw when `installAgent` was
empty. This spec reverts that — `init` warns and continues, it does not
throw, when no `--installAgent` is given. The `generator.spec.ts` tests
written against the throwing behavior are wrong and are fixed as part of
this work, not the generator.

## `--project` flag

`graphify install` / `graphify uninstall` accept a bare `--project` flag (no
value) meaning "scope this command to the current directory's project,
not the global/user-level install." This plugin's agent-install and
agent-uninstall commands always run from the workspace root and always pass
`--project` — there is no option to opt out, since a global install/uninstall
is never what this plugin should do on a user's behalf.

This is unrelated to the existing `--project <name>` flag in
`buildGraphifyArgs` (`src/utils/build-args.ts`), which is a _different_,
value-taking flag used by the `graphify`/`graphify-workspace` extraction
executors to identify which project is being extracted. Both flags happen to
be spelled `--project` but belong to different `graphify` subcommands
(`install`/`uninstall` vs. plain extraction) and are implemented in
completely separate code paths (generators vs. `buildGraphifyArgs`). No
shared code between them.

## `init` generator (modify)

Unconditionally appends `--project`:

```ts
const installAgents = options.installAgent ?? [];
if (options.installAgent && options.installAgent.length === 0) {
  logger.warn("You didn't specify an agent to install you can use --installAgent (e.g. --installAgent=claude --installAgent=cursor), or run graphify install manually (e.g. `graphify install --platforms claude|cursor`).");
}
const command = `graphify install --project --platforms ${installAgents.join('|')}`;
```

No other behavioral change. `checkGraphifyInstalled()` guard, `Tree`-unused
signature, and warn-not-throw behavior on empty `installAgent` are unchanged
from today's implementation.

## `uninstall-agents` generator (new)

New generator at `src/generators/uninstall-agents/`, structurally identical
to `init` (one-shot CLI passthrough, no `Tree` mutation, runs from the
workspace root):

- **Schema** (`UninstallAgentsGeneratorSchema`): `agent?: InstallAgent[]`,
  same closed enum list as `init`'s `installAgent`
  (`InstallAgent` type — reused, not duplicated; both schema.d.ts files
  import it from a shared location, see Shared types below).
- **Behavior**: unlike `init`, an empty/missing `agent` list is a hard
  error — there is no meaningful "uninstall nothing" case, and no separate
  "remove everything" generator exists (an explicit project decision: a bare
  `graphify uninstall --project` with no `--platform` is intentionally not
  exposed by this plugin).

```ts
export default async function uninstallAgentsGenerator(tree: Tree, options: UninstallAgentsGeneratorSchema) {
  if (!checkGraphifyInstalled()) {
    throw new Error('graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install');
  }

  const agents = options.agent ?? [];
  if (agents.length === 0) {
    throw new Error('You must specify at least one --agent (e.g. --agent=claude --agent=cursor).');
  }

  const command = `graphify uninstall --project --platform ${agents.join('|')}`;
  logger.info(`Running: ${command}`);
  execSync(command, { stdio: 'inherit' });
}
```

Note the check order: `checkGraphifyInstalled` first (matches `init`), then
the agent-list validation — there is nothing meaningful to validate before
confirming the CLI exists.

### Shared types

`InstallAgent` (currently declared only in
`src/generators/init/schema.d.ts`) moves to a shared file,
`src/utils/agents.ts`, exporting the type. `init/schema.d.ts` and the new
`uninstall-agents/schema.d.ts` both import it from there instead of each
declaring their own copy. The two `schema.json` files keep their own
duplicated `enum` arrays (JSON schema can't share a `$ref` across package
boundaries cleanly here, and the existing codebase already accepts this
duplication between `schema.json` and `schema.d.ts` for `init` — this is not
a new pattern, just extended to a second generator).

## `purge` executor + inferred target (new)

New executor at `src/executors/purge/`:

```ts
const runExecutor: PromiseExecutor<PurgeExecutorSchema> = async (options, context: ExecutorContext) => {
  if (!checkGraphifyInstalled()) {
    throw new Error('graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install');
  }

  const projectName = context.projectName as string;
  const projectRoot = context.projectsConfigurations.projects[projectName].root;
  const cwd = projectRoot === '.' ? context.root : `${context.root}/${projectRoot}`;

  // graphify does not yet support a custom output directory for `uninstall --purge`
  // (it always purges its hard-coded `graphify-out`). `options.outputDir` is kept
  // here only so this target's `outputs` declaration matches the real on-disk path;
  // once graphify adds a flag for this, wire it in here:
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
```

**Schema** (`PurgeExecutorSchema`): `{ outputDir?: string }`, default
`'graphify-out'` — documentation/cache-output purposes only, not forwarded
to the CLI command (see comment above).

### `plugin/index.ts` (createNodes update)

`purge` is added to the `targets` object for **every** matched project
(unconditional, unlike `graphify-workspace` which is root-only):

```ts
targets['purge'] = {
  executor: 'nx-graphify:purge',
  options: { outputDir: resolvedOptions.outputDir },
  // Not cached: this is a destructive operation (deletes graphify-out), not
  // a reproducible build step. There is intentionally no `outputs` declared
  // for caching either, for the same reason — caching a delete makes no sense.
};
```

This means `purge` is runnable both as `nx run my-app:purge` (per-project,
`cwd` = that project's root) and `nx run workspace:purge` (root project,
`cwd` = workspace root) — both valid per your earlier confirmation that
`graphify uninstall --project --purge` is meaningful at either scope.

### `executors.json`

Add the `purge` entry alongside `graphify`/`graphify-workspace`:

```json
"purge": {
  "implementation": "./dist/executors/purge/executor",
  "schema": "./dist/executors/purge/schema.json",
  "description": "Remove a project's or the workspace's graphify-out directory"
}
```

## `provider.backend` / `provider.model` extraction option

New nested option on `GraphifyArgsOptions` (`src/utils/build-args.ts`),
applied to both the `graphify` and `graphify-workspace` executors (same as
every other extraction flag) and to `resolveGraphifyOptions` in
`src/plugin/index.ts` (so it can be set as a workspace-wide default in
`nx.json`, same resolution order as `mode`/`outputDir`/etc.).

```ts
export type ProviderBackend = 'azure' | 'bedrock' | 'claude' | 'claude-cli' | 'deepseek' | 'gemini' | 'kimi' | 'ollama' | 'openai';

export interface GraphifyArgsOptions {
  // ...existing fields unchanged...
  provider?: {
    backend?: ProviderBackend;
    model?: string;
  };
}
```

`buildGraphifyArgs` validation and arg order — `--backend`/`--model` are
appended after the existing flags, before the trailing `--project <name>`:

```ts
if (options.provider?.model && !options.provider?.backend) {
  throw new Error('provider.model requires provider.backend to be set (e.g. provider: { backend: "openai", model: "gpt-4" }).');
}
if (options.provider?.backend) {
  args.push('--backend', options.provider.backend);
  if (options.provider.model) {
    args.push('--model', options.provider.model);
  }
}
```

`ProviderBackend` follows the same "closed enum, duplicated between
`schema.json` and `schema.d.ts`" convention as `InstallAgent` (see Shared
types above) — declared once in `src/utils/build-args.ts` and imported by
both executors' `schema.d.ts` files; each `schema.json` keeps its own
`enum` array for the nested `provider.backend` property.

`resolveGraphifyOptions` forwards `provider` only when set on the plugin
options, same spread-conditional pattern already used for `update`,
`clusterOnly`, etc.:

```ts
...(pluginOptions.provider !== undefined && { provider: pluginOptions.provider }),
```

## Testing

- `generators/init/generator.spec.ts`: fix the two tests currently asserting
  throw-on-empty-`installAgent` (wrong expectation — actual behavior is
  warn-and-continue); update all command-string assertions to include
  `--project`.
- `generators/uninstall-agents/generator.spec.ts` (new): mirrors `init`'s
  spec structure — throws when `graphify` missing, throws when `agent` is
  empty/missing, builds correct single/multi-agent pipe-joined command with
  `--project --platform`, logs before running, propagates command failure.
- `executors/purge/executor.spec.ts` (new): mirrors `graphify-workspace`'s
  spec structure — throws when `graphify` missing, runs
  `graphify uninstall --project --purge` with `cwd` set to the project root
  (and separately, to workspace root when `projectName`'s root is `.`),
  returns `{ success: false }` on command failure (matching `graphify`'s
  catch-and-return pattern, not `init`'s throw pattern — `purge` is an
  executor, not a generator).
- `utils/build-args.spec.ts`: new cases for `provider.backend` alone,
  `provider.backend` + `provider.model` together, and the
  model-without-backend throw case; verify `--backend`/`--model` ordering
  relative to the trailing `--project <name>`.
- `plugin/index.spec.ts`: verify `purge` target is attached to every matched
  project (including workspace root), with no `cache`/`outputs` fields, and
  that `resolvedOptions.outputDir` flows into `purge`'s `options.outputDir`.

## e2e (`e2e/`)

`e2e/` currently contains only `.gitkeep`. This adds a single e2e project
using the workspace's existing verdaccio setup (`local-registry` target in
root `package.json`, `.verdaccio/config.yml`):

1. Start the local registry, publish `nx-graphify` to it.
2. Scaffold a temp Nx workspace via `create-nx-workspace`, install
   `nx-graphify` from the local registry, register the plugin in `nx.json`.
3. Put a fake `graphify` shell script on `PATH` (a temp dir prepended to
   `PATH` for the test process) that appends its received argv to a log
   file instead of doing real extraction/install work — this lets tests
   assert exact CLI invocations without depending on the real `graphify`
   CLI being installed in CI.
4. Exercise: `nx g nx-graphify:init --installAgent=claude`, `nx g
nx-graphify:uninstall-agents --agent=claude`, `nx run <proj>:purge`, and
   one `nx run <proj>:graphify --provider.backend=openai
--provider.model=gpt-4` (or equivalent options-file invocation) —
   asserting the fake `graphify` log file recorded the expected argv for
   each.
5. Teardown: stop the local registry, remove the temp workspace.

## Out of scope

- A bare "remove all platforms, no purge, no specific agents" generator —
  explicitly dropped; only `uninstall-agents` (agent-scoped) and `purge`
  (output-dir-scoped) exist on the uninstall side.
- Wiring a real custom output directory into `purge`'s CLI invocation —
  `graphify` doesn't support this yet; the option is left commented out for
  future use (see `purge` executor above).
- `--watch`, `--mcp`, `graphify hook install/uninstall`, `/graphify add
<url>`, `/graphify query/explain/path` — still out of scope, unchanged
  from prior specs.
- Publishing checklist (`nx release`, npm publish, `nx list` registry
  submission) — still deferred.
