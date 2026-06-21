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

That's it — every project automatically gets `graphify` and `purge` targets,
and the workspace root additionally gets a `graphify-workspace` target. No
generator, no per-project scaffolding.

The `options` block sets workspace-wide defaults (any of the options in the
table below). An individual project can still override them by adding its
own `targets.graphify.options` to its `project.json` — Nx merges that over
the inferred defaults automatically.

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

```bash
nx run my-app:graphify
```

Runs Graphify against a single project's root, scoped via `--project`.
Outputs (`graph.html`, `graph.json`, `GRAPH_REPORT.md`, and any optional
exports) are written to `options.outputDir` (default `graphify-out`) and are
cached by Nx like any other target.

### `graphify-workspace` (whole monorepo)

Automatically attached to the workspace root once the plugin is registered
in `nx.json` (see Setup). Runs Graphify against the entire workspace from
`context.root`.

### `purge` (per project, including workspace root)

```bash
nx run my-app:purge
```

Runs `graphify uninstall --project --purge`, scoped to that project's own
directory (or the workspace root, if run there). This removes that
project's `graphify-out` directory — nothing else, no agent skills are
touched. Not cached, since deleting output isn't a reproducible build step.

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

`provider.backend` is one of `azure`, `bedrock`, `claude`, `claude-cli`,
`deepseek`, `gemini`, `kimi`, `ollama`, `openai`. `provider.model` is a
free-text model identifier and is only valid alongside `provider.backend`:

```json
{
  "targets": {
    "graphify": {
      "options": {
        "provider": { "backend": "openai", "model": "gpt-4" }
      }
    }
  }
}
```
