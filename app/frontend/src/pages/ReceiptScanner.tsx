import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import PremiumGate from '@/components/PremiumGate';

interface ParsedItem {
  name: string;
  amount: number;
}

interface ScannedReceipt {
  id: string;
  date: string;
  storeName: string;
  items: ParsedItem[];
  total: number;
  category: string;
  addedToFinance: boolean;
}

const STORAGE_KEY = 'amanah-receipts';

const CATEGORIES = {
  en: ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Other'],
  ar: ['طعام', 'مواصلات', 'تسوق', 'فواتير', 'صحة', 'أخرى'],
};

const CATEGORY_MAP: Record<string, string> = {
  'طعام': 'Food',
  'مواصلات': 'Transport',
  'تسوق': 'Shopping',
  'فواتير': 'Bills',
  'صحة': 'Health',
  'أخرى': 'Other',
};

// Calls the real app_11941c8fec_receipt_scan Edge Function (Claude vision-backed) -
// Phase I (Phase D decision, 2026-08). This used to ignore the uploaded photo
// entirely and return a random pick from 4 hardcoded mock receipts after a fake
// 2-second delay, despite the "AI analyzing receipt" label. Same endpoint
// pattern as app_11941c8fec_ai_life_coach.
const RECEIPT_SCAN_ENDPOINT = 'https://nyhsnvjdgifphwkqzwel.supabase.co/functions/v1/app_11941c8fec_receipt_scan';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:<mime>;base64," prefix - the function wants raw base64.
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ReceiptScanner() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [parsedReceipt, setParsedReceipt] = useState<ScannedReceipt | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('Food');
  const [recentScans, setRecentScans] = useState<ScannedReceipt[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setRecentScans(JSON.parse(stored));
      } catch { /* ignore */ }
    }
  }, []);

  function saveReceipts(receipts: ScannedReceipt[]) {
    setRecentScans(receipts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
  }

  function handleFileSelect() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      toast.error(isAr ? 'صيغة الصورة غير مدعومة - استخدم JPEG أو PNG' : 'Unsupported image format - use JPEG or PNG');
      return;
    }

    setScanning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(isAr ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first');
        return;
      }

      const imageBase64 = await readFileAsBase64(file);
      const response = await fetch(RECEIPT_SCAN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ imageBase64, mimeType: file.type, language: isAr ? 'ar' : 'en' }),
      });
      const data = await response.json();

      if (!response.ok || data.error) {
        if (data.error === 'not_a_receipt') {
          toast.error(isAr ? 'لا تبدو هذه الصورة كإيصال' : "This doesn't look like a receipt");
        } else if (data.error === 'unreadable') {
          toast.error(isAr ? 'تعذّرت قراءة الإيصال - جرّب صورة أوضح' : "Couldn't read this receipt clearly - try a clearer photo");
        } else {
          toast.error(isAr ? 'ماسح الإيصالات غير متاح حالياً' : 'Receipt scanner is currently unavailable');
        }
        return;
      }

      const receipt: ScannedReceipt = {
        id: Date.now().toString(),
        date: data.date || new Date().toISOString(),
        storeName: data.storeName,
        items: data.items,
        total: data.total,
        category: 'Food',
        addedToFinance: false,
      };
      setParsedReceipt(receipt);
    } catch {
      toast.error(isAr ? 'حدث خطأ أثناء مسح الإيصال' : 'Something went wrong scanning the receipt');
    } finally {
      setScanning(false);
    }
  }

  function addToFinance() {
    if (!parsedReceipt) return;

    // Save to transactions
    const transactions = JSON.parse(localStorage.getItem('amanah-transactions') || '[]');
    const newTransaction = {
      id: Date.now().toString(),
      type: 'expense',
      amount: parsedReceipt.total,
      category: selectedCategory,
      description: `${parsedReceipt.storeName} (${isAr ? 'ماسح' : 'scanned'})`,
      date: new Date().toISOString().split('T')[0],
    };
    transactions.push(newTransaction);
    localStorage.setItem('amanah-transactions', JSON.stringify(transactions));

    // Save to receipts history
    const updatedReceipt = { ...parsedReceipt, category: selectedCategory, addedToFinance: true };
    const updatedScans = [updatedReceipt, ...recentScans].slice(0, 20);
    saveReceipts(updatedScans);

    setParsedReceipt(null);
  }

  const categories = isAr ? CATEGORIES.ar : CATEGORIES.en;

  return (
    <div className="min-h-screen bg-background pb-20" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader icon="📸" title={isAr ? 'ماسح الإيصالات' : 'Receipt Scanner'} />

      {/* Action Button */}
      <div className="max-w-lg mx-auto px-4 pt-3 flex justify-end">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-xs text-primary border border-primary/30 px-2 py-1 rounded-lg"
        >
          {isAr ? 'السجل' : 'History'}
        </button>
      </div>

      <main className="max-w-lg mx-auto px-4 py-4">
        <PremiumGate requiredTier="balanced" featureName={isAr ? 'ماسح الإيصالات' : 'Receipt Scanner'}>
          <div className="space-y-4">
            {/* Upload Area */}
            {!parsedReceipt && !showHistory && (
              <div className="bg-card rounded-2xl p-6 border border-dashed border-border text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {scanning ? (
                  <div className="py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c9a96e] mx-auto mb-4" />
                    <p className="text-foreground font-medium">
                      {isAr ? 'جاري المسح...' : 'Scanning...'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isAr ? 'تحليل الإيصال بالذكاء الاصطناعي' : 'AI analyzing receipt'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-5xl mb-4">📷</div>
                    <h3 className="text-foreground font-bold mb-2">
                      {isAr ? 'مسح إيصال' : 'Scan a Receipt'}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      {isAr
                        ? 'التقط صورة أو ارفع صورة لإيصال لتحليله تلقائياً'
                        : 'Take a photo or upload an image of a receipt for automatic analysis'}
                    </p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={handleFileSelect}
                        className="bg-[#c9a96e] hover:bg-[#b8944f] text-white font-semibold py-3 px-6 rounded-xl transition-all flex items-center gap-2"
                      >
                        📷 {isAr ? 'التقاط صورة' : 'Take Photo'}
                      </button>
                      <button
                        onClick={handleFileSelect}
                        className="bg-primary/10 border border-primary/30 text-primary font-semibold py-3 px-6 rounded-xl transition-all flex items-center gap-2"
                      >
                        📁 {isAr ? 'رفع ملف' : 'Upload'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Parsed Receipt */}
            {parsedReceipt && !showHistory && (
              <div className="bg-card rounded-2xl p-4 border border-border animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-foreground font-bold flex items-center gap-2">
                    <span>🧾</span>
                    {parsedReceipt.storeName}
                  </h3>
                  <button
                    onClick={() => setParsedReceipt(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>

                {/* Items List */}
                <div className="space-y-2 mb-4">
                  {parsedReceipt.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-background/50">
                      <span className="text-sm text-foreground">{item.name}</span>
                      <span className="text-sm font-medium text-foreground">{item.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#c9a96e]/10 border border-[#c9a96e]/20">
                    <span className="text-sm font-bold text-foreground">{isAr ? 'المجموع' : 'Total'}</span>
                    <span className="text-sm font-bold text-[#c9a96e]">{parsedReceipt.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Category Selection */}
                <div className="mb-4">
                  <label className="text-xs text-muted-foreground mb-2 block">
                    {isAr ? 'التصنيف' : 'Category'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {categories.map((cat, i) => {
                      const catValue = isAr ? (CATEGORY_MAP[cat] || cat) : cat;
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedCategory(catValue)}
                          className={`py-2 px-2 rounded-lg text-xs font-medium transition-all border ${
                            selectedCategory === catValue
                              ? 'bg-[#c9a96e]/20 border-[#c9a96e] text-[#c9a96e]'
                              : 'bg-background border-border text-muted-foreground hover:border-primary'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Add to Finance Button */}
                <button
                  onClick={addToFinance}
                  className="w-full bg-[#c9a96e] hover:bg-[#b8944f] text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  💰 {isAr ? 'إضافة للمالية' : 'Add to Finance'}
                </button>
              </div>
            )}

            {/* Recent Scans History */}
            {showHistory && (
              <div className="bg-card rounded-2xl p-4 border border-border">
                <h3 className="text-foreground font-bold mb-3 flex items-center gap-2">
                  <span>📋</span>
                  {isAr ? 'السجل الأخير' : 'Recent Scans'}
                </h3>
                {recentScans.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    {isAr ? 'لا توجد إيصالات ممسوحة بعد' : 'No scanned receipts yet'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recentScans.slice(0, 10).map(scan => (
                      <div key={scan.id} className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border">
                        <div>
                          <p className="text-sm font-medium text-foreground">{scan.storeName}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(scan.date).toLocaleDateString()} • {scan.category}
                          </p>
                        </div>
                        <div className="text-end">
                          <p className="text-sm font-bold text-foreground">{scan.total.toFixed(2)}</p>
                          {scan.addedToFinance && (
                            <span className="text-[10px] text-emerald-400">
                              ✓ {isAr ? 'مضاف' : 'Added'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowHistory(false)}
                  className="w-full mt-3 bg-background border border-border text-foreground py-2 rounded-xl text-sm"
                >
                  {isAr ? 'العودة للماسح' : 'Back to Scanner'}
                </button>
              </div>
            )}

            {/* Tips */}
            {!parsedReceipt && !showHistory && (
              <div className="bg-card rounded-2xl p-4 border border-border">
                <h3 className="text-foreground font-bold mb-3 flex items-center gap-2">
                  <span>💡</span>
                  {isAr ? 'نصائح للمسح' : 'Scanning Tips'}
                </h3>
                <div className="space-y-2">
                  {[
                    isAr ? 'تأكد من إضاءة جيدة عند التصوير' : 'Ensure good lighting when taking photos',
                    isAr ? 'ضع الإيصال على سطح مستوٍ' : 'Place receipt on a flat surface',
                    isAr ? 'تأكد أن النص واضح وغير مطوي' : 'Make sure text is clear and not folded',
                    isAr ? 'التقط الإيصال كاملاً في إطار واحد' : 'Capture the full receipt in one frame',
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 p-2">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <span className="text-muted-foreground text-sm">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PremiumGate>
      </main>

      <BottomNav />
    </div>
  );
}