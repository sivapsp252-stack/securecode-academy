import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { api } from '../api';

const CASES = [
  { name: 'Blocks <img onerror>', type: 'attack', payload: '<img src=x onerror=alert(1)>' },
  { name: 'Blocks <script> tag', type: 'attack', payload: '<script>alert(1)</script>' },
  { name: 'Blocks <svg onload>', type: 'attack', payload: '<svg onload=alert(1)>' },
  { name: 'Blocks javascript: links', type: 'attack', payload: '<a href="javascript:alert(1)">click me</a>' },
  { name: 'Blocks attribute breakout', type: 'attack', payload: '"><img src=x onerror=alert(1)>' },
  { name: 'Blocks <iframe srcdoc>', type: 'attack', payload: '<iframe srcdoc="<script>alert(1)</script>"></iframe>' },
  { name: 'Normal comment still works', type: 'benign', payload: 'Great article, thanks!' },
  { name: 'Special characters shown as typed', type: 'benign', payload: 'I <3 secure code & 5 > 3' },
];

/** Creates a sandboxed iframe (opaque origin: no cookies, no storage, no access to this page). */
function makeFrame(parent, hidden) {
  return new Promise((resolve) => {
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts');       // deliberately NOT allow-same-origin
    f.src = '/xss-sandbox.html';
    f.title = 'sandboxed comment preview';
    if (hidden) f.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
    else f.className = 'preview-frame';
    f.onload = () => resolve(f);
    parent.appendChild(f);
  });
}

function runInFrame(frame, code, cases) {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    const timer = setTimeout(() => { cleanup(); resolve({ error: 'Time limit exceeded - does your code loop forever?' }); }, 6000);
    const onMsg = (e) => {
      if (e.source !== frame.contentWindow || e.data?.kind !== 'result' || e.data.id !== id) return;
      cleanup(); resolve(e.data);
    };
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', onMsg); };
    window.addEventListener('message', onMsg);
    frame.contentWindow.postMessage({ kind: 'run', id, code, cases }, '*');
  });
}

export default function XssChallenge({ slug, onComplete }) {
  const [meta, setMeta] = useState(null);
  const [code, setCode] = useState('');
  const [payload, setPayload] = useState('');
  const [demo, setDemo] = useState(null);
  const [tests, setTests] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const previewRef = useRef(null);

  useEffect(() => {
    api(`/challenges/${slug}`).then((m) => { setMeta(m); setCode(m.starterCode); }).catch((e) => setError(e.message));
  }, [slug]);

  if (!meta) return <p className={error ? 'error' : 'muted'}>{error || 'Loading challenge…'}</p>;

  async function post() {
    setBusy('demo'); setDemo(null);
    previewRef.current.innerHTML = '';
    const frame = await makeFrame(previewRef.current, false);
    const res = await runInFrame(frame, code, [{ name: 'demo', type: 'demo', payload }]);
    setDemo(res.error ? { tone: 'warn', text: res.error } : { tone: res.results[0].fired ? 'bad' : 'good', text: res.results[0].fired ? 'XSS executed - your script ran inside the page!' : res.results[0].detail });
    setBusy('');
  }

  async function runTests() {
    setBusy('tests'); setTests(null); setError('');
    const holder = document.createElement('div');
    document.body.appendChild(holder);
    const frame = await makeFrame(holder, true);
    const res = await runInFrame(frame, code, CASES);
    holder.remove();
    if (res.error) { setTests({ error: res.error }); setBusy(''); return; }
    const passed = res.results.every((r) => r.passed);
    setTests({ passed, results: res.results });
    if (passed) { try { await onComplete(); } catch (e) { setError(e.message); } }
    setBusy('');
  }

  return (
    <section className="challenge">
      <div className="pane">
        <div className="pane-head"><h3>1 · Attack the widget</h3><span className="muted small">Runs in a sandboxed iframe</span></div>
        <div className="attack-form">
          <label>Your comment<input value={payload} onChange={(e) => setPayload(e.target.value)} spellCheck="false" placeholder="Type a comment…" /></label>
          <button className="btn danger" disabled={!!busy} onClick={post}>{busy === 'demo' ? 'Posting…' : 'Post comment'}</button>
        </div>
        <p className="muted small hint">Hint: {meta.exploitHint}</p>
        <div ref={previewRef} className="preview" />
        {demo && <div className={'result ' + demo.tone}><p>{demo.text}</p></div>}
      </div>

      <div className="pane">
        <div className="pane-head">
          <h3>2 · Patch the code (javascript)</h3>
          <button className="link" onClick={() => setCode(meta.starterCode)}>Reset to vulnerable code</button>
        </div>
        <div className="editor">
          <Editor height="320px" language="javascript" theme="vs-dark" value={code} onChange={(v) => setCode(v ?? '')}
            options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, tabSize: 2 }} />
        </div>
        <div className="row"><button className="btn good" disabled={!!busy} onClick={runTests}>{busy === 'tests' ? 'Running tests…' : 'Run tests'}</button></div>
        {error && <p className="error" role="alert">{error}</p>}
        {tests && (
          <div className={'result ' + (tests.passed ? 'good' : 'bad')}>
            {tests.error && <p>{tests.error}</p>}
            {tests.results && (
              <>
                <p><b>{tests.passed ? 'All tests passed - the flaw is patched.' : 'Some tests failed.'}</b></p>
                <ul className="tests">{tests.results.map((t) => <li key={t.name} className={t.passed ? 'ok' : 'no'}><span>{t.passed ? '✓' : '✗'}</span> {t.name}<em>{t.detail}</em></li>)}</ul>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
