import type { ExecutorContext, PromiseExecutor } from '@nx/devkit';
import { logger } from '@nx/devkit';
import { assertGraphifyInstalled, runGraphifyCommand } from '../../utils/run-graphify';
import { buildGraphifyArgs } from '../../utils/build-args';
import type { GraphifyWorkspaceExecutorSchema } from './schema';

const runExecutor: PromiseExecutor<GraphifyWorkspaceExecutorSchema> = async (
  options,
  context: ExecutorContext
) => {
  assertGraphifyInstalled();

  const args = buildGraphifyArgs(options, context.root, 'workspace');
  const command = `graphify ${args.join(' ')}`;

  try {
    runGraphifyCommand(command, { cwd: context.root });
    return { success: true };
  } catch (error) {
    logger.error((error as Error).message);
    return { success: false };
  }
};

export default runExecutor;
