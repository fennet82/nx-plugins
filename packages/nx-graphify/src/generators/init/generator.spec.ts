import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { logger, type Tree } from '@nx/devkit';
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
  });

  it('throws when installAgent is not set', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await expect(initGenerator(tree, {})).rejects.toThrow(
      'You must specify at least one --installAgent (e.g. --installAgent=claude --installAgent=cursor).'
    );
  });

  it('throws when installAgent is an empty array', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await expect(initGenerator(tree, { installAgent: [] })).rejects.toThrow(
      'You must specify at least one --installAgent (e.g. --installAgent=claude --installAgent=cursor).'
    );
  });

  it('throws when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await expect(initGenerator(tree, { installAgent: ['claude'] })).rejects.toThrow(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install'
    );
    expect(execSync).not.toHaveBeenCalled();
  });

  it('runs a single `graphify install --platforms <agent>` call for one agent', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await initGenerator(tree, { installAgent: ['claude'] });

    expect(execSync).toHaveBeenCalledWith('graphify install --platforms claude', {
      stdio: 'inherit',
    });
  });

  it('joins multiple agents with "|" in a single install command', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await initGenerator(tree, { installAgent: ['claude', 'cursor', 'codex'] });

    expect(execSync).toHaveBeenCalledWith(
      'graphify install --platforms claude|cursor|codex',
      { stdio: 'inherit' }
    );
    expect(execSync).toHaveBeenCalledTimes(1);
  });

  it('logs the command before running it', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    await initGenerator(tree, { installAgent: ['claude'] });

    expect(infoSpy).toHaveBeenCalledWith('Running: graphify install --platforms claude');
  });

  it('propagates the error when the install command fails', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('command not found');
    });

    await expect(initGenerator(tree, { installAgent: ['claude'] })).rejects.toThrow(
      'command not found'
    );
  });
});
