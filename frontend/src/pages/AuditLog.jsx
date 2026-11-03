import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';

const ACTION_COLORS = {
  create: 'text-emerald-600',
  update: 'text-brand-600',
  delete: 'text-red-500',
  cancel: 'text-red-500',
  adjust: 'text-amber-600',
  login: 'text-slate-400',
};

const ACTIONS = ['create', 'update', 'delete', 'cancel', 'adjust', 'login'];

export default function AuditLog() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [entityTypes, setEntityTypes] = useState([]);
  const [filters, setFilters] = useState({ action: '', entity_type: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = () => {
    const params = { ...filters, page, limit: 30 };
    Object.keys(params).forEach((k) => !params[k] && delete params[k]);
    api.get('/audit-log', { params }).then(({ data }) => {
      setEntries(data.data);
      setTotalPages(data.total_pages);
    });
  };

  useEffect(() => {
    api.get('/audit-log/entity-types').then(({ data }) => setEntityTypes(data));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const applyFilters = () => {
    setPage(1);
    load();
  };

  return (
    <div>
      <h1 className="mb-3 text-xl font-bold">{t('audit.title')}</h1>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={filters.action}
          onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          className="rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="">{t('audit.all_actions')}</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{t(`audit.action_${a}`)}</option>
          ))}
        </select>
        <select
          value={filters.entity_type}
          onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })}
          className="rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="">{t('audit.all_entities')}</option>
          {entityTypes.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          className="rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1.5 text-sm"
        />
        <span className="text-sm">{t('reports.to')}</span>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          className="rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1.5 text-sm"
        />
        <button onClick={applyFilters} className="rounded-md bg-brand-600 px-3 py-1.5 text-white text-sm">{t('common.filter')}</button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left">
            <tr>
              <th className="px-3 py-2">{t('audit.when')}</th>
              <th className="px-3 py-2">{t('audit.user')}</th>
              <th className="px-3 py-2">{t('audit.action')}</th>
              <th className="px-3 py-2">{t('audit.entity')}</th>
              <th className="px-3 py-2">{t('audit.details')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{e.username || '—'}</td>
                <td className={`px-3 py-2 font-medium ${ACTION_COLORS[e.action] || ''}`}>{t(`audit.action_${e.action}`, e.action)}</td>
                <td className="px-3 py-2">{e.entity_type}{e.entity_id ? ` #${e.entity_id}` : ''}</td>
                <td className="px-3 py-2 text-xs text-slate-400">
                  {e.details ? Object.entries(e.details).map(([k, v]) => `${k}: ${v}`).join(', ') : ''}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">{t('audit.no_entries')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3 text-sm">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border px-3 py-1 disabled:opacity-40">
          {t('common.prev')}
        </button>
        <span>{t('common.page_of', { page, total: totalPages })}</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border px-3 py-1 disabled:opacity-40">
          {t('common.next')}
        </button>
      </div>
    </div>
  );
}
