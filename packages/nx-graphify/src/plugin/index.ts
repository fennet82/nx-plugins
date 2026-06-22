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
  genTarget: 'graphify:gen',
  updateTarget: 'graphify:update',
  queryTarget: 'graphify:query',
  pathTarget: 'graphify:path',
  explainTarget: 'graphify:explain',
  prsTarget: 'graphify:prs',
  purgeTarget: 'graphify:purge',
} as const;

type NormalizedGraphifyTargetOptions = GraphifyTargetOptions & {
  name: string;
};

interface NormalizedGraphifyPluginOptions {
  genTarget: NormalizedGraphifyTargetOptions;
  updateTarget: NormalizedGraphifyTargetOptions;
  queryTarget: NormalizedGraphifyTargetOptions;
  pathTarget: NormalizedGraphifyTargetOptions;
  explainTarget: NormalizedGraphifyTargetOptions;
  prsTarget: NormalizedGraphifyTargetOptions;
  purgeTarget: NormalizedGraphifyTargetOptions;
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
    genTarget: normalizeTarget(
      options.genTarget,
      DEFAULT_TARGET_NAMES.genTarget,
    ),
    updateTarget: normalizeTarget(
      options.updateTarget,
      DEFAULT_TARGET_NAMES.updateTarget,
    ),
    queryTarget: normalizeTarget(
      options.queryTarget,
      DEFAULT_TARGET_NAMES.queryTarget,
    ),
    pathTarget: normalizeTarget(
      options.pathTarget,
      DEFAULT_TARGET_NAMES.pathTarget,
    ),
    explainTarget: normalizeTarget(
      options.explainTarget,
      DEFAULT_TARGET_NAMES.explainTarget,
    ),
    prsTarget: normalizeTarget(
      options.prsTarget,
      DEFAULT_TARGET_NAMES.prsTarget,
    ),
    purgeTarget: normalizeTarget(
      options.purgeTarget,
      DEFAULT_TARGET_NAMES.purgeTarget,
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
