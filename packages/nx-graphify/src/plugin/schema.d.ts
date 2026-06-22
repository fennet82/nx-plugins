export interface GraphifyTargetOptions {
  name?: string;
  args?: string[];
  env?: Record<string, string>;
  envFile?: string;
  cwd?: string;
  configurations?: Record<
    string,
    Omit<GraphifyTargetOptions, 'configurations' | 'name'>
  >;
}

export interface GraphifyPluginOptions {
  extractGraphifyTargetName?: string | GraphifyTargetOptions;
  updateGraphifyTargetName?: string | GraphifyTargetOptions;
  queryGraphifyTargetName?: string | GraphifyTargetOptions;
  pathGraphifyTargetName?: string | GraphifyTargetOptions;
  explainGraphifyTargetName?: string | GraphifyTargetOptions;
  prsGraphifyTargetName?: string | GraphifyTargetOptions;
  purgeGraphifyTargetName?: string | GraphifyTargetOptions;
}
