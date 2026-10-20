import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

export default function AuthPage() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'developer', teamName: '', inviteCode: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      signIn(await api(mode === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body: f }));
    } catch (err) { setError(err.message); }
    setBusy(false);
  }
  const demo = (email, password) => setF({ ...f, email, password });

  return (
    <div className="auth">
      <section className="auth-pitch">
        <h1>Break the code.<br />Then fix it.</h1>
        <p>Run real exploits against vulnerable code in a safe sandbox, patch the flaw, and prove the fix with a test suite. SQL injection, XSS and IDOR - one hands-on lesson at a time.</p>
        <pre className="pitch-code"><span className="bad">- query = "... WHERE name='" + name + "'"</span>{'\n'}<span className="good">+ query = "... WHERE name = ?"</span></pre>
      </section>

      <form className="card auth-form" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Sign in' : 'Create your account'}</h2>
        {mode === 'register' && (
          <>
            <label>Name<input value={f.name} onChange={set('name')} required /></label>
            <label>I am a
              <select value={f.role} onChange={set('role')}>
                <option value="developer">Developer</option>
                <option value="manager">Manager (runs a team)</option>
              </select>
            </label>
          </>
        )}
        <label>Email<input type="email" value={f.email} onChange={set('email')} required /></label>
        <label>Password<input type="password" value={f.password} onChange={set('password')} minLength={8} required /></label>
        {mode === 'register' && f.role === 'manager' && <label>Team name<input value={f.teamName} onChange={set('teamName')} /></label>}
        {mode === 'register' && f.role === 'developer' && <label>Team invite code (optional)<input value={f.inviteCode} onChange={set('inviteCode')} /></label>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
        {mode === 'login' && (
          <p className="muted small">Demo:{' '}
            <button type="button" className="link" onClick={() => demo('dev@securecode.dev', 'Developer@123')}>developer</button>{' · '}
            <button type="button" className="link" onClick={() => demo('manager@securecode.dev', 'Manager@123')}>manager</button>
          </p>
        )}
      </form>
    </div>
  );
}
