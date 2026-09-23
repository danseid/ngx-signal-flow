import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

const workspaceDirectory = dirname(dirname(fileURLToPath(import.meta.url)));

const {values: options} = parseArgs({
  options: {
    coverage: {type: 'string', default: 'coverage/ngx-signal-flow/coverage-summary.json'},
    performance: {type: 'string', default: 'performance-report.json'},
    out: {type: 'string', default: 'badges'},
  },
});

const readJson = async (path) => JSON.parse(await readFile(resolve(workspaceDirectory, path), 'utf8'));

const coverageColor = (percentage) => {
  const thresholds = [
    [95, 'brightgreen'],
    [90, 'green'],
    [80, 'yellowgreen'],
    [70, 'yellow'],
    [60, 'orange'],
  ];
  return thresholds.find(([minimum]) => percentage >= minimum)?.[1] ?? 'red';
};

const kilobytes = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

const badge = (label, message, color) => ({schemaVersion: 1, label, message, color});

const coverage = (await readJson(options.coverage)).total;
const performance = await readJson(options.performance);
const statementCoverage = coverage.statements.pct;

const badges = {
  'coverage.json': badge('coverage', `${statementCoverage}%`, coverageColor(statementCoverage)),
  'branches.json': badge('branches', `${coverage.branches.pct}%`, coverageColor(coverage.branches.pct)),
  'bundle-size.json': badge('createStore gzip', kilobytes(performance.bundle.createStore.gzipBytes), 'blue'),
  'core-bundle-size.json': badge(
    'createCoreStore gzip',
    kilobytes(performance.bundle.createCoreStore.gzipBytes),
    'blue',
  ),
};

const outputDirectory = resolve(workspaceDirectory, options.out);
await mkdir(outputDirectory, {recursive: true});
await Promise.all(
  Object.entries(badges).map(([fileName, content]) =>
    writeFile(join(outputDirectory, fileName), `${JSON.stringify(content, null, 2)}\n`),
  ),
);

console.log(JSON.stringify(badges, null, 2));
