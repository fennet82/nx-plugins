import type {
  CreateNodes,
  CreateNodesContext,
  TargetConfiguration,
} from '@nx/devkit';
import { createNodesFromFiles } from '@nx/devkit';
import { dirname } from 'node:path';
import type { GraphifyPluginOptions, GraphifyTargetOptions } from './schema';

const GRAPHIFY_CONFIG_GLOB = '{**/project.json,**/package.json}';

export const DEFAULT_TARGET_NAMES = {
  extractGraphifyTargetName: 'graphify:extract',
  updateGraphifyTargetName: 'graphify:update',
  queryGraphifyTargetName: 'graphify:query',
  pathGraphifyTargetName: 'graphify:path',
  explainGraphifyTargetName: 'graphify:explain',
  prsGraphifyTargetName: 'graphify:prs',
  purgeGraphifyTargetName: 'graphify:purge',
} as const;

type NormalizedGraphifyTargetOptions = GraphifyTargetOptions & {
  name: string;
};

interface NormalizedGraphifyPluginOptions {
  extractGraphifyTargetName: NormalizedGraphifyTargetOptions;
  updateGraphifyTargetName: NormalizedGraphifyTargetOptions;
  queryGraphifyTargetName: NormalizedGraphifyTargetOptions;
  pathGraphifyTargetName: NormalizedGraphifyTargetOptions;
  explainGraphifyTargetName: NormalizedGraphifyTargetOptions;
  prsGraphifyTargetName: NormalizedGraphifyTargetOptions;
  purgeGraphifyTargetName: NormalizedGraphifyTargetOptions;
}

function normalizeTarget(
  target: string | GraphifyTargetOptions | undefined,
  defaultName: string,
): NormalizedGraphifyTargetOptions {
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
    extractGraphifyTargetName: normalizeTarget(
      options.extractGraphifyTargetName,
      DEFAULT_TARGET_NAMES.extractGraphifyTargetName,
    ),
    updateGraphifyTargetName: normalizeTarget(
      options.updateGraphifyTargetName,
      DEFAULT_TARGET_NAMES.updateGraphifyTargetName,
    ),
    queryGraphifyTargetName: normalizeTarget(
      options.queryGraphifyTargetName,
      DEFAULT_TARGET_NAMES.queryGraphifyTargetName,
    ),
    pathGraphifyTargetName: normalizeTarget(
      options.pathGraphifyTargetName,
      DEFAULT_TARGET_NAMES.pathGraphifyTargetName,
    ),
    explainGraphifyTargetName: normalizeTarget(
      options.explainGraphifyTargetName,
      DEFAULT_TARGET_NAMES.explainGraphifyTargetName,
    ),
    prsGraphifyTargetName: normalizeTarget(
      options.prsGraphifyTargetName,
      DEFAULT_TARGET_NAMES.prsGraphifyTargetName,
    ),
    purgeGraphifyTargetName: normalizeTarget(
      options.purgeGraphifyTargetName,
      DEFAULT_TARGET_NAMES.purgeGraphifyTargetName,
    ),
  };
}

function buildTargetOptions(
  target: NormalizedGraphifyTargetOptions,
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
  target: NormalizedGraphifyTargetOptions,
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
  target: NormalizedGraphifyTargetOptions,
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
          [normalized.extractGraphifyTargetName.name]: buildCommandTarget(
            normalized.extractGraphifyTargetName,
            projectRoot,
            'graphify extract . {args}',
            true,
          ),
          [normalized.updateGraphifyTargetName.name]: buildCommandTarget(
            normalized.updateGraphifyTargetName,
            projectRoot,
            'graphify update . {args}',
            true,
          ),
          [normalized.queryGraphifyTargetName.name]: buildCommandTarget(
            normalized.queryGraphifyTargetName,
            projectRoot,
            'graphify query {args}',
            false,
          ),
          [normalized.pathGraphifyTargetName.name]: buildCommandTarget(
            normalized.pathGraphifyTargetName,
            projectRoot,
            'graphify path {args}',
            false,
          ),
          [normalized.explainGraphifyTargetName.name]: buildCommandTarget(
            normalized.explainGraphifyTargetName,
            projectRoot,
            'graphify explain {args}',
            false,
          ),
          [normalized.prsGraphifyTargetName.name]: buildCommandTarget(
            normalized.prsGraphifyTargetName,
            projectRoot,
            'graphify prs {args}',
            false,
          ),
          [normalized.purgeGraphifyTargetName.name]: buildCommandTarget(
            normalized.purgeGraphifyTargetName,
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
