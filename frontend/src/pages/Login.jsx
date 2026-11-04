import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { t } = useTranslation();
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || t('auth.invalid_credentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 font-sans">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-md">
            UP
          </div>
        </div>
        <h1 className="mb-1 text-xl font-bold text-slate-900 dark:text-white text-center">
          {t('auth.login_title')}
        </h1>
        <p className="text-xs text-slate-400 text-center mb-6">Universal POS & Management System</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <div className="space-y-4 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">{t('auth.username')}</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-3 font-bold text-slate-950 shadow-md transition-colors disabled:opacity-50 mt-2 text-sm"
          >
            {loading ? 'Signing in...' : t('auth.login')}
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-400">
          Default: <span className="font-mono text-slate-600 dark:text-slate-300">admin</span> / <span className="font-mono text-slate-600 dark:text-slate-300">Admin@123</span>
        </div>
      </form>
    </div>
  );
}
