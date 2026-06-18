import { execSync } from 'child_process';

export function checkGraphifyInstalled(): boolean {
  try {
    execSync('graphify --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
