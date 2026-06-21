import { logger, type Tree } from '@nx/devkit';
import { assertGraphifyInstalled, runGraphifyCommand } from '../../utils/run-graphify';
import type { InitGeneratorSchema } from './schema';

export default async function initGenerator(
  tree: Tree,
  options: InitGeneratorSchema,
) {
  assertGraphifyInstalled();

  const installAgents = options.installAgent ?? [];
  if (installAgents.length === 0) {
    logger.warn(
      "You didn't specify an agent to install you can use --installAgent (e.g. --installAgent=claude --installAgent=cursor), or run graphify install manually (e.g. `graphify install --platforms claude|cursor|...`).",
    );
  }

  const command = `graphify install --project --platforms ${installAgents.join('|')}`;
  runGraphifyCommand(command);
}
