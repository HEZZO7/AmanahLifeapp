import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type Theme = 'light' | 'dark';
type ThemeMode = 'manual' | 'auto';

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Priority: URL param > localStorage > default 'dark'. The URL param lets
    // the native app pass its current theme when opening these pages in an
    // external browser tab, which has no access to the app's localStorage.
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTheme = urlParams.get('theme');
      if (urlTheme === 'light' || urlTheme === 'dark') {
        localStorage.setItem('amanah-theme', urlTheme);
        return urlTheme;
      }
    }
    // Fall back to 'al_theme' — the key landing.html's own theme toggle
    // used to write exclusively before it was fixed to also write
    // 'amanah-theme', so users who set their preference there before this
    // fix shipped still get it honored instead of resetting to dark.
    const stored = localStorage.getItem('amanah-theme') || localStorage.getItem('al_theme');
    return (stored as Theme) || 'dark';
  });

  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('amanah-theme-mode');
    return (stored as ThemeMode) || 'manual';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('amanah-theme', newTheme);
    localStorage.setItem('al_theme', newTheme);
  };

  const toggleTheme = () => {
    if (themeMode === 'manual') {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('amanah-theme-mode', mode);
    if (mode === 'auto') {
      applyAutoTheme();
    }
  };

  // Auto theme based on prayer times (sunrise/sunset)
  const applyAutoTheme = useCallback(() => {
    const cachedTimes = localStorage.getItem('amanah-prayer-times-today');
    if (cachedTimes) {
      try {
        const timings = JSON.parse(cachedTimes);
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // Sunrise = Fajr end (approx Sunrise field), Sunset = Maghrib
        const sunrise = timings.Sunrise || timings.Fajr;
        const sunset = timings.Maghrib;

        if (sunrise && sunset) {
          const [sunriseH, sunriseM] = sunrise.split(':').map(Number);
          const [sunsetH, sunsetM] = sunset.split(':').map(Number);
          const sunriseMinutes = sunriseH * 60 + sunriseM;
          const sunsetMinutes = sunsetH * 60 + sunsetM;

          if (currentMinutes >= sunriseMinutes && currentMinutes < sunsetMinutes) {
            setTheme('light');
          } else {
            setTheme('dark');
          }
          return;
        }
      } catch { /* fall through */ }
    }

    // Fallback: use simple time-based (6am-6pm = light)
    const hour = new Date().getHours();
    setTheme(hour >= 6 && hour < 18 ? 'light' : 'dark');
  }, []);

  // Auto-theme interval check
  useEffect(() => {
    if (themeMode !== 'auto') return;

    applyAutoTheme();
    const interval = setInterval(applyAutoTheme, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [themeMode, applyAutoTheme]);

  // Also try to fetch prayer times for auto mode
  useEffect(() => {
    if (themeMode !== 'auto') return;

    const cached = localStorage.getItem('amanah-prayer-times-today');
    if (cached) return; // Already have today's times

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const today = new Date();
          const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
          const res = await fetch(
            `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&method=2`
          );
          const data = await res.json();
          localStorage.setItem('amanah-prayer-times-today', JSON.stringify(data.data.timings));
          applyAutoTheme();
        } catch { /* ignore */ }
      });
    }
  }, [themeMode, applyAutoTheme]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setTheme, toggleTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    return {
      theme: 'dark' as Theme,
      themeMode: 'manual' as ThemeMode,
      setTheme: () => {},
      toggleTheme: () => {},
      setThemeMode: () => {},
    };
  }
  return context;
}