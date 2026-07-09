import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { THEMES } from './presets';
import type { Theme, ThemeId } from './types';

const KEY = 'letssplyt.themeId';

const ThemeCtx = createContext<{ theme: Theme; setTheme: (id: ThemeId) => void }>({
  theme: THEMES.aurora,
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [id, setId] = useState<ThemeId>('aurora');

  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((value) => {
      if (value === 'aurora' || value === 'solid') {
        setId(value);
      }
    });
  }, []);

  const setTheme = (next: ThemeId) => {
    setId(next);
    void AsyncStorage.setItem(KEY, next);
  };

  return <ThemeCtx.Provider value={{ theme: THEMES[id], setTheme }}>{children}</ThemeCtx.Provider>;
};

export const useTheme = () => useContext(ThemeCtx);
