import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

export default function Team() {
  const { user, refresh } = useAuth();
  const [data, setData] = useState(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const load = () => api('/team').then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const invite = async (e) => {
    e.preventDefault(); setMsg(''); setError('');
    try { setMsg((await api('/team/invite', { method: 'POST', body: { email } })).message); setEmail(''); load(); }
    catch (err) { setError(err.message); }
  };
  const join = async (e) => {
    e.preventDefault(); setMsg(''); setError('');
    try { await api('/team/join', { method: 'POST', body: { code } }); await refresh(); load(); }
    catch (err) { setError(err.message); }
  };

  if (!data) return <p className="muted">{error || 'Loading…'}</p>;

  if (user.role === 'developer') {
    return (
      <section className="narrow">
        <h1>My team</h1>
        {data.team ? <p>You are part of <b>{data.team.name}</b>. Your manager can see your completion rate.</p> : (
          <form className="card" onSubmit={join}>
            <p>You are not in a team yet. Ask your manager for an invite code.</p>
            <label>Invite code<input value={code} onChange={(e) => setCode(e.target.value)} required /></label>
            <button className="btn">Join team</button>
          </form>
        )}
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  const { team, members, invites } = data;
  return (
    <>
      <section className="hero">
        <div>
          <h1>{team.name}</h1>
          <p className="muted">{members.length} developer{members.length === 1 ? '' : 's'} · average completion {data.averageCompletion}%</p>
          <p>Invite code: <code className="code-chip">{team.inviteCode}</code> <button className="link" onClick={() => navigator.clipboard?.writeText(team.inviteCode)}>Copy</button></p>
        </div>
        <form className="card invite" onSubmit={invite}>
          <label>Invite a developer by email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <button className="btn">Send invite</button>
          {msg && <p className="small ok-text">{msg}</p>}
          {error && <p className="error small">{error}</p>}
        </form>
      </section>

      <section>
        <h2>Completion rates</h2>
        {members.length === 0 ? <p className="muted">No developers yet. Share your invite code to get started.</p> : (
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Developer</th><th>Completion</th><th>Lessons</th><th>XP / Level</th><th>Streak</th><th>Badges</th><th>Last active</th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td><b>{m.name}</b><br /><span className="muted small">{m.email}</span></td>
                    <td><span className="bar"><i style={{ width: m.completionRate + '%' }} /></span> {m.completionRate}%</td>
                    <td>{m.completed}/{data.totalLessons}</td>
                    <td>{m.xp} XP · L{m.level}</td>
                    <td>🔥 {m.streak}</td>
                    <td>{m.badges}</td>
                    <td>{m.last_active || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {invites.length > 0 && (
          <>
            <h3>Invites</h3>
            <ul className="plain">{invites.map((i) => <li key={i.email}>{i.email} - {i.accepted ? 'joined' : 'pending'}</li>)}</ul>
          </>
        )}
      </section>
    </>
  );
}
