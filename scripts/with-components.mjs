import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'node_modules/@angular/cli/bin/ng.js');
const [command, ...args] = process.argv.slice(2);
if (!['build', 'serve', 'test'].includes(command)) {
  throw new Error('Usage: node scripts/with-components.mjs <build|serve|test> [Angular options]');
}


const watching = command === 'serve' || args.includes('--watch') || args.includes('--watch=true')
  || (command === 'test' && !args.includes('--watch=false'));
const children = new Set();
let stopping = false;
let application;

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    try {
      if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM');
      else child.kill('SIGTERM');
    } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
}
process.on('SIGINT', () => stop(130));
process.on('SIGTERM', () => stop(143));

function run(cliArgs, pipeOutput = false, libraryBuild = false) {
  const child = spawn(libraryBuild ? 'npm' : process.execPath, libraryBuild ? cliArgs : [cli, ...cliArgs], {
    cwd: root,
    detached: process.platform !== 'win32',
    stdio: pipeOutput ? ['inherit', 'pipe', 'pipe'] : 'inherit'
  });
  children.add(child);
  child.on('error', error => { console.error(error); stop(1); });
  child.on('exit', () => children.delete(child));
  return child;
}

function startApplication() {
  if (application || stopping) return;
  application = run([command, 'myscoutee', ...args]);
  application.on('exit', (code, signal) => stop(code ?? (signal ? 1 : 0)));
}

// One library build owner, then the application. In dev mode the same library
// process stays alive; ng serve observes its rebuilt output through the workspace dependency.
const library = run(['run', watching ? 'watch' : 'build', '--workspace', '@myscoutee/components'], watching, true);
if (watching) {
  let output = '';
  const observe = (chunk, target) => {
    target.write(chunk);
    output = (output + chunk.toString()).slice(-8192);
    if (/Built Angular Package/.test(output)) startApplication();
  };
  library.stdout.on('data', chunk => observe(chunk, process.stdout));
  library.stderr.on('data', chunk => observe(chunk, process.stderr));
}
library.on('exit', (code, signal) => {
  if (stopping) return;
  if (watching || code !== 0 || signal) stop(code || 1);
  else startApplication();
});
