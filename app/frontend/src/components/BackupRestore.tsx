import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Download, Upload, AlertTriangle } from 'lucide-react';

const APP_VERSION = '2.0.0';
const SUPABASE_URL = 'https://nyhsnvjdgifphwkqzwel.supabase.co';

// Tables that contain user data
const USER_TABLES = [
  'app_11941c8fec_push_subscriptions',
  'app_11941c8fec_notification_preferences',
  'app_11941c8fec_email_digest',
  'app_11941c8fec_search_history',
  'app_11941c8fec_subscriptions',
];

// Local storage keys to backup
const LOCAL_STORAGE_KEYS = [
  'amanah-settings',
  'amanah-tasks',
  'amanah-goals',
  'amanah-transactions',
  'amanah-habits',
  'amanah-planner',
  'amanah-wellness',
  'amanah-daily-routine',
  'amanah-fasting',
  'amanah-adhkar-progress',
  'amanah-bills',
  'amanah-family-budget',
  'amanah-savings-challenges',
];

export default function BackupRestore() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const isAr = language === 'ar';

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Collect data from Supabase tables
      const supabaseData: Record<string, unknown[]> = {};
      for (const table of USER_TABLES) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', user.id);
        if (!error && data) {
          supabaseData[table] = data;
        }
      }

      // Collect local storage data
      const localData: Record<string, unknown> = {};
      for (const key of LOCAL_STORAGE_KEYS) {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            localData[key] = JSON.parse(value);
          } catch {
            localData[key] = value;
          }
        }
      }

      // Also backup prayer completion data and dhikr
      const allKeys = Object.keys(localStorage);
      const dynamicKeys = allKeys.filter(k => 
        k.startsWith('prayer_completed_') || 
        k.startsWith('dhikr_') ||
        k.startsWith('amanah-')
      );
      for (const key of dynamicKeys) {
        if (!localData[key]) {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              localData[key] = JSON.parse(value);
            } catch {
              localData[key] = value;
            }
          }
        }
      }

      const backup = {
        metadata: {
          version: APP_VERSION,
          exportedAt: new Date().toISOString(),
          userId: user.id,
          email: user.email,
        },
        supabaseData,
        localData,
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `amanahlife-backup-${timestamp}.json`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(isAr ? 'تم تصدير البيانات بنجاح!' : 'Data exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(isAr ? 'فشل تصدير البيانات' : 'Failed to export data');
    }

    setExporting(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error(isAr ? 'يرجى اختيار ملف JSON' : 'Please select a JSON file');
      return;
    }

    setPendingFile(file);
    setShowConfirm(true);
    // Reset input
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!pendingFile || !user) return;
    setImporting(true);
    setShowConfirm(false);

    try {
      const text = await pendingFile.text();
      const backup = JSON.parse(text);

      // Validate backup structure
      if (!backup.metadata || !backup.metadata.version) {
        throw new Error('Invalid backup file format');
      }

      // Restore local storage data
      if (backup.localData) {
        for (const [key, value] of Object.entries(backup.localData)) {
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
      }

      // Restore Supabase data
      if (backup.supabaseData) {
        for (const [table, rows] of Object.entries(backup.supabaseData)) {
          if (!Array.isArray(rows) || rows.length === 0) continue;

          // Delete existing data for this user
          await supabase.from(table).delete().eq('user_id', user.id);

          // Insert backup data (update user_id to current user)
          const updatedRows = rows.map((row: Record<string, unknown>) => ({
            ...row,
            user_id: user.id,
          }));

          // Remove id field to let DB generate new ones
          const cleanRows = updatedRows.map(({ id, ...rest }: Record<string, unknown>) => rest);
          
          if (cleanRows.length > 0) {
            await supabase.from(table).insert(cleanRows);
          }
        }
      }

      toast.success(isAr ? 'تم استيراد البيانات بنجاح! يرجى تحديث الصفحة.' : 'Data imported successfully! Please refresh the page.');
      
      // Refresh after short delay
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Import failed:', error);
      toast.error(isAr ? 'فشل استيراد البيانات. تأكد من صحة الملف.' : 'Failed to import data. Please check the file.');
    }

    setImporting(false);
    setPendingFile(null);
  };

  return (
    <div className="bg-card rounded-2xl p-4 border border-border">
      <h3 className="text-sm text-muted-foreground mb-3">
        {isAr ? '💾 النسخ الاحتياطي والاستعادة' : '💾 Backup & Restore'}
      </h3>

      <div className="space-y-2">
        {/* Export */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full bg-background border border-border rounded-xl px-4 py-3 flex items-center gap-3 hover:border-primary transition-all disabled:opacity-50"
        >
          <Download className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="text-left flex-1">
            <p className="text-foreground text-sm">
              {exporting
                ? (isAr ? 'جارٍ التصدير...' : 'Exporting...')
                : (isAr ? 'تصدير البيانات' : 'Export Data')}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {isAr ? 'تحميل نسخة احتياطية JSON' : 'Download JSON backup'}
            </p>
          </div>
        </button>

        {/* Import */}
        <label className="w-full bg-background border border-border rounded-xl px-4 py-3 flex items-center gap-3 hover:border-primary transition-all cursor-pointer">
          <Upload className="w-4 h-4 text-[#D4A017] flex-shrink-0" />
          <div className="text-left flex-1">
            <p className="text-foreground text-sm">
              {importing
                ? (isAr ? 'جارٍ الاستيراد...' : 'Importing...')
                : (isAr ? 'استيراد البيانات' : 'Import Data')}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {isAr ? 'استعادة من ملف JSON' : 'Restore from JSON file'}
            </p>
          </div>
          <input
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            disabled={importing}
            className="hidden"
          />
        </label>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full border border-border shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h4 className="text-foreground font-semibold">
                {isAr ? 'تأكيد الاستيراد' : 'Confirm Import'}
              </h4>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {isAr
                ? 'سيتم استبدال بياناتك الحالية بالبيانات من الملف. هل تريد المتابعة؟'
                : 'This will replace your current data with data from the file. Continue?'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowConfirm(false); setPendingFile(null); }}
                className="flex-1 py-2.5 rounded-xl border border-border text-foreground text-sm hover:bg-background transition-all"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleImport}
                className="flex-1 py-2.5 rounded-xl bg-[#D4A017] text-white text-sm font-medium hover:bg-[#b8944f] transition-all"
              >
                {isAr ? 'استيراد' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}