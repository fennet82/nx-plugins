import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { logger, readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import { DEFAULT_TARGET_NAMES } from '../../plugin';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import initGenerator from './generator';

vi.mock('../../utils/check-graphify', () => ({
  checkGraphifyInstalled: vi.fn(),
}));

const DEFAULT_PLUGIN_OPTIONS = {
  extractGraphifyTargetName: DEFAULT_TARGET_NAMES.extractGraphifyTargetName,
  updateGraphifyTargetName: DEFAULT_TARGET_NAMES.updateGraphifyTargetName,
  queryGraphifyTargetName: DEFAULT_TARGET_NAMES.queryGraphifyTargetName,
  pathGraphifyTargetName: DEFAULT_TARGET_NAMES.pathGraphifyTargetName,
  explainGraphifyTargetName: DEFAULT_TARGET_NAMES.explainGraphifyTargetName,
  prsGraphifyTargetName: DEFAULT_TARGET_NAMES.prsGraphifyTargetName,
  purgeGraphifyTargetName: DEFAULT_TARGET_NAMES.purgeGraphifyTargetName,
};

describe('init generator', () => {
  let tree: Tree;

  beforeEach(() => {
    vi.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  it('registers the plugin with full default target options', async () => {
    await initGenerator(tree, {});

    expect(readNxJson(tree)?.plugins).toEqual([
      {
        plugin: '@fennet82/nx-graphify/plugin',
        options: DEFAULT_PLUGIN_OPTIONS,
      },
    ]);
  });

  it('does not duplicate the plugin in nx.json if already registered as a string', async () => {
    const nxJson = readNxJson(tree)!;
    nxJson.plugins = ['@fennet82/nx-graphify/plugin'];
    updateNxJson(tree, nxJson);

    await initGenerator(tree, {});

    expect(readNxJson(tree)?.plugins).toEqual(['@fennet82/nx-graphify/plugin']);
  });

  it('does not duplicate the plugin in nx.json if already registered as an object', async () => {
    const nxJson = readNxJson(tree)!;
    nxJson.plugins = [
      {
        plugin: '@fennet82/nx-graphify/plugin',
        options: { extractGraphifyTargetName: 'extract' },
      },
    ];
    updateNxJson(tree, nxJson);

    await initGenerator(tree, {});

    expect(readNxJson(tree)?.plugins).toEqual([
      {
        plugin: '@fennet82/nx-graphify/plugin',
        options: { extractGraphifyTargetName: 'extract' },
      },
    ]);
  });

  it('warns but still registers the plugin when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const warnSpy = vi
      .spyOn(logger, 'warn')
      .mockImplementation(() => undefined);

    await initGenerator(tree, {});

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('graphify CLI not found'),
    );
    expect(readNxJson(tree)?.plugins).toEqual([
      {
        plugin: '@fennet82/nx-graphify/plugin',
        options: DEFAULT_PLUGIN_OPTIONS,
      },
    ]);
  });

  it('does not warn when graphify is installed', async () => {
    const warnSpy = vi
      .spyOn(logger, 'warn')
      .mockImplementation(() => undefined);

    await initGenerator(tree, {});

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
