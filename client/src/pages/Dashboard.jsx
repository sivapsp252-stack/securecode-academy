import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

export default function Dashboard() {
  const { user, badges } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api('/curriculum').then(setData).catch((e) => setError(e.message)); }, []);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading curriculum…</p>;

  const all = data.tracks.flatMap((t) => t.modules);
  const done = all.reduce((s, m) => s + m.completed, 0);
  const total = all.reduce((s, m) => s + m.total, 0);
  const next = all.flatMap((m) => m.lessons).find((l) => !l.completed);

  return (
    <>
      <section className="hero">
        <div>
          <h1>Welcome back, {user.name.split(' ')[0]}.</h1>
          <p className="muted">{done} of {total} lessons patched. {next ? 'Pick up where you left off.' : 'Every flaw is fixed. Nice work.'}</p>
          {next && <Link className="btn" to={`/lesson/${next.slug}`}>Continue: {next.title}</Link>}
        </div>
        <div className="badges">
          <h3>Badges</h3>
          {badges.length === 0 && <p className="muted small">Finish a module to earn your first badge.</p>}
          <ul>{badges.map((b) => <li key={b.slug} title={b.description}><span>{b.icon}</span>{b.name}</li>)}</ul>
        </div>
      </section>

      {data.tracks.map((t) => (
        <section key={t.id}>
          <h2>{t.title}</h2>
          <p className="muted">{t.description}</p>
          <div className="modules">
            {t.modules.map((m) => {
              const complete = m.completed === m.total;
              return (
                <article key={m.id} className={'card module ' + (complete ? 'patched' : 'vulnerable')}>
                  <h3>{m.title}</h3>
                  <p className="muted">{m.description}</p>
                  <span className="status">{complete ? 'Patched' : 'Vulnerable'} · {m.completed}/{m.total}</span>
                  <ul className="lessons">
                    {m.lessons.map((l) => (
                      <li key={l.id}>
                        <Link to={`/lesson/${l.slug}`}>
                          <span className={'tick' + (l.completed ? ' on' : '')}>{l.completed ? '✓' : ''}</span>
                          {l.title}<em>{l.xp} XP</em>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {m.badge && <p className="small muted">Earns {m.badge.icon} {m.badge.name}</p>}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
