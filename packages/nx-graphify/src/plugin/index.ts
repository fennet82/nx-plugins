import type {
  CreateNodes,
  CreateNodesContext,
  TargetConfiguration,
} from '@nx/devkit';
import { createNodesFromFiles } from '@nx/devkit';
import { dirname } from 'node:path';
import type { GraphifyExecutorSchema } from '../executors/graphify/schema';
import type { GraphifyPluginOptions } from './schema';

const GRAPHIFY_CONFIG_GLOB = '{**/project.json,**/package.json}';

export function resolveGraphifyOptions(
  pluginOptions: GraphifyPluginOptions = {},
): GraphifyExecutorSchema {
  return {
    outputDir: pluginOptions.outputDir ?? 'graphify-out',
    mode: pluginOptions.mode ?? 'normal',
    ...(pluginOptions.update !== undefined && { update: pluginOptions.update }),
    ...(pluginOptions.clusterOnly !== undefined && {
      clusterOnly: pluginOptions.clusterOnly,
    }),
    ...(pluginOptions.noViz !== undefined && { noViz: pluginOptions.noViz }),
    ...(pluginOptions.wiki !== undefined && { wiki: pluginOptions.wiki }),
    ...(pluginOptions.obsidian !== undefined && {
      obsidian: pluginOptions.obsidian,
    }),
    ...(pluginOptions.svg !== undefined && { svg: pluginOptions.svg }),
    ...(pluginOptions.graphml !== undefined && {
      graphml: pluginOptions.graphml,
    }),
    ...(pluginOptions.neo4j !== undefined && { neo4j: pluginOptions.neo4j }),
    ...(pluginOptions.neo4jPush !== undefined && {
      neo4jPush: pluginOptions.neo4jPush,
    }),
    ...(pluginOptions.provider !== undefined && {
      provider: pluginOptions.provider,
    }),
  };
}

export const createNodes: CreateNodes<GraphifyPluginOptions> = [
  GRAPHIFY_CONFIG_GLOB,
  (
    configFiles: readonly string[],
    options: GraphifyPluginOptions | undefined,
    context: CreateNodesContext,
  ) => {
    return createNodesFromFiles(
      (configFile) => {
        const projectRoot = dirname(configFile);
        const resolvedOptions = resolveGraphifyOptions(options);

        const targets: Record<string, TargetConfiguration> = {
          graphify: {
            executor: '@fennet82/nx-graphify:graphify',
            options: resolvedOptions,
            inputs: ['default', '^default'],
            outputs: [`{projectRoot}/${resolvedOptions.outputDir}`],
            cache: true,
          },
          purge: {
            executor: '@fennet82/nx-graphify:purge',
            options: { outputDir: resolvedOptions.outputDir },
          },
        };

        if (projectRoot === '.') {
          targets['graphify-workspace'] = {
            executor: '@fennet82/nx-graphify:graphify-workspace',
            options: resolvedOptions,
            outputs: [`{workspaceRoot}/${resolvedOptions.outputDir}`],
            cache: true,
          };
        }

        return {
          projects: {
            [projectRoot]: { targets },
          },
        };
      },
      configFiles,
      options ?? {},
      context,
    );
  },
];

export const createNodesV2 = createNodes;
