'use strict';
/**
 * Sandbox service - runs untrusted Python submitted by learners.
 *
 *  docker mode (default when Docker is available): one EPHEMERAL container per run
 *     --network none, read-only root fs, no capabilities, non-root user,
 *     memory / CPU / PID limits, hard wall-clock timeout, container removed afterwards.
 *  local mode (dev fallback only): child process with timeout + in-process guard.
 *
 * See docs/SANDBOX_DESIGN.md for the full threat model.
 */
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const IMAGE = process.env.SANDBOX_IMAGE || 'python:3.12-alpine';
const TIMEOUT_MS = Number(process.env.SANDBOX_TIMEOUT_MS || 5000);
const MAX_OUT = 64 * 1024;
const MAX_CONCURRENT = Number(process.env.SANDBOX_MAX_CONCURRENT || 4);

let active = 0;
let mode = null;
let pythonBin = null;

function probe(cmd, args, timeout = 4000) {
  return new Promise((resolve) =>
    execFile(cmd, args, { timeout }, (err, stdout, stderr) => resolve(err ? null : String(stdout || stderr).trim()))
  );
}

async function detect() {
  if (mode) return mode;
  const want = (process.env.SANDBOX_MODE || 'auto').toLowerCase();
  if (want !== 'local') {
    const v = await probe('docker', ['info', '--format', '{{.ServerVersion}}']);
    if (v) {
      mode = 'docker';
      const img = await probe('docker', ['image', 'inspect', IMAGE, '--format', '{{.Id}}']);
      if (!img) {
        console.warn(`[sandbox] image ${IMAGE} not present, pulling in background...`);
        probe('docker', ['pull', IMAGE], 180000).then(() => console.log('[sandbox] image ready'));
      }
      return mode;
    }
    if (want === 'docker') throw new Error('SANDBOX_MODE=docker but the Docker daemon is not reachable');
  }
  for (const bin of [process.env.PYTHON_BIN, 'python3', 'python'].filter(Boolean)) {
    const v = await probe(bin, ['--version']);
    if (v && /Python 3/.test(v)) { pythonBin = bin; break; }
  }
  if (!pythonBin) throw new Error('Neither Docker nor Python 3 is available for the sandbox');
  mode = 'local';
  console.warn('[sandbox] LOCAL mode: development only. Use Docker in production.');
  return mode;
}

function collect(stream, sink) {
  stream.on('data', (chunk) => {
    if (sink.len >= MAX_OUT) { sink.truncated = true; return; }
    sink.buf += chunk.toString('utf8');
    sink.len += chunk.length;
  });
}

function execute(dir, stdinText) {
  return new Promise((resolve) => {
    let child, containerName = null;
    if (mode === 'docker') {
      containerName = 'sca-' + crypto.randomBytes(6).toString('hex');
      child = spawn('docker', [
        'run', '--rm', '-i', '--name', containerName,
        '--network', 'none',
        '--memory', '128m', '--memory-swap', '128m', '--cpus', '0.5', '--pids-limit', '64',
        '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=8m',
        '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
        '--user', '65534:65534',
        '-v', `${dir}:/work:ro`, '-w', '/work',
        '-e', 'PYTHONDONTWRITEBYTECODE=1',
        IMAGE, 'python', 'run.py',
      ]);
    } else {
      const env = { PYTHONIOENCODING: 'utf-8' };
      for (const k of ['PATH', 'SystemRoot', 'TEMP']) if (process.env[k]) env[k] = process.env[k];
      child = spawn(pythonBin, ['-E', '-B', 'run.py'], { cwd: dir, env });
    }

    const out = { buf: '', len: 0, truncated: false };
    const err = { buf: '', len: 0, truncated: false };
    let timedOut = false;
    collect(child.stdout, out);
    collect(child.stderr, err);

    const timer = setTimeout(() => {
      timedOut = true;
      if (containerName) execFile('docker', ['rm', '-f', containerName], () => {});
      child.kill('SIGKILL');
    }, TIMEOUT_MS);

    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ stdout: '', stderr: 'Sandbox failed to start: ' + e.message, exitCode: -1, timedOut: false });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout: out.buf, stderr: err.buf, exitCode: code, timedOut, truncated: out.truncated || err.truncated });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(stdinText);
  });
}

/** files: { 'run.py': '...', 'user_code.py': '...' }   input: JSON-serialisable object */
async function runPython(files, input) {
  if (active >= MAX_CONCURRENT) {
    const e = new Error('The sandbox is busy. Try again in a few seconds.');
    e.status = 429;
    throw e;
  }
  active++;
  let dir;
  try {
    await detect();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sca-'));
    for (const [name, content] of Object.entries(files)) {
      if (!/^[\w.]+$/.test(name)) throw new Error('bad file name');
      fs.writeFileSync(path.join(dir, name), content, { mode: 0o644 });
    }
    fs.chmodSync(dir, 0o755);
    const res = await execute(dir, JSON.stringify(input));
    return { ...res, mode };
  } finally {
    active--;
    if (dir) fs.rm(dir, { recursive: true, force: true }, () => {});
  }
}

module.exports = { runPython, detect, getMode: () => mode, TIMEOUT_MS };
