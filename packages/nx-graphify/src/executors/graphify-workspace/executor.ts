import type { ExecutorContext, PromiseExecutor } from '@nx/devkit';
import { logger } from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import { buildGraphifyArgs } from '../../utils/build-args';
import type { GraphifyWorkspaceExecutorSchema } from './schema';

const runExecutor: PromiseExecutor<GraphifyWorkspaceExecutorSchema> = async (
  options,
  context: ExecutorContext
) => {
  if (!checkGraphifyInstalled()) {
    throw new Error(
      'graphify CLI not found. See installation instructions at: https://github.com/safishamsi/graphify#install'
    );
  }

  const args = buildGraphifyArgs(options, context.root, 'workspace');
  const command = `graphify ${args.join(' ')}`;

  logger.info(`Running: ${command}`);

  try {
    execSync(command, { stdio: 'inherit', cwd: context.root });
    return { success: true };
  } catch (error) {
    logger.error((error as Error).message);
    return { success: false };
  }
};

export default runExecutor;
