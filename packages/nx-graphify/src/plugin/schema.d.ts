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
  genTarget?: string | GraphifyTargetOptions;
  updateTarget?: string | GraphifyTargetOptions;
  queryTarget?: string | GraphifyTargetOptions;
  pathTarget?: string | GraphifyTargetOptions;
  explainTarget?: string | GraphifyTargetOptions;
  prsTarget?: string | GraphifyTargetOptions;
  purgeTarget?: string | GraphifyTargetOptions;
}
