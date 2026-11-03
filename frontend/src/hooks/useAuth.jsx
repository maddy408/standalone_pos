import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import api from '../config/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('pos_user');
    return raw ? JSON.parse(raw) : null;
  });

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('pos_token', data.token);
    localStorage.setItem('pos_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    setUser(null);
  };

  const can = useCallback((code) => !!user?.permissions?.includes(code), [user]);

  const value = useMemo(
    () => ({ user, login, logout, isAuthenticated: !!user, can }),
    [user, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
