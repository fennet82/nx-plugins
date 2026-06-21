import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from './check-graphify';
import { assertGraphifyInstalled, runGraphifyCommand } from './run-graphify';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('./check-graphify', () => ({
  checkGraphifyInstalled: vi.fn(),
}));

describe('assertGraphifyInstalled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not throw when graphify is installed', () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    expect(() => assertGraphifyInstalled()).not.toThrow();
  });

  it('throws when graphify is not installed', () => {
    (checkGraphifyInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);

    expect(() => assertGraphifyInstalled()).toThrow(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install',
    );
  });
});

describe('runGraphifyCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs the command and runs it without cwd when none is given', () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    runGraphifyCommand('graphify install --project --platforms claude');

    expect(infoSpy).toHaveBeenCalledWith('Running: graphify install --project --platforms claude');
    expect(execSync).toHaveBeenCalledWith('graphify install --project --platforms claude', {
      stdio: 'inherit',
    });
  });

  it('passes cwd through to execSync when given', () => {
    runGraphifyCommand('graphify uninstall --project --purge', { cwd: '/repo/apps/foo' });

    expect(execSync).toHaveBeenCalledWith('graphify uninstall --project --purge', {
      stdio: 'inherit',
      cwd: '/repo/apps/foo',
    });
  });

  it('propagates the error when execSync throws', () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('command not found');
    });

    expect(() => runGraphifyCommand('graphify install --project --platforms claude')).toThrow(
      'command not found',
    );
  });
});
