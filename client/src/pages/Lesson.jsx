import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import CodeChallenge from '../components/CodeChallenge.jsx';
import XssChallenge from '../components/XssChallenge.jsx';
import Reward from '../components/Reward.jsx';

export default function Lesson() {
  const { slug } = useParams();
  const { refresh } = useAuth();
  const [data, setData] = useState(null);
  const [reward, setReward] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api(`/lessons/${slug}`).then(setData).catch((e) => setError(e.message)), [slug]);
  useEffect(() => { setData(null); setReward(null); setError(''); load(); }, [load]);

  const onReward = useCallback((r) => { setReward(r); refresh(); load(); }, [refresh, load]);
  const complete = useCallback(async () => onReward(await api(`/lessons/${slug}/complete`, { method: 'POST' })), [slug, onReward]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading lesson…</p>;
  const { lesson, module: mod, siblings } = data;
  const idx = siblings.findIndex((s) => s.id === lesson.id);
  const next = siblings[idx + 1];

  return (
    <div className="lesson-layout">
      <aside className="side">
        <h4>{mod.title}</h4>
        <ol>
          {siblings.map((s) => (
            <li key={s.id} className={s.id === lesson.id ? 'current' : ''}>
              <Link to={`/lesson/${s.slug}`}><span className={'tick' + (s.completed ? ' on' : '')}>{s.completed ? '✓' : ''}</span>{s.title}</Link>
            </li>
          ))}
        </ol>
        <Link to="/" className="small">← All modules</Link>
      </aside>

      <article className="lesson">
        <div className="markdown"><ReactMarkdown>{lesson.markdown}</ReactMarkdown></div>

        {lesson.type === 'reading' && (
          lesson.completed
            ? <p className="done">✓ Lesson completed</p>
            : <button className="btn" onClick={complete}>Mark as complete (+{lesson.xp} XP)</button>
        )}
        {lesson.type === 'server-challenge' && <CodeChallenge key={lesson.slug} slug={lesson.challengeSlug} onReward={onReward} />}
        {lesson.type === 'client-challenge' && <XssChallenge key={lesson.slug} slug={lesson.challengeSlug} onComplete={complete} />}

        <Reward reward={reward} />
        {lesson.completed && !reward && lesson.type !== 'reading' && <p className="done">✓ Challenge completed</p>}
        {next && lesson.completed && <Link className="btn" to={`/lesson/${next.slug}`}>Next: {next.title}</Link>}
        {!next && lesson.completed && <Link className="btn" to="/">Back to modules</Link>}
      </article>
    </div>
  );
}
