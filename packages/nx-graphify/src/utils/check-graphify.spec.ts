import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from './check-graphify';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('checkGraphifyInstalled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when `graphify --version` succeeds', () => {
    (execSync as ReturnType<typeof vi.fn>).mockReturnValue(Buffer.from(''));

    expect(checkGraphifyInstalled()).toBe(true);
    expect(execSync).toHaveBeenCalledWith('graphify --version', {
      stdio: 'ignore',
    });
  });

  it('returns false when `graphify --version` throws', () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('command not found');
    });

    expect(checkGraphifyInstalled()).toBe(false);
  });
});
