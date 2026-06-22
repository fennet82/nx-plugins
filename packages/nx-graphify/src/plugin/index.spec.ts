import { describe, it, expect } from 'vitest';
import type { CreateNodesContext } from '@nx/devkit';
import { createNodes, normalizePluginOptions } from './index';

function fakeContext(): CreateNodesContext {
  return {
    nxJsonConfiguration: {},
    workspaceRoot: '/workspace',
    configFiles: [],
  } as CreateNodesContext;
}

describe('normalizePluginOptions', () => {
  it('fills in default target names when no options are given', () => {
    expect(normalizePluginOptions()).toEqual({
      genTarget: { name: 'graphify:gen' },
      updateTarget: { name: 'graphify:update' },
      queryTarget: { name: 'graphify:query' },
      pathTarget: { name: 'graphify:path' },
      explainTarget: { name: 'graphify:explain' },
      prsTarget: { name: 'graphify:prs' },
      purgeTarget: { name: 'graphify:purge' },
    });
  });

  it('treats a string option as just the target name', () => {
    expect(normalizePluginOptions({ genTarget: 'extract' }).genTarget).toEqual({
      name: 'extract',
    });
  });

  it('preserves object option fields and defaults the name if missing', () => {
    expect(
      normalizePluginOptions({
        queryTarget: { args: ['--budget', '500'] },
      }).queryTarget,
    ).toEqual({ name: 'graphify:query', args: ['--budget', '500'] });
  });
});

describe('createNodes', () => {
  const [, createNodesFunction] = createNodes;

  it('attaches all 7 default-named, command-based targets to a matched project', async () => {
    const result = await createNodesFunction(
      ['apps/foo/project.json'],
      {},
      fakeContext(),
    );

    const [, { projects }] = result[0];
    const targets = projects!['apps/foo'].targets!;

    expect(targets['graphify:gen']).toEqual({
      command: 'graphify extract . {args}',
      options: { cwd: 'apps/foo' },
      cache: true,
      inputs: ['default', '^default'],
      outputs: ['{projectRoot}/graphify-out'],
    });
    expect(targets['graphify:update']).toEqual({
      command: 'graphify update . {args}',
      options: { cwd: 'apps/foo' },
      cache: true,
      inputs: ['default', '^default'],
      outputs: ['{projectRoot}/graphify-out'],
    });
    expect(targets['graphify:query']).toEqual({
      command: 'graphify query {args}',
      options: { cwd: 'apps/foo' },
    });
    expect(targets['graphify:path']).toEqual({
      command: 'graphify path {args}',
      options: { cwd: 'apps/foo' },
    });
    expect(targets['graphify:explain']).toEqual({
      command: 'graphify explain {args}',
      options: { cwd: 'apps/foo' },
    });
    expect(targets['graphify:prs']).toEqual({
      command: 'graphify prs {args}',
      options: { cwd: 'apps/foo' },
    });
    expect(targets['graphify:purge']).toEqual({
      command: 'graphify uninstall --project --purge {args}',
      options: { cwd: 'apps/foo' },
    });
  });

  it('uses a custom target name from a string option', async () => {
    const result = await createNodesFunction(
      ['apps/foo/project.json'],
      { genTarget: 'extract' },
      fakeContext(),
    );

    const [, { projects }] = result[0];
    const targets = projects!['apps/foo'].targets!;
    expect(targets['extract']).toBeDefined();
    expect(targets['graphify:gen']).toBeUndefined();
  });

  it('passes through args/env/envFile/cwd overrides from an object option', async () => {
    const result = await createNodesFunction(
      ['apps/foo/project.json'],
      {
        queryTarget: {
          name: 'graphify:query',
          args: ['--budget', '500'],
          env: { GRAPHIFY_DEBUG: '1' },
          envFile: '.env.graphify',
          cwd: 'apps/foo/custom',
        },
      },
      fakeContext(),
    );

    const [, { projects }] = result[0];
    expect(projects!['apps/foo'].targets!['graphify:query']).toEqual({
      command: 'graphify query {args}',
      options: {
        cwd: 'apps/foo/custom',
        args: ['--budget', '500'],
        env: { GRAPHIFY_DEBUG: '1' },
        envFile: '.env.graphify',
      },
    });
  });

  it('builds per-configuration option overrides for a target', async () => {
    const result = await createNodesFunction(
      ['apps/foo/project.json'],
      {
        genTarget: {
          name: 'graphify:gen',
          configurations: { ci: { args: ['--no-cluster'] } },
        },
      },
      fakeContext(),
    );

    const [, { projects }] = result[0];
    expect(
      projects!['apps/foo'].targets!['graphify:gen'].configurations,
    ).toEqual({
      ci: { cwd: 'apps/foo', args: ['--no-cluster'] },
    });
  });

  it('attaches targets to the workspace root the same way as any other project', async () => {
    const result = await createNodesFunction(
      ['package.json', 'apps/foo/project.json'],
      {},
      fakeContext(),
    );

    const projectsByRoot = Object.fromEntries(
      result.flatMap(([, { projects }]) => Object.entries(projects ?? {})),
    );

    expect(projectsByRoot['.'].targets!['graphify:gen']).toEqual({
      command: 'graphify extract . {args}',
      options: { cwd: '.' },
      cache: true,
      inputs: ['default', '^default'],
      outputs: ['{projectRoot}/graphify-out'],
    });
  });

  it('attaches a target for every matched project independently', async () => {
    const result = await createNodesFunction(
      ['apps/foo/project.json', 'libs/bar/package.json'],
      {},
      fakeContext(),
    );

    const projectRoots = result.flatMap(([, { projects }]) =>
      Object.keys(projects ?? {}),
    );
    expect(projectRoots.sort()).toEqual(['apps/foo', 'libs/bar']);
  });
});
