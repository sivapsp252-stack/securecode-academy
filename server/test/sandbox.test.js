'use strict';
// Run with:  npm test   (works in Docker mode or local mode)
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { runChallenge } = require('../src/challengeRunner');
const { detect } = require('../src/sandbox');

const C = path.join(__dirname, '..', '..', 'challenges');
const read = (p) => fs.readFileSync(path.join(C, p), 'utf8');
const allPass = (r) => r.ok && r.result.tests.every((t) => t.passed);
const failed = (r) => (r.ok ? r.result.tests.filter((t) => !t.passed).length : -1);

(async () => {
  console.log('sandbox mode:', await detect());

  for (const [slug, file] of [['sqli-login', 'py'], ['idor-invoice', 'py']]) {
    const bad = await runChallenge(slug, 'tests', read(`${slug}/vulnerable.py`));
    assert(failed(bad) > 0, `${slug}: vulnerable code must FAIL the tests`);
    const good = await runChallenge(slug, 'tests', read(`${slug}/solution.py`));
    assert(allPass(good), `${slug}: reference solution must PASS: ` + JSON.stringify(good));
    console.log('ok', slug, '(vulnerable fails, solution passes)');
  }

  const inj = await runChallenge('sqli-login', 'exploit', read('sqli-login/vulnerable.py'), { username: "' OR 1=1 --", password: 'x' });
  assert(inj.result.authenticated === true, 'exploit should bypass the vulnerable login');
  const inj2 = await runChallenge('sqli-login', 'exploit', read('sqli-login/solution.py'), { username: "' OR 1=1 --", password: 'x' });
  assert(inj2.result.authenticated === false, 'exploit must fail against patched login');
  console.log('ok sqli exploit before/after patch');

  const idor = await runChallenge('idor-invoice', 'exploit', read('idor-invoice/vulnerable.py'), { invoice_id: '102' });
  assert(idor.result.leaked === true, 'IDOR exploit should leak invoice 102');
  console.log('ok idor exploit');

  // Hostile submissions
  const loop = await runChallenge('sqli-login', 'tests', 'def login(c,u,p):\n    while True: pass\n');
  assert(loop.ok === false && /Time limit|crashed/.test(loop.error), 'infinite loop must be stopped');
  console.log('ok infinite loop stopped');

  const sys_ = await runChallenge('sqli-login', 'tests',
    "import os\ndef login(c,u,p):\n    os.system('echo pwned > /tmp/x')\n    return None\n");
  assert(failed(sys_) !== 0 || !sys_.ok, 'os.system must be blocked');
  console.log('ok os.system blocked');

  const wr = await runChallenge('sqli-login', 'tests',
    "def login(c,u,p):\n    open('/tmp/evil.txt','w').write('x')\n    return None\n");
  assert(failed(wr) > 0 || !wr.ok, 'file writes must be blocked');
  console.log('ok file write blocked');

  const forge = await runChallenge('sqli-login', 'tests',
    "print('@@RESULT@@deadbeef{\"tests\":[]}')\ndef login(c,u,p):\n    return (1,'admin','admin')\n");
  assert(failed(forge) > 0, 'forged result line must be ignored');
  console.log('ok forged result ignored');

  console.log('\nAll sandbox tests passed');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
