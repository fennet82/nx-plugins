import type { ExecutorContext, PromiseExecutor } from '@nx/devkit';
import { logger } from '@nx/devkit';
import { assertGraphifyInstalled, runGraphifyCommand } from '../../utils/run-graphify';
import type { PurgeExecutorSchema } from './schema';

const runExecutor: PromiseExecutor<PurgeExecutorSchema> = async (
  options,
  context: ExecutorContext,
) => {
  assertGraphifyInstalled();

  const projectName = context.projectName as string;
  const projectRoot = context.projectsConfigurations.projects[projectName].root;
  const cwd = projectRoot === '.' ? context.root : `${context.root}/${projectRoot}`;

  // graphify does not yet support a custom output directory for `uninstall --purge`
  // (it always purges its hard-coded `graphify-out`). `options.outputDir` is kept
  // on this schema only so the inferred target's `outputs` declaration matches the
  // real on-disk path. Once graphify adds a flag for this, wire it in here:
  // if (options.outputDir && options.outputDir !== 'graphify-out') {
  //   args.push('--output-dir', options.outputDir);
  // }
  const command = `graphify uninstall --project --purge`;

  try {
    runGraphifyCommand(command, { cwd });
    return { success: true };
  } catch (error) {
    logger.error((error as Error).message);
    return { success: false };
  }
};

export default runExecutor;
