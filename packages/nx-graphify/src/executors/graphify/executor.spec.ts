import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutorContext } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import executor from './executor';
import type { GraphifyExecutorSchema } from './schema';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('../../utils/check-graphify', () => ({
  checkGraphifyInstalled: vi.fn(),
}));

const baseOptions: GraphifyExecutorSchema = { outputDir: 'graphify-out' };

function makeContext(): ExecutorContext {
  return {
    root: '/repo',
    cwd: '/repo',
    isVerbose: false,
    projectName: 'foo',
    projectGraph: { nodes: {}, dependencies: {} },
    projectsConfigurations: {
      version: 2,
      projects: {
        foo: { root: 'apps/foo' },
      },
    },
    nxJsonConfiguration: {},
  } as unknown as ExecutorContext;
}

describe('graphify executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when graphify is not installed', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await expect(executor(baseOptions, makeContext())).rejects.toThrow(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install'
    );
    expect(execSync).not.toHaveBeenCalled();
  });

  it('runs graphify with the resolved project root and cwd, returning success', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (execSync as ReturnType<typeof vi.fn>).mockReturnValue(Buffer.from(''));

    const result = await executor(baseOptions, makeContext());

    expect(result).toEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith('graphify apps/foo --project foo', {
      stdio: 'inherit',
      cwd: '/repo',
    });
  });

  it('returns success: false and logs when execSync throws', async () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('graphify exited with code 1');
    });

    const result = await executor(baseOptions, makeContext());

    expect(result).toEqual({ success: false });
  });
});
