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
