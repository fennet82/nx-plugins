import { logger, readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import { DEFAULT_TARGET_NAMES } from '../../plugin';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import type { InitGeneratorSchema } from './schema';

const PLUGIN_PATH = '@fennet82/nx-graphify/plugin';

const DEFAULT_PLUGIN_OPTIONS = {
  extractGraphifyTargetName: DEFAULT_TARGET_NAMES.extractGraphifyTargetName,
  updateGraphifyTargetName: DEFAULT_TARGET_NAMES.updateGraphifyTargetName,
  queryGraphifyTargetName: DEFAULT_TARGET_NAMES.queryGraphifyTargetName,
  pathGraphifyTargetName: DEFAULT_TARGET_NAMES.pathGraphifyTargetName,
  explainGraphifyTargetName: DEFAULT_TARGET_NAMES.explainGraphifyTargetName,
  prsGraphifyTargetName: DEFAULT_TARGET_NAMES.prsGraphifyTargetName,
  purgeGraphifyTargetName: DEFAULT_TARGET_NAMES.purgeGraphifyTargetName,
};

export default async function initGenerator(
  tree: Tree,
  _options: InitGeneratorSchema,
) {
  if (!checkGraphifyInstalled()) {
    logger.warn(
      'graphify CLI not found. The plugin will still be registered, but its targets will fail until graphify is installed. See: https://github.com/safishamsi/graphify#install',
    );
  }

  registerPlugin(tree);
}

function registerPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson) {
    return;
  }

  const plugins = nxJson.plugins ?? [];
  const alreadyRegistered = plugins.some((plugin) =>
    typeof plugin === 'string'
      ? plugin === PLUGIN_PATH
      : plugin.plugin === PLUGIN_PATH,
  );
  if (alreadyRegistered) {
    return;
  }

  nxJson.plugins = [
    ...plugins,
    { plugin: PLUGIN_PATH, options: DEFAULT_PLUGIN_OPTIONS },
  ];
  updateNxJson(tree, nxJson);
}
