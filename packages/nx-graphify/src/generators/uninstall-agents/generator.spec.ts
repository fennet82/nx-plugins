import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { logger, type Tree } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import uninstallAgentsGenerator from './generator';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('../../utils/check-graphify', () => ({
  checkGraphifyInstalled: vi.fn(),
}));

describe('uninstall-agents generator', () => {
  let tree: Tree;

  beforeEach(() => {
    vi.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
  });

  it('throws when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await expect(
      uninstallAgentsGenerator(tree, { agent: ['claude'] }),
    ).rejects.toThrow(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install',
    );
    expect(execSync).not.toHaveBeenCalled();
  });

  it('throws when agent is not set', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await expect(uninstallAgentsGenerator(tree, {})).rejects.toThrow(
      'You must specify at least one --agent (e.g. --agent=claude --agent=cursor).',
    );
    expect(execSync).not.toHaveBeenCalled();
  });

  it('throws when agent is an empty array', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await expect(uninstallAgentsGenerator(tree, { agent: [] })).rejects.toThrow(
      'You must specify at least one --agent (e.g. --agent=claude --agent=cursor).',
    );
    expect(execSync).not.toHaveBeenCalled();
  });

  it('runs a single `graphify uninstall --project --platform <agent>` call for one agent', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await uninstallAgentsGenerator(tree, { agent: ['claude'] });

    expect(execSync).toHaveBeenCalledWith(
      'graphify uninstall --project --platform claude',
      {
        stdio: 'inherit',
      },
    );
  });

  it('joins multiple agents with "|" in a single uninstall command', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await uninstallAgentsGenerator(tree, {
      agent: ['claude', 'cursor', 'codex'],
    });

    expect(execSync).toHaveBeenCalledWith(
      'graphify uninstall --project --platform claude|cursor|codex',
      { stdio: 'inherit' },
    );
    expect(execSync).toHaveBeenCalledTimes(1);
  });

  it('logs the command before running it', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const infoSpy = vi
      .spyOn(logger, 'info')
      .mockImplementation(() => undefined);

    await uninstallAgentsGenerator(tree, { agent: ['claude'] });

    expect(infoSpy).toHaveBeenCalledWith(
      'Running: graphify uninstall --project --platform claude',
    );
  });

  it('propagates the error when the uninstall command fails', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('command not found');
    });

    await expect(
      uninstallAgentsGenerator(tree, { agent: ['claude'] }),
    ).rejects.toThrow('command not found');
  });
});
