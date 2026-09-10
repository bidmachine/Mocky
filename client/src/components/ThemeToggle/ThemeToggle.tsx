import React, { useEffect, useState } from 'react';

import './styles.css';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'mocky-theme';

/**
 * Light/dark switch for the whole site.
 *
 * The choice is stamped on the document element, which is what every dark rule keys off, and
 * remembered per browser. Dark is the default: this is a tool for reading payloads and logs, and
 * that is what it is used against all day.
 */
const ThemeToggle = () => {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      // A browser with storage disabled still gets a working toggle, just not a remembered one
    }
  }, [theme]);

  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(next)}
      title={`Switch to ${next} theme`}
      aria-label={`Switch to ${next} theme`}>
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
};

const initialTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch (e) {
    // A browser with storage disabled still gets the default
  }

  return 'dark';
};

export default ThemeToggle;
