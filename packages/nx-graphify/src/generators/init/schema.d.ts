export type InstallAgent =
  | 'none'
  | 'claude'
  | 'codex'
  | 'opencode'
  | 'kilo'
  | 'aider'
  | 'copilot'
  | 'claw'
  | 'droid'
  | 'trae'
  | 'trae-cn'
  | 'hermes'
  | 'kiro'
  | 'pi'
  | 'codebuddy'
  | 'antigravity'
  | 'antigravity-windows'
  | 'windows'
  | 'kimi'
  | 'amp'
  | 'devin'
  | 'gemini'
  | 'cursor';

export interface InitGeneratorSchema {
  project?: string;
  all?: boolean;
  installAgent?: InstallAgent;
}
