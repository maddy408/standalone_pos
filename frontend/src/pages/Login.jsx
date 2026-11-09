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
      if (!navigator.onLine) {
        setError('Device is offline. Please enter the username used during your last online login.');
      } else {
        setError(err.response?.data?.error || t('auth.invalid_credentials'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB] dark:bg-[#0B131E] p-4 font-sans">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#121E2C] p-8 shadow-xl border border-[#DCE5EF] dark:border-[#22354B]"
      >
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-[#0A4174] dark:bg-[#4A8CD2] text-white dark:text-[#0B131E] flex items-center justify-center font-black text-2xl shadow-md">
            UP
          </div>
        </div>
        <h1 className="mb-1 text-2xl font-black text-[#1C2736] dark:text-[#F1F5F9] text-center tracking-tight">
          {t('auth.login_title')}
        </h1>
        <p className="text-xs text-[#5A6B82] dark:text-[#94A3B8] text-center mb-6">
          Universal POS & Management System
        </p>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs text-red-600 dark:text-red-300 border border-red-200 dark:border-red-900 font-medium">
            {error}
          </div>
        )}

        <div className="space-y-4 text-xs">
          <div>
            <label className="mb-1.5 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">
              {t('auth.username')}
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] text-[#1C2736] dark:text-[#F1F5F9] px-3.5 py-2.5 focus:ring-2 focus:ring-[#0A4174]/30 focus:border-[#0A4174] focus:outline-none transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">
              {t('auth.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] text-[#1C2736] dark:text-[#F1F5F9] px-3.5 py-2.5 focus:ring-2 focus:ring-[#0A4174]/30 focus:border-[#0A4174] focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] py-3 font-bold text-white dark:text-[#0B131E] shadow-md transition-colors disabled:opacity-50 mt-3 text-sm"
          >
            {loading ? 'Signing in...' : t('auth.login')}
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-[#DCE5EF] dark:border-[#22354B] text-center text-xs text-[#5A6B82] dark:text-[#94A3B8] bg-[#F4F7FB] dark:bg-[#0B131E] p-3 rounded-xl border">
          Default: <span className="font-mono font-semibold text-[#0A4174] dark:text-[#4A8CD2]">admin</span> / <span className="font-mono font-semibold text-[#0A4174] dark:text-[#4A8CD2]">Admin@123</span>
        </div>
      </form>
    </div>
  );
}
