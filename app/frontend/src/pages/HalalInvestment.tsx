import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';

interface Investment {
  id: string;
  name: string;
  amount: number;
  type: 'Stocks' | 'Sukuk' | 'Real Estate' | 'Gold';
  date: string;
  returns: number;
}

interface HomeOwnership {
  propertyValue: number;
  downPayment: number;
  monthlyInstallment: number;
  totalPaid: number;
}

interface InvestmentData {
  portfolio: Investment[];
  homeOwnership: HomeOwnership;
}

const STORAGE_KEY = 'amanah_investments';

const HALAL_CRITERIA = [
  { icon: '🚫🍺', en: 'No Alcohol', ar: 'لا كحول' },
  { icon: '🚫🎰', en: 'No Gambling', ar: 'لا قمار' },
  { icon: '🚫💳', en: 'No Interest-Based Finance', ar: 'لا ربا' },
  { icon: '🚫🐷', en: 'No Pork Products', ar: 'لا منتجات خنزير' },
  { icon: '🚫🔫', en: 'No Weapons', ar: 'لا أسلحة' },
  { icon: '🚫🎭', en: 'No Adult Entertainment', ar: 'لا ترفيه محرم' },
];

export default function HalalInvestment() {
  const { language } = useLanguage();
  const [data, setData] = useState<InvestmentData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    return {
      portfolio: [],
      homeOwnership: { propertyValue: 0, downPayment: 0, monthlyInstallment: 0, totalPaid: 0 },
    };
  });

  const [activeTab, setActiveTab] = useState<'screening' | 'portfolio' | 'murabaha' | 'ijara' | 'home'>('portfolio');
  const [newInvestment, setNewInvestment] = useState({ name: '', amount: '', type: 'Stocks' as Investment['type'] });

  // Murabaha calculator state
  const [murabaha, setMurabaha] = useState({ costPrice: '', profitMargin: '', installments: '' });
  // Ijara calculator state
  const [ijara, setIjara] = useState({ assetValue: '', leaseTerm: '', monthlyRent: '' });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const addInvestment = () => {
    if (!newInvestment.name || !newInvestment.amount) return;
    setData(prev => ({
      ...prev,
      portfolio: [...prev.portfolio, {
        id: Date.now().toString(),
        name: newInvestment.name,
        amount: parseFloat(newInvestment.amount),
        type: newInvestment.type,
        date: new Date().toISOString().split('T')[0],
        returns: 0,
      }],
    }));
    setNewInvestment({ name: '', amount: '', type: 'Stocks' });
  };

  const removeInvestment = (id: string) => {
    setData(prev => ({ ...prev, portfolio: prev.portfolio.filter(i => i.id !== id) }));
  };

  const totalPortfolio = data.portfolio.reduce((sum, i) => sum + i.amount, 0);

  // Murabaha calculation
  const murabahaResult = (() => {
    const cost = parseFloat(murabaha.costPrice) || 0;
    const margin = parseFloat(murabaha.profitMargin) || 0;
    const inst = parseInt(murabaha.installments) || 1;
    const totalPrice = cost + (cost * margin / 100);
    const monthlyPayment = totalPrice / inst;
    return { totalPrice, monthlyPayment, profit: totalPrice - cost };
  })();

  // Ijara calculation
  const ijaraResult = (() => {
    const value = parseFloat(ijara.assetValue) || 0;
    const term = parseInt(ijara.leaseTerm) || 1;
    const rent = parseFloat(ijara.monthlyRent) || 0;
    const totalRent = rent * term;
    const ownership = totalRent >= value;
    return { totalRent, ownership, remaining: Math.max(value - totalRent, 0) };
  })();

  const tabs = [
    { key: 'screening' as const, label: language === 'ar' ? 'الفحص' : 'Screening', icon: '✅' },
    { key: 'portfolio' as const, label: language === 'ar' ? 'المحفظة' : 'Portfolio', icon: '📈' },
    { key: 'murabaha' as const, label: language === 'ar' ? 'مرابحة' : 'Murabaha', icon: '🏦' },
    { key: 'ijara' as const, label: language === 'ar' ? 'إجارة' : 'Ijara', icon: '🏠' },
    { key: 'home' as const, label: language === 'ar' ? 'التملك' : 'Home', icon: '🏡' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-foreground">
            {language === 'ar' ? '📈 الاستثمار الحلال' : '📈 Halal Investment'}
          </h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-card text-muted-foreground border border-border'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Portfolio Summary */}
        <div className="bg-gradient-to-r from-primary/20 to-[#d4a853]/20 rounded-2xl p-4 mb-4 border border-border">
          <p className="text-xs text-muted-foreground">{language === 'ar' ? 'إجمالي المحفظة' : 'Total Portfolio'}</p>
          <p className="text-2xl font-bold text-foreground">{totalPortfolio.toLocaleString()}</p>
          <p className="text-xs text-primary">{data.portfolio.length} {language === 'ar' ? 'استثمارات' : 'investments'}</p>
        </div>

        {/* Screening Tab */}
        {activeTab === 'screening' && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {language === 'ar' ? '✅ معايير الاستثمار الحلال' : '✅ Halal Screening Criteria'}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {language === 'ar'
                ? 'يجب أن تستوفي الشركات هذه المعايير لتكون متوافقة مع الشريعة'
                : 'Companies must meet these criteria to be Shariah-compliant'}
            </p>
            <div className="space-y-3">
              {HALAL_CRITERIA.map((c, i) => (
                <div key={i} className="flex items-center gap-3 bg-background/50 rounded-xl p-3">
                  <span className="text-xl">{c.icon}</span>
                  <span className="text-sm text-foreground">{language === 'ar' ? c.ar : c.en}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-primary/10 rounded-xl p-3">
              <p className="text-xs text-primary">
                {language === 'ar'
                  ? '💡 نصيحة: تحقق دائمًا من شهادة الامتثال الشرعي قبل الاستثمار'
                  : '💡 Tip: Always verify Shariah compliance certification before investing'}
              </p>
            </div>
          </div>
        )}

        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && (
          <div className="space-y-4">
            <div className="bg-card rounded-2xl border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {language === 'ar' ? 'إضافة استثمار' : 'Add Investment'}
              </h3>
              <div className="space-y-2">
                <input
                  value={newInvestment.name}
                  onChange={e => setNewInvestment(p => ({ ...p, name: e.target.value }))}
                  placeholder={language === 'ar' ? 'اسم الاستثمار' : 'Investment Name'}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={newInvestment.amount}
                    onChange={e => setNewInvestment(p => ({ ...p, amount: e.target.value }))}
                    placeholder={language === 'ar' ? 'المبلغ' : 'Amount'}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                  <select
                    value={newInvestment.type}
                    onChange={e => setNewInvestment(p => ({ ...p, type: e.target.value as Investment['type'] }))}
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  >
                    <option value="Stocks">{language === 'ar' ? 'أسهم' : 'Stocks'}</option>
                    <option value="Sukuk">{language === 'ar' ? 'صكوك' : 'Sukuk'}</option>
                    <option value="Real Estate">{language === 'ar' ? 'عقارات' : 'Real Estate'}</option>
                    <option value="Gold">{language === 'ar' ? 'ذهب' : 'Gold'}</option>
                  </select>
                </div>
                <button onClick={addInvestment} className="w-full bg-primary text-white py-2 rounded-lg text-sm font-medium">
                  {language === 'ar' ? 'إضافة' : 'Add Investment'}
                </button>
              </div>
            </div>

            {/* Portfolio List */}
            <div className="space-y-2">
              {data.portfolio.map(inv => (
                <div key={inv.id} className="bg-card rounded-xl border border-border p-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-foreground">{inv.name}</p>
                    <p className="text-xs text-muted-foreground">{inv.type} • {inv.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-primary">{inv.amount.toLocaleString()}</p>
                    <button onClick={() => removeInvestment(inv.id)} className="text-red-400 text-xs">✕</button>
                  </div>
                </div>
              ))}
              {data.portfolio.length === 0 && (
                <p className="text-center text-muted-foreground text-xs py-8">
                  {language === 'ar' ? 'لا توجد استثمارات بعد' : 'No investments yet'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Murabaha Tab */}
        {activeTab === 'murabaha' && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">
              {language === 'ar' ? '🏦 حاسبة المرابحة' : '🏦 Murabaha Calculator'}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {language === 'ar'
                ? 'المرابحة: بيع بالتقسيط مع هامش ربح معلوم'
                : 'Murabaha: Cost-plus financing with known profit margin'}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'سعر التكلفة' : 'Cost Price'}</label>
                <input
                  type="number"
                  value={murabaha.costPrice}
                  onChange={e => setMurabaha(p => ({ ...p, costPrice: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'هامش الربح (%)' : 'Profit Margin (%)'}</label>
                <input
                  type="number"
                  value={murabaha.profitMargin}
                  onChange={e => setMurabaha(p => ({ ...p, profitMargin: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'عدد الأقساط (شهر)' : 'Installments (months)'}</label>
                <input
                  type="number"
                  value={murabaha.installments}
                  onChange={e => setMurabaha(p => ({ ...p, installments: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1"
                />
              </div>
            </div>

            {(murabaha.costPrice && murabaha.profitMargin && murabaha.installments) && (
              <div className="mt-4 bg-primary/10 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{language === 'ar' ? 'السعر الإجمالي' : 'Total Price'}</span>
                  <span className="font-bold text-foreground">{murabahaResult.totalPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{language === 'ar' ? 'الربح' : 'Profit'}</span>
                  <span className="font-bold text-[#d4a853]">{murabahaResult.profit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{language === 'ar' ? 'القسط الشهري' : 'Monthly Payment'}</span>
                  <span className="font-bold text-primary">{Math.round(murabahaResult.monthlyPayment).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ijara Tab */}
        {activeTab === 'ijara' && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">
              {language === 'ar' ? '🏠 حاسبة الإجارة' : '🏠 Ijara Calculator'}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {language === 'ar'
                ? 'الإجارة: تأجير منتهي بالتمليك'
                : 'Ijara: Lease-to-own Islamic financing'}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'قيمة الأصل' : 'Asset Value'}</label>
                <input
                  type="number"
                  value={ijara.assetValue}
                  onChange={e => setIjara(p => ({ ...p, assetValue: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'مدة الإيجار (شهر)' : 'Lease Term (months)'}</label>
                <input
                  type="number"
                  value={ijara.leaseTerm}
                  onChange={e => setIjara(p => ({ ...p, leaseTerm: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'الإيجار الشهري' : 'Monthly Rent'}</label>
                <input
                  type="number"
                  value={ijara.monthlyRent}
                  onChange={e => setIjara(p => ({ ...p, monthlyRent: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1"
                />
              </div>
            </div>

            {(ijara.assetValue && ijara.leaseTerm && ijara.monthlyRent) && (
              <div className="mt-4 bg-primary/10 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{language === 'ar' ? 'إجمالي الإيجار' : 'Total Rent'}</span>
                  <span className="font-bold text-foreground">{ijaraResult.totalRent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{language === 'ar' ? 'المتبقي للتملك' : 'Remaining to Own'}</span>
                  <span className="font-bold text-[#d4a853]">{ijaraResult.remaining.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{language === 'ar' ? 'حالة التملك' : 'Ownership Status'}</span>
                  <span className={`font-bold ${ijaraResult.ownership ? 'text-primary' : 'text-muted-foreground'}`}>
                    {ijaraResult.ownership
                      ? (language === 'ar' ? '✅ مكتمل' : '✅ Complete')
                      : (language === 'ar' ? '⏳ جاري' : '⏳ In Progress')}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Home Ownership Tab */}
        {activeTab === 'home' && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {language === 'ar' ? '🏡 متتبع تملك المنزل' : '🏡 Home Ownership Tracker'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'قيمة العقار' : 'Property Value'}</label>
                <input
                  type="number"
                  value={data.homeOwnership.propertyValue || ''}
                  onChange={e => setData(prev => ({
                    ...prev,
                    homeOwnership: { ...prev.homeOwnership, propertyValue: parseFloat(e.target.value) || 0 },
                  }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'الدفعة المقدمة' : 'Down Payment'}</label>
                <input
                  type="number"
                  value={data.homeOwnership.downPayment || ''}
                  onChange={e => setData(prev => ({
                    ...prev,
                    homeOwnership: { ...prev.homeOwnership, downPayment: parseFloat(e.target.value) || 0 },
                  }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'القسط الشهري' : 'Monthly Installment'}</label>
                <input
                  type="number"
                  value={data.homeOwnership.monthlyInstallment || ''}
                  onChange={e => setData(prev => ({
                    ...prev,
                    homeOwnership: { ...prev.homeOwnership, monthlyInstallment: parseFloat(e.target.value) || 0 },
                  }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'إجمالي المدفوع' : 'Total Paid'}</label>
                <input
                  type="number"
                  value={data.homeOwnership.totalPaid || ''}
                  onChange={e => setData(prev => ({
                    ...prev,
                    homeOwnership: { ...prev.homeOwnership, totalPaid: parseFloat(e.target.value) || 0 },
                  }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1"
                />
              </div>
            </div>

            {data.homeOwnership.propertyValue > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{language === 'ar' ? 'نسبة التملك' : 'Equity %'}</span>
                  <span className="text-primary font-semibold">
                    {Math.round(((data.homeOwnership.downPayment + data.homeOwnership.totalPaid) / data.homeOwnership.propertyValue) * 100)}%
                  </span>
                </div>
                <div className="w-full h-4 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-[#d4a853] rounded-full transition-all"
                    style={{
                      width: `${Math.min(((data.homeOwnership.downPayment + data.homeOwnership.totalPaid) / data.homeOwnership.propertyValue) * 100, 100)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>{(data.homeOwnership.downPayment + data.homeOwnership.totalPaid).toLocaleString()}</span>
                  <span>{data.homeOwnership.propertyValue.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}