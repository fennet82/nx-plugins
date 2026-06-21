import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutorContext } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import executor from './executor';
import type { PurgeExecutorSchema } from './schema';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('../../utils/check-graphify', () => ({
  checkGraphifyInstalled: vi.fn(),
}));

const baseOptions: PurgeExecutorSchema = { outputDir: 'graphify-out' };

function makeContext(projectName: string, projectRoot: string): ExecutorContext {
  return {
    root: '/repo',
    cwd: '/repo',
    projectName,
    isVerbose: false,
    projectGraph: { nodes: {}, dependencies: {} },
    projectsConfigurations: {
      version: 2,
      projects: { [projectName]: { root: projectRoot } },
    },
    nxJsonConfiguration: {},
  } as unknown as ExecutorContext;
}

describe('purge executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await expect(executor(baseOptions, makeContext('foo', 'apps/foo'))).rejects.toThrow(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install'
    );
    expect(execSync).not.toHaveBeenCalled();
  });

  it('runs `graphify uninstall --project --purge` with cwd set to the project root', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const result = await executor(baseOptions, makeContext('foo', 'apps/foo'));

    expect(execSync).toHaveBeenCalledWith('graphify uninstall --project --purge', {
      stdio: 'inherit',
      cwd: '/repo/apps/foo',
    });
    expect(result).toEqual({ success: true });
  });

  it('runs with cwd set to the workspace root when the project root is "."', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await executor(baseOptions, makeContext('workspace', '.'));

    expect(execSync).toHaveBeenCalledWith('graphify uninstall --project --purge', {
      stdio: 'inherit',
      cwd: '/repo',
    });
  });

  it('returns success: false when execSync throws', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('graphify exited with code 1');
    });

    const result = await executor(baseOptions, makeContext('foo', 'apps/foo'));

    expect(result).toEqual({ success: false });
  });
});
