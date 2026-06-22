import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { logger, type Tree } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import agentsGenerator from './generator';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('../../utils/check-graphify', () => ({
  checkGraphifyInstalled: vi.fn(),
}));

describe('agents generator', () => {
  let tree: Tree;

  beforeEach(() => {
    vi.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  it('throws when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await expect(
      agentsGenerator(tree, { action: 'install', agent: ['claude'] }),
    ).rejects.toThrow(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install',
    );
    expect(execSync).not.toHaveBeenCalled();
  });

  it('throws when uninstall is run with no --agent', async () => {
    await expect(
      agentsGenerator(tree, { action: 'uninstall' }),
    ).rejects.toThrow(
      'You must specify at least one --agent (e.g. --agent=claude --agent=cursor).',
    );
    expect(execSync).not.toHaveBeenCalled();
  });

  it('runs `graphify uninstall --project --platform <agent>` for uninstall', async () => {
    await agentsGenerator(tree, { action: 'uninstall', agent: ['claude'] });

    expect(execSync).toHaveBeenCalledWith(
      'graphify uninstall --project --platform claude',
      { stdio: 'inherit' },
    );
  });

  it('joins multiple agents with "|" for uninstall', async () => {
    await agentsGenerator(tree, {
      action: 'uninstall',
      agent: ['claude', 'cursor', 'codex'],
    });

    expect(execSync).toHaveBeenCalledWith(
      'graphify uninstall --project --platform claude|cursor|codex',
      { stdio: 'inherit' },
    );
  });

  it('warns and omits --platform when install is run with no --agent', async () => {
    const warnSpy = vi
      .spyOn(logger, 'warn')
      .mockImplementation(() => undefined);

    await agentsGenerator(tree, { action: 'install' });

    expect(warnSpy).toHaveBeenCalled();
    expect(execSync).toHaveBeenCalledWith('graphify install --project', {
      stdio: 'inherit',
    });
  });

  it('runs `graphify install --project --platform <agent>` for one agent', async () => {
    await agentsGenerator(tree, { action: 'install', agent: ['claude'] });

    expect(execSync).toHaveBeenCalledWith(
      'graphify install --project --platform claude',
      { stdio: 'inherit' },
    );
  });

  it('logs the command before running it', async () => {
    const infoSpy = vi
      .spyOn(logger, 'info')
      .mockImplementation(() => undefined);

    await agentsGenerator(tree, { action: 'install', agent: ['claude'] });

    expect(infoSpy).toHaveBeenCalledWith(
      'Running: graphify install --project --platform claude',
    );
  });

  it('propagates the error when the command fails', async () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('command not found');
    });

    await expect(
      agentsGenerator(tree, { action: 'install', agent: ['claude'] }),
    ).rejects.toThrow('command not found');
  });
});
