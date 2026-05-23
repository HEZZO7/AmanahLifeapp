import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import BottomNav from '@/components/BottomNav';

interface ZakatItem {
  label: string;
  labelAr: string;
  value: string;
  key: string;
  icon: string;
}

interface CurrencyGroup {
  region: string;
  regionAr: string;
  currencies: { code: string; name: string; nameAr: string }[];
}

const CURRENCY_GROUPS: CurrencyGroup[] = [
  {
    region: 'Gulf',
    regionAr: 'الخليج',
    currencies: [
      { code: 'SAR', name: 'Saudi Riyal', nameAr: 'ريال سعودي' },
      { code: 'AED', name: 'UAE Dirham', nameAr: 'درهم إماراتي' },
      { code: 'KWD', name: 'Kuwaiti Dinar', nameAr: 'دينار كويتي' },
      { code: 'BHD', name: 'Bahraini Dinar', nameAr: 'دينار بحريني' },
      { code: 'OMR', name: 'Omani Rial', nameAr: 'ريال عماني' },
      { code: 'QAR', name: 'Qatari Riyal', nameAr: 'ريال قطري' },
    ],
  },
  {
    region: 'Middle East',
    regionAr: 'الشرق الأوسط',
    currencies: [
      { code: 'EGP', name: 'Egyptian Pound', nameAr: 'جنيه مصري' },
      { code: 'JOD', name: 'Jordanian Dinar', nameAr: 'دينار أردني' },
      { code: 'IQD', name: 'Iraqi Dinar', nameAr: 'دينار عراقي' },
      { code: 'LBP', name: 'Lebanese Pound', nameAr: 'ليرة لبنانية' },
      { code: 'SYP', name: 'Syrian Pound', nameAr: 'ليرة سورية' },
    ],
  },
  {
    region: 'Turkey',
    regionAr: 'تركيا',
    currencies: [
      { code: 'TRY', name: 'Turkish Lira', nameAr: 'ليرة تركية' },
    ],
  },
  {
    region: 'Asia',
    regionAr: 'آسيا',
    currencies: [
      { code: 'MYR', name: 'Malaysian Ringgit', nameAr: 'رينغيت ماليزي' },
      { code: 'IDR', name: 'Indonesian Rupiah', nameAr: 'روبية إندونيسية' },
      { code: 'PKR', name: 'Pakistani Rupee', nameAr: 'روبية باكستانية' },
      { code: 'BDT', name: 'Bangladeshi Taka', nameAr: 'تاكا بنغلاديشية' },
      { code: 'INR', name: 'Indian Rupee', nameAr: 'روبية هندية' },
    ],
  },
  {
    region: 'Americas',
    regionAr: 'الأمريكتين',
    currencies: [
      { code: 'USD', name: 'US Dollar', nameAr: 'دولار أمريكي' },
      { code: 'CAD', name: 'Canadian Dollar', nameAr: 'دولار كندي' },
    ],
  },
  {
    region: 'Europe',
    regionAr: 'أوروبا',
    currencies: [
      { code: 'EUR', name: 'Euro', nameAr: 'يورو' },
      { code: 'GBP', name: 'British Pound', nameAr: 'جنيه إسترليني' },
      { code: 'CHF', name: 'Swiss Franc', nameAr: 'فرنك سويسري' },
    ],
  },
  {
    region: 'Oceania',
    regionAr: 'أوقيانوسيا',
    currencies: [
      { code: 'AUD', name: 'Australian Dollar', nameAr: 'دولار أسترالي' },
      { code: 'NZD', name: 'New Zealand Dollar', nameAr: 'دولار نيوزيلندي' },
    ],
  },
];

// Current approximate Nisab values in USD
const GOLD_PRICE_PER_GRAM_USD = 75;
const SILVER_PRICE_PER_GRAM_USD = 0.95;
const NISAB_GOLD_GRAMS = 87.48;
const NISAB_SILVER_GRAMS = 612.36;
const ZAKAT_RATE = 0.025;

// Fallback rates (USD base)
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, SAR: 3.75, AED: 3.67, KWD: 0.31, BHD: 0.376, OMR: 0.385, QAR: 3.64,
  EGP: 49.5, JOD: 0.709, IQD: 1310, LBP: 89500, SYP: 13000, TRY: 38.5,
  MYR: 4.45, IDR: 16200, PKR: 278, BDT: 121, INR: 83.5,
  CAD: 1.36, EUR: 0.92, GBP: 0.79, CHF: 0.88, AUD: 1.53, NZD: 1.67,
};

