import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {dirname, join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {of} from 'rxjs';

const toolsDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceDirectory = dirname(toolsDirectory);
const bundlePath = join(workspaceDirectory, 'dist/ngx-signal-flow/fesm2022/ngx-signal-flow.mjs');
const baselinePath = join(toolsDirectory, 'performance-baseline.json');

const median = values => values.sort((left, right) => left - right)[Math.floor(values.length / 2)];

const measureUpdates = (createStore, count, withPatches) => {
  const store = createStore({count: 0}, withPatches ? {withPatches: true} : undefined);
  const startedAt = performance.now();

  for (let index = 0; index < count; index++) {
    store.reduce(draft => {
      draft.count++;
    });
  }

  return performance.now() - startedAt;
};

const measureHistoryScaling = createStore => [1_000, 2_000, 4_000, 8_000].map(count => {
  measureUpdates(createStore, count, false);
  measureUpdates(createStore, count, true);

  const plainSamples = Array.from({length: 5}, () => measureUpdates(createStore, count, false));
  const patchSamples = Array.from({length: 5}, () => measureUpdates(createStore, count, true));
  const plainMilliseconds = median(plainSamples);
  const patchMilliseconds = median(patchSamples);

  return {
    count,
    plainMilliseconds: Number(plainMilliseconds.toFixed(2)),
    patchMilliseconds: Number(patchMilliseconds.toFixed(2)),
    patchToPlainRatio: Number((patchMilliseconds / plainMilliseconds).toFixed(2))
  };
});

const measureRuntime = createStore => {
  const noOpStore = createStore({count: 0});
  let noOpEmissions = 0;
  noOpStore.asObservable().subscribe(() => noOpEmissions++);

  for (let index = 0; index < 1_000; index++) {
    noOpStore.reduce(() => undefined);
  }

  const effectStore = createStore({count: 0});
  let effectEmissionsForOneResult = 0;
  effectStore.asObservable().subscribe(() => effectEmissionsForOneResult++);
  const source = effectStore.source();
  const effect = source.effect(value => of(value));
  effect.reduce((draft, value) => {
    draft.count = value;
  });
  source(1);

  const patchStore = createStore({count: 0}, {withPatches: true});
  let patchEmissionsAfterNoOp = 0;
  patchStore.asObservable().subscribe(() => patchEmissionsAfterNoOp++);
  patchStore.reduce(() => undefined);

  const selectorStore = createStore({selected: 0, unrelated: 0});
  let computeRuns = 0;
  const selectors = Array.from({length: 100}, () => selectorStore.compute('selected', value => {
    computeRuns++;
    return value * 2;
  }));
  selectors.forEach(selector => selector());
  const runsBeforeUnrelatedUpdate = computeRuns;
  selectorStore.reduce(draft => {
    draft.unrelated++;
  });
  selectors.forEach(selector => selector());

  effect.destroy?.();
  source.destroy?.();

  return {
    noOpEmissions,
    effectEmissionsForOneResult,
    emptyPatchCreatesUndoStep: patchStore.canUndo(),
    patchEmissionsAfterNoOp,
    selectorRecomputationsAfterUnrelatedUpdate: computeRuns - runsBeforeUnrelatedUpdate,
    historyScaling: measureHistoryScaling(createStore)
  };
};

const measureBundle = async exportName => {
  const result = await build({
    stdin: {
      contents: `import {${exportName}} from './dist/ngx-signal-flow/fesm2022/ngx-signal-flow.mjs'; globalThis.__ngxSignalFlow = ${exportName};`,
      resolveDir: workspaceDirectory,
      sourcefile: `${exportName}.mjs`
    },
    bundle: true,
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    external: ['@angular/core', '@angular/core/*'],
    format: 'esm',
    logLevel: 'silent',
    minify: true,
    platform: 'browser',
    treeShaking: true,
    write: false
  });
  const output = result.outputFiles[0].contents;

  return {
    minifiedBytes: output.byteLength,
    gzipBytes: gzipSync(output).byteLength
  };
};

const checkBaseline = (report, baseline) => {
  const failures = [];

  for (const [metric, expected] of Object.entries(baseline.runtime)) {
    if (report.runtime[metric] !== expected) {
      failures.push(`runtime.${metric}: expected ${expected}, received ${report.runtime[metric]}`);
    }
  }

  for (const [entryPoint, limits] of Object.entries(baseline.bundle)) {
    const measurement = report.bundle[entryPoint];
    if (!measurement) {
      failures.push(`bundle.${entryPoint}: entry point was not measured`);
      continue;
    }

    for (const [metric, maximum] of Object.entries(limits)) {
      if (measurement[metric] > maximum) {
        failures.push(`bundle.${entryPoint}.${metric}: maximum ${maximum}, received ${measurement[metric]}`);
      }
    }
  }

  return failures;
};

const library = await import(`${pathToFileURL(bundlePath).href}?performance=${Date.now()}`);
const bundle = {
  createStore: await measureBundle('createStore')
};

if (library.createCoreStore) {
  bundle.createCoreStore = await measureBundle('createCoreStore');
}

const report = {
  runtime: measureRuntime(library.createStore),
  bundle
};

console.log(JSON.stringify(report, null, 2));

if (process.argv.includes('--check')) {
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  const failures = checkBaseline(report, baseline);

  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
}
