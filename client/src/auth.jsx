import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(!!getToken());

  const refresh = useCallback(async () => {
    try {
      const d = await api('/auth/me');
      setUser(d.user); setBadges(d.badges);
    } catch { setToken(null); setUser(null); }
    setLoading(false);
  }, []);

  useEffect(() => { if (getToken()) refresh(); }, [refresh]);

  const signIn = (data) => { setToken(data.token); setUser(data.user); refresh(); };
  const signOut = () => { setToken(null); setUser(null); setBadges([]); };

  return <Ctx.Provider value={{ user, badges, loading, refresh, signIn, signOut }}>{children}</Ctx.Provider>;
}
