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

  it('warns and omits --platform when installAgent is not set', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const warnSpy = vi
      .spyOn(logger, 'warn')
      .mockImplementation(() => undefined);

    await initGenerator(tree, {});

    expect(warnSpy).toHaveBeenCalledWith(
      "You didn't specify an agent to install you can use --installAgent (e.g. --installAgent=claude --installAgent=cursor), or run graphify install manually (e.g. `graphify install --platforms claude|cursor|...`).",
    );
    expect(execSync).toHaveBeenCalledWith('graphify install --project', {
      stdio: 'inherit',
    });
  });

  it('warns and omits --platform when installAgent is an empty array', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const warnSpy = vi
      .spyOn(logger, 'warn')
      .mockImplementation(() => undefined);

    await initGenerator(tree, { installAgent: [] });

    expect(warnSpy).toHaveBeenCalled();
    expect(execSync).toHaveBeenCalledWith('graphify install --project', {
      stdio: 'inherit',
    });
  });

  it('throws when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await expect(
      initGenerator(tree, { installAgent: ['claude'] }),
    ).rejects.toThrow(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install',
    );
    expect(execSync).not.toHaveBeenCalled();
  });

  it('runs a single `graphify install --project --platform <agent>` call for one agent', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await initGenerator(tree, { installAgent: ['claude'] });

    expect(execSync).toHaveBeenCalledWith(
      'graphify install --project --platform claude',
      {
        stdio: 'inherit',
      },
    );
  });

  it('joins multiple agents with "|" in a single install command', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await initGenerator(tree, { installAgent: ['claude', 'cursor', 'codex'] });

    expect(execSync).toHaveBeenCalledWith(
      'graphify install --project --platform claude|cursor|codex',
      { stdio: 'inherit' },
    );
    expect(execSync).toHaveBeenCalledTimes(1);
  });

  it('logs the command before running it', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const infoSpy = vi
      .spyOn(logger, 'info')
      .mockImplementation(() => undefined);

    await initGenerator(tree, { installAgent: ['claude'] });

    expect(infoSpy).toHaveBeenCalledWith(
      'Running: graphify install --project --platform claude',
    );
  });

  it('propagates the error when the install command fails', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('command not found');
    });

    await expect(
      initGenerator(tree, { installAgent: ['claude'] }),
    ).rejects.toThrow('command not found');
  });
});
