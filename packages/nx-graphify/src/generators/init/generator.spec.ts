import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addProjectConfiguration, logger, readProjectConfiguration, type Tree } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import initGenerator from './generator';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('../../utils/check-graphify', () => ({
  checkGraphifyInstalled: vi.fn(),
}));

describe('init generator', () => {
  let tree: Tree;

  beforeEach(() => {
    vi.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'foo', { root: 'apps/foo', targets: {} });
    addProjectConfiguration(tree, 'bar', { root: 'apps/bar', targets: {} });
  });

  it('throws when neither project nor all is set', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await expect(initGenerator(tree, {})).rejects.toThrow(
      'You must specify either --project=<name> or --all to add the graphify target.'
    );
  });

  it('adds the graphify target to the specified project only', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await initGenerator(tree, { project: 'foo' });

    const foo = readProjectConfiguration(tree, 'foo');
    expect(foo.targets?.graphify).toEqual({
      executor: 'nx-graphify:graphify',
      options: { outputDir: 'graphify-out' },
    });

    const bar = readProjectConfiguration(tree, 'bar');
    expect(bar.targets?.graphify).toBeUndefined();
  });

  it('adds the graphify target to every project when all is set', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await initGenerator(tree, { all: true });

    expect(readProjectConfiguration(tree, 'foo').targets?.graphify).toBeDefined();
    expect(readProjectConfiguration(tree, 'bar').targets?.graphify).toBeDefined();
  });

  it('warns instead of throwing when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    await initGenerator(tree, { project: 'foo' });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install'
      )
    );
    expect(readProjectConfiguration(tree, 'foo').targets?.graphify).toBeDefined();
  });

  it('runs `graphify <agent> install` after scaffolding when installAgent is set and graphify is installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await initGenerator(tree, { project: 'foo', installAgent: 'claude' });

    expect(execSync).toHaveBeenCalledWith('graphify claude install', {
      stdio: 'inherit',
    });
  });

  it('skips agent installation and warns when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    await initGenerator(tree, { project: 'foo', installAgent: 'claude' });

    expect(execSync).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Skipping agent installation — graphify must be installed first. Run `graphify claude install` manually after installing graphify.'
      )
    );
  });

  it('does not run agent installation when installAgent is "none"', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await initGenerator(tree, { project: 'foo', installAgent: 'none' });

    expect(execSync).not.toHaveBeenCalled();
  });
});
