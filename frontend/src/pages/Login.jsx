import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { t } = useTranslation();
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    navigate('/', { replace: true });
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
    <div className="flex h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg">
        <h1 className="mb-6 text-xl font-bold text-brand-600 dark:text-brand-400 text-center">
          {t('auth.login_title')}
        </h1>
        {error && <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
        <label className="mb-1 block text-sm font-medium">{t('auth.username')}</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
          autoFocus
        />
        <label className="mb-1 block text-sm font-medium">{t('auth.password')}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-600 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {t('auth.login')}
        </button>
        <p className="mt-4 text-center text-xs text-slate-400">admin / Admin@123</p>
      </form>
    </div>
  );
}
