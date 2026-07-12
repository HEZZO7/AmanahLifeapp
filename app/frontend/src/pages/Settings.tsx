import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import NotificationSettings from '@/components/NotificationSettings';
import PrayerReminderSettings from '@/components/PrayerReminderSettings';
import BackupRestore from '@/components/BackupRestore';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface AppSettings {
  currency: string;
  country: string;
  showHijri: boolean;
  showIslamicEvents: boolean;
  ramadanMode: boolean;
  easternNumerals: boolean;
}

const COUNTRIES = [
  { code: 'SA', nameAr: 'السعودية', nameEn: 'Saudi Arabia', currency: 'SAR', symbol: '﷼', flag: '🇸🇦' },
  { code: 'AE', nameAr: 'الإمارات', nameEn: 'UAE', currency: 'AED', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'KW', nameAr: 'الكويت', nameEn: 'Kuwait', currency: 'KWD', symbol: 'د.ك', flag: '🇰🇼' },
  { code: 'BH', nameAr: 'البحرين', nameEn: 'Bahrain', currency: 'BHD', symbol: '.د.ب', flag: '🇧🇭' },
  { code: 'OM', nameAr: 'عمان', nameEn: 'Oman', currency: 'OMR', symbol: 'ر.ع', flag: '🇴🇲' },
  { code: 'QA', nameAr: 'قطر', nameEn: 'Qatar', currency: 'QAR', symbol: 'ر.ق', flag: '🇶🇦' },
  { code: 'EG', nameAr: 'مصر', nameEn: 'Egypt', currency: 'EGP', symbol: 'ج.م', flag: '🇪🇬' },
  { code: 'JO', nameAr: 'الأردن', nameEn: 'Jordan', currency: 'JOD', symbol: 'د.أ', flag: '🇯🇴' },
  { code: 'IQ', nameAr: 'العراق', nameEn: 'Iraq', currency: 'IQD', symbol: 'ع.د', flag: '🇮🇶' },
  { code: 'LB', nameAr: 'لبنان', nameEn: 'Lebanon', currency: 'LBP', symbol: 'ل.ل', flag: '🇱🇧' },
  { code: 'SY', nameAr: 'سوريا', nameEn: 'Syria', currency: 'SYP', symbol: 'ل.س', flag: '🇸🇾' },
  { code: 'TR', nameAr: 'تركيا', nameEn: 'Turkey', currency: 'TRY', symbol: '₺', flag: '🇹🇷' },
  { code: 'MY', nameAr: 'ماليزيا', nameEn: 'Malaysia', currency: 'MYR', symbol: 'RM', flag: '🇲🇾' },
  { code: 'ID', nameAr: 'إندونيسيا', nameEn: 'Indonesia', currency: 'IDR', symbol: 'Rp', flag: '🇮🇩' },
  { code: 'PK', nameAr: 'باكستان', nameEn: 'Pakistan', currency: 'PKR', symbol: '₨', flag: '🇵🇰' },
  { code: 'BD', nameAr: 'بنغلاديش', nameEn: 'Bangladesh', currency: 'BDT', symbol: '৳', flag: '🇧🇩' },
  { code: 'IN', nameAr: 'الهند', nameEn: 'India', currency: 'INR', symbol: '₹', flag: '🇮🇳' },
  { code: 'US', nameAr: 'الولايات المتحدة', nameEn: 'USA', currency: 'USD', symbol: '$', flag: '🇺🇸' },
  { code: 'CA', nameAr: 'كندا', nameEn: 'Canada', currency: 'CAD', symbol: 'C$', flag: '🇨🇦' },
  { code: 'EU', nameAr: 'منطقة اليورو', nameEn: 'Eurozone', currency: 'EUR', symbol: '€', flag: '🇪🇺' },
  { code: 'GB', nameAr: 'المملكة المتحدة', nameEn: 'UK', currency: 'GBP', symbol: '£', flag: '🇬🇧' },
  { code: 'CH', nameAr: 'سويسرا', nameEn: 'Switzerland', currency: 'CHF', symbol: 'Fr', flag: '🇨🇭' },
  { code: 'AU', nameAr: 'أستراليا', nameEn: 'Australia', currency: 'AUD', symbol: 'A$', flag: '🇦🇺' },
  { code: 'NZ', nameAr: 'نيوزيلندا', nameEn: 'New Zealand', currency: 'NZD', symbol: 'NZ$', flag: '🇳🇿' },
];

