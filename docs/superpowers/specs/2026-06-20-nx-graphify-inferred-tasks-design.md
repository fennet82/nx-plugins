# nx-graphify: inferred tasks + agent-install simplification

## Summary

Replace the `init` generator's project-scaffolding role (writing a `graphify`
target into every targeted project's `project.json`) with Nx's **inferred
tasks** mechanism (`createNodesV2`), so the `graphify` target is attached
automatically to every project — and `graphify-workspace` automatically to
the workspace root — with zero per-project file mutation. `init` shrinks to
a pure passthrough for `graphify install --platforms <agents>`.

This supersedes the project-scaffolding portion of
`docs/superpowers/specs/2026-06-18-nx-graphify-design.md`. The two executors
(`graphify`, `graphify-workspace`) and their schemas/logic are unchanged by
this redesign — only *how their target gets attached to a project* changes.

## Motivation

The original `init` generator wrote an identical `targets.graphify` block
into every project's `project.json` it touched. This is redundant: Nx
plugins like `@nx/vite`, `@nx/eslint`, and `@nx/js` (already used in this
workspace's own `nx.json`) instead infer targets dynamically from a single
plugin registration, with workspace-wide defaults living in `nx.json` and
per-project overrides only written when a project actually needs to deviate.
Inferred tasks also satisfy the goal of `graphify` "just working" for every
project/lib/package without an opt-in scaffolding step per project.

## Architecture

### New file: `src/plugin/index.ts`

Exports `createNodesV2`, a tuple of `[globPattern, createNodesFunction]`,
registered by consumers in their own `nx.json`:

```json
{
  "plugins": [
    {
      "plugin": "nx-graphify",
      "options": { "outputDir": "graphify-out", "mode": "normal" }
    }
  ]
}
```

- **Glob**: `'{project.json,package.json}'` — the same marker files Nx
  itself uses to discover projects. This is a hard constraint of
  `createNodesV2`: it scans the workspace for files matching the glob and
  calls the node-creation function once per match. There is no mechanism
  to infer a target onto "every project" without some file-existence check
  to drive the scan — globbing on the two standard project-marker files is
  the closest equivalent, and covers every project in a normal Nx workspace
  (explicit `project.json` projects and implicit package-based projects
  alike).
- For every matched file, the function returns a `graphify` target on that
  project (see Defaults & Caching below).
- When the matched file's directory is the workspace root (`projectRoot ===
  '.'`), the function additionally attaches a `graphify-workspace` target
  there. If the workspace root has neither a `project.json` nor a
  `package.json`, `graphify-workspace` is not inferred — an edge case, but
  one that already requires a `package.json` for nearly every real Nx
  workspace (including this one).

### `src/plugin/schema.d.ts`

Types the `nx.json` plugin options object (`outputDir`, `mode`, and the
other existing executor options — see `GraphifyArgsOptions` in
`src/utils/build-args.ts`, which these defaults are validated against /
forwarded to).

### `executors.json`

`graphify` and `graphify-workspace` stay registered exactly as today (still
directly invocable by hand in a `project.json`, still what `createNodesV2`
points `executor:` at). The static top-level `inputs`/`outputs` are removed
from `executors.json`, since cache configuration now needs `{projectRoot}`
resolved per matched project — it's computed inline in the target object
`createNodesV2` returns, not declared once globally.

### `generators/init/`

Drops all scaffolding logic. No `Tree` mutation, no `getProjects` /
`updateProjectConfiguration`, no `--project` / `--all` options. The
generator's only remaining job is the agent-install passthrough (see below).
`schema.json`'s `project`/`all` properties are removed; `installAgent`
remains exactly as already implemented (validated enum array — see Agent
Install section).

## Defaults, Overrides & Caching

Resolution order for a project's `graphify` target options, highest to
lowest priority:

1. `targets.graphify.options` explicitly set in that project's own
   `project.json` (if present) — standard Nx behavior, no custom merge code
   needed; Nx layers explicit project config over inferred config
   automatically.
2. `nx.json` → `plugins: [{ "plugin": "nx-graphify", "options": {...} }]`
   (workspace-wide defaults).
3. Hard-coded fallback inside the plugin (`outputDir: "graphify-out"`,
   `mode: "normal"`) if neither of the above sets a value.

Per-project target shape returned by `createNodesV2`:

```ts
{
  targets: {
    graphify: {
      executor: 'nx-graphify:graphify',
      options: resolvedOptions, // per resolution order above
      inputs: ['default', '^default'],
      outputs: [`{projectRoot}/${resolvedOptions.outputDir}`],
      cache: true,
    },
  },
}
```

Workspace-root target shape (only when `projectRoot === '.'`):

```ts
{
  targets: {
    'graphify-workspace': {
      executor: 'nx-graphify:graphify-workspace',
      options: resolvedOptions,
      outputs: [`{workspaceRoot}/${resolvedOptions.outputDir}`],
      cache: true,
    },
  },
}
```

## Agent Install (`init` generator)

`init`'s schema keeps the existing validated enum for `installAgent`
(`string[]`, items restricted to the same closed list already in
`schema.json`/`schema.d.ts`: `claude`, `codex`, `opencode`, `kilo`, `aider`,
`copilot`, `claw`, `droid`, `trae`, `trae-cn`, `hermes`, `kiro`, `pi`,
`codebuddy`, `antigravity`, `antigravity-windows`, `windows`, `kimi`, `amp`,
`devin`, `gemini`, `cursor`). Adding a new agent in the future means a small
plugin code change and a version bump — accepted tradeoff, since `graphify`
itself only adds new agent integrations infrequently, and a new `graphify`
release is required on that side regardless.

New generator logic — pure passthrough, no Tree mutation, no scaffolding
fallback path:

```ts
export default async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  const installAgents = options.installAgent ?? [];
  if (installAgents.length === 0) {
    throw new Error(
      'You must specify at least one --installAgent (e.g. --installAgent=claude --installAgent=cursor).'
    );
  }

  if (!checkGraphifyInstalled()) {
    throw new Error(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install'
    );
  }

  const command = `graphify install --platforms ${installAgents.join('|')}`;
  logger.info(`Running: ${command}`);
  execSync(command, { stdio: 'inherit' });
}
```

Behavioral changes from today's generator:

- **Throws (does not warn) when `graphify` is missing.** There's no
  scaffolding fallback path left to justify a soft warning — the
  generator's entire remaining purpose requires the CLI, so it fails hard,
  matching the executors' own throw behavior.
- **No partial-failure handling.** A single `graphify install` call either
  succeeds or throws uncaught; there's no longer a project-scaffolding
  success to preserve alongside a failed agent install, so there's nothing
  to catch-and-continue for.
- `Tree` remains a required parameter (Nx generator signature), but is
  unused in the body — expected for a CLI-wrapper generator with no file
  mutations.

## Testing

- `plugin/index.spec.ts`: given a fake file tree (via `@nx/devkit/testing`
  helpers or a hand-built `CreateNodesContext`), verify:
  - `graphify` target is attached for every matched `project.json`/
    `package.json`, with correct executor, `outputs`, and resolved options
    pulled from plugin options vs. defaults.
  - `graphify-workspace` is attached only at `projectRoot === '.'`.
  - `nx.json` plugin `options` override the hard-coded fallback defaults.
- `generators/init/generator.spec.ts`: rewritten for the passthrough-only
  behavior — throws on empty `installAgent`, throws when `graphify` missing,
  builds the correct single pipe-joined `graphify install --platforms ...`
  command, no scaffolding-related tests remain (removed, since there's no
  scaffolding left to test in this generator).
- Existing `executors/*/executor.spec.ts` and `utils/*.spec.ts` are
  unaffected by this redesign and remain as-is.

## Migration / compatibility note

This is a pre-1.0, unpublished plugin (current state is on `master`, never
published to npm) — there are no existing consumers to migrate, so no
backward-compatibility shims, deprecation warnings, or dual-mode support are
needed. The generator's `--project`/`--all` options and their tests are
deleted outright rather than deprecated.

## Out of scope (unchanged from original design)

- `--watch`, `--mcp`, `graphify hook install/uninstall`, `/graphify add
  <url>`, `/graphify query/explain/path` — still out of scope, unaffected by
  this redesign.
- Publishing checklist (`nx release`, npm publish, `nx list` registry
  submission) — still deferred, not part of this pass.
