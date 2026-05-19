import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import BottomNav from '@/components/BottomNav';

interface AppSettings {
  currency: string;
  showHijri: boolean;
  ramadanMode: boolean;
  easternNumerals: boolean;
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(() => {
    const stored = localStorage.getItem('amanah-settings');
    return stored ? JSON.parse(stored) : {
      currency: 'QAR',
      showHijri: true,
      ramadanMode: false,
      easternNumerals: false,
    };
  });

  useEffect(() => {
    localStorage.setItem('amanah-settings', JSON.stringify(settings));
  }, [settings]);

  const updateSetting = (key: keyof AppSettings, value: boolean | string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const exportFinanceCSV = () => {
    const transactions = JSON.parse(localStorage.getItem('amanah-transactions') || '[]');
    if (transactions.length === 0) return;
    const headers = 'Date,Type,Category,Amount,Description\n';
    const rows = transactions.map((t: { date?: string; type?: string; category?: string; amount?: number; description?: string }) =>
      `${t.date || ''},${t.type || ''},${t.category || ''},${t.amount || 0},${t.description || ''}`
    ).join('\n');
    downloadCSV(headers + rows, 'amanah-finance-export.csv');
  };

  const exportGoalsCSV = () => {
    const goals = JSON.parse(localStorage.getItem('amanah-goals') || '[]');
    if (goals.length === 0) return;
    const headers = 'Title,Category,Status,Progress,Target Date\n';
    const rows = goals.map((g: { title?: string; category?: string; status?: string; progress?: number; targetDate?: string }) =>
      `${g.title || ''},${g.category || ''},${g.status || ''},${g.progress || 0}%,${g.targetDate || ''}`
    ).join('\n');
    downloadCSV(headers + rows, 'amanah-goals-export.csv');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 flex items-center h-14">
          <h1 className="text-xl font-bold text-foreground">⚙️ {t('settings')}</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Profile Section */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="text-sm text-muted-foreground mb-3">{t('profile')}</h3>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#14b8a6] to-[#0d9488] flex items-center justify-center">
              <span className="text-white text-lg font-bold">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <p className="text-foreground font-medium text-sm">{user?.email || 'User'}</p>
              <p className="text-xs text-muted-foreground">AmanahLife Member</p>
            </div>
          </div>
        </div>

        {/* Theme */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="text-sm text-muted-foreground mb-3">{t('theme')}</h3>
          <ToggleRow
            label={theme === 'dark' ? t('darkMode') : t('lightMode')}
            icon={theme === 'dark' ? '🌙' : '☀️'}
            checked={theme === 'dark'}
            onChange={toggleTheme}
          />
        </div>

        {/* Language */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="text-sm text-muted-foreground mb-3">{t('chooseLanguage')}</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setLanguage('en')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                language === 'en' ? 'bg-primary text-white' : 'bg-background text-muted-foreground border border-border'
              }`}
            >
              🇬🇧 English
            </button>
            <button
              onClick={() => setLanguage('ar')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                language === 'ar' ? 'bg-primary text-white' : 'bg-background text-muted-foreground border border-border'
              }`}
            >
              🇸🇦 العربية
            </button>
          </div>
        </div>

        {/* Currency */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="text-sm text-muted-foreground mb-3">{t('currency')}</h3>
          <select
            value={settings.currency}
            onChange={(e) => updateSetting('currency', e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary"
          >
            <option value="QAR">QAR - Qatari Riyal</option>
            <option value="USD">USD - US Dollar</option>
            <option value="SAR">SAR - Saudi Riyal</option>
            <option value="AED">AED - UAE Dirham</option>
            <option value="EGP">EGP - Egyptian Pound</option>
          </select>
        </div>

        {/* Toggles */}
        <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
          <ToggleRow
            label={t('hijriCalendar')}
            icon="📅"
            checked={settings.showHijri}
            onChange={() => updateSetting('showHijri', !settings.showHijri)}
          />
          <ToggleRow
            label={t('ramadanMode')}
            icon="🌙"
            checked={settings.ramadanMode}
            onChange={() => updateSetting('ramadanMode', !settings.ramadanMode)}
          />
          <ToggleRow
            label={t('easternNumerals')}
            icon="١٢٣"
            checked={settings.easternNumerals}
            onChange={() => updateSetting('easternNumerals', !settings.easternNumerals)}
          />
        </div>

        {/* Export Data */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="text-sm text-muted-foreground mb-3">{t('exportData')}</h3>
          <div className="space-y-2">
            <button
              onClick={exportFinanceCSV}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-left flex items-center gap-3 hover:border-primary transition-all"
            >
              <span>💰</span>
              <div>
                <p className="text-foreground text-sm">{t('exportFinance')}</p>
                <p className="text-[10px] text-muted-foreground">CSV format</p>
              </div>
            </button>
            <button
              onClick={exportGoalsCSV}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-left flex items-center gap-3 hover:border-primary transition-all"
            >
              <span>🎯</span>
              <div>
                <p className="text-foreground text-sm">{t('exportGoals')}</p>
                <p className="text-[10px] text-muted-foreground">CSV format</p>
              </div>
            </button>
          </div>
        </div>

        {/* Sign Out */}
        <button
          onClick={signOut}
          className="w-full bg-red-500/10 border border-red-500/30 text-red-400 py-3 rounded-2xl text-sm font-medium hover:bg-red-500/20 transition-all"
        >
          {t('signOut')}
        </button>
      </main>

      <BottomNav />
    </div>
  );
}

function ToggleRow({ label, icon, checked, onChange }: { label: string; icon: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm">{icon}</span>
        <span className="text-foreground text-sm">{label}</span>
      </div>
      <button
        onClick={onChange}
        className={`w-11 h-6 rounded-full transition-all relative ${checked ? 'bg-primary' : 'bg-secondary'}`}
      >
        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}