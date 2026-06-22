import type { InstallAgent } from '../../utils/types';

export interface AgentsGeneratorSchema {
  action: 'install' | 'uninstall';
  agent?: InstallAgent[];
}
