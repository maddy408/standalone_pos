import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../config/api';
import { getCachedSettings, cacheSettings } from '../db/db';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/settings');
      setSettings(data);
      await cacheSettings(data);
    } catch {
      const cached = await getCachedSettings();
      if (cached) setSettings(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = async (patch) => {
    const { data } = await api.put('/settings', patch);
    setSettings(data);
    await cacheSettings(data);
    return data;
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
