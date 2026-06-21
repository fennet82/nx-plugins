import { logger, type Tree } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import type { UninstallAgentsGeneratorSchema } from './schema';

export default async function uninstallAgentsGenerator(
  tree: Tree,
  options: UninstallAgentsGeneratorSchema,
) {
  if (!checkGraphifyInstalled()) {
    throw new Error(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install',
    );
  }

  const agents = options.agent ?? [];
  if (agents.length === 0) {
    throw new Error(
      'You must specify at least one --agent (e.g. --agent=claude --agent=cursor).',
    );
  }

  const command = `graphify uninstall --project --platform ${agents.join('|')}`;
  logger.info(`Running: ${command}`);
  execSync(command, { stdio: 'inherit' });
}
