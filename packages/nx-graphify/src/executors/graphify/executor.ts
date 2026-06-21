import type { ExecutorContext, PromiseExecutor } from '@nx/devkit';
import { logger } from '@nx/devkit';
import { assertGraphifyInstalled, runGraphifyCommand } from '../../utils/run-graphify';
import { buildGraphifyArgs } from '../../utils/build-args';
import type { GraphifyExecutorSchema } from './schema';

const runExecutor: PromiseExecutor<GraphifyExecutorSchema> = async (
  options,
  context: ExecutorContext
) => {
  assertGraphifyInstalled();

  const projectName = context.projectName as string;
  const projectRoot = context.projectsConfigurations.projects[projectName].root;
  const args = buildGraphifyArgs(options, projectRoot, projectName);
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