const DEFAULT_SETTINGS: AppSettings = {
  currency: 'QAR',
  country: 'QA',
  showHijri: true,
  showIslamicEvents: true,
  ramadanMode: false,
  easternNumerals: false,
};

function getSafeSettings(): AppSettings {
  try {
    const stored = localStorage.getItem('amanah-settings');
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Corrupted localStorage - reset
  }
  return DEFAULT_SETTINGS;
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, themeMode, toggleTheme, setThemeMode } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(getSafeSettings);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('amanah-settings', JSON.stringify(settings));
  }, [settings]);

  const updateSetting = (key: keyof AppSettings, value: boolean | string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleCountryChange = (countryCode: string) => {
    const country = COUNTRIES.find(c => c.code === countryCode);
    if (country) {
      setSettings(prev => ({ ...prev, country: countryCode, currency: country.currency }));
    }
  };

  const getSubscriptionTier = () => {
    try {
      const stored = localStorage.getItem('amanahlife_subscription');
      if (stored) {
        const sub = JSON.parse(stored);
        return sub.tier || 'free';
      }
    } catch { /* ignore */ }
    return 'free';
  };

  const tierNames: Record<string, { ar: string; en: string }> = {
    free: { ar: 'مجاني', en: 'Free' },
    balanced: { ar: 'الحياة المتوازنة', en: 'Balanced Life' },
    family: { ar: 'أمانة العائلة', en: 'Family Trust' },
  };

  const currentTier = getSubscriptionTier();
  const isAr = language === 'ar';

  const getSelectedCountry = () => COUNTRIES.find(c => c.code === settings.country);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error(isAr ? 'يرجى كتابة DELETE للتأكيد' : 'Please type DELETE to confirm');
      return;
    }

    setDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(isAr ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first');
        setDeleteLoading(false);
        return;
      }

      const response = await fetch(
        'https://nyhsnvjdgifphwkqzwel.supabase.co/functions/v1/app_11941c8fec_delete_account',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ confirm: true }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete account');
      }

      toast.success(isAr ? 'تم حذف الحساب بنجاح' : 'Account deleted successfully');
      // Clear local storage
      localStorage.clear();
      await signOut();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : (isAr ? 'فشل حذف الحساب' : 'Failed to delete account')
      );
    }
    setDeleteLoading(false);
    setShowDeleteDialog(false);
    setDeleteConfirmText('');
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
    <div className="min-h-screen bg-background pb-20" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader icon="⚙️" title={t('settings')} />

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Subscription Section */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="text-sm text-muted-foreground mb-3">{isAr ? 'الاشتراك' : 'Subscription'}</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#c9a96e] to-[#a67c3d] flex items-center justify-center">
                <span className="text-sm">👑</span>
              </div>
              <div>
                <p className="text-foreground font-medium text-sm">
                  {isAr ? tierNames[currentTier]?.ar : tierNames[currentTier]?.en}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {isAr ? 'باقتك الحالية' : 'Current Plan'}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/subscription')}
              className="bg-[#c9a96e] hover:bg-[#b8944f] text-white text-xs font-medium px-4 py-2 rounded-xl transition-all"
            >
              {isAr ? 'إدارة' : 'Manage'}
            </button>
          </div>
        </div>

        {/* Profile Section */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="text-sm text-muted-foreground mb-3">{t('profile')}</h3>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1FC7C1] to-[#178F8A] flex items-center justify-center">
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
          {/* Auto theme scheduling */}
          <div className="mt-3 pt-3 border-t border-border">
            <ToggleRow
              label={isAr ? 'تبديل تلقائي (شروق/غروب)' : 'Auto-switch (sunrise/sunset)'}
              icon="🌗"
              checked={themeMode === 'auto'}
              onChange={() => setThemeMode(themeMode === 'auto' ? 'manual' : 'auto')}
            />
            {themeMode === 'auto' && (
              <p className="text-[10px] text-muted-foreground mt-1.5 ml-6">
                {isAr
                  ? 'يتبدل تلقائياً حسب أوقات الصلاة (الشروق/المغرب)'
                  : 'Switches automatically based on prayer times (sunrise/maghrib)'}
              </p>
            )}
          </div>
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

        {/* Notifications */}
        <NotificationSettings />

        {/* Smart Prayer Reminders */}
        <PrayerReminderSettings />

        {/* Regional */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="text-sm text-muted-foreground mb-3">{isAr ? 'الإقليمية' : 'Regional'}</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{isAr ? 'الدولة' : 'Country'}</label>
              <select
                value={settings.country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary"
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {isAr ? c.nameAr : c.nameEn} - {c.currency} {c.symbol}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-foreground text-sm">{isAr ? 'العملة' : 'Currency'}</span>
              <span className="text-muted-foreground text-sm">
                {settings.currency} {getSelectedCountry()?.symbol || ''}
              </span>
            </div>
          </div>
        </div>

        {/* Islamic Calendar Toggles */}
        <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
          <ToggleRow
            label={isAr ? 'التقويم الهجري' : 'Hijri Calendar'}
            icon="🗓️"
            checked={settings.showHijri}
            onChange={() => updateSetting('showHijri', !settings.showHijri)}
          />
          <ToggleRow
            label={isAr ? 'المناسبات الإسلامية' : 'Islamic Events'}
            icon="🕌"
            checked={settings.showIslamicEvents}
            onChange={() => updateSetting('showIslamicEvents', !settings.showIslamicEvents)}
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

        {/* Backup & Restore */}
        <BackupRestore />

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

        {/* Delete Account */}
        <div className="bg-card rounded-2xl p-4 border border-red-500/30">
          <h3 className="text-sm text-red-400 mb-3">{isAr ? 'منطقة الخطر' : 'Danger Zone'}</h3>
          <p className="text-xs text-muted-foreground mb-3">
            {isAr
              ? 'حذف حسابك نهائي ولا يمكن التراجع عنه. سيتم حذف جميع بياناتك.'
              : 'Deleting your account is permanent and cannot be undone. All your data will be removed.'}
          </p>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="w-full bg-red-500/10 border border-red-500/30 text-red-400 py-3 rounded-xl text-sm font-medium hover:bg-red-500/20 transition-all"
          >
            {isAr ? '🗑️ حذف الحساب' : '🗑️ Delete Account'}
          </button>
        </div>

        {/* Sign Out */}
        <button
          onClick={async () => {
            setSignOutLoading(true);
            await signOut();
          }}
          disabled={signOutLoading}
          className="w-full bg-red-500/10 border border-red-500/30 text-red-400 py-3 rounded-2xl text-sm font-medium hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {signOutLoading ? (isAr ? 'جارٍ تسجيل الخروج...' : 'Signing out...') : t('signOut')}
        </button>
      </main>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-500">
              {isAr ? '⚠️ حذف الحساب' : '⚠️ Delete Account'}
            </DialogTitle>
            <DialogDescription>
              {isAr
                ? 'هذا الإجراء لا يمكن التراجع عنه. سيتم حذف حسابك وجميع بياناتك نهائياً.'
                : 'This action cannot be undone. Your account and all associated data will be permanently deleted.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                {isAr ? 'اكتب DELETE للتأكيد' : 'Type DELETE to confirm'}
              </Label>
              <Input
                id="delete-confirm"
                type="text"
                placeholder="DELETE"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="border-red-500/30 focus:border-red-500"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText('');
              }}
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'DELETE' || deleteLoading}
            >
              {deleteLoading
                ? (isAr ? 'جاري الحذف...' : 'Deleting...')
                : (isAr ? 'حذف نهائي' : 'Delete Forever')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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