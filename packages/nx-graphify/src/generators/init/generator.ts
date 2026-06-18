import {
  formatFiles,
  getProjects,
  logger,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { execSync } from 'child_process';
import { checkGraphifyInstalled } from '../../utils/check-graphify';
import type { InitGeneratorSchema } from './schema';

export default async function initGenerator(
  tree: Tree,
  options: InitGeneratorSchema
) {
  if (!options.project && !options.all) {
    throw new Error(
      'You must specify either --project=<name> or --all to add the graphify target.'
    );
  }

  const graphifyInstalled = checkGraphifyInstalled();
  if (!graphifyInstalled) {
    logger.warn(
      'graphify CLI not found. See installation instructions at: ' +
        'https://github.com/safishamsi/graphify#install\n' +
        'Targets have been scaffolded and will work once graphify is installed.'
    );
  }

  const projects = getProjects(tree);
  const targetProjectNames = options.all
    ? Array.from(projects.keys())
    : [options.project as string];

  for (const projectName of targetProjectNames) {
    const config = projects.get(projectName);
    if (!config) {
      throw new Error(`Project "${projectName}" not found in the workspace.`);
    }

    updateProjectConfiguration(tree, projectName, {
      ...config,
      targets: {
        ...config.targets,
        graphify: {
          executor: 'nx-graphify:graphify',
          options: {
            outputDir: 'graphify-out',
          },
        },
      },
    });
  }

  const installAgent = options.installAgent ?? 'none';
  if (installAgent !== 'none') {
    if (!graphifyInstalled) {
      logger.warn(
        `Skipping agent installation — graphify must be installed first. ` +
          `Run \`graphify ${installAgent} install\` manually after installing graphify.`
      );
    } else {
      const command = `graphify ${installAgent} install`;
      logger.info(`Running: ${command}`);
      execSync(command, { stdio: 'inherit' });
    }
  }

  await formatFiles(tree);

  logger.info(
    `nx-graphify: added the "graphify" target to: ${targetProjectNames.join(', ')}` +
      (installAgent !== 'none' ? `\nConfigured AI assistant: ${installAgent}` : '')
  );
}
