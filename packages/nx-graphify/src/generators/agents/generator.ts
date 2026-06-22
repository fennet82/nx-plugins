import { logger, type Tree } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import type { AgentsGeneratorSchema } from './schema';

export default async function agentsGenerator(
  _tree: Tree,
  options: AgentsGeneratorSchema,
) {
  if (!checkGraphifyInstalled()) {
    throw new Error(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install',
    );
  }

  const agents = options.agent ?? [];

  if (options.action === 'uninstall' && agents.length === 0) {
    throw new Error(
      'You must specify at least one --agent (e.g. --agent=claude --agent=cursor).',
    );
  }

  let command = `graphify ${options.action} --project`;
  if (agents.length === 0) {
    logger.warn(
      "You didn't specify an agent. You can use --agent (e.g. --agent=claude --agent=cursor), or run graphify install manually (e.g. `graphify install --platforms claude|cursor|...`).",
    );
  } else {
    command = `${command} --platform ${agents.join('|')}`;
  }

  logger.info(`Running: ${command}`);
  execSync(command, { stdio: 'inherit' });
}
