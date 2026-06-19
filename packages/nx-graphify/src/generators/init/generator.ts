import { logger, type Tree } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import type { InitGeneratorSchema } from './schema';

export default async function initGenerator(
  tree: Tree,
  options: InitGeneratorSchema
) {
  const installAgents = options.installAgent ?? [];
  if (installAgents.length === 0) {
    throw new Error(
      'You must specify at least one --installAgent (e.g. --installAgent=claude --installAgent=cursor).'
    );
  }

  if (!checkGraphifyInstalled()) {
    throw new Error(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install'
    );
  }

  const command = `graphify install --platforms ${installAgents.join('|')}`;
  logger.info(`Running: ${command}`);
  execSync(command, { stdio: 'inherit' });
}
