import { type Tree } from '@nx/devkit';
import { assertGraphifyInstalled, runGraphifyCommand } from '../../utils/run-graphify';
import type { UninstallAgentsGeneratorSchema } from './schema';

export default async function uninstallAgentsGenerator(
  tree: Tree,
  options: UninstallAgentsGeneratorSchema,
) {
  assertGraphifyInstalled();

  const agents = options.agent ?? [];
  if (agents.length === 0) {
    throw new Error(
      'You must specify at least one --agent (e.g. --agent=claude --agent=cursor).',
    );
  }

  const command = `graphify uninstall --project --platform ${agents.join('|')}`;
  runGraphifyCommand(command);
}
