import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
  isDark: false,
  toggleDark: () => {},
  setDarkMode: () => {},
});

const THEME_STORAGE_KEY = 'theme';

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
  } catch (e) {
    console.warn('Failed to read theme from localStorage:', e);
  }
  return false;
};

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(getInitialTheme);

  useEffect(() => {
    try {
      if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
      }
    } catch (e) {
      console.warn('Failed to update theme in localStorage:', e);
    }
  }, [isDark]);

  const toggleDark = () => setIsDark((prev) => !prev);
  const setDarkMode = (val) => setIsDark(Boolean(val));

  return (
    <ThemeContext.Provider value={{ isDark, toggleDark, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
