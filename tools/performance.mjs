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
const checkMode = process.argv.includes('--check');

const median = (values) => values.toSorted((left, right) => left - right)[Math.floor(values.length / 2)];

const measureUpdates = ({createStore, withHistory}, count, recordHistory) => {
  const store = recordHistory ? createStore({count: 0}, withHistory()) : createStore({count: 0});
  const startedAt = performance.now();

  for (let index = 0; index < count; index++) {
    store.reduce((draft) => {
      draft.count++;
    });
  }

  return performance.now() - startedAt;
};

const measureHistoryScaling = (library) =>
  [1_000, 2_000, 4_000, 8_000].map((count) => {
    measureUpdates(library, count, false);
    measureUpdates(library, count, true);

    const plainMilliseconds = median(Array.from({length: 5}, () => measureUpdates(library, count, false)));
    const historyMilliseconds = median(Array.from({length: 5}, () => measureUpdates(library, count, true)));

    return {
      count,
      plainMilliseconds: Number(plainMilliseconds.toFixed(2)),
      historyMilliseconds: Number(historyMilliseconds.toFixed(2)),
      historyToPlainRatio: Number((historyMilliseconds / plainMilliseconds).toFixed(2)),
    };
  });

const measureRuntime = ({createStore, withHistory}) => {
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
  const effect = source.effect((value) => of(value));
  effect.reduce((draft, value) => {
    draft.count = value;
  });
  source(1);

  const historyStore = createStore({count: 0}, withHistory());
  let historyEmissionsAfterNoOp = 0;
  historyStore.asObservable().subscribe(() => historyEmissionsAfterNoOp++);
  historyStore.reduce(() => undefined);

  const selectorStore = createStore({selected: 0, unrelated: 0});
  let computeRuns = 0;
  const selectors = Array.from({length: 100}, () =>
    selectorStore.compute('selected', (value) => {
      computeRuns++;
      return value * 2;
    }),
  );
  selectors.forEach((selector) => selector());
  const runsBeforeUnrelatedUpdate = computeRuns;
  selectorStore.reduce((draft) => {
    draft.unrelated++;
  });
  selectors.forEach((selector) => selector());

  effect.destroy();
  source.destroy();

  return {
    noOpEmissions,
    effectEmissionsForOneResult,
    emptyPatchCreatesUndoStep: historyStore.canUndo(),
    patchEmissionsAfterNoOp: historyEmissionsAfterNoOp,
    selectorRecomputationsAfterUnrelatedUpdate: computeRuns - runsBeforeUnrelatedUpdate,
  };
};

const measureBundle = async (exportNames) => {
  const result = await build({
    stdin: {
      contents: `import {${exportNames.join(', ')}} from './dist/ngx-signal-flow/fesm2022/ngx-signal-flow.mjs'; globalThis.__ngxSignalFlow = [${exportNames.join(', ')}];`,
      resolveDir: workspaceDirectory,
      sourcefile: 'entry.mjs',
    },
    bundle: true,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    external: ['@angular/core', '@angular/core/*'],
    format: 'esm',
    logLevel: 'silent',
    minify: true,
    platform: 'browser',
    treeShaking: true,
    write: false,
  });
  const output = result.outputFiles[0].contents;

  return {
    minifiedBytes: output.byteLength,
    gzipBytes: gzipSync(output).byteLength,
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

const report = {
  runtime: measureRuntime(library),
  bundle: {
    createStore: await measureBundle(['createStore']),
    createStoreWithFeatures: await measureBundle(['createStore', 'withHistory', 'withMapSet']),
    createCoreStore: await measureBundle(['createCoreStore']),
  },
};

if (!checkMode) {
  report.historyScaling = measureHistoryScaling(library);
}

console.log(JSON.stringify(report, null, 2));

if (checkMode) {
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  const failures = checkBaseline(report, baseline);

  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
}
