import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function isPortAvailable(port, hostname = '127.0.0.1') {
  return new Promise((resolveProbe, rejectProbe) => {
    const server = createServer();
    server.once('error', error => {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
        resolveProbe(false);
      } else {
        rejectProbe(error);
      }
    });
    server.listen(port, hostname, () => {
      server.close(error => {
        if (error) rejectProbe(error);
        else resolveProbe(true);
      });
    });
  });
}

export async function findAvailablePort(startPort = 3000, endPort = 3010, probe = isPortAvailable) {
  for (let port = startPort; port <= endPort; port += 1) {
    if (await probe(port)) return port;
  }
  throw new Error(`No available development port between ${startPort} and ${endPort}.`);
}

export async function run(args = process.argv.slice(2)) {
  const port = await findAvailablePort();
  const nextBin = resolve('node_modules/next/dist/bin/next');
  const child = spawn(process.execPath, [
    nextBin,
    'dev',
    ...args,
    '--hostname',
    '127.0.0.1',
    '--port',
    String(port)
  ], { stdio: 'inherit', windowsHide: true });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => child.kill(signal));
  }

  child.on('error', error => {
    console.error(`Could not start the Next.js development server: ${error.message}`);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    process.exitCode = signal ? 1 : code ?? 1;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run().catch(error => {
    console.error(`Could not select a development port: ${error.message}`);
    process.exitCode = 1;
  });
}
