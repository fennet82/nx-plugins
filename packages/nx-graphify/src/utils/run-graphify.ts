import { logger } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from './check-graphify';

export function assertGraphifyInstalled(): void {
  if (!checkGraphifyInstalled()) {
    throw new Error(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install',
    );
  }
}

export function runGraphifyCommand(command: string, options: { cwd?: string } = {}): void {
  logger.info(`Running: ${command}`);
  execSync(command, { stdio: 'inherit', ...(options.cwd ? { cwd: options.cwd } : {}) });
}