export default function ZakatCalculator() {
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const navigate = useNavigate();
  const [assets, setAssets] = useState<ZakatItem[]>([
    { label: 'Cash & Bank Balance', labelAr: 'النقد والرصيد البنكي', value: '', key: 'cash', icon: '💵' },
    { label: 'Gold (in grams)', labelAr: 'الذهب (بالغرام)', value: '', key: 'gold', icon: '🪙' },
    { label: 'Silver (in grams)', labelAr: 'الفضة (بالغرام)', value: '', key: 'silver', icon: '🥈' },
    { label: 'Investments & Stocks', labelAr: 'الاستثمارات والأسهم', value: '', key: 'investments', icon: '📈' },
    { label: 'Business Inventory', labelAr: 'مخزون تجاري', value: '', key: 'business', icon: '🏪' },
    { label: 'Rental Income', labelAr: 'دخل الإيجار', value: '', key: 'rental', icon: '🏠' },
    { label: 'Other Assets', labelAr: 'أصول أخرى', value: '', key: 'other', icon: '💎' },
  ]);
  const [liabilities, setLiabilities] = useState('');
  const [calculated, setCalculated] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(FALLBACK_RATES);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if (data.result === 'success' && data.rates) {
          setExchangeRates(data.rates);
        }
      } catch {
        // Use fallback rates
      } finally {
        setRatesLoading(false);
      }
    };
    fetchRates();
  }, []);

  const getRate = (code: string): number => {
    return exchangeRates[code] || FALLBACK_RATES[code] || 1;
  };

  const convertToUSD = (amount: number, fromCurrency: string): number => {
    const rate = getRate(fromCurrency);
    return amount / rate;
  };

  const convertFromUSD = (amountUSD: number, toCurrency: string): number => {
    const rate = getRate(toCurrency);
    return amountUSD * rate;
  };

  const updateAsset = (key: string, value: string) => {
    setAssets((prev) => prev.map((a) => (a.key === key ? { ...a, value } : a)));
    setCalculated(false);
  };

  const calculateTotalInUSD = () => {
    let totalUSD = 0;
    assets.forEach((asset) => {
      const val = parseFloat(asset.value) || 0;
      if (asset.key === 'gold') {
        totalUSD += val * GOLD_PRICE_PER_GRAM_USD;
      } else if (asset.key === 'silver') {
        totalUSD += val * SILVER_PRICE_PER_GRAM_USD;
      } else {
        totalUSD += convertToUSD(val, currency);
      }
    });
    return totalUSD;
  };

  const totalAssetsUSD = calculateTotalInUSD();
  const totalLiabilitiesUSD = convertToUSD(parseFloat(liabilities) || 0, currency);
  const netWorthUSD = totalAssetsUSD - totalLiabilitiesUSD;
  const nisabGoldUSD = NISAB_GOLD_GRAMS * GOLD_PRICE_PER_GRAM_USD;
  const nisabSilverUSD = NISAB_SILVER_GRAMS * SILVER_PRICE_PER_GRAM_USD;
  const nisabUSD = Math.min(nisabGoldUSD, nisabSilverUSD);
  const isEligible = netWorthUSD >= nisabUSD;
  const zakatAmountUSD = isEligible ? netWorthUSD * ZAKAT_RATE : 0;

  // Convert display values to selected currency
  const nisabDisplay = convertFromUSD(nisabUSD, currency);
  const totalAssetsDisplay = convertFromUSD(totalAssetsUSD, currency);
  const totalLiabilitiesDisplay = convertFromUSD(totalLiabilitiesUSD, currency);
  const netWorthDisplay = convertFromUSD(netWorthUSD, currency);
  const zakatDisplay = convertFromUSD(zakatAmountUSD, currency);

  const formatAmount = (amount: number): string => {
    if (amount >= 1000000) return amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background pb-20" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="w-16" />
          <h1 className="text-lg font-bold text-foreground">
            💰 {isAr ? 'متتبع العطاء' : 'Giving Tracker'}
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Currency Selector */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">
                🌍 {isAr ? 'اختر العملة' : 'Select Currency'}
              </p>
              {ratesLoading ? (
                <span className="text-[10px] text-muted-foreground animate-pulse">
                  {isAr ? 'جاري تحميل الأسعار...' : 'Loading rates...'}
                </span>
              ) : (
                <span className="text-[10px] text-primary">
                  ✓ {isAr ? 'أسعار مباشرة' : 'Live rates'}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
              className="w-full flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 hover:border-primary transition-all"
            >
              <span className="text-foreground font-medium">{currency}</span>
              <span className="text-muted-foreground text-xs">
                {(() => {
                  const found = CURRENCY_GROUPS.flatMap(g => g.currencies).find(c => c.code === currency);
                  return found ? (isAr ? found.nameAr : found.name) : currency;
                })()}
              </span>
              <svg className={`w-4 h-4 text-muted-foreground transition-transform ${showCurrencyPicker ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showCurrencyPicker && (
              <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-border bg-card">
                {CURRENCY_GROUPS.map((group) => (
                  <div key={group.region}>
                    <div className="sticky top-0 bg-secondary px-3 py-1.5 border-b border-border">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                        {isAr ? group.regionAr : group.region}
                      </p>
                    </div>
                    {group.currencies.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => { setCurrency(c.code); setShowCurrencyPicker(false); setCalculated(false); }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-primary/10 transition-all ${
                          currency === c.code ? 'bg-primary/10 border-l-2 border-primary' : ''
                        }`}
                      >
                        <span className={`text-sm ${currency === c.code ? 'text-primary font-semibold' : 'text-foreground'}`}>
                          {c.code}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {isAr ? c.nameAr : c.name}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Nisab Info */}
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 dark:text-emerald-300 font-medium">
                  {isAr ? 'حد النصاب الحالي' : 'Current Nisab Threshold'}
                </p>
                <p className="text-lg font-bold text-emerald-800 dark:text-emerald-100">
                  {formatAmount(nisabDisplay)} {currency}
                </p>
              </div>
              <div className={isAr ? 'text-left' : 'text-right'}>
                <p className="text-xs text-muted-foreground">
                  {isAr ? 'ذهب' : 'Gold'}: {NISAB_GOLD_GRAMS}{isAr ? 'غ' : 'g'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAr ? 'فضة' : 'Silver'}: {NISAB_SILVER_GRAMS}{isAr ? 'غ' : 'g'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assets Input */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground">
              {isAr ? 'أصولك' : 'Your Assets'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {assets.map((asset) => (
              <div key={asset.key} className="flex items-center gap-3">
                <span className="text-xl w-8">{asset.icon}</span>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground block mb-1">
                    {isAr ? asset.labelAr : asset.label}
                  </label>
                  <Input
                    type="number"
                    placeholder={
                      asset.key === 'gold' || asset.key === 'silver'
                        ? (isAr ? 'غرام' : 'grams')
                        : (isAr ? `المبلغ بـ ${currency}` : `Amount in ${currency}`)
                    }
                    value={asset.value}
                    onChange={(e) => updateAsset(asset.key, e.target.value)}
                    className="bg-secondary"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Liabilities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground">
              {isAr ? 'الخصومات' : 'Deductions'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className="text-xl w-8">📋</span>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1">
                  {isAr ? 'الديون والالتزامات المستحقة' : 'Outstanding Debts & Liabilities'}
                </label>
                <Input
                  type="number"
                  placeholder={isAr ? `المبلغ بـ ${currency}` : `Amount in ${currency}`}
                  value={liabilities}
                  onChange={(e) => { setLiabilities(e.target.value); setCalculated(false); }}
                  className="bg-secondary"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calculate Button */}
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-semibold"
          onClick={() => setCalculated(true)}
        >
          {isAr ? 'احسب المبلغ' : 'Calculate Giving'}
        </Button>

        {/* Results */}
        {calculated && (
          <Card className="border-0 shadow-xl overflow-hidden">
            <div className={`p-6 text-center ${isEligible ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-gray-500 to-gray-600'} text-white`}>
              <p className="text-sm opacity-80">
                {isAr ? 'المبلغ المستحق' : 'Your Giving Amount'}
              </p>
              <p className="text-4xl font-bold mt-2">
                {isEligible ? formatAmount(zakatDisplay) : '0.00'}
              </p>
              <p className="text-sm opacity-70 mt-1">{currency}</p>
              <p className="text-xs opacity-70 mt-2">
                {isEligible
                  ? (isAr ? '٢.٥٪ من صافي ثروتك المؤهلة' : '2.5% of your net eligible wealth')
                  : (isAr ? 'أقل من حد النصاب - لا مبلغ مستحق' : 'Below Nisab threshold - no giving due')
                }
              </p>
            </div>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {isAr ? 'إجمالي الأصول' : 'Total Assets'}
                </span>
                <span className="font-medium text-foreground">{formatAmount(totalAssetsDisplay)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {isAr ? 'الالتزامات' : 'Liabilities'}
                </span>
                <span className="font-medium text-red-500 dark:text-red-400">-{formatAmount(totalLiabilitiesDisplay)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {isAr ? 'صافي الثروة المؤهلة' : 'Net Eligible Wealth'}
                </span>
                <span className="font-bold text-foreground">{formatAmount(netWorthDisplay)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {isAr ? 'حد النصاب' : 'Nisab Threshold'}
                </span>
                <span className={`font-medium ${isEligible ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                  {formatAmount(nisabDisplay)} {isEligible ? '✓' : ''}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <div className="p-4 rounded-xl bg-secondary border border-border">
          <h3 className="font-semibold text-foreground text-sm mb-2">
            ℹ️ {isAr ? 'عن حاسبة العطاء' : 'About Giving Tracker'}
          </h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• {isAr ? 'يُحسب العطاء بنسبة ٢.٥٪ من الثروة المحتفظ بها لسنة فوق النصاب' : 'Giving is calculated as 2.5% of wealth held for one year above Nisab'}</li>
            <li>• {isAr ? 'النصاب هو الحد الأدنى الذي يوجب العطاء' : 'Nisab is the minimum threshold that triggers a giving obligation'}</li>
            <li>• {isAr ? 'أسعار الذهب تقريبية — راجع أسعار السوق الحالية' : 'Gold prices are approximate — consult current market rates'}</li>
            <li>• {isAr ? 'أسعار الصرف مباشرة وقد تختلف قليلاً' : 'Exchange rates are fetched live and may vary slightly'}</li>
            <li>• {isAr ? 'استشر عالماً للأحكام الخاصة بحالتك' : 'Consult a scholar for specific rulings on your situation'}</li>
          </ul>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}