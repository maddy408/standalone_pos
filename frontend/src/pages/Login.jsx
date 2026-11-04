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
    <div className="flex min-h-screen items-center justify-center bg-[#F7F5FC] dark:bg-[#17151D] p-4 font-sans">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#211D2A] p-8 shadow-xl border border-[#E8E3EF] dark:border-[#393244]"
      >
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-[#7652B5] dark:bg-[#A98ADB] text-white dark:text-[#17151D] flex items-center justify-center font-black text-2xl shadow-md">
            UP
          </div>
        </div>
        <h1 className="mb-1 text-2xl font-black text-[#282431] dark:text-[#F5F2F9] text-center tracking-tight">
          {t('auth.login_title')}
        </h1>
        <p className="text-xs text-[#716B7C] dark:text-[#B8B0C4] text-center mb-6">
          Universal POS & Management System
        </p>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs text-red-600 dark:text-red-300 border border-red-200 dark:border-red-900 font-medium">
            {error}
          </div>
        )}

        <div className="space-y-4 text-xs">
          <div>
            <label className="mb-1.5 block font-semibold text-[#282431] dark:text-[#F5F2F9]">
              {t('auth.username')}
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-[#F7F5FC] dark:bg-[#17151D] text-[#282431] dark:text-[#F5F2F9] px-3.5 py-2.5 focus:ring-2 focus:ring-[#7652B5]/30 focus:border-[#7652B5] focus:outline-none transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block font-semibold text-[#282431] dark:text-[#F5F2F9]">
              {t('auth.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-[#F7F5FC] dark:bg-[#17151D] text-[#282431] dark:text-[#F5F2F9] px-3.5 py-2.5 focus:ring-2 focus:ring-[#7652B5]/30 focus:border-[#7652B5] focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#7652B5] hover:bg-[#5B3B91] dark:bg-[#A98ADB] dark:hover:bg-[#C0A5EA] py-3 font-bold text-white dark:text-[#17151D] shadow-md transition-colors disabled:opacity-50 mt-3 text-sm"
          >
            {loading ? 'Signing in...' : t('auth.login')}
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-[#E8E3EF] dark:border-[#393244] text-center text-xs text-[#716B7C] dark:text-[#B8B0C4] bg-[#F7F5FC] dark:bg-[#17151D] p-3 rounded-xl border">
          Default: <span className="font-mono font-semibold text-[#7652B5] dark:text-[#A98ADB]">admin</span> / <span className="font-mono font-semibold text-[#7652B5] dark:text-[#A98ADB]">Admin@123</span>
        </div>
      </form>
    </div>
  );
}
