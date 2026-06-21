import { describe, it, expect } from 'vitest';
import type { CreateNodesContext } from '@nx/devkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createNodes } from './index';

function fakeContext(): CreateNodesContext {
  return {
    nxJsonConfiguration: {},
    workspaceRoot: '/workspace',
    configFiles: [],
  } as CreateNodesContext;
}

describe('createNodes', () => {
  const [, createNodesFunction] = createNodes;

  it('attaches a graphify target to a matched project with default options', async () => {
    const result = await createNodesFunction(
      ['apps/foo/project.json'],
      {},
      fakeContext(),
    );

    const [, { projects }] = result[0];
    expect(projects!['apps/foo'].targets!.graphify).toEqual({
      executor: '@fennet82/nx-graphify:graphify',
      options: { outputDir: 'graphify-out', mode: 'normal' },
      inputs: ['default', '^default'],
      outputs: ['{projectRoot}/graphify-out'],
      cache: true,
    });
  });

  it('applies plugin-level option overrides from nx.json', async () => {
    const result = await createNodesFunction(
      ['apps/foo/project.json'],
      { mode: 'deep' },
      fakeContext(),
    );

    const [, { projects }] = result[0];
    expect(projects!['apps/foo'].targets!.graphify!.options).toEqual({
      outputDir: 'graphify-out',
      mode: 'deep',
    });
  });

  it('ignores an attempted outputDir override, since graphify does not support a custom output directory', async () => {
    const result = await createNodesFunction(
      ['apps/foo/project.json'],
      { outputDir: 'custom-out' },
      fakeContext(),
    );

    const [, { projects }] = result[0];
    expect(projects!['apps/foo'].targets!.graphify!.options.outputDir).toBe(
      'graphify-out',
    );
    expect(projects!['apps/foo'].targets!.graphify!.outputs).toEqual([
      '{projectRoot}/graphify-out',
    ]);
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

  it('attaches a graphify target to the workspace root the same way as any other project', async () => {
    const result = await createNodesFunction(
      ['package.json', 'apps/foo/project.json'],
      {},
      fakeContext(),
    );

    const projectsByRoot = Object.fromEntries(
      result.flatMap(([, { projects }]) => Object.entries(projects ?? {})),
    );

    expect(projectsByRoot['.'].targets!.graphify).toEqual({
      executor: '@fennet82/nx-graphify:graphify',
      options: { outputDir: 'graphify-out', mode: 'normal' },
      inputs: ['default', '^default'],
      outputs: ['{projectRoot}/graphify-out'],
      cache: true,
    });
  });

  it('only emits executor strings that are registered in executors.json', async () => {
    const executorsJsonPath = join(__dirname, '../../executors.json');
    const executorsJson = JSON.parse(
      readFileSync(executorsJsonPath, 'utf-8'),
    ) as {
      executors: Record<string, unknown>;
    };
    const registeredExecutorKeys = Object.keys(executorsJson.executors);

    const result = await createNodesFunction(
      ['package.json', 'apps/foo/project.json'],
      {},
      fakeContext(),
    );

    const emittedTargets = result.flatMap(([, { projects }]) =>
      Object.values(projects ?? {}).flatMap((project) =>
        Object.values(project.targets ?? {}),
      ),
    );

    const emittedExecutors = emittedTargets
      .map((target) => target.executor)
      .filter((executor): executor is string => typeof executor === 'string');

    expect(emittedExecutors.length).toBeGreaterThan(0);

    for (const executor of emittedExecutors) {
      const [pluginName, executorKey] = executor.split(':');
      expect(pluginName).toBe('@fennet82/nx-graphify');
      expect(registeredExecutorKeys).toContain(executorKey);
    }
  });

  it('attaches an uncached purge target to every matched project, including workspace root', async () => {
    const result = await createNodesFunction(
      ['package.json', 'apps/foo/project.json'],
      {},
      fakeContext(),
    );

    const projectsByRoot = Object.fromEntries(
      result.flatMap(([, { projects }]) => Object.entries(projects ?? {})),
    );

    expect(projectsByRoot['.'].targets!.purge).toEqual({
      executor: '@fennet82/nx-graphify:purge',
      options: { outputDir: 'graphify-out' },
    });
    expect(projectsByRoot['apps/foo'].targets!.purge).toEqual({
      executor: '@fennet82/nx-graphify:purge',
      options: { outputDir: 'graphify-out' },
    });
  });

  it('ignores an attempted outputDir override for the purge target options too', async () => {
    const result = await createNodesFunction(
      ['apps/foo/project.json'],
      { outputDir: 'custom-out' },
      fakeContext(),
    );

    const [, { projects }] = result[0];
    expect(projects!['apps/foo'].targets!.purge).toEqual({
      executor: '@fennet82/nx-graphify:purge',
      options: { outputDir: 'graphify-out' },
    });
  });
});
