import { Routes, Route, Navigate, NavLink, Link } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Lesson from './pages/Lesson.jsx';
import Team from './pages/Team.jsx';

function Shell({ children }) {
  const { user, signOut } = useAuth();
  const pct = Math.round((user.xpIntoLevel / user.xpPerLevel) * 100);
  return (
    <>
      <header className="nav">
        <Link to="/" className="brand">SecureCode Academy</Link>
        <nav>
          <NavLink to="/" end>Learn</NavLink>
          <NavLink to="/team">{user.role === 'manager' ? 'Team dashboard' : 'My team'}</NavLink>
        </nav>
        <div className="stats" title={`${user.xp} XP total`}>
          <span className="lvl">Level {user.level}</span>
          <span className="xpbar"><i style={{ width: pct + '%' }} /></span>
          <span>{user.xp} XP</span>
          <span title="Day streak">🔥 {user.streak}</span>
          <button className="link" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}

function Private({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/" element={<Private><Dashboard /></Private>} />
      <Route path="/lesson/:slug" element={<Private><Lesson /></Private>} />
      <Route path="/team" element={<Private><Team /></Private>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
