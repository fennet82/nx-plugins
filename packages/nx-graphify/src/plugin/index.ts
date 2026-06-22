import type {
  CreateNodes,
  CreateNodesContext,
  TargetConfiguration,
} from '@nx/devkit';
import { createNodesFromFiles } from '@nx/devkit';
import { dirname } from 'node:path';
import type { GraphifyPluginOptions, GraphifyTargetOptions } from './schema';

const GRAPHIFY_CONFIG_GLOB = '{**/project.json,**/package.json}';

interface NormalizedGraphifyPluginOptions {
  genTarget: GraphifyTargetOptions;
  updateTarget: GraphifyTargetOptions;
  queryTarget: GraphifyTargetOptions;
  pathTarget: GraphifyTargetOptions;
  explainTarget: GraphifyTargetOptions;
  prsTarget: GraphifyTargetOptions;
  purgeTarget: GraphifyTargetOptions;
}

function normalizeTarget(
  target: string | GraphifyTargetOptions | undefined,
  defaultName: string,
): GraphifyTargetOptions {
  if (typeof target === 'string') {
    return { name: target };
  }
  if (target && typeof target === 'object') {
    return { ...target, name: target.name ?? defaultName };
  }
  return { name: defaultName };
}

export function normalizePluginOptions(
  options: GraphifyPluginOptions = {},
): NormalizedGraphifyPluginOptions {
  return {
    genTarget: normalizeTarget(options.genTarget, 'graphify:gen'),
    updateTarget: normalizeTarget(options.updateTarget, 'graphify:update'),
    queryTarget: normalizeTarget(options.queryTarget, 'graphify:query'),
    pathTarget: normalizeTarget(options.pathTarget, 'graphify:path'),
    explainTarget: normalizeTarget(options.explainTarget, 'graphify:explain'),
    prsTarget: normalizeTarget(options.prsTarget, 'graphify:prs'),
    purgeTarget: normalizeTarget(options.purgeTarget, 'graphify:purge'),
  };
}

function buildTargetOptions(
  target: GraphifyTargetOptions,
  projectRoot: string,
): Record<string, unknown> {
  const options: Record<string, unknown> = {
    cwd: target.cwd ?? projectRoot,
  };
  if (target.args) {
    options.args = target.args;
  }
  if (target.env) {
    options.env = target.env;
  }
  if (target.envFile) {
    options.envFile = target.envFile;
  }
  return options;
}

function buildTargetConfigurations(
  target: GraphifyTargetOptions,
  projectRoot: string,
): Record<string, unknown> | undefined {
  if (!target.configurations) {
    return undefined;
  }

  const configurations: Record<string, unknown> = {};
  for (const [configName, configOptions] of Object.entries(
    target.configurations,
  )) {
    configurations[configName] = buildTargetOptions(
      { ...configOptions, name: target.name },
      projectRoot,
    );
  }
  return configurations;
}

function buildCommandTarget(
  target: GraphifyTargetOptions,
  projectRoot: string,
  command: string,
  cacheable: boolean,
): TargetConfiguration {
  const configurations = buildTargetConfigurations(target, projectRoot);
  return {
    command,
    options: buildTargetOptions(target, projectRoot),
    ...(configurations && { configurations }),
    ...(cacheable && {
      cache: true,
      inputs: ['default', '^default'],
      outputs: ['{projectRoot}/graphify-out'],
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
        const normalized = normalizePluginOptions(options);

        const targets: Record<string, TargetConfiguration> = {
          [normalized.genTarget.name]: buildCommandTarget(
            normalized.genTarget,
            projectRoot,
            'graphify extract . {args}',
            true,
          ),
          [normalized.updateTarget.name]: buildCommandTarget(
            normalized.updateTarget,
            projectRoot,
            'graphify update . {args}',
            true,
          ),
          [normalized.queryTarget.name]: buildCommandTarget(
            normalized.queryTarget,
            projectRoot,
            'graphify query {args}',
            false,
          ),
          [normalized.pathTarget.name]: buildCommandTarget(
            normalized.pathTarget,
            projectRoot,
            'graphify path {args}',
            false,
          ),
          [normalized.explainTarget.name]: buildCommandTarget(
            normalized.explainTarget,
            projectRoot,
            'graphify explain {args}',
            false,
          ),
          [normalized.prsTarget.name]: buildCommandTarget(
            normalized.prsTarget,
            projectRoot,
            'graphify prs {args}',
            false,
          ),
          [normalized.purgeTarget.name]: buildCommandTarget(
            normalized.purgeTarget,
            projectRoot,
            'graphify uninstall --project --purge {args}',
            false,
          ),
        };

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
