export interface GraphifyArgsOptions {
  mode?: 'normal' | 'deep';
  update?: boolean;
  clusterOnly?: boolean;
  noViz?: boolean;
  wiki?: boolean;
  obsidian?: boolean;
  svg?: boolean;
  graphml?: boolean;
  neo4j?: boolean;
  neo4jPush?: string;
}

export function buildGraphifyArgs(
  options: GraphifyArgsOptions,
  targetPath: string,
  projectName: string
): string[] {
  const args: string[] = [targetPath];
  if (options.mode === 'deep') args.push('--mode', 'deep');
  if (options.update) args.push('--update');
  if (options.clusterOnly) args.push('--cluster-only');
  if (options.noViz) args.push('--no-viz');
  if (options.wiki) args.push('--wiki');
  if (options.obsidian) args.push('--obsidian');
  if (options.svg) args.push('--svg');
  if (options.graphml) args.push('--graphml');
  if (options.neo4j) args.push('--neo4j');
  if (options.neo4jPush) args.push('--neo4j-push', options.neo4jPush);
  args.push('--project', projectName);
  return args;
}
