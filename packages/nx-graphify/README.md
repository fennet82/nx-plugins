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
        "extractGraphifyTargetName": "graphify:extract",
        "updateGraphifyTargetName": "graphify:update",
        "queryGraphifyTargetName": "graphify:query",
        "pathGraphifyTargetName": "graphify:path",
        "explainGraphifyTargetName": "graphify:explain",
        "prsGraphifyTargetName": "graphify:prs",
        "purgeGraphifyTargetName": "graphify:purge"
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

Each plugin option accepts either a plain string (just renames the target,
shown above) or an object — `{ name, args, env, envFile, cwd, configurations }`
(see [Per-configuration overrides](#per-configuration-overrides) for the
object form). All graphify CLI flags are passed straight through as `args`;
there's no structured schema to keep in sync with graphify's own flags.

## Guides

### Build a graph from scratch

The first run of `graphify:extract` on a project builds its graph from
nothing — there's no separate "init the graph" step:

```bash
nx run my-app:graphify:extract
```

This scans `my-app`'s project root, runs Tree-sitter AST extraction plus LLM
semantic extraction (see [Setting an LLM backend](#setting-an-llm-backend)
below), clusters the result, and writes everything to `my-app/graphify-out/`
(`graph.json`, `manifest.json`, `.graphify_analysis.json`). Building the
whole workspace's graph in one shot works the same way, since the workspace
root is a project too:

```bash
nx run my-workspace:graphify:extract
```

(replace `my-workspace` with whatever `name` your root `package.json` has).
To build every project's graph in one command instead of just the root's,
use `run-many` or `affected`:

```bash
nx run-many -t graphify:extract
nx affected -t graphify:extract
```

`graphify:extract` is cached by Nx — rerunning it with no relevant file
changes replays the cached result instead of calling `graphify` again.

### Update an existing graph

Once a graph exists, re-running `graphify:extract` rebuilds it from scratch.
`graphify:update` instead re-extracts only the files that changed since the
last build and merges the result into the existing graph — cheaper, and
skips the LLM step entirely unless you also pass extract-style flags:

```bash
nx run my-app:graphify:update
```

Use `--force` to overwrite `graph.json` even if the incremental rebuild
ends up with fewer nodes than before (useful right after a refactor that
deletes a lot of code, where "fewer nodes" is expected and correct, not a
sign of a broken rebuild):

```bash
nx run my-app:graphify:update -- --force
```

Like `graphify:extract`, `graphify:update` is cached, and works the same way
against the workspace root or via `run-many`/`affected`.

### Setting an LLM backend

`extractGraphifyTargetName`/`updateGraphifyTargetName` extraction needs an
LLM backend for semantic (non-AST) analysis. graphify auto-detects a backend
from whichever API key is set in the environment — no `--backend` flag
needed if exactly one of these is set:

| Backend    | Env var(s)                                       |
| ---------- | ------------------------------------------------ |
| `openai`   | `OPENAI_API_KEY`                                 |
| `claude`   | `ANTHROPIC_API_KEY`                              |
| `gemini`   | `GEMINI_API_KEY` or `GOOGLE_API_KEY`             |
| `deepseek` | `DEEPSEEK_API_KEY`                               |
| `kimi`     | `MOONSHOT_API_KEY`                               |
| `azure`    | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` |
| `ollama`   | `OLLAMA_BASE_URL` (+ optional `OLLAMA_API_KEY`)  |

To pin a specific backend/model instead of relying on auto-detection, pass
`--backend`/`--model` as `args`:

```json
{
  "name": "my-app",
  "targets": {
    "graphify:extract": {
      "options": {
        "args": ["--backend", "openai", "--model", "gpt-4"]
      }
    }
  }
}
```

### Setting environment variables

Don't put API keys directly in `args` or in `nx.json`/`project.json` (they'd
end up committed to git). Use the target's `env` or `envFile` option
instead — both are passed straight through to Nx's `command` executor:

```json
{
  "plugins": [
    {
      "plugin": "@fennet82/nx-graphify/plugin",
      "options": {
        "extractGraphifyTargetName": {
          "name": "graphify:extract",
          "env": { "GRAPHIFY_MAX_WORKERS": "4" }
        }
      }
    }
  ]
}
```

`env` is a plain key-value map merged into the command's environment.
`envFile` instead points at a dotenv-style file (each line `KEY=value`) that
Nx loads before running the command — the usual place to keep an API key out
of version control:

```json
{
  "name": "my-app",
  "targets": {
    "graphify:extract": {
      "options": {
        "envFile": ".env.graphify"
      }
    }
  }
}
```

```
# .env.graphify (gitignored)
OPENAI_API_KEY=sk-...
```

### Overriding the global config in nx.json

The `options` block under the plugin registration in `nx.json` sets
workspace-wide defaults for all 7 targets. Override it at three different
scopes, depending on how broadly the change should apply:

- **Workspace-wide** — edit the plugin's `options` in `nx.json` directly
  (affects every project):

  ```json
  {
    "plugins": [
      {
        "plugin": "@fennet82/nx-graphify/plugin",
        "options": {
          "extractGraphifyTargetName": {
            "name": "graphify:extract",
            "args": ["--mode", "deep"]
          }
        }
      }
    ]
  }
  ```

- **Per project** — add the target to that project's `project.json` (or the
  `nx` key in its `package.json`); see
  [Overriding options per project](#overriding-options-per-project) below.

- **Per invocation** — pass flags on the command line after `--`, without
  touching any config file at all:

  ```bash
  nx run my-app:graphify:extract -- --mode deep
  ```

These three scopes behave differently, and it matters which one you reach
for:

- **Per-invocation flags genuinely layer on top of configured `args`.** Nx's
  `command` executor concatenates whatever follows `--` on the CLI with the
  target's own configured `args`, so
  `nx run my-app:graphify:extract -- --mode deep` runs with both the
  configured args _and_ `--mode deep`.
- **Per-project `project.json` options replace, not merge.** If `nx.json`
  configures `extractGraphifyTargetName.args: ['--mode', 'deep']`
  workspace-wide and a project's `project.json` sets its own
  `args: ['--backend', 'openai']` for `graphify:extract`, that project runs
  with `--backend openai` only — `--mode deep` is gone, since Nx replaces
  array-valued options wholesale rather than concatenating them when merging
  an explicit project target over an inferred one. If you need both, repeat
  every flag you want in the project-level `args`.
- **Target `configurations`** behave the same way — see
  [Per-configuration overrides](#per-configuration-overrides) below.

## Targets

### `graphify:extract` — `extractGraphifyTargetName`

Runs `graphify extract . {args}` (cwd = the project's root). Creates
`graphify-out/` (`graph.json`, `manifest.json`, `.graphify_analysis.json`,
plus clustering output) and is cached by Nx like any other build target.

```bash
nx run my-app:graphify:extract
nx run my-app:graphify:extract -- --backend openai --model gpt-4
nx run my-app:graphify:extract -- --mode deep --max-workers 4
```

### `graphify:update` — `updateGraphifyTargetName`

Runs `graphify update . {args}`. Re-extracts changed files only and merges
into the existing graph — no LLM needed unless you also pass extract-style
flags. Cached the same way as `graphify:extract`.

```bash
nx run my-app:graphify:update
nx run my-app:graphify:update -- --force
```

### `graphify:query` — `queryGraphifyTargetName`

Runs `graphify query {args}` against the project's `graphify-out/graph.json`.
Not cached — it's a read, not a build.

```bash
nx run my-app:graphify:query -- "what calls the auth middleware?"
nx run my-app:graphify:query -- "what calls the auth middleware?" --dfs --budget 500
```

### `graphify:path` — `pathGraphifyTargetName`

Runs `graphify path {args}` — shortest path between two nodes in the graph.

```bash
nx run my-app:graphify:path -- "UserService" "Database"
```

### `graphify:explain` — `explainGraphifyTargetName`

Runs `graphify explain {args}` — plain-language explanation of a node and
its neighbors.

```bash
nx run my-app:graphify:explain -- "UserService.login"
```

### `graphify:prs` — `prsGraphifyTargetName`

Runs `graphify prs {args}` — a dashboard of open PRs against the repo, with
optional triage/conflict/graph-impact analysis.

```bash
nx run my-app:graphify:prs
nx run my-app:graphify:prs -- --triage
nx run my-app:graphify:prs -- --conflicts
```

### `graphify:purge` — `purgeGraphifyTargetName`

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
its own entry to `targets` in `project.json`:

```json
{
  "name": "my-app",
  "targets": {
    "graphify:extract": {
      "options": {
        "args": ["--backend", "ollama", "--model", "llama3"]
      }
    }
  }
}
```

This works the same way for any of the 7 targets, and for the root project
too. Note this fully replaces the workspace-wide `args`/`env`/etc. from
`nx.json` rather than merging with them — see
[Overriding the global config in nx.json](#overriding-the-global-config-in-nxjson)
above for the full breakdown of which override scope merges vs. replaces.

## Renaming a target

```json
{
  "plugins": [
    {
      "plugin": "@fennet82/nx-graphify/plugin",
      "options": {
        "extractGraphifyTargetName": "extract"
      }
    }
  ]
}
```

Now every project's extraction target is `nx run my-app:extract` instead of
`nx run my-app:graphify:extract`.

## Per-configuration overrides

```json
{
  "plugins": [
    {
      "plugin": "@fennet82/nx-graphify/plugin",
      "options": {
        "extractGraphifyTargetName": {
          "name": "graphify:extract",
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
nx run my-app:graphify:extract:ci
```

A configuration's `args`/`env`/`envFile`/`cwd` fully replace the parent
target's values rather than merging with them — so if you want base args
available in every configuration, repeat them in each configuration block.

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
