import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { api } from '../api';
import Reward from './Reward.jsx';

function describe(slug, r) {
  if (!r.ok) return { tone: 'warn', text: r.error };
  const x = r.result;
  if (slug === 'sqli-login') {
    if (x.error) return { tone: 'good', text: 'The query failed: ' + x.error };
    return x.authenticated
      ? { tone: 'bad', text: `The app answered: login successful as "${x.user?.[1]}" (${x.user?.[2]}).` }
      : { tone: 'good', text: 'The app answered: login rejected.' };
  }
  if (slug === 'idor-invoice') {
    if (x.leaked) return { tone: 'bad', text: `Leaked! ${x.requested_as} received invoice #${x.invoice_id} that belongs to user #${x.returned.owner_id}: ${x.returned.item} (${x.returned.amount}).` };
    if (x.returned) return { tone: 'neutral', text: `Returned your own invoice: ${x.returned.item} (${x.returned.amount}).` };
    return { tone: 'good', text: 'Nothing returned - access refused.' };
  }
  return { tone: 'neutral', text: JSON.stringify(x) };
}

export default function CodeChallenge({ slug, onReward }) {
  const [meta, setMeta] = useState(null);
  const [code, setCode] = useState('');
  const [form, setForm] = useState({});
  const [attack, setAttack] = useState(null);
  const [tests, setTests] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/challenges/${slug}`).then((m) => {
      setMeta(m); setCode(m.starterCode);
      setForm(Object.fromEntries(m.exploitForm.map((f) => [f.name, f.default])));
    }).catch((e) => setError(e.message));
  }, [slug]);

  if (error) return <p className="error">{error}</p>;
  if (!meta) return <p className="muted">Loading challenge…</p>;

  async function run(kind) {
    setBusy(kind); setError('');
    try {
      if (kind === 'exploit') {
        setAttack(await api(`/challenges/${slug}/exploit`, { method: 'POST', body: { code, input: form } }));
      } else {
        const r = await api(`/challenges/${slug}/validate`, { method: 'POST', body: { code } });
        setTests(r);
        if (r.reward) onReward(r.reward);
      }
    } catch (e) { setError(e.message); }
    setBusy('');
  }

  const view = attack && describe(slug, attack);

  return (
    <section className="challenge">
      <div className="pane">
        <div className="pane-head"><h3>1 · Attack the app</h3><span className="muted small">Runs your current code below</span></div>
        <div className="attack-form">
          {meta.exploitForm.map((f) => (
            <label key={f.name}>{f.label}
              <input type={f.type || 'text'} value={form[f.name] ?? ''} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} autoComplete="off" spellCheck="false" />
            </label>
          ))}
          <button className="btn danger" disabled={!!busy} onClick={() => run('exploit')}>{busy === 'exploit' ? 'Attacking…' : 'Attack the app'}</button>
        </div>
        <p className="muted small hint">Hint: {meta.exploitHint}</p>
        {view && (
          <div className={'result ' + view.tone}>
            <p>{view.text}</p>
            {attack.result?.sql?.length > 0 && (<><b className="small">SQL the database executed</b><pre>{attack.result.sql.join('\n')}</pre></>)}
            {attack.logs && <pre>{attack.logs}</pre>}
            {attack.stderr && <pre>{attack.stderr}</pre>}
          </div>
        )}
      </div>

      <div className="pane">
        <div className="pane-head">
          <h3>2 · Patch the code ({meta.language})</h3>
          <button className="link" onClick={() => setCode(meta.starterCode)}>Reset to vulnerable code</button>
        </div>
        <div className="editor">
          <Editor height="320px" language={meta.language} theme="vs-dark" value={code} onChange={(v) => setCode(v ?? '')}
            options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, tabSize: 4 }} />
        </div>
        <div className="row">
          <button className="btn good" disabled={!!busy} onClick={() => run('validate')}>{busy === 'validate' ? 'Running tests…' : 'Submit patch'}</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {tests && (
          <div className={'result ' + (tests.passed ? 'good' : 'bad')}>
            {!tests.ok && <p>{tests.error}</p>}
            {tests.tests && (
              <>
                <p><b>{tests.passed ? 'All tests passed - the flaw is patched.' : 'Some tests failed.'}</b></p>
                <ul className="tests">{tests.tests.map((t) => <li key={t.name} className={t.passed ? 'ok' : 'no'}><span>{t.passed ? '✓' : '✗'}</span> {t.name}<em>{t.detail}</em></li>)}</ul>
              </>
            )}
            {tests.logs && <pre>{tests.logs}</pre>}
            {tests.stderr && <pre>{tests.stderr}</pre>}
          </div>
        )}
      </div>
    </section>
  );
}
