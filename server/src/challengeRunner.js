'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { runPython, TIMEOUT_MS } = require('./sandbox');

const ROOT = path.join(__dirname, '..', '..', 'challenges');

function loadChallenge(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const dir = path.join(ROOT, slug);
  if (!fs.existsSync(path.join(dir, 'meta.json'))) return null;
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const starter = fs.readFileSync(path.join(dir, meta.starterFile), 'utf8');
  return { dir, meta, starter };
}

/** kind: 'exploit' | 'tests' */
async function runChallenge(slug, kind, code, input = {}) {
  const ch = loadChallenge(slug);
  if (!ch || ch.meta.runner !== 'server') return { error: 'Unknown challenge' };

  const files = {
    'run.py': fs.readFileSync(path.join(ch.dir, kind === 'exploit' ? 'exploit.py' : 'tests.py'), 'utf8'),
    '_guard.py': fs.readFileSync(path.join(ROOT, '_shared', '_guard.py'), 'utf8'),
    'user_code.py': code,
  };
  const fixtures = path.join(ch.dir, 'fixtures.py');
  if (fs.existsSync(fixtures)) files['fixtures.py'] = fs.readFileSync(fixtures, 'utf8');

  const nonce = crypto.randomBytes(12).toString('hex');
  const res = await runPython(files, { ...input, nonce });

  const marker = '@@RESULT@@' + nonce;
  const lines = res.stdout.split('\n');
  const idx = lines.findIndex((l) => l.startsWith(marker));
  const logs = lines.filter((_, i) => i !== idx).join('\n').trim().slice(0, 4000);
  const stderr = res.stderr.trim().slice(-2000);

  if (idx === -1) {
    return {
      ok: false,
      error: res.timedOut
        ? `Time limit exceeded (${TIMEOUT_MS / 1000}s). Check for infinite loops.`
        : 'Your code crashed before the checks could finish.',
      logs, stderr,
    };
  }
  let parsed;
  try { parsed = JSON.parse(lines[idx].slice(marker.length)); }
  catch { return { ok: false, error: 'Could not read the sandbox result.', logs, stderr }; }
  return { ok: true, result: parsed, logs, stderr };
}

module.exports = { loadChallenge, runChallenge };
