import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../config/api';
import { getCachedSettings, cacheSettings } from '../db/db';
import { getCurrencySymbol, formatCurrency } from '../utils/currency';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const cleanSettings = (data) => {
    if (!data) return data;
    return {
      ...data,
      currency_symbol: getCurrencySymbol(data.currency_symbol),
    };
  };

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/settings');
      const sanitized = cleanSettings(data);
      setSettings(sanitized);
      await cacheSettings(sanitized);
    } catch {
      const cached = await getCachedSettings();
      if (cached) setSettings(cleanSettings(cached));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = async (patch) => {
    const { data } = await api.put('/settings', patch);
    const sanitized = cleanSettings(data);
    setSettings(sanitized);
    await cacheSettings(sanitized);
    return sanitized;
  };

  const currency = getCurrencySymbol(settings);
  const fmt = (amount) => formatCurrency(amount, settings);

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh, update, currency, formatCurrency: fmt }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

export { getCurrencySymbol, formatCurrency };
