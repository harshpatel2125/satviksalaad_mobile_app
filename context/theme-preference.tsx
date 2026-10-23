import React, { createContext, useCallback, useContext, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { storage } from '@/lib/storage';

export type ThemePreference = 'system' | 'dark' | 'light';

const STORAGE_KEY = '@satviksalaad_theme_preference';

interface ThemePreferenceContextValue {
  themePreference: ThemePreference;
  effectiveScheme: 'light' | 'dark';
  setThemePreference: (pref: ThemePreference) => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue>({
  themePreference: 'system',
  effectiveScheme: 'light',
  setThemePreference: () => {},
});

function readStoredPreference(): ThemePreference {
  try {
    const val = storage.getString(STORAGE_KEY);
    if (val === 'dark' || val === 'light' || val === 'system') return val;
  } catch {}
  return 'system';
}

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? 'light';
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>(readStoredPreference);

  const setThemePreference = useCallback((pref: ThemePreference) => {
    setThemePreferenceState(pref);
    try {
      storage.set(STORAGE_KEY, pref);
    } catch {}
  }, []);

  const effectiveScheme: 'light' | 'dark' =
    themePreference === 'system' ? systemScheme : themePreference;

  return (
    <ThemePreferenceContext.Provider value={{ themePreference, effectiveScheme, setThemePreference }}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
