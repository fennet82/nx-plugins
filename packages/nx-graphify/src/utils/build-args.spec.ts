import { describe, it, expect } from 'vitest';
import { buildGraphifyArgs, type GraphifyArgsOptions } from './build-args';

describe('buildGraphifyArgs', () => {
  it('returns just the target path and --project for default options', () => {
    const options: GraphifyArgsOptions = {};

    expect(buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--project',
      'foo',
    ]);
  });

  it('adds --mode deep when mode is "deep"', () => {
    const options: GraphifyArgsOptions = { mode: 'deep' };

    expect(buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--mode',
      'deep',
      '--project',
      'foo',
    ]);
  });

  it('omits --mode when mode is "normal"', () => {
    const options: GraphifyArgsOptions = { mode: 'normal' };

    expect(buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--project',
      'foo',
    ]);
  });

  it('adds every boolean flag when set', () => {
    const options: GraphifyArgsOptions = {
      update: true,
      clusterOnly: true,
      noViz: true,
      wiki: true,
      obsidian: true,
      svg: true,
      graphml: true,
      neo4j: true,
    };

    expect(buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--update',
      '--cluster-only',
      '--no-viz',
      '--wiki',
      '--obsidian',
      '--svg',
      '--graphml',
      '--neo4j',
      '--project',
      'foo',
    ]);
  });

  it('adds --neo4j-push with its value when set', () => {
    const options: GraphifyArgsOptions = { neo4jPush: 'bolt://localhost:7687' };

    expect(buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--neo4j-push',
      'bolt://localhost:7687',
      '--project',
      'foo',
    ]);
  });

  it('omits boolean flags that are false', () => {
    const options: GraphifyArgsOptions = {
      update: false,
      clusterOnly: false,
      noViz: false,
      wiki: false,
      obsidian: false,
      svg: false,
      graphml: false,
      neo4j: false,
    };

    expect(buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--project',
      'foo',
    ]);
  });

  it('always appends --project last, using the workspace constant for graphify-workspace', () => {
    expect(buildGraphifyArgs({}, '/repo', 'workspace')).toEqual([
      '/repo',
      '--project',
      'workspace',
    ]);
  });
});
