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
        "outputDir": "graphify-out",
        "mode": "normal"
      }
    }
  ]
}
```

Or just run `nx g @fennet82/nx-graphify:init` (see
[AI coding assistant skills](#ai-coding-assistant-skills) below) — it
registers the plugin in `nx.json` for you automatically, with no `options`,
if it isn't already there. Either way works; use the manual JSON above if
you also want to set workspace-wide options right away.

That's it — every project automatically gets `graphify` and `purge`
targets, including the workspace root: a root `package.json` (which every
Nx workspace has, if only to depend on its own plugins) makes the root a
project too, so there's no separate "whole workspace" target — running
`graphify`/`purge` on the root project already covers that case. No
generator, no per-project scaffolding.

The plugin's `options` block sets workspace-wide defaults — any option from
the [Options](#options) table below. A few more realistic defaults:

```json
{
  "plugins": [
    {
      "plugin": "@fennet82/nx-graphify/plugin",
      "options": {
        "mode": "deep",
        "svg": true,
        "wiki": true,
        "provider": { "backend": "openai", "model": "gpt-4" }
      }
    }
  ]
}
```

### Overriding options per project

An individual project can override the workspace-wide defaults by adding its
own `targets.graphify.options` to its `project.json` — Nx merges that over
the inferred defaults automatically. For example, only this one project
also pushes to Neo4j and skips HTML generation:

```json
{
  "name": "my-app",
  "targets": {
    "graphify": {
      "options": {
        "noViz": true,
        "neo4j": true,
        "neo4jPush": "bolt://localhost:7687"
      }
    }
  }
}
```

This works the same way for `purge`, and for the root project too — its
`project.json`/`package.json` can override options just like any other
project's.

### AI coding assistant skills

```bash
nx g @fennet82/nx-graphify:init --installAgent=claude
# or multiple at once, installed in a single call:
nx g @fennet82/nx-graphify:init --installAgent=claude --installAgent=cursor
```

This runs `graphify install --project --platform claude|cursor` for you.
It's a one-time, workspace-root-level operation, unrelated to which
projects have a `graphify` target. `--project` is graphify's own
project-vs-global install flag — this plugin always passes it, so the
skills are installed for this workspace, not globally for your user
account. If you omit `--installAgent`, it runs `graphify install --project`
with no `--platform` flag at all.

Either way, `init` also registers `@fennet82/nx-graphify/plugin` in your
`nx.json` if it isn't already there — regardless of whether you passed
`--installAgent`. If it's already registered (as a plain string or as an
object with `options`), `init` leaves it untouched.

To remove agent skills again:

```bash
nx g @fennet82/nx-graphify:uninstall-agents --agent=claude
# or multiple at once:
nx g @fennet82/nx-graphify:uninstall-agents --agent=claude --agent=cursor
```

This runs `graphify uninstall --project --platform claude|cursor`. At
least one `--agent` is required — there's no "uninstall everything" mode;
say which agents you want removed.

## Targets

### `graphify` (per project)

Runs Graphify against a single project's root. Outputs (`graph.html`,
`graph.json`, `GRAPH_REPORT.md`, and any optional exports) are written to
`options.outputDir` (default `graphify-out`) and are cached by Nx like any
other target.

```bash
# extract using whatever options are configured (workspace defaults +
# this project's own project.json overrides, if any)
nx run my-app:graphify

# re-extract only the files that changed, merging into the existing graph
nx run my-app:graphify --update

# rerun clustering only, without re-extracting anything
nx run my-app:graphify --clusterOnly

# one-off ad-hoc export, without changing project.json
nx run my-app:graphify --svg --graphml
```

To run extraction across the entire monorepo in one shot, run `graphify` on
the root project — every Nx workspace has a root `package.json` (if only to
depend on its own plugins), so the root is always a project too:

```bash
nx run my-workspace:graphify
```

(replace `my-workspace` with whatever `name` your root `package.json` has)

### `purge` (per project, including workspace root)

Runs `graphify uninstall --project --purge`, scoped to that project's own
directory (or the workspace root, if run there). This removes that
project's `graphify-out` directory — nothing else, no agent skills are
touched. Not cached, since deleting output isn't a reproducible build step.

```bash
# clean one project's graphify-out
nx run my-app:purge

# clean every project's graphify-out in one go
nx run-many -t purge

# clean only what's affected by your current changes
nx affected -t purge
```

## Options

| Option        | Type    | Default        | Description                                                 |
| ------------- | ------- | -------------- | ----------------------------------------------------------- |
| `outputDir`   | string  | `graphify-out` | Where outputs are written                                   |
| `mode`        | enum    | `normal`       | `normal` or `deep` (more aggressive inference)              |
| `update`      | boolean | `false`        | Re-extract changed files only, merge into graph             |
| `clusterOnly` | boolean | `false`        | Rerun clustering without re-extraction                      |
| `noViz`       | boolean | `false`        | Skip `graph.html`, produce report + JSON only               |
| `wiki`        | boolean | `false`        | Export Wikipedia-style markdown per community               |
| `obsidian`    | boolean | `false`        | Export an Obsidian vault                                    |
| `svg`         | boolean | `false`        | Export `graph.svg`                                          |
| `graphml`     | boolean | `false`        | Export `graph.graphml` (Gephi/yEd)                          |
| `neo4j`       | boolean | `false`        | Generate `cypher.txt`                                       |
| `neo4jPush`   | string  | —              | `bolt://` URL to push directly to Neo4j                     |
| `provider`    | object  | —              | `{ backend, model }` — select an LLM backend for extraction |

### `provider.backend` / `provider.model`

`provider.backend` is one of `azure`, `bedrock`, `claude`, `claude-cli`,
`deepseek`, `gemini`, `kimi`, `ollama`, `openai`. `provider.model` is a
free-text model identifier and is only valid alongside `provider.backend`
(setting `model` without `backend` throws).

```json
{
  "plugins": [
    {
      "plugin": "@fennet82/nx-graphify/plugin",
      "options": {
        "provider": { "backend": "openai", "model": "gpt-4" }
      }
    }
  ]
}
```

Using a local Ollama model instead, just for one project:

```json
{
  "name": "my-app",
  "targets": {
    "graphify": {
      "options": {
        "provider": { "backend": "ollama", "model": "llama3" }
      }
    }
  }
}
```

## Examples

Export an Obsidian vault and a Wikipedia-style markdown dump alongside the
default HTML graph, workspace-wide:

```json
{
  "plugins": [
    {
      "plugin": "@fennet82/nx-graphify/plugin",
      "options": { "obsidian": true, "wiki": true }
    }
  ]
}
```

Push straight to Neo4j instead of writing local exports, for one project
only:

```json
{
  "name": "my-app",
  "targets": {
    "graphify": {
      "options": {
        "noViz": true,
        "neo4j": true,
        "neo4jPush": "bolt://localhost:7687"
      }
    }
  }
}
```

Install Claude and Cursor skills, run an extraction, then clean up the
output for one project:

```bash
nx g @fennet82/nx-graphify:init --installAgent=claude --installAgent=cursor
nx run my-app:graphify
nx run my-app:purge
```
