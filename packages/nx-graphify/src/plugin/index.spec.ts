import { describe, it, expect } from 'vitest';
import type { CreateNodesContext } from '@nx/devkit';
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
      fakeContext()
    );

    const [, { projects }] = result[0];
    expect(projects!['apps/foo'].targets!.graphify).toEqual({
      executor: 'nx-graphify:graphify',
      options: { outputDir: 'graphify-out', mode: 'normal' },
      inputs: ['default', '^default'],
      outputs: ['{projectRoot}/graphify-out'],
      cache: true,
    });
  });

  it('applies plugin-level option overrides from nx.json', async () => {
    const result = await createNodesFunction(
      ['apps/foo/project.json'],
      { outputDir: 'custom-out', mode: 'deep' },
      fakeContext()
    );

    const [, { projects }] = result[0];
    expect(projects!['apps/foo'].targets!.graphify!.options).toEqual({
      outputDir: 'custom-out',
      mode: 'deep',
    });
    expect(projects!['apps/foo'].targets!.graphify!.outputs).toEqual([
      '{projectRoot}/custom-out',
    ]);
  });

  it('attaches a target for every matched project independently', async () => {
    const result = await createNodesFunction(
      ['apps/foo/project.json', 'libs/bar/package.json'],
      {},
      fakeContext()
    );

    const projectRoots = result.flatMap(([, { projects }]) => Object.keys(projects ?? {}));
    expect(projectRoots.sort()).toEqual(['apps/foo', 'libs/bar']);
  });
});
