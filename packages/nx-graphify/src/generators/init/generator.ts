import { logger, type Tree } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import type { InitGeneratorSchema } from './schema';

export default async function initGenerator(
  tree: Tree,
  options: InitGeneratorSchema,
) {
  if (!checkGraphifyInstalled()) {
    throw new Error(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install',
    );
  }

  let command = 'graphify install --project';
  const installAgents = options.installAgent ?? [];
  if (installAgents.length === 0) {
    logger.warn(
      "You didn't specify an agent to install you can use --installAgent (e.g. --installAgent=claude --installAgent=cursor), or run graphify install manually (e.g. `graphify install --platforms claude|cursor|...`).",
    );
  } else {
    command = `${command} --platform ${installAgents.join('|')}`;
  }

  logger.info(`Running: ${command}`);
  execSync(command, { stdio: 'inherit' });
}
