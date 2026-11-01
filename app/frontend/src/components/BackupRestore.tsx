import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { exportPortableData, restorePortableData, isPortableLocalKey } from '@/lib/notificationBackup';
import { backupClient } from '@/lib/backupClient';

const APP_VERSION = '2.0.0';

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
      if (!session || session.user.id !== user.id) throw new Error('Not authenticated');

      const supabaseData = await exportPortableData(backupClient, user.id);
      const localData: Record<string, unknown> = {};
      for (const key of Object.keys(localStorage).filter(isPortableLocalKey)) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          try { localData[key] = JSON.parse(value); }
          catch { localData[key] = value; }
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
    } catch {
      console.error('Backup export failed');
      toast.error(isAr ? 'فشل تصدير البيانات' : 'Failed to export data');
    }

    setExporting(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json') || file.size > 10 * 1024 * 1024) {
      toast.error(isAr ? 'يرجى اختيار ملف JSON لا يتجاوز 10 ميغابايت' : 'Please select a JSON file up to 10 MB');
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== user.id) throw new Error('Not authenticated');
      const result = await restorePortableData(backupClient, user.id, JSON.parse(await pendingFile.text()), localStorage);
      toast.success(isAr ? 'تمت استعادة البيانات المدعومة. يرجى تحديث الصفحة.' : 'Supported data restored. Please refresh the page.');
      if (result.ignored) toast.warning(isAr
        ? 'تم تجاوز بيانات غير قابلة للنقل. أعد تفعيل إشعارات الجهاز من الإعدادات؛ الاشتراك والفوترة لا يُستعادان من النسخ الاحتياطية.'
        : 'Nonportable data was skipped. Enable device notifications again in Settings; subscriptions and billing cannot be restored from backups.');

      // Refresh after short delay
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      console.error('Backup import failed');
      toast.error(isAr ? 'لم تكتمل الاستعادة. قد تكون بعض البيانات تغيّرت؛ راجعها قبل إعادة المحاولة.' : 'Restore did not complete. Some data may have changed; review it before retrying.');
    }

    setImporting(false);
    setPendingFile(null);
  };

  return (
    <div className="bg-card rounded-2xl p-4 border border-border">
      <h3 className="text-sm text-muted-foreground mb-3">
        {isAr ? '💾 النسخ الاحتياطي والاستعادة' : '💾 Backup & Restore'}
      </h3>

      <p className="text-xs text-muted-foreground mb-3">
        {isAr
          ? 'تُنقل البيانات الشخصية المدعومة وتفضيلات الإشعارات فقط. لا تُنقل مفاتيح إشعارات الجهاز أو الاشتراكات أو سجلات الفوترة أو بيانات الأعذار الحساسة. أعد تفعيل إشعارات الجهاز من الإعدادات.'
          : 'Backups transfer supported personal data and notification preferences. Device push keys, subscriptions, billing records and sensitive excused-period data are excluded. Enable device notifications again in Settings.'}
      </p>
      <div className="space-y-2">
        {/* Export */}
        <button
          onClick={handleExport}
          disabled={exporting || importing}
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
            disabled={importing || exporting}
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
                ? 'سيتم تحديث التفضيلات والبيانات المحلية المدعومة واستبدال سجل البحث الموجود في الملف. قد تُطبّق بعض التغييرات قبل حدوث خطأ. هل تريد المتابعة؟'
                : 'This updates supported preferences and local data, and replaces search history included in the file. Some changes may apply before an error. Continue?'}
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