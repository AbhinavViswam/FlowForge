import { useEffect, useState } from 'react';
import { Toaster as SonnerToaster } from 'sonner';

const currentTheme = (): 'light' | 'dark' =>
  document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

// App-wide toast container. Follows the light/dark toggle (the data-theme
// attribute on <html>) so toasts always match the rest of the UI.
export default function Toaster() {
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return <SonnerToaster theme={theme} position="bottom-right" richColors closeButton duration={4000} />;
}
