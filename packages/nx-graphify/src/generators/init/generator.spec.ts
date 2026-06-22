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
  genTarget: { name: DEFAULT_TARGET_NAMES.genTarget },
  updateTarget: { name: DEFAULT_TARGET_NAMES.updateTarget },
  queryTarget: { name: DEFAULT_TARGET_NAMES.queryTarget },
  pathTarget: { name: DEFAULT_TARGET_NAMES.pathTarget },
  explainTarget: { name: DEFAULT_TARGET_NAMES.explainTarget },
  prsTarget: { name: DEFAULT_TARGET_NAMES.prsTarget },
  purgeTarget: { name: DEFAULT_TARGET_NAMES.purgeTarget },
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
        options: { genTarget: 'extract' },
      },
    ];
    updateNxJson(tree, nxJson);

    await initGenerator(tree, {});

    expect(readNxJson(tree)?.plugins).toEqual([
      {
        plugin: '@fennet82/nx-graphify/plugin',
        options: { genTarget: 'extract' },
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
