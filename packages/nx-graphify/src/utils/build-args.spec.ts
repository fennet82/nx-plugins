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

  it('adds --backend when provider.backend is set', () => {
    const options: GraphifyArgsOptions = { provider: { backend: 'openai' } };

    expect(buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--backend',
      'openai',
      '--project',
      'foo',
    ]);
  });

  it('adds --backend and --model when both provider.backend and provider.model are set', () => {
    const options: GraphifyArgsOptions = {
      provider: { backend: 'openai', model: 'gpt-4' },
    };

    expect(buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--backend',
      'openai',
      '--model',
      'gpt-4',
      '--project',
      'foo',
    ]);
  });

  it('omits --backend/--model when provider is not set', () => {
    expect(buildGraphifyArgs({}, '/repo/apps/foo', 'foo')).toEqual([
      '/repo/apps/foo',
      '--project',
      'foo',
    ]);
  });

  it('throws when provider.model is set without provider.backend', () => {
    const options: GraphifyArgsOptions = { provider: { model: 'gpt-4' } };

    expect(() => buildGraphifyArgs(options, '/repo/apps/foo', 'foo')).toThrow(
      'provider.model requires provider.backend to be set (e.g. provider: { backend: "openai", model: "gpt-4" }).',
    );
  });
});
