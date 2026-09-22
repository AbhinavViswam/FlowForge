import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { IconButton } from './ui';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'light'; } catch { return 'light'; }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
  }, [theme]);

  return (
    <IconButton
      label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </IconButton>
  );
}
