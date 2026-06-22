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
