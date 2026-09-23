import {execFileSync} from 'node:child_process';
import {cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

const {values: versions} = parseArgs({
  options: {
    angular: {type: 'string', default: '22'},
    rxjs: {type: 'string', default: '7'},
    immer: {type: 'string', default: '11'},
    typescript: {type: 'string', default: '6.0'},
  },
});

const toolsDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = join(dirname(toolsDirectory), 'dist/ngx-signal-flow');
const consumerDirectory = mkdtempSync(join(tmpdir(), 'ngx-signal-flow-compatibility-'));

const run = (command, args, cwd) =>
  execFileSync(command, args, {cwd, stdio: 'inherit', shell: process.platform === 'win32'});

try {
  run('npm', ['pack', '--silent', '--pack-destination', consumerDirectory], packageDirectory);
  const tarball = readdirSync(consumerDirectory).find((file) => file.endsWith('.tgz'));
  cpSync(join(toolsDirectory, 'compatibility'), consumerDirectory, {recursive: true});
  writeFileSync(join(consumerDirectory, 'package.json'), JSON.stringify({private: true, type: 'module'}));

  console.log(`Checking against ${JSON.stringify(versions)}`);
  run(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--loglevel=error',
      `./${tarball}`,
      `@angular/core@${versions.angular}`,
      `rxjs@${versions.rxjs}`,
      `immer@${versions.immer}`,
      `typescript@${versions.typescript}`,
    ],
    consumerDirectory,
  );
  run('npx', ['tsc', '-p', '.'], consumerDirectory);
  run('node', ['out/consumer.js'], consumerDirectory);
} finally {
  rmSync(consumerDirectory, {recursive: true, force: true});
}
