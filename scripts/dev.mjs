import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number.parseInt(process.env.PORT || '5174', 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid PORT value: ${process.env.PORT}`);
  process.exit(1);
}

function windowsListeners() {
  const output = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields[0] !== 'TCP' || fields[3] !== 'LISTENING') continue;
    if (!fields[1].endsWith(`:${port}`)) continue;
    const pid = Number(fields[4]);
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) pids.add(pid);
  }
  return [...pids];
}

function unixListeners() {
  try {
    const output = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
    return [...new Set(output.split(/\s+/).map(Number).filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid))];
  } catch (error) {
    if (error.status === 1) return [];
    try {
      const output = execFileSync('sh', ['-c', `fuser -n tcp ${port} 2>&1`], { encoding: 'utf8' });
      const pidList = output.match(/:\s*(.*)$/m)?.[1] || '';
      return [...new Set(pidList.match(/\d+/g)?.map(Number).filter((pid) => pid > 0 && pid !== process.pid) || [])];
    } catch (fuserError) {
      if (fuserError.status === 1) return [];
      throw new Error('Cannot inspect the process using this port (install lsof or fuser).');
    }
  }
}

function getListeners() {
  return process.platform === 'win32' ? windowsListeners() : unixListeners();
}

function isNodeProcess(pid) {
  if (process.platform === 'win32') {
    const command = `try { (Get-Process -Id ${pid} -ErrorAction Stop).ProcessName } catch { '' }`;
    const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8' }).trim();
    return /^node$/i.test(output);
  }
  const output = execFileSync('ps', ['-p', String(pid), '-o', 'comm='], { encoding: 'utf8' }).trim();
  return /(^|[/\\])node(?:js)?$/.test(output);
}

async function clearPort() {
  const listeners = getListeners();
  for (const pid of listeners) {
    if (!isNodeProcess(pid)) {
      throw new Error(`Port ${port} is occupied by a non-Node process (PID ${pid}); leaving it untouched.`);
    }
    console.log(`Stopping previous Node dev server on port ${port} (PID ${pid})...`);
    try { process.kill(pid, 'SIGTERM'); } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }

  const deadline = Date.now() + 8000;
  while (getListeners().length && Date.now() < deadline) await delay(200);
  const remaining = getListeners();
  if (remaining.length) {
    throw new Error(`Could not free port ${port} (remaining PID${remaining.length > 1 ? 's' : ''}: ${remaining.join(', ')}).`);
  }
}

try {
  await clearPort();
} catch (error) {
  console.error(`Unable to start AUSTWise: ${error.message}`);
  process.exit(1);
}

const child = spawn(process.execPath, ['server/dev.mjs', '--vite'], {
  cwd: projectRoot,
  env: { ...process.env, PORT: String(port) },
  stdio: 'inherit',
});

let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    if (child.exitCode === null) child.kill(signal);
  });
}

child.on('error', (error) => {
  console.error(`Could not launch AUSTWise server: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
