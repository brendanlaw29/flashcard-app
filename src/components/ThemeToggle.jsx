/**
 * ThemeToggle.jsx — cycles System → Light → Dark, and applies the theme by
 * toggling the `dark` class on <html>.
 */

import { useEffect } from 'react';
import { useStore } from '../state/store.jsx';

const ORDER = ['system', 'light', 'dark'];
const ICONS = {
  system: 'M4 5h16v11H4zM9 20h6M12 16v4',
  light: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  dark: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
};

/** Keep <html class="dark"> in sync with the theme setting and the OS preference. */
export function useApplyTheme(theme) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches));
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

export default function ThemeToggle() {
  const { state, setSetting } = useStore();
  const theme = state.settings.theme;
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];

  return (
    <button
      className="btn-ghost px-2.5"
      onClick={() => setSetting('theme', next)}
      aria-label={`Theme: ${theme}. Switch to ${next}.`}
      title={`Theme: ${theme}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={ICONS[theme]} />
      </svg>
      <span className="hidden capitalize sm:inline">{theme}</span>
    </button>
  );
}
